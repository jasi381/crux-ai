// Server-side Groq chat helper. Reused by /api/chat, /api/scorecard, /api/generate-dsa.
// Groq's API is OpenAI-compatible.

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

export interface GroqOptions {
  maxTokens?: number;
  temperature?: number;
  topP?: number;
}

const DEFAULT_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';
const DEFAULT_MODEL = 'llama-3.3-70b-versatile';

export async function callGroq(
  messages: ChatMessage[],
  { maxTokens = 512, temperature = 0.7, topP = 0.95 }: GroqOptions = {},
): Promise<string> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error('GROQ_API_KEY is not set.');
  }

  const baseUrl = process.env.GROQ_BASE_URL ?? DEFAULT_BASE_URL;
  const model = process.env.GROQ_MODEL ?? DEFAULT_MODEL;

  const res = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      top_p: topP,
      max_tokens: maxTokens,
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq ${res.status}: ${await res.text()}`);
  }

  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return (data.choices?.[0]?.message?.content ?? '').trim();
}
