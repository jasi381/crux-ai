import { NextResponse } from 'next/server';
import { callGroq } from '@/lib/groq';

interface Body {
  contextHint?: string;
  specificTitle?: string;
}

export async function POST(request: Request) {
  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: 'GROQ_API_KEY not set' }, { status: 500 });
  }

  let body: Body = {};
  try {
    body = (await request.json()) as Body;
  } catch {
    // empty body is fine — random problem
  }

  let problemSpec: string;
  if (body.contextHint) {
    problemSpec = `An interviewer just said the following when transitioning to a new problem: "${body.contextHint.slice(0, 400)}". Identify the DSA problem being referred to and generate its full canonical details.`;
  } else if (body.specificTitle) {
    problemSpec = `Generate the DSA problem titled "${body.specificTitle}". Use its canonical problem statement and examples.`;
  } else {
    problemSpec = `Generate a random DSA interview problem. Pick any classic problem from: arrays, hashmaps, two pointers, sliding window, binary search, linked lists, stacks, or trees. Prefer Medium difficulty.`;
  }

  const prompt = `${problemSpec} Return ONLY valid JSON — no markdown, no code blocks, no extra text. Use exactly this schema:
{
  "title": "Problem Name",
  "description": "Clear problem statement in 2-3 sentences.",
  "testCases": [
    {"input": "nums = [2,7,11,15], target = 9", "output": "[0, 1]", "explanation": "Because nums[0] + nums[1] == 9, we return [0, 1]."},
    {"input": "nums = [3,2,4], target = 6", "output": "[1, 2]", "explanation": "nums[1] + nums[2] == 6, so we return [1, 2]."},
    {"input": "nums = [3,3], target = 6", "output": "[0, 1]", "explanation": "nums[0] + nums[1] == 6, so we return [0, 1]."}
  ],
  "constraints": ["2 <= nums.length <= 10^4", "Each input has exactly one solution"],
  "difficulty": "Medium"
}
Rules:
- Use realistic, concrete test case values — never variable names or pseudocode.
- The "explanation" field must be a concise 1-2 sentence walkthrough of WHY the output is correct for that specific input, like LeetCode's explanation style.`;

  try {
    const raw = await callGroq(
      [{ role: 'user', content: prompt }],
      { maxTokens: 800, temperature: 0.7 },
    );
    if (!raw) throw new Error('Empty response from Groq');
    const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
    const problem = JSON.parse(cleaned);
    return NextResponse.json(problem);
  } catch (err) {
    console.error('[generate-dsa] error', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'generation failed' },
      { status: 500 },
    );
  }
}
