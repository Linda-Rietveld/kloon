import { supabase } from './supabase'
import type { DocumentRecord, Source } from '../types'

interface ChatResponse {
  answer: string
  sources: Source[]
}

interface IngestResponse {
  documentId: string
  title: string
  chunks: number
}

export async function listDocuments(): Promise<DocumentRecord[]> {
  const { data, error } = await supabase.from('documents').select('id,title,mime_type,status,error_message,created_at').order('created_at', { ascending: false })
  if (error) throw new Error(error.message)
  return data ?? []
}

export async function uploadDocument(file: File): Promise<IngestResponse> {
  const formData = new FormData()
  formData.append('file', file)
  const { data, error } = await supabase.functions.invoke<IngestResponse>('ingest', { body: formData })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Geen uploadresultaat ontvangen.')
  return data
}

export async function askClone(message: string): Promise<ChatResponse> {
  const { data, error } = await supabase.functions.invoke<ChatResponse>('chat', { body: { message } })
  if (error) throw new Error(error.message)
  if (!data) throw new Error('Geen chatresultaat ontvangen.')
  return data
}

export async function getSystemPrompt(): Promise<string> {
  const { data, error } = await supabase.from('clone_settings').select('system_prompt').maybeSingle()
  if (error) throw new Error(error.message)
  return data?.system_prompt ?? ''
}

export async function saveSystemPrompt(systemPrompt: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Aanmelden is verplicht.')
  const { error } = await supabase.from('clone_settings').upsert({ user_id: user.id, system_prompt: systemPrompt, updated_at: new Date().toISOString() })
  if (error) throw new Error(error.message)
}
