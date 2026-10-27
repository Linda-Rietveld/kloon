# AGENTS.md — Rules voor "Bouw je eigen kloon"

Afgeleid van Team Member Agent Rules v2.0, ingekort voor de workshop.
Stack: React 18 (Vite) + TypeScript + Supabase (Postgres + pgvector, Auth, Storage, Edge Functions).
LLM en embeddingmodel: eigen keuze van het team — niet voorschrijven, wel via config.

---

## 1. Agentgedrag

- **Lees eerst:** dit bestand en `design/DESIGN.md` vóór elke UI-taak.
- **Introspectie (MCP):** controleer bij elke DB-taak de actuele staat via de Supabase-MCP (tabellen, extensies, migraties). Geen aannames uit geheugen.
- **Dependency map:** benoem vóór het coderen wat een wijziging raakt: *"Dit raakt [X], ik doe [Y] om breuken te voorkomen."*
- **Plan-first:** bij wijzigingen in > 3 bestanden eerst een plan (DB, bestanden, wat blijft werken). Wacht op **GO**.
- **Direct technisch:** geen intro's of excuses.

## 2. Mappenstructuur

```
AGENTS.md
design/DESIGN.md            ← export uit Google Stitch
design/screens/*.html       ← referentie, geen productiecode
src/{components,hooks,contexts,types,lib}/
src/index.css               ← design tokens
supabase/{migrations,functions}/
.vscode/mcp.json
```

- Geen nieuwe top-level mappen buiten deze structuur.
- **Drie lagen:** data (Supabase queries + RLS) · logica (custom hooks / pure TS) · view (componenten tonen data, geen queries).
- Bestand > 200 regels → splitsen. Eén verantwoordelijkheid per component.

## 3. Design uit Stitch

- `design/DESIGN.md` is de bron van waarheid voor kleur, typografie, spacing en componentstijl.
- Vertaal DESIGN.md naar CSS custom properties in `src/index.css` (`--color-*`, `--space-*`, `--radius-*`, `--font-*`).
- Stitch-HTML is referentie: herbouw als React-componenten, kopieer geen Tailwind-klassen.
- **Vanilla CSS met tokens:** geen hardcoded hex in componenten, geen inline styles, geen Tailwind.
- Wijkt een scherm af van het design? Meld het, gok niet.

## 4. Architectuur

```
Frontend → Supabase (queries, rpc, Storage, Edge Functions) → LLM
```

- De frontend praat **alleen** met Supabase. Nooit direct met een LLM of andere externe dienst.
- LLM-aanroepen gebeuren in Edge Functions; keys staan uitsluitend als Edge Function secrets.
- Railway/Python alleen als een taak > 30 s duurt of iets nodig heeft dat Edge Functions niet kunnen. Dan: job-tabel + Realtime, geen synchrone lange requests.

## 5. Database

- Elke schemawijziging = nieuw, sequentieel genummerd bestand in `supabase/migrations/`.
- **Expand & contract:** eerst toevoegen, oude velden pas later verwijderen.
- DROP, RENAME, TRUNCATE en bulk-delete: expliciete dubbele bevestiging van de gebruiker.
- `supabase migration repair` is verboden.
- **Elke nieuwe tabel/view:** `ENABLE ROW LEVEL SECURITY` + expliciete GRANTs in hetzelfde migratiebestand. Minimale rechten, nooit `GRANT ALL`. Views: `security_invoker = true`.
- Na schemawijziging eerst TypeScript-types genereren, dan pas code.

## 6. RAG

- `create extension if not exists vector;`
- `documents` (id, user_id, title, storage_bucket, storage_path) en `chunks` (id, document_id, content, embedding vector(N)).
- N = dimensie van het gekozen embeddingmodel; vraag en chunks gebruiken hetzelfde model.
- FK van chunks naar documents: `ON DELETE CASCADE`. Document verwijderen verwijdert ook het bestand in Storage.
- HNSW-index op `embedding` (cosine).
- Zoeken via SQL-functie `match_chunks(query_embedding, match_count)`, aangeroepen met `rpc()`.
- RLS op `user_id`: ieder ziet alleen de eigen kennis.
- Edge Function `ingest`: Storage → tekst → chunks (± 500 tokens, overlap) → embeddings → insert.
- Edge Function `chat`: valideer JWT → embed vraag → `match_chunks` → prompt → LLM → antwoord + bronnen.

## 7. Prompts, secrets en config

- Systeemprompt van de kloon centraal (bijv. tabel `clone_settings`), niet als losse string in code.
- Geen API-keys, tokens of service-URL's in code of git.
- Ontbrekende config = duidelijke fout, geen stille fallback.
- Log geen persoonsgegevens.

## 8. Code

- Strict TypeScript: geen `any`, geen `@ts-ignore`. Interfaces in `src/types/`.
- Comments alleen over het *waarom*.
- Eén concern per commit.
- `tsc --noEmit` of build zonder fouten vóór oplevering.
- Geen hardcoded domeindata; wat kan veranderen komt uit de database.

## 9. UI

- Hit-targets ≥ 44 × 44 px, `env(safe-area-inset-*)` op mobiel.
- Geen `alert()`, `confirm()` of `prompt()`: gebruik een toast-component.
- Iconen uit Lucide, geen emoji.
- Toon bij elk antwoord van de kloon de bronnen, en maak zichtbaar dat het een AI-kloon is.

## 10. Afronden

Een taak is af na deploy, niet na code schrijven:
- Migraties → Supabase-MCP
- Edge Functions → `deploy_edge_function` via MCP
