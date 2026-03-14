'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TranscriptMessage } from '@/types/interview';
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

  const stopAudio = useCallback(() => {
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(console.error);
      audioCtxRef.current = null;
    }
    nextStartTimeRef.current = 0;
  }, []);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      userIdRef.current = u?.uid ?? null;
    });
  }, []);

  // Futuristic 2026 Neural Orb
  useEffect(() => {
    const canvas = orbCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const size = (canvas.width = canvas.height = canvas.offsetWidth);
      ctx.clearRect(0, 0, size, size);
      const cx = size / 2, cy = size / 2;
      const t = orbPhaseRef.current;
      const isAI = lastSpeaker !== 'user';
      
      const primary = isAI ? '#6366F1' : '#2DD4BF';
      const secondary = isAI ? '#818CF8' : '#5EEAD4';
      const intensity = 0.9 + 0.1 * Math.sin(t * 3);

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.45);
      grad.addColorStop(0, `${primary}20`);
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, size * 0.45 * intensity, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 3; i++) {
        const r = size * (0.2 + i * 0.08) * intensity;
        ctx.strokeStyle = i % 2 === 0 ? `${primary}40` : `${secondary}30`;
        ctx.lineWidth = 1;
        ctx.setLineDash([20, 40]);
        ctx.lineDashOffset = t * 50 * (i + 1);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }

      ctx.setLineDash([]);
      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8 + t;
        const x = cx + Math.cos(angle) * 15 * Math.sin(t * 2);
        const y = cy + Math.sin(angle) * 15 * Math.cos(t * 1.5);
        const r = size * 0.12 * intensity;
        
        const coreGrad = ctx.createRadialGradient(x, y, 0, x, y, r);
        coreGrad.addColorStop(0, `${primary}80`);
        coreGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = coreGrad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let p = 0; p < 15; p++) {
        const angle = t * 0.5 + (p * Math.PI * 2) / 15;
        const orbitR = size * 0.35 + Math.sin(t + p) * 10;
        const px = cx + Math.cos(angle) * orbitR;
        const py = cy + Math.sin(angle) * orbitR;
        ctx.fillStyle = p % 2 === 0 ? primary : secondary;
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      orbPhaseRef.current += 0.02;
      orbAnimRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(orbAnimRef.current);
  }, [lastSpeaker]);

  // Removed automatic scrollIntoView to prevent jitter during transcription
  // flex-col-reverse handles bottom-anchoring naturally

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

  const initMicrophone = useCallback(async () => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { sampleRate: 16000, channelCount: 1 },
      });
      streamRef.current = stream;
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;
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
    } catch (err) {
      console.error('Mic error:', err);
    }
  }, []);

  const connect = useCallback(async () => {
    try {
      const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const wsUrl = `${wsProtocol}://${window.location.host}/api/ws?type=${encodeURIComponent(interviewType)}&personality=${encodeURIComponent(personality)}`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus('connected');
        statusRef.current = 'connected';
        startTimer();
        initMicrophone();
      };

      ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);
        
        if (msg.type === 'audio' && msg.data) {
          try {
            const raw = atob(msg.data);
            const buf = new ArrayBuffer(raw.length);
            const view = new Uint8Array(buf);
            for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);

            const actx = audioCtxRef.current || new (window.AudioContext || (window as any).webkitAudioContext)();
            if (!audioCtxRef.current) audioCtxRef.current = actx;
            if (actx.state === 'suspended') await actx.resume();

            const sampleRate = 24000;
            const samples = new Int16Array(buf);
            const float = new Float32Array(samples.length);
            for (let i = 0; i < samples.length; i++) float[i] = samples[i] / 32768;
            
            const audioBuf = actx.createBuffer(1, float.length, sampleRate);
            audioBuf.copyToChannel(float, 0);
            const src = actx.createBufferSource();
            src.buffer = audioBuf;
            src.connect(actx.destination);
            
            const now = actx.currentTime;
            if (nextStartTimeRef.current < now) nextStartTimeRef.current = now;
            src.start(nextStartTimeRef.current);
            nextStartTimeRef.current += audioBuf.duration;
          } catch (e) {
            console.error('Playback error:', e);
          }
        }

        if (msg.type === 'user_transcript' && msg.text) {
          setLastSpeaker('user');
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last?.isUser) {
              const updated = [...prev.slice(0, -1), { ...last, text: last.text + ' ' + msg.text }];
              transcriptRef.current = updated;
              return updated;
            }
            const updated = [...prev, { text: msg.text, isUser: true, timestamp: Date.now() }];
            transcriptRef.current = updated;
            return updated;
          });
        }

        if (msg.type === 'ai_transcript' && msg.text) {
          setLastSpeaker('ai');
          setTranscript((prev) => {
            const last = prev[prev.length - 1];
            if (last && !last.isUser) {
              const updated = [...prev.slice(0, -1), { ...last, text: last.text + ' ' + msg.text }];
              transcriptRef.current = updated;
              return updated;
            }
            const updated = [...prev, { text: msg.text, isUser: false, timestamp: Date.now() }];
            transcriptRef.current = updated;
            return updated;
          });
        }
      };
      
      ws.onclose = () => setStatus('ended');
      ws.onerror = () => setStatus('error');
    } catch (e) {
      setStatus('error');
    }
  }, [interviewType, personality, startTimer, initMicrophone]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      processorRef.current?.disconnect();
      sourceRef.current?.disconnect();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (timerRef.current) clearInterval(timerRef.current);
      stopAudio();
    };
  }, [connect, stopAudio]);

  const handleEndInterview = async () => {
    setIsGenerating(true);
    statusRef.current = 'ended';
    stopAudio(); // Kill AI voice immediately
    wsRef.current?.send(JSON.stringify({ type: 'end' }));
    
    try {
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
      const scorecard = await res.json();
      sessionStorage.setItem('scorecard', JSON.stringify(scorecard));
      sessionStorage.setItem('interviewMeta', JSON.stringify({ type: interviewType, personality, duration: durationRef.current }));
      router.push('/scorecard');
    } catch (err) {
      setIsGenerating(false);
    }
  };

  const handleSendText = (e: React.FormEvent) => {
    e.preventDefault();
    if (!userInput.trim() || status !== 'connected') return;
    wsRef.current?.send(JSON.stringify({ type: 'text', text: userInput }));
    setTranscript(prev => [...prev, { text: userInput, isUser: true, timestamp: Date.now() }]);
    setLastSpeaker('user');
    setUserInput('');
  };

  const handleExit = () => {
    stopAudio();
    router.push('/');
  };

  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-between p-6 md:p-12 overflow-hidden after-scan">
      <div className="w-full flex items-center justify-between z-20">
        <div className="neural-glass px-6 py-3 rounded-2xl flex items-center gap-4">
           <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(99,102,241,1)]" />
           <div>
             <div className="text-[10px] font-black uppercase tracking-[0.2em] text-text-dim">Session Active</div>
             <div className="text-sm font-bold text-white">{interviewType}</div>
           </div>
        </div>
        
        <div className="flex items-center gap-3">
           <div className="neural-glass px-6 py-3 rounded-2xl font-mono text-xl font-black tracking-tighter text-primary">
              {formatDuration(duration)}
           </div>
           <button onClick={handleExit} className="tactile-button w-12 h-12 neural-glass rounded-2xl flex items-center justify-center text-text-dim hover:text-white">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M18 6L6 18M6 6l12 12"/></svg>
           </button>
        </div>
      </div>

      <div className="relative flex flex-col items-center justify-center flex-1 w-full max-w-2xl">
         <div className="absolute inset-0 bg-primary/5 blur-[100px] rounded-full animate-neural-float" />
         <canvas ref={orbCanvasRef} className="w-80 h-80 md:w-[450px] md:h-[450px] relative z-10" />
         
         <div className="absolute bottom-10 neural-glass px-8 py-3 rounded-full flex items-center gap-3 z-20">
            <span className={`w-2 h-2 rounded-full ${lastSpeaker === 'user' ? 'bg-secondary' : 'bg-primary'} animate-pulse`} />
            <span className="text-xs font-black uppercase tracking-[0.3em] text-text-secondary">
               {lastSpeaker === 'user' ? 'Processing Response' : `Agent ${personality} Speaking`}
            </span>
         </div>
      </div>

      <div className="w-full max-w-xl z-20 space-y-4">
         <div className="h-40 overflow-y-auto relative scrollbar-hide">
            <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent pointer-events-none z-10" />
            <div className="flex flex-col-reverse gap-3 pb-4">
               {transcript.slice().reverse().map((msg, i) => (
                  <div key={i} className={`flex ${msg.isUser ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2`}>
                     <div className={`px-4 py-2 rounded-2xl text-xs font-medium max-w-[85%]
                       ${msg.isUser ? 'bg-secondary/10 border border-secondary/20 text-secondary' : 'bg-primary/10 border border-primary/20 text-primary'}`}>
                        {msg.text}
                     </div>
                  </div>
               ))}
            </div>
         </div>

         <div className="flex gap-3">
            <form onSubmit={handleSendText} className="flex-1 flex gap-3">
               <input 
                  type="text" 
                  value={userInput}
                  onChange={(e) => setUserInput(e.target.value)}
                  placeholder="Type a manual response..." 
                  className="flex-1 neural-glass h-16 rounded-[1.5rem] px-6 text-sm focus:outline-none focus:border-primary/50 transition-all text-white bg-transparent"
               />
               {isGenerating ? (
                  <div className="h-16 neural-glass rounded-[1.5rem] px-8 flex items-center gap-3">
                     <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                     <span className="text-xs font-black uppercase tracking-widest text-primary">Analyzing</span>
                  </div>
               ) : (
                  <button 
                     type="button"
                     onClick={handleEndInterview}
                     className="tactile-button h-16 bg-accent rounded-[1.5rem] px-10 font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-accent/20 text-white"
                  >
                     Complete
                  </button>
               )}
            </form>
         </div>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense fallback={<div className="fixed inset-0 bg-background flex items-center justify-center text-primary font-black animate-pulse">Neural Linkage...</div>}>
      <InterviewContent />
    </Suspense>
  );
}
