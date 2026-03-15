// server.js
const { loadEnvConfig } = require('@next/env');
loadEnvConfig(process.cwd());

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { WebSocketServer, WebSocket } = require('ws');
const { GoogleGenAI, Modality } = require('@google/genai');

const dev = process.env.NODE_ENV !== 'production';
const hostname = '0.0.0.0';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

function buildSystemPrompt(type, personality) {
  const persona = {
    'Friendly': `You are Alex, a senior engineer at a top tech company. You're genuinely encouraging — you want the candidate to succeed and it shows. When someone nails a point, you say so briefly: "Yeah, exactly" or "Good instinct." When they're stuck, offer a small nudge in the right direction without giving the answer away. Keep energy positive but stay professional — this is still a real interview.`,

    'Strict': `You are Morgan, a principal engineer known for an exceptionally high bar. You're not unkind, but you are direct and precise. Praise only when it's truly earned. When an answer is vague, say so plainly: "I need more specifics" or "Walk me through the reasoning, not just the conclusion." Let silence sit after a weak answer — don't fill it. You don't give hints unless the candidate explicitly asks.`,

    'FAANG-style': `You are a Staff Engineer running a bar-raiser loop at a top-five tech company. Your one job: determine whether this candidate raises the average bar of your team. You probe for optimal solutions, production-level thinking, and crisp reasoning under pressure. A brute-force answer must be challenged with "Can we do better?" Communication clarity matters as much as technical depth. One weak answer won't fail them — a pattern of shallow thinking will.`,
  }[personality] || `You are a professional technical interviewer.`;

  const domain = {
    'DSA': `You are interviewing for a Software Engineer role focused on problem solving and algorithms.

The problem is displayed as a card on the candidate's screen — it already shows the test cases and constraints visually. Do NOT read out examples or constraints. When presenting the problem, say only the title and a one-sentence description, then say "the examples are on your screen" and ask "Any questions before you start?" Then wait.

Enforce this candidate sequence: clarify before coding, explain the approach out loud, then implement, then state time and space complexity unprompted. If their solution is O(n²) and a better one exists, ask "Can we do better?" without revealing how. Progress from arrays and strings to trees and graphs to dynamic programming based on performance. Notice whether the candidate asks smart clarifying questions or just jumps straight in — that signal matters.`,

    'Android Developer': `You are interviewing for a Senior Android Engineer role.

Cover these areas in depth, not breadth: Kotlin idioms and coroutines, Jetpack Compose and the recomposition model, MVVM vs MVI and when each makes sense, ViewModel with StateFlow and lifecycle awareness, dependency injection with Hilt, Room and data persistence, and production performance debugging. Ask about real trade-offs, not textbook definitions. Strong questions to use: "Walk me through how recomposition works and how you'd debug excessive recompositions." "How does your architecture handle a process death mid-flow?" "When would you pick WorkManager over a foreground service, and why?" If they share their screen, read their code directly and ask about specific decisions you see.`,

    'HR Interview': `You are conducting a behavioral interview to assess cultural fit, leadership, and problem-solving under ambiguity.

Use the STAR method as your internal evaluation lens but don't mention it. Cover: the project they're most proud of and their specific contribution to its success, a meaningful conflict with a teammate and exactly how they resolved it, a significant failure and what concretely changed in how they work, a time they influenced a decision without having direct authority, and a situation where they disagreed with a decision but had to execute it anyway. When answers sound collective ("we decided to..."), drill in: "What did you personally decide?" "What would have happened if you hadn't been there?" Push for specificity and ownership — vague answers are a signal.`,

    'System Design': `You are interviewing for a Senior Engineer role on system design and architecture.

Start by giving a clear, scoped problem. For example: "Design a URL shortening service like Bitly. Assume hundreds of millions of existing URLs, ten thousand writes per second, and a hundred thousand reads per second. Users should get redirects in under one hundred milliseconds globally." Then say: "Walk me through how you'd approach this. Start by asking me any clarifying questions you need." Then wait for them to lead.

Do not let them skip steps — if they jump straight to architecture without clarifying requirements, stop them: "Let's slow down — what assumptions are you making about scale?" Drive through: requirements and scale estimation, high-level architecture, API design, database and storage decisions, caching strategy, then failure modes and observability. Push deeper after surface answers: "What breaks first at 10x load?" "How do you handle a regional outage?" "What pages you at 3am?" If they share their screen, reference their diagram directly.`,
  }[type] || `Conduct a rigorous and professional technical interview.`;

  return `${persona}

${domain}

VOICE AND CONDUCT
You are speaking out loud in a real-time voice interview. This is audio only — never use backticks, asterisks, bullet points, numbered lists, code blocks, variable names, or any markdown formatting. No "nums equals", no "index zero", no backtick notation. Speak exactly as a human interviewer would speak face to face. Describe everything in plain conversational English. Keep every response under 25 seconds of speaking time. Be direct and purposeful — cut filler phrases.

One question at a time, always. Wait for a complete answer before continuing. After each answer, ask exactly one targeted follow-up that either probes their reasoning or tests an edge case — never let a surface-level answer pass unchallenged.

Listen to how they speak, not just what they say. Hesitation on a topic is signal. If they go quiet for a moment, give them space: "Take your time" or "Think out loud if it helps." If they ramble off-topic, redirect cleanly: "Let me steer us back to the core question." If they share their screen, reference what you see naturally in conversation — don't narrate it constantly.

Never reveal scores or internal assessments during the interview. Never give away answers. Never ask more than one question at a time.

BEGIN NOW. Introduce yourself by first name and role in one sentence. State what kind of interview this is. Then ask your opening question.`;
}

