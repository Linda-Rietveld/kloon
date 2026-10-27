import { createClient } from 'npm:@supabase/supabase-js@2'
import { corsHeaders, jsonResponse } from './_shared/cors.ts'
import { embedText, generateAnswer } from './_shared/gemini.ts'

const supabaseUrl = Deno.env.get('SUPABASE_URL')
const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')
if (!supabaseUrl || !supabaseAnonKey) throw new Error('Supabase-config ontbreekt.')

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (request.method !== 'POST') return jsonResponse({ error: 'Gebruik POST.' }, 405)

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: request.headers.get('Authorization') ?? '' } },
  })
  const { data: { user }, error: userError } = await supabase.auth.getUser()
  if (userError || !user) return jsonResponse({ error: 'Aanmelden is verplicht.' }, 401)

  try {
    const body = await request.json() as { message?: unknown }
    const message = typeof body.message === 'string' ? body.message.trim() : ''
    if (!message) return jsonResponse({ error: 'Vul een vraag in.' }, 400)

    await supabase.from('clone_settings').upsert({ user_id: user.id }, { onConflict: 'user_id', ignoreDuplicates: true })
    const { data: settings, error: settingsError } = await supabase.from('clone_settings').select('system_prompt').eq('user_id', user.id).single()
    if (settingsError || !settings) throw new Error('Systeemprompt kon niet worden geladen.')

    const matches = await supabase.rpc('match_chunks', { query_embedding: await embedText(message), match_count: 6 })
    if (matches.error) throw new Error(matches.error.message)
    const sources = (matches.data ?? []).map((match: { title: string; content: string; similarity: number; document_id: string }) => ({
      documentId: match.document_id,
      title: match.title,
      excerpt: match.content,
      similarity: match.similarity,
    }))
    const context = sources.map((source, index) => `[Bron ${index + 1}: ${source.title}]\n${source.excerpt}`).join('\n\n') || 'Geen relevante bronnen gevonden.'
    const answer = await generateAnswer(settings.system_prompt, message, context)
    return jsonResponse({ answer, sources })
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Chat mislukt.' }, 500)
  }
})
