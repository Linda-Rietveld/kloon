# Kloon RAG

Een React/Vite-interface voor persoonlijke documenten, met Supabase Storage, pgvector en Gemini via Edge Functions.

## Lokaal starten

1. Kopieer `.env.example` naar `.env.local`.
2. Vul je Supabase anon key in.
3. Installeer dependencies met `npm install`.
4. Start met `npm run dev`.

## Supabase-configuratie

Voer `supabase/migrations/0001_rag_foundation.sql` uit via Supabase-MCP of de SQL Editor. Stel daarna alleen deze Edge Function secret in:

- `GEMINI_API_KEY` (bestaande secret)

De functies gebruiken `gemini-embedding-001` met 768 dimensies en `gemini-2.0-flash`. Deploy daarna de functies `ingest` en `chat`. De functies vereisen een ingelogde gebruiker en verwerken maximaal 10 MB per bestand.
