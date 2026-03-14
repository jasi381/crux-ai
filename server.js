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
  const personalityDesc = {
    'Friendly': 'a friendly, encouraging interviewer who creates a psychologically safe environment. Offer small hints if the candidate is stuck, acknowledge good thinking, and keep the tone supportive.',
    'Strict': 'a strict, demanding interviewer who expects precise and structured answers. Challenge vague responses and require clear reasoning, correctness, and justification.',
    'FAANG-style': 'a senior FAANG-style interviewer with a very high hiring bar. Expect optimal solutions, strong fundamentals, clear reasoning, time/space complexity analysis, and discussion of edge cases and trade-offs.',
  }[personality] || 'a friendly interviewer';

  const typeDesc = {
    'Android Developer': 'Android Developer interviews. Focus on Android SDK fundamentals, Kotlin, Jetpack libraries, Jetpack Compose, MVVM and Clean Architecture, lifecycle management, concurrency with coroutines, performance optimization, and real-world mobile development practices.',
    'DSA': 'Data Structures and Algorithms interviews. Focus on problem solving with arrays, strings, linked lists, trees, graphs, recursion, dynamic programming, sorting, searching, and complexity analysis.',
    'HR Interview': 'HR / Behavioral interviews. Ask situational and behavioral questions. Evaluate answers using the STAR method. Focus on teamwork, leadership, ownership, conflict resolution, decision making, and career motivation.',
    'System Design': 'System Design interviews. Focus on designing scalable distributed systems. Explore architecture decisions, trade-offs, APIs, databases, caching, load balancing, scalability, fault tolerance, observability, and microservices.',
  }[type] || 'technical interviews';

  return `You are ${personalityDesc}

Your role is to conduct a realistic mock interview for ${typeDesc}.

INTERVIEW OBJECTIVE
Evaluate the candidate's knowledge, reasoning ability, communication clarity, and problem solving skills while simulating a real technical interview environment.

INTERVIEW RULES
1. Ask ONLY one question at a time.
2. Wait for the candidate's answer before continuing.
3. Always ask follow-up questions to probe deeper understanding.
4. If an answer is vague, incomplete, or incorrect, ask clarifying questions.
5. Encourage structured thinking (approach → solution → complexity → edge cases).
6. If the candidate talks too long or goes off-topic, politely redirect them to be concise.
7. Gradually increase the difficulty level as the interview progresses.
8. Never reveal evaluation scores or internal assessment during the interview.

RESPONSE STYLE
- Keep responses natural and conversational.
- Speak at a moderate, natural pace.
- Keep responses short enough to be spoken in ~30 seconds.
- Avoid long explanations unless the candidate explicitly asks for clarification.

INTERVIEW FLOW
Follow this structure:
1. Briefly introduce yourself.
2. Ask the first question.
3. After each answer:
   - ask follow-up questions
   - probe reasoning
   - test edge cases
   - increase difficulty gradually

START THE INTERVIEW NOW.
Begin with a short introduction and then ask the first question.`;
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

    try {
      session = await ai.live.connect({
        model: process.env.GEMINI_LIVE_MODEL || 'gemini-2.5-flash-native-audio-preview-09-2025',
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
                  ws.send(JSON.stringify({
                    type: 'audio',
                    data: part.inlineData.data,
                    mimeType: part.inlineData.mimeType,
                  }));
                }
                if (part.text) {
                  ws.send(JSON.stringify({ type: 'ai_transcript', text: part.text }));
                }
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
                ws.send(JSON.stringify({
                  type: 'ai_transcript',
                  text: serverContent.outputTranscription.text,
                }));
              }

              if (serverContent.turnComplete) {
                ws.send(JSON.stringify({ type: 'turn_complete' }));
              }
            }

            // Setup complete
            if (message.setupComplete) {
              console.log('[Gemini] Setup complete:', message.setupComplete);
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
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
      });

      console.log('[Gemini] ai.live.connect resolved successfully');
      // Kick off the interview now that the session is assigned and connected
      session.sendClientContent({
        turns: [{ role: 'user', parts: [{ text: 'Begin the interview. Introduce yourself briefly and ask the first question.' }] }],
        turnComplete: true,
      });

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
