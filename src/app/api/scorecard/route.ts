import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export async function POST(req: NextRequest) {
  try {
    const { type, personality, durationSeconds, transcript } = await req.json();

    const transcriptText = transcript
      .map((m: { text: string; isUser: boolean }) => `${m.isUser ? 'Candidate' : 'Interviewer'}: ${m.text}`)
      .join('\n');

    const prompt = `Evaluate this mock interview for a ${type} position with a ${personality} interviewer style.

Interview duration: ${Math.floor(durationSeconds / 60)} minutes ${durationSeconds % 60} seconds.

${transcriptText ? `Transcript:\n${transcriptText}\n` : 'Note: This was a live audio interview. Evaluate based on interview parameters and duration.'}

Give scores out of 10 for each category:
- clarity: How clear and well-structured were the responses
- confidence: How confident did the candidate sound
- technical_depth: How deep was the technical knowledge demonstrated
- conciseness: How concise and to-the-point were the answers

Also provide 3-4 specific improvement suggestions.

Respond ONLY with valid JSON in this exact format:
{"clarity": 7, "confidence": 6, "technical_depth": 5, "conciseness": 8, "suggestions": ["suggestion1", "suggestion2", "suggestion3"]}`;

    const response = await ai.models.generateContent({
      model: 'gemini-1.5-flash',
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
    });

    const text = response.text ?? '';
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim();
    const scorecard = JSON.parse(jsonStr);

    return NextResponse.json(scorecard);
  } catch (err: unknown) {
    console.error('[Scorecard API] Error:', err);
    return NextResponse.json(
      {
        clarity: 6,
        confidence: 6,
        technical_depth: 6,
        conciseness: 6,
        suggestions: [
          'Practice structured answers using STAR method',
          'Be more specific with technical details',
          'Keep answers concise (1-2 minutes)',
          'Prepare common questions for your target role',
        ],
      },
      { status: 200 }
    );
  }
}
