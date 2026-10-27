import { FormEvent, useEffect, useRef, useState } from 'react'
import { BookOpen, Bot, CheckCircle2, ChevronRight, Copy, FileText, LogOut, Menu, MessageSquare, Mic, MoreHorizontal, Save, Send, ShieldCheck, SlidersHorizontal, Sparkles, Upload, UploadCloud, UserRound } from 'lucide-react'
import { supabase, supabaseConfigError } from './lib/supabase'
import { askClone, getSystemPrompt, listDocuments, saveSystemPrompt, uploadDocument } from './lib/api'
import type { ChatMessage, DocumentRecord } from './types'

function App() {
  const [session, setSession] = useState<boolean | null>(null)
  const [documents, setDocuments] = useState<DocumentRecord[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [prompt, setPrompt] = useState('')
  const [question, setQuestion] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [activeView, setActiveView] = useState<'chat' | 'knowledge' | 'upload'>('chat')
  const [showMobileNav, setShowMobileNav] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (supabaseConfigError) return
    if (window.location.search) window.history.replaceState({}, document.title, window.location.pathname)
    supabase.auth.getSession().then(({ data }) => setSession(Boolean(data.session)))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, currentSession) => setSession(Boolean(currentSession)))
    return () => listener.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (supabaseConfigError) return
    if (!session) return
    Promise.all([listDocuments(), getSystemPrompt()]).then(([nextDocuments, nextPrompt]) => {
      setDocuments(nextDocuments)
      setPrompt(nextPrompt)
    }).catch((error: Error) => setNotice(error.message))
  }, [session])

  async function handleAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const email = String(form.get('email') ?? '')
    const password = String(form.get('password') ?? '')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setNotice('Aanmelden mislukt. Registreer eerst een account en bevestig daarna je e-mailadres via de Supabase-mail.')
  }

  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const data = new FormData(event.currentTarget)
    const email = String(data.get('email') ?? '').trim()
    const password = String(data.get('password') ?? '')
    if (!email || !email.includes('@')) {
      setNotice('Vul eerst een geldig e-mailadres in.')
      return
    }
    if (password.length < 6) {
      setNotice('Je wachtwoord moet minimaal 6 tekens bevatten.')
      return
    }
    const { error } = await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } })
    setNotice(error ? error.message : 'Account aangemaakt. Controleer je inbox en spam op de bevestigingsmail van Supabase.')
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return
    setBusy(true)
    setNotice('Document wordt verwerkt...')
    try {
      await uploadDocument(file)
      setDocuments(await listDocuments())
      setNotice(`${file.name} is toegevoegd aan je kennis.`)
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Upload mislukt.') }
    finally { setBusy(false); event.target.value = '' }
  }

  async function handleQuestion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const message = question.trim()
    if (!message || busy) return
    setQuestion('')
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: message }])
    setBusy(true)
    try {
      const response = await askClone(message)
      setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'assistant', content: response.answer, sources: response.sources }])
    } catch (error) { setNotice(error instanceof Error ? error.message : 'Chat mislukt.') }
    finally { setBusy(false) }
  }

  async function handlePromptSave() {
    setBusy(true)
    try { await saveSystemPrompt(prompt); setNotice('Systeemprompt opgeslagen.') }
    catch (error) { setNotice(error instanceof Error ? error.message : 'Opslaan mislukt.') }
    finally { setBusy(false) }
  }

  if (session === null) return <div className="loading-screen"><Sparkles size={22} /> Laden...</div>
  if (!session) return <AuthScreen onSubmit={handleAuth} onRegister={register} notice={notice} />

  function chooseView(view: 'chat' | 'knowledge' | 'upload') {
    setShowSettings(false)
    setActiveView(view)
    setShowMobileNav(false)
  }

  if (supabaseConfigError) return <ConfigErrorScreen message={supabaseConfigError} />

  return <main className="app-shell">
    <header className="site-header">
      <button className="mobile-menu" title="Menu openen" onClick={() => setShowMobileNav((value) => !value)}><Menu size={19} /></button>
      <button className="brand brand-button" onClick={() => chooseView('chat')}><div className="brand-mark"><Bot size={18} /></div><div><strong>Mijn Kloon</strong><span>persoonlijk AI-archief</span></div></button>
      <nav className={`main-nav ${showMobileNav ? 'mobile-open' : ''}`} aria-label="Hoofdnavigatie">
        <button className={activeView === 'chat' && !showSettings ? 'active' : ''} onClick={() => chooseView('chat')}><MessageSquare size={16} /> Chatgesprek</button>
        <button className={activeView === 'knowledge' ? 'active' : ''} onClick={() => chooseView('knowledge')}><BookOpen size={16} /> Kennisbank</button>
        <button className={activeView === 'upload' ? 'active' : ''} onClick={() => chooseView('upload')}><Upload size={16} /> Documenten uploaden</button>
      </nav>
      <div className="header-actions"><span className="sync-status"><span /> Online &amp; gesynchroniseerd</span><span className="language">NL</span><button className="profile-button" title="Uitloggen" onClick={() => supabase.auth.signOut()}><UserRound size={16} /></button></div>
    </header>
    <section className="workspace">
      {notice && <div className="notice" role="status">{notice}</div>}
      {showSettings ? <SettingsPanel prompt={prompt} setPrompt={setPrompt} onSave={handlePromptSave} busy={busy} /> : activeView === 'chat' ? <ChatView messages={messages} question={question} setQuestion={setQuestion} onSubmit={handleQuestion} busy={busy} onSettings={() => setShowSettings(true)} /> : activeView === 'knowledge' ? <KnowledgeView documents={documents} onUpload={() => chooseView('upload')} /> : <UploadView fileInput={fileInput} onUpload={handleUpload} />}
    </section>
    <input ref={fileInput} hidden type="file" accept=".pdf,.docx,.txt,.md,.csv,.json" onChange={handleUpload} />
  </main>
}

