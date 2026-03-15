import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

const FALLBACK = {
  clarity: 5,
  confidence: 5,
  technicalDepth: 5,
  conciseness: 5,
  suggestions: [
    'Practice structured answers using the STAR method',
    'Be more specific with technical details and examples',
    'Keep answers concise — aim for 1-2 minutes per response',
    'Prepare questions to ask the interviewer at the end',
  ],
};

export async function POST(req: NextRequest) {
  try {
    const { type, personality, durationSeconds, transcript } = await req.json();

    const transcriptText = (transcript as { text: string; isUser: boolean }[])
      .map((m) => `${m.isUser ? 'Candidate' : 'Interviewer'}: ${m.text}`)
      .join('\n');

    const prompt = `You are an expert technical interview coach. Evaluate the candidate's performance in this mock interview.

Interview type: ${type}
Interviewer style: ${personality}
Duration: ${Math.floor(durationSeconds / 60)}m ${durationSeconds % 60}s

${transcriptText ? `TRANSCRIPT:\n${transcriptText}` : 'No transcript captured. Score conservatively based on the interview type and duration alone.'}

Score the CANDIDATE only (not the interviewer) on each dimension from 1-10. Be honest and precise — vary scores meaningfully based on actual performance. Do not default to average scores:
- clarity: Were answers clear, structured, and easy to follow?
- confidence: Did the candidate sound confident and assertive, without excessive hesitation?
- technical_depth: How technically accurate and deep were the answers? Did they explain trade-offs?
- conciseness: Were answers focused and concise, or did the candidate ramble?

Also write 3-4 specific, actionable coaching tips based on THIS interview — reference what was actually said.

Output ONLY a raw JSON object (no markdown, no explanation, no code fences):
{"clarity": <1-10>, "confidence": <1-10>, "technical_depth": <1-10>, "conciseness": <1-10>, "suggestions": ["tip1", "tip2", "tip3"]}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    // Robustly extract text — handles both string getter and deep path (SDK version differences)
    const rawText: string =
      typeof response.text === 'string'
        ? response.text
        : (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    console.log('[Scorecard] Raw Gemini response:', rawText.slice(0, 300));

    // Extract the JSON object even if Gemini wraps it in text or code fences
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[Scorecard] No JSON found in response:', rawText);
      return NextResponse.json(FALLBACK);
    }

    const raw = JSON.parse(jsonMatch[0]);
    // Normalize snake_case → camelCase
    const scorecard = {
      ...raw,
      technicalDepth: raw.technicalDepth ?? raw.technical_depth ?? FALLBACK.technicalDepth,
    };

    return NextResponse.json(scorecard);
  } catch (err: unknown) {
    console.error('[Scorecard] Error:', err);
    return NextResponse.json(FALLBACK);
  }
}