async function generateDSAProblem(ai, specificTitle = null, contextHint = null) {
  let problemSpec;
  if (contextHint) {
    problemSpec = `An interviewer just said the following when transitioning to a new problem: "${contextHint.slice(0, 400)}". Identify the DSA problem being referred to and generate its full canonical details.`;
  } else if (specificTitle) {
    problemSpec = `Generate the DSA problem titled "${specificTitle}". Use its canonical problem statement and examples.`;
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

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
  });
  // Support both response.text (convenience) and the deep path
  const raw = (typeof response.text === 'string' ? response.text : response?.candidates?.[0]?.content?.parts?.[0]?.text ?? '').trim();
  if (!raw) throw new Error('Empty response from generateContent');
  // Strip accidental markdown fences if model adds them despite instructions
  const cleaned = raw.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  return JSON.parse(cleaned);
}

app.prepare().then(() => {
  const server = createServer(async (req, res) => {
    const parsedUrl = parse(req.url, true);
    await handle(req, res, parsedUrl);
  });

  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const parsedUrl = parse(req.url, true);
    if (parsedUrl.pathname === '/api/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on('connection', async (ws, req) => {
    const parsedUrl = parse(req.url, true);
    const interviewType = parsedUrl.query.type || 'DSA';
    const personality = parsedUrl.query.personality || 'Friendly';

    console.log(`[WS] New connection: type=${interviewType}, personality=${personality}`);

    if (!GEMINI_API_KEY) {
      ws.send(JSON.stringify({ type: 'error', message: 'GEMINI_API_KEY not set on server' }));
      ws.close();
      return;
    }

    const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
    let session = null;
    let sessionClosed = false;
    let pendingProblem = null; // set after generation; sent on first AI transcript
    let aiTurnText = '';       // accumulates AI text per turn for problem detection
    let firstTurnDone = false; // skip detection on the very first turn (initial greeting)

    // Kick off problem generation immediately — runs in parallel with session setup
    const problemPromise = interviewType === 'DSA'
      ? generateDSAProblem(ai).catch(e => { console.error('[Gemini] Problem pre-gen failed:', e.message); return null; })
      : Promise.resolve(null);

    try {
      session = await ai.live.connect({
        model: process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('[Gemini] Session onopen callback called');
            ws.send(JSON.stringify({ type: 'status', status: 'connected' }));
          },
          onmessage: (message) => {
            if (ws.readyState !== WebSocket.OPEN) return;
            // console.log('[Gemini] Received message:', JSON.stringify(message).substring(0, 100));

            // Handle server content (audio + text)
            const serverContent = message.serverContent;
            if (serverContent) {
              const parts = serverContent.modelTurn?.parts || [];
              if (parts.length > 0) {
                console.log(`[Gemini] Received serverContent with ${parts.length} parts`);
              }
              for (const part of parts) {
                if (part.inlineData) {
                  // Audio chunk from AI
                  console.log(`[Gemini] Audio chunk: mimeType=${part.inlineData.mimeType}, bytes=${Math.round(part.inlineData.data.length * 0.75)}`);
                  ws.send(JSON.stringify({
                    type: 'audio',
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType,
                  }));
                }
                // part.text is skipped — thinking model leaks reasoning here.
                // Clean speech text comes from outputTranscription below.
              }

              // Input transcription (user's speech)
              if (serverContent.inputTranscription?.text) {
                ws.send(JSON.stringify({
                  type: 'user_transcript',
                  text: serverContent.inputTranscription.text,
                }));
              }

              // Output transcription (AI's speech text)
              if (serverContent.outputTranscription?.text) {
                const chunk = serverContent.outputTranscription.text;
                ws.send(JSON.stringify({ type: 'ai_transcript', text: chunk }));
                aiTurnText += chunk;
                // First AI transcript means Alex is speaking — now reveal the problem card
                if (pendingProblem) {
                  ws.send(JSON.stringify({ type: 'problem', problem: pendingProblem }));
                  pendingProblem = null;
                }
              }

              if (serverContent.turnComplete) {
                ws.send(JSON.stringify({ type: 'turn_complete' }));

                // Detect when the AI introduces a NEW problem mid-session
                if (!firstTurnDone) {
                  firstTurnDone = true;
                } else if (interviewType === 'DSA') {
                  const lower = aiTurnText.toLowerCase();
                  const isNewProblem = [
                    'examples are on your screen',
                    'transition to a different problem',
                    'different problem',
                    "let's move on to",
                    'move on to',
                    'next problem',
                    'new problem',
                    'another problem',
                    "let's try",
                    'next one is',
                  ].some(phrase => lower.includes(phrase));

                  if (isNewProblem) {
                    console.log('[Gemini] Problem transition detected — generating next problem from context');
                    generateDSAProblem(ai, null, aiTurnText)
                      .then(problem => {
                        if (problem && ws.readyState === WebSocket.OPEN) {
                          ws.send(JSON.stringify({ type: 'problem', problem }));
                        }
                      })
                      .catch(e => console.error('[Gemini] Next problem gen failed:', e.message));
                  }
                }

                aiTurnText = ''; // reset for next turn
              }
            }

            // Setup complete — optionally generate DSA problem, then kick off
            if (message.setupComplete) {
              console.log('[Gemini] Setup complete — preparing kick-off');
              (async () => {
                try {
                  let kickoffText = 'Begin.';

                  if (interviewType === 'DSA') {
                    // Await the pre-started promise (already running in parallel with session setup)
                    const problem = await problemPromise;
                    if (problem) {
                      console.log('[Gemini] Problem ready:', problem.title);
                      pendingProblem = problem; // will be sent on first ai_transcript
                      kickoffText = `Begin. Introduce yourself by first name and role in one sentence. Then tell the candidate: "Today's problem is ${problem.title} — ${problem.description} The examples are on your screen. Any questions before you start?"`;
                    }
                  }

                  await session.sendClientContent({
                    turns: [{ role: 'user', parts: [{ text: kickoffText }] }],
                    turnComplete: true,
                  });
                  console.log('[Gemini] Kick-off sent');
                } catch (e) {
                  console.error('[Gemini] Kick-off failed:', e.message);
                }
              })();
            }
          },
          onerror: (e) => {
            console.error('[Gemini] Error callback:', e);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'error', message: e.message || 'Gemini error' }));
            }
          },
          onclose: (e) => {
            console.log(`[Gemini] Session onclose callback (code: ${e.code}, reason: ${e.reason})`);
            sessionClosed = true;
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'status', status: 'disconnected' }));
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: { parts: [{ text: buildSystemPrompt(interviewType, personality) }] },
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });

      console.log('[Gemini] ai.live.connect resolved successfully');
      // Native audio model auto-starts from system prompt — no sendClientContent needed.

    } catch (err) {
      console.error('[WS] Failed to connect to Gemini:', err);
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
      ws.close();
      return;
    }


    // Browser → Gemini: relay audio or text messages
    ws.on('message', async (data) => {
      if (sessionClosed || !session) return;
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'audio') {
          // PCM16 audio from browser microphone
          await session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: 'audio/pcm;rate=16000' },
          });
        } else if (msg.type === 'image') {
          // Vision frame — use `video` field per Google's Live API spec
          await session.sendRealtimeInput({
            video: { data: msg.data, mimeType: msg.mimeType || 'image/jpeg' },
          });
        } else if (msg.type === 'text') {
          await session.sendClientContent({
            turns: [{ role: 'user', parts: [{ text: msg.text }] }],
            turnComplete: true,
          });
        } else if (msg.type === 'end') {
          // Client wants to end the session
          if (!sessionClosed) {
            sessionClosed = true;
            session.close();
          }
        }
      } catch (err) {
        console.error('[WS] Error relaying to Gemini:', err);
      }
    });

    ws.on('close', () => {
      console.log('[WS] Browser disconnected');
      if (!sessionClosed && session) {
        sessionClosed = true;
        try { session.close(); } catch (e) {}
      }
    });

    ws.on('error', (err) => {
      console.error('[WS] WebSocket error:', err);
    });
  });

  server.listen(port, hostname, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
  });
});