function ConfigErrorScreen({ message }: { message: string }) {
  return <main className="auth-screen"><section className="auth-card config-error"><div className="brand"><div className="brand-mark"><Bot size={18} /></div><div><strong>Mijn Kloon</strong><span>persoonlijk AI-archief</span></div></div><span className="eyebrow">CONFIGURATIE NODIG</span><h1>De omgeving is nog niet verbonden.</h1><p>{message} Voeg deze variabelen toe in Vercel bij <strong>Settings → Environment Variables</strong> en maak daarna een nieuwe deployment:</p><ul><li><code>VITE_SUPABASE_URL</code></li><li><code>VITE_SUPABASE_ANON_KEY</code></li></ul></section></main>
}

function ChatView({ messages, question, setQuestion, onSubmit, busy, onSettings }: { messages: ChatMessage[]; question: string; setQuestion: (value: string) => void; onSubmit: (event: FormEvent<HTMLFormElement>) => void; busy: boolean; onSettings: () => void }) {
  return <div className="page-stack chat-page"><div className="page-heading"><div><span className="eyebrow">AI-KLOON / CHATGESPREK</span><h1>Dialoog met je kloon</h1><p>Stel vragen aan je eigen kennis en ontdek de bronnen achter elk antwoord.</p></div><div className="heading-actions"><button className="secondary-button" title="Systeemprompt openen" onClick={onSettings}><SlidersHorizontal size={16} /> Instellingen</button><button className="icon-button" title="Meer opties"><MoreHorizontal size={18} /></button></div></div><div className="dialogue-card"><div className="dialogue-toolbar"><span><ShieldCheck size={16} /> Antwoorden met bronvermelding</span><button className="quiet-button" title="Gesprek kopiëren"><Copy size={15} /> Kopieer gesprek</button></div><div className="chat-area">{messages.length === 0 && <div className="empty-state"><div className="empty-icon"><Bot size={24} /></div><h2>Waar wil je vandaag in duiken?</h2><p>Je kloon doorzoekt je documenten en maakt zichtbaar waarop een antwoord gebaseerd is.</p><div className="prompt-chips"><button onClick={() => setQuestion('Vat mijn belangrijkste documenten samen')}>Vat mijn kennis samen</button><button onClick={() => setQuestion('Welke thema’s komen vaak terug?')}>Welke thema&apos;s keren terug?</button></div></div>}{messages.map((message) => <article className={`message ${message.role}`} key={message.id}><div className="message-icon">{message.role === 'assistant' ? <Bot size={16} /> : <UserRound size={16} />}</div><div className="message-body"><p>{message.content}</p>{message.sources && message.sources.length > 0 && <div className="sources"><span className="sources-label">Geverifieerde bronnen</span>{message.sources.map((source, index) => <div className="source" key={`${message.id}-${source.documentId}-${source.excerpt.slice(0, 10)}`}><span className="source-number">{index + 1}</span><FileText size={14} /><span>{source.title}</span><small>{Math.round(source.similarity * 100)}%</small><ChevronRight size={14} /></div>)}</div>}</div></article>)}</div><form className="composer" onSubmit={onSubmit}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="Stel een inhoudelijke vraag aan je kloon..." rows={2} disabled={busy} /><div className="composer-actions"><button type="button" className="icon-button" title="Spreek vraag in"><Mic size={17} /></button><button className="primary-button" title="Vraag versturen" disabled={busy || !question.trim()}><Send size={16} /> Vraag stellen</button></div></form></div></div>
}

