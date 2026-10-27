export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'error'

export interface DocumentRecord {
  id: string
  title: string
  mime_type: string
  status: DocumentStatus
  error_message: string | null
  created_at: string
}

export interface Source {
  documentId: string
  title: string
  excerpt: string
  similarity: number
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  sources?: Source[]
}
