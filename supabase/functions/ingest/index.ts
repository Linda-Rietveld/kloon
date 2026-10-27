import { createClient } from 'npm:@supabase/supabase-js@2'
import mammoth from 'npm:mammoth@1.8.0'
import pdfParse from 'npm:pdf-parse@1.1.1'
import { corsHeaders, jsonResponse } from './_shared/cors.ts'
import { embedText } from './_shared/gemini.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase-config ontbreekt.')
}

function getClient(request: Request) {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
  })
}

function chunkText(text: string, size = 500, overlap = 60): string[] {
  const words = text.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  const chunks: string[] = []
  for (let start = 0; start < words.length; start += size - overlap) {
    const chunk = words.slice(start, start + size).join(' ').trim()
    if (chunk) chunks.push(chunk)
    if (start + size >= words.length) break
  }
  return chunks
}

async function extractText(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const extension = file.name.split('.').pop()?.toLowerCase()
  if (extension === 'txt' || extension === 'md' || extension === 'csv' || extension === 'json') {
    return new TextDecoder().decode(bytes)
  }
  if (extension === 'docx') {
    const result = await mammoth.extractRawText({ arrayBuffer: bytes.buffer })
    return result.value
  }
  if (extension === 'pdf' || file.type === 'application/pdf') {
    const result = await pdfParse(bytes)
    return result.text
  }
  throw new Error('Bestandstype niet ondersteund. Gebruik PDF, DOCX, TXT, MD, CSV of JSON.')
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Gebruik POST.' }, 405)

  const supabase = getClient(request)
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Aanmelden is verplicht.' }, 401)

  let documentId: string | null = null
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    if (!(file instanceof File)) return jsonResponse({ error: 'Geen bestand ontvangen.' }, 400)
    if (file.size > 10 * 1024 * 1024) return jsonResponse({ error: 'Bestanden mogen maximaal 10 MB zijn.' }, 400)

    const documentIdCandidate = crypto.randomUUID()
    const initialStoragePath = `${user.id}/${documentIdCandidate}-pending`
    const { data: document, error: documentError } = await supabase
      .from('documents')
      .insert({ id: documentIdCandidate, user_id: user.id, title: file.name, mime_type: file.type || 'application/octet-stream', storage_path: initialStoragePath })
      .select('id')
      .single()
    if (documentError || !document) throw new Error(documentError?.message ?? 'Document kon niet worden aangemaakt.')
    documentId = document.id

    const storagePath = `${user.id}/${document.id}-${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(storagePath, file, { upsert: false })
    if (uploadError) throw new Error(uploadError.message)

    await supabase.from('documents').update({ storage_path: storagePath, status: 'processing' }).eq('id', document.id)
    const text = (await extractText(file)).trim()
    if (!text) throw new Error('Er kon geen tekst uit het bestand worden gelezen.')

    const chunks = chunkText(text)
    const rows = []
    for (const [chunkIndex, content] of chunks.entries()) {
      rows.push({ document_id: document.id, user_id: user.id, content, chunk_index: chunkIndex, embedding: await embedText(content) })
    }
    const { error: chunkError } = await supabase.from('chunks').insert(rows)
    if (chunkError) throw new Error(chunkError.message)

    await supabase.from('documents').update({ status: 'ready' }).eq('id', document.id)
    return jsonResponse({ documentId: document.id, title: file.name, chunks: rows.length })
  } catch (error) {
    if (documentId) await supabase.from('documents').update({ status: 'error', error_message: error instanceof Error ? error.message : 'Onbekende fout' }).eq('id', documentId)
    return jsonResponse({ error: error instanceof Error ? error.message : 'Upload mislukt.' }, 500)
  }
})
