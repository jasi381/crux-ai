'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TranscriptMessage, Scorecard } from '@/types/interview';
import { db, auth } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';

function InterviewContent() {
  const router = useRouter();
  const params = useSearchParams();
  const interviewType = params.get('type') || 'DSA';
  const personality = params.get('personality') || 'Friendly';

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [status, setStatus] = useState<'connecting' | 'connected' | 'ended' | 'error'>(
    'connecting'
  );
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [duration, setDuration] = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSpeaker, setLastSpeaker] = useState<'ai' | 'user' | null>('ai');
  const [userInput, setUserInput] = useState('');
  const [micPermission, setMicPermission] = useState<PermissionState | 'not-supported'>('prompt');
  const micPermissionRef = useRef<PermissionState | 'not-supported'>('prompt');
  
  useEffect(() => {
    micPermissionRef.current = micPermission;
  }, [micPermission]);

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef<TranscriptMessage[]>([]);
  const durationRef = useRef(0);
  const orbCanvasRef = useRef<HTMLCanvasElement>(null);
  const orbAnimRef = useRef<number>(0);
  const orbPhaseRef = useRef(0);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const userIdRef = useRef<string | null>(null);
  const statusRef = useRef<string>('connecting');
  const nextStartTimeRef = useRef(0);

  // Track auth user
  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      userIdRef.current = u?.uid ?? null;
    });
  }, []);

  // Animated orb
  useEffect(() => {
    const canvas = orbCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const size = (canvas.width = canvas.height = canvas.offsetWidth);
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2,
        cy = size / 2;
      const t = orbPhaseRef.current;
      const isAI = lastSpeaker !== 'user';
      const primary = isAI ? '#A78BFA' : '#22D3EE';
      const secondary = isAI ? '#22D3EE' : '#34D399';
      const breathe = 0.92 + 0.08 * Math.sin(t * 2.6);

      // Pulse rings
      for (let r = 0; r < 3; r++) {
        const pulseT = Math.sin(t * 2.2 + r * 2.1) * 0.5 + 0.5;
        const ringR = size * (0.44 + r * 0.07 + pulseT * 0.04) * breathe;
        ctx.strokeStyle =
          (r % 2 === 0 ? primary : secondary) +
          Math.round(0.1 * pulseT * 255)
            .toString(16)
            .padStart(2, '0');
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Rotating arcs
      for (let r = 0; r < 4; r++) {
        const ringR = size * (0.36 + r * 0.09) * breathe;
        const startAngle =
          ((r % 2 === 0 ? t * 0.7 : -t * 0.5) + r * 0.7) % (Math.PI * 2);
        const sweep = Math.PI * (1.6 - r * 0.12);
        ctx.strokeStyle =
          (r % 2 === 0 ? primary : secondary) +
          Math.round((0.55 - r * 0.1) * 255)
            .toString(16)
            .padStart(2, '0');
        ctx.lineWidth = 2.2 - r * 0.35;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(cx, cy, ringR, startAngle, startAngle + sweep);
        ctx.stroke();
      }

      // Inner morphing orb layers
      for (let l = 0; l < 7; l++) {
        const phaseOff = l * 0.88;
        const orbR = size * (0.16 + l * 0.042) * breathe;
        const dx = Math.sin(t + phaseOff) * 8;
        const dy = Math.cos(t * 0.72 + phaseOff) * 8;
        const a = 0.24 - l * 0.027;
        const color =
          l % 3 === 0 ? primary : l % 3 === 1 ? secondary : isAI ? '#34D399' : primary;
        const grad = ctx.createRadialGradient(cx + dx, cy + dy, 0, cx + dx, cy + dy, orbR);
        grad.addColorStop(
          0,
          color + Math.round(a * 255).toString(16).padStart(2, '0')
        );
        grad.addColorStop(1, 'transparent');
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(cx + dx, cy + dy, orbR, 0, Math.PI * 2);
        ctx.fill();
      }

      // Bright core
      const coreGrad = ctx.createRadialGradient(
        cx,
        cy,
        0,
        cx,
        cy,
        size * 0.15 * breathe
      );
      coreGrad.addColorStop(0, 'rgba(255,255,255,0.18)');
      coreGrad.addColorStop(0.4, primary + 'A8');
      coreGrad.addColorStop(1, 'transparent');
      ctx.fillStyle = coreGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.15 * breathe, 0, Math.PI * 2);
      ctx.fill();

      // Orbiting particles
      for (let p = 0; p < 12; p++) {
        const angle = t * 1.25 + p * ((Math.PI * 2) / 12);
        const orbitR = size * 0.4 * breathe;
        const px = cx + Math.cos(angle) * orbitR;
        const py = cy + Math.sin(angle) * orbitR;
        const pa = 0.55 + Math.sin(t + p * 0.45) * 0.3;
        const pColor =
          p % 3 === 0 ? primary : p % 3 === 1 ? secondary : isAI ? '#34D399' : '#22D3EE';
        ctx.fillStyle =
          pColor +
          Math.round(Math.max(0.08, Math.min(0.72, pa)) * 255)
            .toString(16)
            .padStart(2, '0');
        ctx.beginPath();
        ctx.arc(px, py, p % 3 === 0 ? 2.5 : p % 3 === 1 ? 1.8 : 1.2, 0, Math.PI * 2);
        ctx.fill();
      }

      orbPhaseRef.current += 0.025;
      orbAnimRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(orbAnimRef.current);
  }, [lastSpeaker]);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // Timer
  const startTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // PCM16 conversion
  const floatToPCM16 = (floatSamples: Float32Array): Int16Array => {
    const pcm = new Int16Array(floatSamples.length);
    for (let i = 0; i < floatSamples.length; i++) {
      const s = Math.max(-1, Math.min(1, floatSamples[i]));
      pcm[i] = s < 0 ? s * 32768 : s * 32767;
    }
    return pcm;
  };

  const toBase64 = (buffer: ArrayBuffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    return btoa(binary);
  };

  // Check for mic permission on mount
  useEffect(() => {
    if (typeof navigator !== 'undefined' && navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'microphone' as PermissionName }).then((result) => {
        setMicPermission(result.state);
        result.onchange = () => setMicPermission(result.state);
      });
    } else {
      setMicPermission('not-supported');
    }
  }, []);

  const handleRequestMic = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach(t => t.stop());
      setMicPermission('granted');
    } catch (err) {
      console.error('Mic permission denied:', err);
      setMicPermission('denied');
    }
  };

  const micInitializedRef = useRef(false);

  const initMicrophone = useCallback(async () => {
    if (micInitializedRef.current || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      streamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
      // eslint-disable-next-line @typescript-eslint/no-deprecated
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
        if (statusRef.current !== 'connected') return;
        const samples = e.inputBuffer.getChannelData(0);
        const pcm = floatToPCM16(samples);
        const b64 = toBase64(pcm.buffer as ArrayBuffer);
        wsRef.current.send(JSON.stringify({ type: 'audio', data: b64 }));
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      micInitializedRef.current = true;
    } catch (err) {
      console.error('Mic error:', err);
    }
  }, []);

  // Initialize mic if permission is granted later
  useEffect(() => {
    if (micPermission === 'granted' && status === 'connected') {
      initMicrophone();
    }
  }, [micPermission, status, initMicrophone]);

  // Connect to WebSocket and mic
  const connect = useCallback(async () => {
    micInitializedRef.current = false;
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${wsProtocol}://${window.location.host}/api/ws?type=${encodeURIComponent(interviewType)}&personality=${encodeURIComponent(personality)}`;
      const ws = new WebSocket(wsUrl);
      ws.binaryType = 'arraybuffer';
      wsRef.current = ws;

      ws.onopen = async () => {
        // Start mic if granted
        if (micPermissionRef.current === 'granted') {
          initMicrophone();
        }
        
        // Always set connected once WS is open
        setStatus('connected');
        statusRef.current = 'connected';
        startTimer();
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data as string);

        if (msg.type === 'status' && msg.status === 'connected') {
          // Handled by ws.onopen usually, but keeping for robustness
          setStatus('connected');
          statusRef.current = 'connected';
        }

        if (msg.type === 'audio' && msg.data) {
          // Play AI audio
          try {
            const raw = atob(msg.data);
            const buf = new ArrayBuffer(raw.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);

            // Ensure even length for Int16Array
            if (buf.byteLength % 2 !== 0) {
               console.warn('Received odd number of bytes for audio, skipping...');
               return;
            }

            const actx = audioCtxRef.current || new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
            if (!audioCtxRef.current) audioCtxRef.current = actx;

            // Resume context if suspended (browser requirement for playback)
            if (actx.state === 'suspended') {
              await actx.resume();
            }

            // PCM16 24kHz from Gemini
            const sampleRate = 24000;
            const samples = new Int16Array(buf);
            const float = new Float32Array(samples.length);
            for (let i = 0; i < samples.length; i++) float[i] = samples[i] / 32768;
            
            const audioBuf = actx.createBuffer(1, float.length, sampleRate);
            audioBuf.copyToChannel(float, 0);
            const src = actx.createBufferSource();
            src.buffer = audioBuf;
            src.connect(actx.destination);
            
            // Scheduling logic
            const now = actx.currentTime;
            if (nextStartTimeRef.current < now) {
              nextStartTimeRef.current = now;
            }
            src.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuf.duration;
          } catch (e) {
            console.error('Audio playback error:', e);
          }
        }

        if (msg.type === 'user_transcript' && msg.text) {
          setLastSpeaker('user');
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last?.isUser) {
              const updated = [
                ...prev.slice(0, -1),
                { ...last, text: last.text + ' ' + msg.text },
              ];
              transcriptRef.current = updated;
              return updated;
            }
            const updated = [
              ...prev,
              { text: msg.text, isUser: true, timestamp: Date.now() },
            ];
            transcriptRef.current = updated;
            return updated;
          });
        }

        if (msg.type === 'ai_transcript' && msg.text) {
          setLastSpeaker('ai');
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && !last.isUser) {
              const updated = [
                ...prev.slice(0, -1),
                { ...last, text: last.text + ' ' + msg.text },
              ];
              transcriptRef.current = updated;
              return updated;
            }
            const updated = [
              ...prev,
              { text: msg.text, isUser: false, timestamp: Date.now() },
            ];
            transcriptRef.current = updated;
            return updated;
          });
        }

        if (msg.type === 'error') {
          setErrorMsg(msg.message || 'Failed to connect to Gemini');
          statusRef.current = 'error';
          setStatus('error');
        }
      };

      ws.onclose = () => {
        // Don't overwrite 'error' status — only mark ended if session was normal
        if (statusRef.current !== 'ended' && statusRef.current !== 'error') {
          setStatus('ended');
        }
      };

      ws.onerror = () => {
        statusRef.current = 'error';
        setErrorMsg('WebSocket connection failed');
        setStatus('error');
      };
    } catch (err) {
      console.error('Connect error:', err);
      setStatus('error');
    }
  }, [interviewType, personality, startTimer]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      cancelAnimationFrame(orbAnimRef.current);
    };
  }, [connect]);

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || status !== 'connected') return;
    
    wsRef.current?.send(JSON.stringify({ type: 'text', text: userInput }));
    
    setTranscript(prev => {
       const updated = [...prev, { text: userInput, isUser: true, timestamp: Date.now() }];
       transcriptRef.current = updated;
       return updated;
    });
    setLastSpeaker('user');
    setUserInput('');
  };

  const handleEndInterview = async () => {
    setIsGenerating(true);
    statusRef.current = 'ended';
    if (timerRef.current) clearInterval(timerRef.current);

    // Stop mic
    processorRef.current?.disconnect();
    sourceRef.current?.disconnect();
    streamRef.current?.getTracks().forEach((t) => t.stop());

    // Close WS
    wsRef.current?.send(JSON.stringify({ type: 'end' }));
    wsRef.current?.close();

    try {
      // Generate scorecard
      const res = await fetch('/api/scorecard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: interviewType,
          personality,
          durationSeconds: durationRef.current,
          transcript: transcriptRef.current,
        }),
      });
      const scorecard: Scorecard = await res.json();

      // Save to Firestore
      const uid = userIdRef.current || 'anonymous';
      try {
        await addDoc(collection(db, 'users', uid, 'interviews'), {
          timestamp: serverTimestamp(),
          type: interviewType,
          personality,
          durationSeconds: durationRef.current,
          scorecard: {
            clarity: scorecard.clarity,
            confidence: scorecard.confidence,
            technicalDepth:
              scorecard.technicalDepth ??
              (scorecard as unknown as Record<string, number>)['technical_depth'],
            conciseness: scorecard.conciseness,
            suggestions: scorecard.suggestions,
          },
          transcript: transcriptRef.current.map((m) => ({ text: m.text, isUser: m.isUser })),
        });
      } catch (e) {
        console.warn('Firestore save failed:', e);
      }

      // Navigate to scorecard
      sessionStorage.setItem('scorecard', JSON.stringify(scorecard));
      sessionStorage.setItem(
        'interviewMeta',
        JSON.stringify({ type: interviewType, personality, duration: durationRef.current })
      );
      router.push('/scorecard');
    } catch (err) {
      console.error('Scorecard error:', err);
      setIsGenerating(false);
    }
  };

  const [isAudioSuspended, setIsAudioSuspended] = useState(false);

  // ... (inside InterviewContent)
  useEffect(() => {
    const checkAudio = setInterval(() => {
      if (audioCtxRef.current?.state === 'suspended') {
        setIsAudioSuspended(true);
      } else if (audioCtxRef.current?.state === 'running') {
        setIsAudioSuspended(false);
      }
    }, 1000);
    return () => clearInterval(checkAudio);
  }, []);

  const resumeAudio = async () => {
    if (audioCtxRef.current) {
      await audioCtxRef.current.resume();
      setIsAudioSuspended(false);
    }
  };
  const speakerLabel =
    status !== 'connected'
      ? status === 'connecting'
        ? 'Connecting…'
        : status === 'error'
          ? 'Error'
          : 'Ended'
      : lastSpeaker === 'ai'
        ? 'AI speaking'
        : 'You speaking';
  const dotColor = lastSpeaker === 'user' ? 'bg-cyan-400' : 'bg-violet-400';

  return (
    <div className="fixed inset-0 bg-[#0A0A0F] flex flex-col overflow-hidden">
      {/* Top HUD */}
      <div className="flex items-center px-5 py-4 flex-shrink-0">
        <div className="flex-1">
          <div className="font-bold text-white text-base">{interviewType}</div>
          <div className="text-xs text-white/50">{personality} interviewer</div>
        </div>
        <div
          className={`flex items-center gap-2 px-3.5 py-1.5 rounded-full border text-xs font-bold tracking-widest
          ${
            status === 'connected'
              ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-400'
              : 'border-white/20 bg-white/5 text-white/50'
          }`}
        >
          {status === 'connected' && (
            <div className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
          )}
          {formatDuration(duration)}
        </div>
        <button
          onClick={() => router.push('/')}
          className="ml-3 w-9 h-9 rounded-full bg-white/5 border border-white/15 flex items-center justify-center text-white/60 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Central orb */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        {status === 'connected' && micPermission !== 'granted' && (
          <div className="absolute top-10 left-1/2 -translate-x-1/2 z-30 w-[90%] max-w-sm">
            <div className="bg-[#1A1A24] border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-xl">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-400/10 flex items-center justify-center flex-shrink-0">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#22D3EE" strokeWidth="2">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v4M8 23h8"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-white font-bold text-sm mb-1">Enable Microphone</h3>
                  <p className="text-xs text-white/50 leading-relaxed mb-3">
                    {micPermission === 'denied' 
                      ? "Microphone access is blocked. Please enable it in your browser settings to use voice features."
                      : "We need microphone access to hear your responses for a realistic interview experience."}
                  </p>
                  {micPermission !== 'denied' && (
                    <button
                      onClick={handleRequestMic}
                      className="w-full py-2 rounded-lg bg-cyan-400 text-[#0A0A0F] text-xs font-bold hover:bg-cyan-300 transition-colors"
                    >
                      Grant Access
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        {status === 'error' ? (
          <div className="flex flex-col items-center gap-4 px-8 text-center">
            <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center text-2xl">✕</div>
            <div>
              <p className="text-white font-semibold mb-1">Connection Failed</p>
              <p className="text-xs text-white/50 max-w-xs">{errorMsg || 'Could not connect to Gemini'}</p>
            </div>
            <button onClick={() => router.push('/')}
              className="px-5 py-2.5 rounded-xl text-[#0A0A0F] text-sm font-bold relative overflow-hidden">
              <div className="absolute inset-0" style={{ background: 'linear-gradient(90deg, #22D3EE, #A78BFA)' }} />
              <span className="relative z-10">Try Again</span>
            </button>
          </div>
        ) : (
          <>
            {isAudioSuspended && status === 'connected' && (
              <button 
                onClick={resumeAudio}
                className="absolute z-20 px-6 py-3 rounded-2xl bg-cyan-400 text-[#0A0A0F] font-bold shadow-lg shadow-cyan-400/20 animate-bounce"
              >
                Click to Enable Audio 🔊
              </button>
            )}
            <canvas
              ref={orbCanvasRef}
              className="w-64 h-64 md:w-72 md:h-72"
              style={{ imageRendering: 'pixelated' }}
            />
            {/* Speaker pill */}
            <div className="mt-4 flex items-center gap-2.5 px-4 py-2 rounded-full bg-white/5 border border-white/15">
              <div className="relative flex items-center justify-center">
                {status === 'connected' && (
                  <div className={`absolute w-4 h-4 rounded-full ${dotColor} opacity-30 animate-pulse`} />
                )}
                <div className={`w-2 h-2 rounded-full ${status === 'connected' ? dotColor : 'bg-white/30'}`} />
              </div>
              <span className="text-xs text-white/70 tracking-wide">{speakerLabel}</span>
            </div>
          </>
        )}
      </div>

      {/* Bottom: transcript + end button */}
      <div
        className="flex-shrink-0"
        style={{
          background:
            'linear-gradient(to bottom, transparent, rgba(10,10,15,0.9) 30%, #0A0A0F)',
        }}
      >
        {/* Transcript */}
        <div className="h-36 overflow-y-auto px-5 space-y-2 py-2">
          {transcript.length === 0 && status === 'connected' && (
            <p className="text-center text-white/30 text-xs py-4">
              Transcript will appear here as you speak…
            </p>
          )}
          {transcript.slice(-8).map((msg, i) => (
            <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'}`}>
              <div className="max-w-[80%]">
                <div
                  className={`text-[10px] mb-0.5 px-1 ${msg.isUser ? 'text-cyan-400/60 text-right' : 'text-violet-400/60'}`}
                >
                  {msg.isUser ? 'You' : 'Interviewer'}
                </div>
                <div
                  className={`px-3 py-2 rounded-2xl text-xs leading-relaxed
                  ${
                    msg.isUser
                      ? 'bg-cyan-400/10 border border-cyan-400/15 text-white/90 rounded-br-sm'
                      : 'bg-violet-400/10 border border-violet-400/10 text-white/90 rounded-bl-sm'
                  }`}
                >
                  {msg.text}
                </div>
              </div>
            </div>
          ))}
          <div ref={transcriptEndRef} />
        </div>

        {/* Text input and End button */}
        <div className="px-5 pb-8 pt-3 space-y-3">
          {status === 'connected' && !isGenerating && (
            <form onSubmit={handleSendText} className="flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="Type your response..."
                className="flex-1 h-12 bg-white/5 border border-white/10 rounded-xl px-4 text-sm text-white focus:outline-none focus:border-cyan-400/50 transition-colors"
              />
              <button
                type="submit"
                disabled={!userInput.trim()}
                className="w-12 h-12 flex items-center justify-center rounded-xl bg-cyan-400 text-[#0A0A0F] disabled:opacity-40 disabled:grayscale transition-all hover:scale-[1.05] active:scale-[0.95]"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="m5 12 14-7-7 14-2-7-5-2Z" />
                </svg>
              </button>
            </form>
          )}

          {isGenerating ? (
            <div className="w-full h-14 rounded-2xl bg-white/5 border border-white/15 flex items-center justify-center gap-3">
              <div className="w-5 h-5 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
              <span className="text-cyan-400 text-sm">Analyzing your interview…</span>
            </div>
          ) : (
            <button
              onClick={handleEndInterview}
              disabled={status !== 'connected'}
              className="w-full h-14 rounded-2xl font-bold text-white text-base relative overflow-hidden transition-transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div
                className="absolute inset-0"
                style={{ background: 'linear-gradient(90deg, #FB7185, #F43F5E)' }}
              />
              <span className="relative z-10">End Interview</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-[#0A0A0F] flex items-center justify-center text-white/50">
          Loading…
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  );
}
