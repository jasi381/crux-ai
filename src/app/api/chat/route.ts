import { NextRequest, NextResponse } from 'next/server';
import { callGroq, type ChatMessage } from '@/lib/groq';

interface Body {
  messages: ChatMessage[];
  maxTokens?: number;
  temperature?: number;
}

export async function POST(req: NextRequest) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: 'messages[] required' }, { status: 400 });
  }

  try {
    const content = await callGroq(body.messages, {
      maxTokens: body.maxTokens,
      temperature: body.temperature,
    });
    return NextResponse.json({ content });
  } catch (err) {
    console.error('[chat] Groq call failed:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'chat failed' },
      { status: 500 },
    );
  }
}
