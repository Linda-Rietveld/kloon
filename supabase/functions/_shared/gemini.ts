const apiBase = 'https://generativelanguage.googleapis.com/v1beta/models'
const embeddingModel = 'gemini-embedding-001'
const embeddingDimensions = 768
const model = 'gemini-2.0-flash'

type GeminiPart = { text: string }

type GeminiResponse = {
  embedding?: { values?: number[] }
  candidates?: Array<{ content?: { parts?: GeminiPart[] } }>
}

function getConfig() {
  const apiKey = Deno.env.get('GEMINI_API_KEY')

  if (!apiKey) {
    throw new Error('Gemini-config ontbreekt: GEMINI_API_KEY is verplicht.')
  }

  return { apiKey, embeddingModel, dimensions: embeddingDimensions, model }
}

async function callGemini(url: string, body: unknown): Promise<GeminiResponse> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const detail = await response.text()
    throw new Error(`Gemini API-fout (${response.status}): ${detail.slice(0, 500)}`)
  }

  return await response.json() as GeminiResponse
}

export async function embedText(text: string): Promise<number[]> {
  const { apiKey, embeddingModel, dimensions } = getConfig()
  const result = await callGemini(
    `${apiBase}/${encodeURIComponent(embeddingModel)}:embedContent?key=${encodeURIComponent(apiKey)}`,
    {
      model: `models/${embeddingModel}`,
      content: { parts: [{ text }] },
      outputDimensionality: dimensions,
    },
  )

  const values = result.embedding?.values
  if (!values || values.length !== dimensions) {
    throw new Error(`Gemini gaf een embedding met een onverwachte dimensie terug. Verwacht: ${dimensions}.`)
  }
  return values
}

export async function generateAnswer(systemPrompt: string, question: string, context: string): Promise<string> {
  const { apiKey, model } = getConfig()
  const result = await callGemini(
    `${apiBase}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
    {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: `Bronnen:\n${context}\n\nVraag:\n${question}` }] }],
      generationConfig: { temperature: 0.2 },
    },
  )

  const answer = result.candidates?.[0]?.content?.parts?.map((part) => part.text).join(' ').trim()
  if (!answer) {
    throw new Error('Gemini gaf geen antwoord terug.')
  }
  return answer
}