function KnowledgeView({ documents, onUpload }: { documents: DocumentRecord[]; onUpload: () => void }) {
  return <div className="page-stack"><div className="page-heading"><div><span className="eyebrow">KENNISBANK</span><h1>Je kennisarchief</h1><p>Beheer de documenten waarop je kloon zijn antwoorden baseert.</p></div><button className="primary-button" onClick={onUpload}><Upload size={16} /> Document toevoegen</button></div><div className="document-grid">{documents.length === 0 ? <div className="empty-panel"><BookOpen size={24} /><h2>Nog geen documenten</h2><p>Voeg je eerste bron toe om je persoonlijke kennisbank op te bouwen.</p><button className="secondary-button" onClick={onUpload}>Eerste document uploaden</button></div> : documents.map((document) => <article className="document-card" key={document.id}><div className="document-icon"><FileText size={19} /></div><div><h2>{document.title}</h2><p>{document.mime_type || 'Document'} <span className={`status ${document.status}`}>{document.status}</span></p></div><ChevronRight size={17} /></article>)}</div></div>
}

function UploadView({ fileInput, onUpload }: { fileInput: React.RefObject<HTMLInputElement>; onUpload: (event: React.ChangeEvent<HTMLInputElement>) => void }) {
  return <div className="page-stack narrow-page"><div className="page-heading"><div><span className="eyebrow">KENNISBANK / TOEVOEGEN</span><h1>Documenten uploaden</h1><p>Geef je kloon de context die hij nodig heeft om jou goed te begrijpen.</p></div></div><button className="upload-zone" onClick={() => fileInput.current?.click()}><UploadCloud size={34} /><strong>Sleep bestanden hierheen of blader door je apparaat</strong><span>PDF, DOCX, TXT, MD, CSV of JSON tot 10 MB</span></button><div className="parameter-panel"><div><SlidersHorizontal size={18} /><div><h2>Verwerkings- &amp; contextparameters</h2><p>Nieuwe documenten worden automatisch verwerkt en doorzoekbaar gemaakt.</p></div></div><CheckCircle2 size={21} className="check-icon" /></div></div>
}

function SettingsPanel({ prompt, setPrompt, onSave, busy }: { prompt: string; setPrompt: (value: string) => void; onSave: () => void; busy: boolean }) {
  return <div className="page-stack narrow-page"><div className="page-heading"><div><span className="eyebrow">INSTELLINGEN</span><h1>Systeemprompt</h1><p>Geef je kloon een vaste toon en een duidelijke manier van antwoorden.</p></div></div><section className="settings-panel"><textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Beschrijf hoe je kloon moet antwoorden..." /><button className="primary-button" onClick={onSave} disabled={busy}><Save size={16} /> Prompt opslaan</button></section></div>
}

function AuthScreen({ onSubmit, onRegister, notice }: { onSubmit: (event: FormEvent<HTMLFormElement>) => void; onRegister: (event: FormEvent<HTMLFormElement>) => void; notice: string }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const isRegistering = mode === 'register'
  return <main className="auth-screen"><div className="auth-card"><div className="brand"><div className="brand-mark"><Bot size={21} /></div><div><strong>Kloon</strong><span>persoonlijke kennis</span></div></div><span className="eyebrow">PRIVÉ KENNISWERKPLEK</span><h1>{isRegistering ? 'Maak je kennisplek.' : 'Praat met wat je weet.'}</h1><p>{isRegistering ? 'Maak een account om je eigen documenten en gesprekken te bewaren.' : 'Een rustige plek voor je documenten, vragen en bronnen.'}</p><form id="auth-form" onSubmit={isRegistering ? onRegister : onSubmit}><label>E-mail<input name="email" type="email" autoComplete="email" required /></label><label>Wachtwoord<input name="password" type="password" autoComplete={isRegistering ? 'new-password' : 'current-password'} minLength={6} required /></label><button className="primary-button" type="submit">{isRegistering ? <><UserRound size={17} /> Account aanmaken</> : <><LogOut size={17} /> Aanmelden</>}</button></form><button className="text-button" onClick={() => setMode(isRegistering ? 'login' : 'register')}>{isRegistering ? 'Terug naar aanmelden' : 'Account registreren'}</button>{notice && <div className="notice">{notice}</div>}</div></main>
}

export default App
