'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback, useMemo, memo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { TranscriptMessage, DSAProblem } from '@/types/interview';
import {
  buildSystemPrompt,
  buildGreeting,
  type InterviewType,
  type InterviewPersonality,
} from '@/lib/interview-prompts';
import { voiceForPersonality } from '@/lib/cloudVoices';
import { useInterviewVoice } from '@/hooks/useInterviewVoice';
import type { ChatMessage } from '@/lib/groq';

// ─── Neural Orb (Canvas) ──────────────────────────────────────────────────────
function NeuralOrb({
  lastSpeaker,
  size,
  className = '',
}: {
  lastSpeaker: 'ai' | 'user' | null;
  size: 'small' | 'large';
  className?: string;
}) {
  const orbCanvasRef = useRef<HTMLCanvasElement>(null);
  const orbAnimRef = useRef<number>(0);
  const orbPhaseRef = useRef(0);

  useEffect(() => {
    const canvas = orbCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;

    const draw = () => {
      const sz = (canvas.width = canvas.height = canvas.offsetWidth);
      ctx.clearRect(0, 0, sz, sz);
      const cx = sz / 2, cy = sz / 2;
      const t = orbPhaseRef.current;
      const isAI = lastSpeaker !== 'user';

      const primary   = isAI ? '#6366F1' : '#2DD4BF';
      const secondary = isAI ? '#818CF8' : '#5EEAD4';
      const intensity = 0.9 + 0.1 * Math.sin(t * 3);

      const halo = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.5);
      halo.addColorStop(0,   `${primary}08`);
      halo.addColorStop(0.6, `${primary}14`);
      halo.addColorStop(1,   'transparent');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(cx, cy, sz * 0.5, 0, Math.PI * 2);
      ctx.fill();

      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.45);
      grad.addColorStop(0,   `${primary}30`);
      grad.addColorStop(0.5, `${secondary}18`);
      grad.addColorStop(1,   'transparent');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, sz * 0.45 * intensity, 0, Math.PI * 2);
      ctx.fill();

      for (let i = 0; i < 3; i++) {
        const r   = sz * (0.18 + i * 0.09) * intensity;
        const dir = i % 2 === 0 ? 1 : -1;
        ctx.strokeStyle = i % 2 === 0 ? `${primary}50` : `${secondary}38`;
        ctx.lineWidth   = i === 0 ? 1.5 : 1;
        ctx.setLineDash([12 + i * 4, 30 + i * 8]);
        ctx.lineDashOffset = t * 60 * dir * (i + 1);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      for (let i = 0; i < 8; i++) {
        const angle = (i * Math.PI * 2) / 8 + t * 0.7;
        const drift = 12 * Math.sin(t * 1.8 + i);
        const bx = cx + Math.cos(angle) * drift;
        const by = cy + Math.sin(angle) * drift;
        const r  = sz * 0.11 * intensity;
        const blobGrad = ctx.createRadialGradient(bx, by, 0, bx, by, r);
        blobGrad.addColorStop(0, `${primary}90`);
        blobGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = blobGrad;
        ctx.beginPath();
        ctx.arc(bx, by, r, 0, Math.PI * 2);
        ctx.fill();
      }

      for (let p = 0; p < 18; p++) {
        const angle  = t * 0.5 + (p * Math.PI * 2) / 18;
        const orbitR = sz * 0.38 + Math.sin(t * 1.2 + p * 0.8) * (sz * 0.04);
        const px = cx + Math.cos(angle) * orbitR;
        const py = cy + Math.sin(angle) * orbitR;
        ctx.fillStyle = p % 2 === 0 ? `${primary}CC` : `${secondary}AA`;
        ctx.beginPath();
        ctx.arc(px, py, p % 3 === 0 ? 2.5 : 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, sz * 0.08);
      core.addColorStop(0,   `${primary}FF`);
      core.addColorStop(0.4, `${primary}60`);
      core.addColorStop(1,   'transparent');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(cx, cy, sz * 0.08 * intensity, 0, Math.PI * 2);
      ctx.fill();

      orbPhaseRef.current += 0.018;
      orbAnimRef.current = requestAnimationFrame(draw);
    };

    draw();
    return () => cancelAnimationFrame(orbAnimRef.current);
  }, [lastSpeaker]);

  const dimClass =
    size === 'large'
      ? 'w-[300px] h-[300px] md:w-[420px] md:h-[420px]'
      : 'w-[140px] h-[140px] md:w-[176px] md:h-[176px]';

  return <canvas ref={orbCanvasRef} className={`${dimClass} ${className}`} />;
}

// ─── Speaker Status Pill ──────────────────────────────────────────────────────
function SpeakerPill({
  lastSpeaker,
  personality,
}: {
  lastSpeaker: 'ai' | 'user' | null;
  personality: string;
}) {
  const isUser = lastSpeaker === 'user';
  return (
    <div className="neural-glass px-5 py-2.5 rounded-full flex items-center gap-2.5">
      <span
        className={`w-1.5 h-1.5 rounded-full animate-pulse ${
          isUser
            ? 'bg-secondary shadow-[0_0_6px_#2DD4BF]'
            : 'bg-primary shadow-[0_0_6px_#6366F1]'
        }`}
      />
      <span className="text-[10px] font-black uppercase tracking-[0.28em] text-text-secondary">
        {isUser ? 'You Speaking' : `${personality} Listening`}
      </span>
    </div>
  );
}

// ─── Transcript Bubble ────────────────────────────────────────────────────────
const TranscriptBubble = memo(function TranscriptBubble({ msg, isLatest }: { msg: TranscriptMessage; isLatest: boolean }) {
  return (
    <div
      className={`flex items-end gap-3 ${isLatest ? 'animate-in fade-in slide-in-from-bottom-2 duration-300' : ''} ${
        msg.isUser ? 'flex-row-reverse' : 'flex-row'
      }`}
    >
      <div
        className={`w-7 h-7 rounded-xl shrink-0 flex items-center justify-center text-[9px] font-black shadow-md ${
          msg.isUser
            ? 'bg-secondary text-background'
            : 'bg-primary/20 border border-primary/40 text-primary-neural'
        }`}
      >
        {msg.isUser ? 'YOU' : 'AI'}
      </div>
      <div
        className={`flex flex-col max-w-[78%] gap-1 ${
          msg.isUser ? 'items-end' : 'items-start'
        }`}
      >
        <div
          className={`px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-lg ${
            msg.isUser
              ? 'bg-white/[0.06] border border-white/10 text-white rounded-br-sm'
              : 'bg-primary/[0.08] border border-primary/20 text-white/90 rounded-bl-sm'
          }`}
        >
          {msg.text || '...'}
        </div>
        <span className="text-[9px] font-black uppercase tracking-tight text-text-dim px-1">
          {new Date(msg.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>
      </div>
    </div>
  );
});

// ─── DSA Problem Card ─────────────────────────────────────────────────────────
function ProblemCard({ problem }: { problem: DSAProblem }) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(0);

  const diffColor =
    problem.difficulty === 'Easy' ? { bg: 'rgba(52,211,153,0.12)', text: '#34D399', border: 'rgba(52,211,153,0.25)' } :
    problem.difficulty === 'Hard' ? { bg: 'rgba(244,63,94,0.12)',  text: '#F43F5E', border: 'rgba(244,63,94,0.25)' } :
                                    { bg: 'rgba(251,191,36,0.12)', text: '#FBBF24', border: 'rgba(251,191,36,0.25)' };

  return (
    <div className="rounded-2xl border border-primary/20 overflow-hidden" style={{ background: 'rgba(99,102,241,0.04)' }}>
      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-white/[0.06]">
        <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,1)]" />
        <span className="text-[9px] font-black uppercase tracking-[0.3em] text-primary flex-1">DSA Problem</span>
        {problem.difficulty && (
          <span className="text-[9px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full"
            style={{ background: diffColor.bg, color: diffColor.text, border: `1px solid ${diffColor.border}` }}>
            {problem.difficulty}
          </span>
        )}
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div>
          <h3 className="font-bold text-white text-sm mb-1.5">{problem.title}</h3>
          <p className="text-xs text-white/65 leading-relaxed">{problem.description}</p>
        </div>

        {problem.testCases?.length > 0 && (
          <div className="flex flex-col gap-2">
            {problem.testCases.map((tc, i) => {
              const isOpen = expandedIdx === i;
              return (
                <div key={i} className="rounded-xl overflow-hidden border border-white/[0.06]">
                  <button
                    onClick={() => setExpandedIdx(isOpen ? null : i)}
                    className="w-full flex items-center justify-between px-3 py-2 bg-white/[0.03] hover:bg-white/[0.05] transition-colors"
                  >
                    <span className="text-[9px] font-black uppercase tracking-[0.25em] text-text-dim">
                      Example {i + 1}
                    </span>
                    <svg
                      width="10" height="10" viewBox="0 0 12 12" fill="none" stroke="currentColor"
                      strokeWidth="2" strokeLinecap="round"
                      className="text-text-dim transition-transform duration-200"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                    >
                      <path d="M2 4l4 4 4-4" />
                    </svg>
                  </button>
                  {isOpen && (
                    <div className="px-3 py-3 bg-black/20 flex flex-col gap-2 border-t border-white/[0.04]">
                      <div className="flex items-baseline gap-2 font-mono text-xs">
                        <span className="text-[9px] font-black uppercase tracking-widest text-text-dim w-12 shrink-0">Input</span>
                        <span className="text-secondary">{tc.input}</span>
                      </div>
                      <div className="flex items-baseline gap-2 font-mono text-xs">
                        <span className="text-[9px] font-black uppercase tracking-widest text-text-dim w-12 shrink-0">Output</span>
                        <span className="text-primary">{tc.output}</span>
                      </div>
                      {tc.explanation && (
                        <div className="flex items-start gap-2 mt-0.5 pt-2 border-t border-white/[0.04]">
                          <span className="text-[9px] font-black uppercase tracking-widest text-text-dim w-12 shrink-0 pt-px">Explain</span>
                          <p className="text-xs text-white/55 leading-relaxed">{tc.explanation}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {problem.constraints?.length > 0 && (
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.25em] text-text-dim mb-1.5">Constraints</div>
            <div className="flex flex-wrap gap-1">
              {problem.constraints.map((c, i) => (
                <span key={i} className="text-[9px] font-mono bg-white/[0.04] border border-white/[0.06] rounded-lg px-2 py-0.5 text-white/50">
                  {c}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mode Toggle ──────────────────────────────────────────────────────────────
function ModeToggle({
  mode,
  onChange,
}: {
  mode: 'chat' | 'immersive';
  onChange: (m: 'chat' | 'immersive') => void;
}) {
  return (
    <div className="neural-glass h-10 rounded-xl px-1 flex items-center gap-1">
      <button
        onClick={() => onChange('chat')}
        className={`tactile-button h-8 flex items-center gap-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
          mode === 'chat'
            ? 'bg-primary/20 text-primary border border-primary/30 shadow-[0_0_12px_rgba(99,102,241,0.2)]'
            : 'text-text-dim hover:text-white'
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <path d="M2 2h12v9H9l-3 3v-3H2V2z" opacity="0.9" />
        </svg>
        Chat
      </button>
      <button
        onClick={() => onChange('immersive')}
        className={`tactile-button h-8 flex items-center gap-1.5 px-3 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all duration-300 ${
          mode === 'immersive'
            ? 'bg-secondary/15 text-secondary border border-secondary/30 shadow-[0_0_12px_rgba(45,212,191,0.15)]'
            : 'text-text-dim hover:text-white'
        }`}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden>
          <circle cx="8" cy="8" r="4.5" />
          <circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1" opacity="0.5" />
        </svg>
        Focus
      </button>
    </div>
  );
}

// DSA-transition heuristic — triggers a new problem when the AI narrates it.
const NEW_PROBLEM_PHRASES = [
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
];

// ─── Main Interview Content ───────────────────────────────────────────────────
function InterviewContent() {
  const router = useRouter();
  const params = useSearchParams();
  const interviewType  = params.get('type')        || 'DSA';
  const personality    = params.get('personality') || 'Friendly';

  const [status, setStatus] = useState<'connecting' | 'connected' | 'ended' | 'error'>('connecting');
  const [transcript, setTranscript]     = useState<TranscriptMessage[]>([]);
  const [duration, setDuration]         = useState(0);
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastSpeaker, setLastSpeaker]   = useState<'ai' | 'user' | null>('ai');
  const [viewMode, setViewMode]         = useState<'chat' | 'immersive'>('chat');
  const [dsaProblem, setDsaProblem]     = useState<DSAProblem | null>(null);

  // Voice (Puter TTS + browser STT). Voice methods are stable across renders.
  const voice = useInterviewVoice(voiceForPersonality(personality as InterviewPersonality));
  const speakRef  = useRef(voice.speak);
  const listenRef = useRef(voice.listen);
  const cancelRef = useRef(voice.cancel);
  useEffect(() => { speakRef.current  = voice.speak;  }, [voice.speak]);
  useEffect(() => { listenRef.current = voice.listen; }, [voice.listen]);
  useEffect(() => { cancelRef.current = voice.cancel; }, [voice.cancel]);

  // Loop control
  const runningRef        = useRef(false);
  const currentUserTurnRef = useRef(0);

  // UI refs
  const timerRef          = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef     = useRef<TranscriptMessage[]>([]);
  const durationRef       = useRef(0);
  const transcriptEndRef  = useRef<HTMLDivElement>(null);
  const connectedRef      = useRef(false);

  // Auto-scroll in chat mode
  useEffect(() => {
    if (viewMode === 'chat' && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [transcript, viewMode]);

  const startTimer = useCallback(() => {
    if (timerRef.current) return;
    timerRef.current = setInterval(() => {
      durationRef.current += 1;
      setDuration((d) => d + 1);
    }, 1000);
  }, []);

  const formatDuration = (s: number) => {
    const m   = Math.floor(s / 60).toString().padStart(2, '0');
    const sec = (s % 60).toString().padStart(2, '0');
    return `${m}:${sec}`;
  };

  // Upsert a transcript entry keyed by (role, turnId).
  const upsertTranscript = useCallback((role: 'user' | 'agent', turnId: number, text: string) => {
    const isUser = role === 'user';
    setTranscript((prev) => {
      // Find the last bubble for this role+turn
      const idx = prev.findIndex(m => m.isUser === isUser && m.turnId === turnId);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx], text };
        transcriptRef.current = next;
        return next;
      }
      const appended = [
        ...prev,
        { text, isUser, timestamp: Date.now(), turnId },
      ];
      transcriptRef.current = appended;
      return appended;
    });
  }, []);

  // Detects when the AI introduces a new DSA problem and re-fetches.
  const handleDsaProblemTransition = useCallback(async (aiTurnText: string) => {
    const lower = aiTurnText.toLowerCase();
    if (!NEW_PROBLEM_PHRASES.some(p => lower.includes(p))) return;
    try {
      const res = await fetch('/api/generate-dsa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contextHint: aiTurnText }),
      });
      if (!res.ok) return;
      const problem = await res.json();
      if (problem && problem.title) setDsaProblem(problem);
    } catch (e) {
      console.error('[DSA] transition problem fetch failed', e);
    }
  }, []);

  // Stream interim STT text into the active user bubble while listening.
  useEffect(() => {
    if (voice.phase !== 'listening') return;
    if (!voice.interimTranscript) return;
    upsertTranscript('user', currentUserTurnRef.current, voice.interimTranscript);
  }, [voice.interimTranscript, voice.phase, upsertTranscript]);

  const connect = useCallback(async () => {
    try {
      // Kick off DSA problem fetch in parallel (only for DSA)
      const problemPromise: Promise<DSAProblem | null> = interviewType === 'DSA'
        ? fetch('/api/generate-dsa', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}',
          })
            .then((r) => (r.ok ? r.json() : null))
            .catch((e) => {
              console.error('[DSA] initial problem fetch failed', e);
              return null;
            })
        : Promise.resolve(null);

      const problem = await problemPromise;
      if (problem && problem.title) setDsaProblem(problem);

      const dsaContext = problem && problem.title
        ? { title: problem.title, description: problem.description }
        : null;
      const systemPrompt = buildSystemPrompt(interviewType, personality, dsaContext);
      const greeting     = buildGreeting(interviewType, personality, dsaContext);

      const chatHistory: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        { role: 'assistant', content: greeting },
      ];

      let agentTurn = 0;
      let userTurn  = 0;

      // Seed transcript with the greeting and start the clock.
      setLastSpeaker('ai');
      upsertTranscript('agent', agentTurn, greeting);
      runningRef.current   = true;
      connectedRef.current = true;
      setStatus('connected');
      startTimer();

      await speakRef.current(greeting);
      if (interviewType === 'DSA') handleDsaProblemTransition(greeting);

      while (runningRef.current) {
        userTurn += 1;
        currentUserTurnRef.current = userTurn;
        setLastSpeaker('user');

        const userText = await listenRef.current();
        if (!runningRef.current) break;
        if (!userText) {
          // Empty turn (silence/no permission) — back to listening.
          continue;
        }
        upsertTranscript('user', userTurn, userText);
        chatHistory.push({ role: 'user', content: userText });

        // Ask Groq for the next interviewer line.
        let assistantText = '';
        try {
          const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              messages: chatHistory,
              maxTokens: 400,
              temperature: 0.7,
            }),
          });
          if (res.ok) {
            const data = (await res.json()) as { content?: string };
            assistantText = (data.content ?? '').trim();
          } else {
            console.error('[interview] /api/chat', res.status, await res.text());
          }
        } catch (e) {
          console.error('[interview] /api/chat failed', e);
        }

        if (!runningRef.current) break;
        if (!assistantText) assistantText = 'One moment — let me rephrase that.';

        agentTurn += 1;
        setLastSpeaker('ai');
        upsertTranscript('agent', agentTurn, assistantText);
        chatHistory.push({ role: 'assistant', content: assistantText });

        if (interviewType === 'DSA') handleDsaProblemTransition(assistantText);

        await speakRef.current(assistantText);
      }
    } catch (err) {
      console.error('[interview] connect failed', err);
      setStatus('error');
    }
  }, [interviewType, personality, startTimer, upsertTranscript, handleDsaProblemTransition]);

  const teardown = useCallback(() => {
    runningRef.current   = false;
    connectedRef.current = false;
    try { cancelRef.current(); } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = setTimeout(() => {
      if (!cancelled) connect();
    }, 50);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (timerRef.current) clearInterval(timerRef.current);
      teardown();
    };
  }, [connect, teardown]);

  const handleEndInterview = async () => {
    setIsGenerating(true);
    setStatus('ended');
    await teardown();
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
      sessionStorage.setItem('interviewMeta', JSON.stringify({
        type: interviewType, personality, duration: durationRef.current,
      }));
      try {
        const entry = {
          id: `${Date.now()}`,
          timestamp: Date.now(),
          type: interviewType,
          personality,
          durationSeconds: durationRef.current,
          scorecard,
          transcript: transcriptRef.current,
        };
        const prev = JSON.parse(localStorage.getItem('interview_history') || '[]');
        localStorage.setItem('interview_history', JSON.stringify([entry, ...prev].slice(0, 50)));
      } catch {}
      router.push('/scorecard');
    } catch (err) {
      console.error(err);
      setIsGenerating(false);
    }
  };

  const handleExit = () => { teardown(); router.push('/'); };

  const lastTwo = transcript.slice(-2);

  const EndButton = isGenerating ? (
    <div className="neural-glass rounded-2xl px-7 py-3.5 flex items-center gap-3 border border-primary/20">
      <div className="w-3.5 h-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">
        Compiling Scorecard...
      </span>
    </div>
  ) : (
    <button
      onClick={handleEndInterview}
      className="tactile-button group relative overflow-hidden rounded-2xl px-7 py-3.5 bg-white/[0.04] border border-white/[0.08] hover:border-accent/50 hover:bg-accent/[0.08] transition-all duration-300"
    >
      <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/5 to-accent/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
      <span className="relative z-10 text-[11px] font-black uppercase tracking-[0.25em] text-white/50 group-hover:text-accent transition-colors duration-300">
        End Interview
      </span>
    </button>
  );

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const TopBar = useMemo(() => (
    <header className="w-full flex items-center justify-between z-30 relative flex-shrink-0">
      <div className="flex items-center gap-2">
        <img src="/crux-icon.svg" alt="Crux.ai" className="w-8 h-8 rounded-lg shrink-0" />
        <div className="neural-glass h-10 px-4 rounded-2xl flex items-center gap-3">
          <div
            className={`w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0 ${
              status === 'connected' ? 'bg-primary shadow-[0_0_7px_#6366F1]' :
              status === 'error'     ? 'bg-accent' : 'bg-text-dim'
            }`}
          />
          <div className="flex items-center gap-1.5">
            <span className="text-[9px] font-black uppercase tracking-[0.22em] text-text-dim leading-none">Live</span>
            <span className="text-[9px] font-black text-text-dim leading-none opacity-40">/</span>
            <span className="text-xs font-bold text-white leading-none">{interviewType}</span>
          </div>
        </div>
        <div className="neural-glass h-10 px-3 rounded-xl items-center hidden sm:flex">
          <span className="text-[9px] font-black uppercase tracking-widest text-secondary">
            {personality}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <ModeToggle mode={viewMode} onChange={setViewMode} />
        <div className="neural-glass h-10 px-5 rounded-2xl flex items-center font-mono text-lg font-black tracking-tight text-primary tabular-nums">
          {formatDuration(duration)}
        </div>
        <button
          onClick={handleExit}
          className="tactile-button w-10 h-10 neural-glass rounded-xl flex items-center justify-center text-text-dim hover:text-white transition-all"
          title="Exit without saving"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </header>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [status, viewMode, duration, interviewType, personality]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ChatMode = useMemo(() => (
    <div className="flex flex-col md:flex-row flex-1 gap-4 min-h-0 overflow-hidden mt-4">
      <aside className="flex flex-col items-center gap-4 md:w-52 shrink-0">
        <div className="relative flex items-center justify-center">
          <div
            className={`absolute rounded-full blur-2xl opacity-25 transition-colors duration-1000 pointer-events-none
              ${lastSpeaker === 'user' ? 'bg-secondary' : 'bg-primary'}
              inset-[-24px]`}
          />
          <NeuralOrb lastSpeaker={lastSpeaker} size="small" className="relative z-10" />
        </div>
        <SpeakerPill lastSpeaker={lastSpeaker} personality={personality} />
        <div className="neural-glass px-3 py-1.5 rounded-xl flex items-center gap-2">
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              status === 'connected'
                ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.9)] animate-pulse'
                : 'bg-text-dim'
            }`}
          />
          <span className="text-[9px] font-black uppercase tracking-widest text-text-dim">
            {status === 'connecting' ? 'Linking...' :
             status === 'connected'  ? 'Stream Active' :
             status.toUpperCase()}
          </span>
        </div>
        <div className="hidden md:block mt-auto">{EndButton}</div>
      </aside>

      <div className="flex-1 flex flex-col min-h-0 neural-glass rounded-3xl overflow-hidden border border-white/[0.06]">
        {interviewType === 'DSA' && dsaProblem && (
          <div
            className="overflow-y-auto flex-shrink-0 border-b border-primary/[0.15] animate-in fade-in slide-in-from-top-2 duration-500"
            style={{ maxHeight: '46%', background: 'rgba(99,102,241,0.025)' }}
          >
            <ProblemCard key={dsaProblem.title} problem={dsaProblem} />
          </div>
        )}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/[0.05] flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_6px_#6366F1]" />
            <span className="text-[9px] font-black uppercase tracking-[0.28em] text-text-dim">
              Neural Transcript
            </span>
          </div>
          <span className="text-[9px] font-black uppercase tracking-widest text-text-dim tabular-nums">
            {transcript.length} msg{transcript.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5 scroll-smooth">
          {transcript.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full py-16 text-center opacity-25">
              <div className="w-10 h-10 rounded-full border-2 border-dashed border-primary mb-3 animate-spin-slow" />
              <p className="text-[10px] font-black uppercase tracking-[0.35em]">
                Establishing Neural Link
              </p>
            </div>
          )}
          {transcript.map((msg, i) => (
            <TranscriptBubble key={`${msg.isUser ? 'u' : 'a'}-${msg.turnId ?? msg.timestamp}`} msg={msg} isLatest={i === transcript.length - 1} />
          ))}
          <div ref={transcriptEndRef} />
        </div>
      </div>

      <div className="flex justify-center md:hidden">{EndButton}</div>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [transcript, lastSpeaker, status, isGenerating, personality, dsaProblem]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ImmersiveMode = useMemo(() => (
    <div className="flex flex-col flex-1 items-center justify-center min-h-0 relative overflow-hidden">
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-[1800ms]"
        style={{
          background: lastSpeaker === 'user'
            ? 'radial-gradient(ellipse 75% 65% at 50% 32%, rgba(45,212,191,0.11) 0%, rgba(45,212,191,0.03) 55%, transparent 80%)'
            : 'radial-gradient(ellipse 75% 65% at 50% 32%, rgba(99,102,241,0.13) 0%, rgba(99,102,241,0.04) 55%, transparent 80%)',
        }}
      />
      <div
        className="absolute bottom-0 left-0 right-0 h-2/5 pointer-events-none"
        style={{ background: 'linear-gradient(to top, rgba(7,7,11,0.85) 0%, transparent 100%)' }}
      />
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.02]"
        style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(255,255,255,0.5) 2px, rgba(255,255,255,0.5) 3px)', backgroundSize: '100% 3px' }}
      />

      <div className="relative flex items-center justify-center mb-6 z-10">
        <div
          className="absolute rounded-full pointer-events-none transition-colors duration-[2000ms]"
          style={{
            inset: '-85%',
            background: lastSpeaker === 'user'
              ? 'radial-gradient(circle, rgba(45,212,191,0.05) 0%, transparent 62%)'
              : 'radial-gradient(circle, rgba(99,102,241,0.07) 0%, transparent 62%)',
            filter: 'blur(36px)',
          }}
        />
        <div
          className="absolute rounded-full pointer-events-none transition-colors duration-[1500ms]"
          style={{
            inset: '-45%',
            background: lastSpeaker === 'user'
              ? 'radial-gradient(circle, rgba(45,212,191,0.13) 0%, transparent 58%)'
              : 'radial-gradient(circle, rgba(99,102,241,0.16) 0%, transparent 58%)',
            filter: 'blur(18px)',
          }}
        />
        {([0, 0.75, 1.5] as number[]).map((delay, i) => (
          <div
            key={i}
            className="absolute inset-0 rounded-full pointer-events-none animate-pulse-ring"
            style={{
              animationDelay: `${delay}s`,
              border: `1px solid ${lastSpeaker === 'user' ? `rgba(45,212,191,${0.18 - i * 0.04})` : `rgba(99,102,241,${0.20 - i * 0.04})`}`,
              transition: 'border-color 900ms ease',
            }}
          />
        ))}
        <div
          className="absolute rounded-full pointer-events-none transition-all duration-700"
          style={{
            inset: '-3px',
            border: `1px solid ${lastSpeaker === 'user' ? 'rgba(45,212,191,0.28)' : 'rgba(99,102,241,0.28)'}`,
            boxShadow: lastSpeaker === 'user'
              ? '0 0 28px rgba(45,212,191,0.10), inset 0 0 28px rgba(45,212,191,0.05)'
              : '0 0 28px rgba(99,102,241,0.12), inset 0 0 28px rgba(99,102,241,0.06)',
          }}
        />
        <NeuralOrb lastSpeaker={lastSpeaker} size="large" className="relative z-10 animate-breathe" />
      </div>

      <div className="flex flex-col items-center gap-2 mb-7 z-10">
        <div className="flex items-center gap-3">
          <div className="h-px transition-all duration-700"
            style={{ width: '40px', background: lastSpeaker === 'user' ? 'linear-gradient(to right, transparent, rgba(45,212,191,0.5))' : 'linear-gradient(to right, transparent, rgba(99,102,241,0.5))' }}
          />
          <div className="w-1.5 h-1.5 rounded-full animate-pulse flex-shrink-0 transition-all duration-500"
            style={{
              background: lastSpeaker === 'user' ? '#2DD4BF' : '#6366F1',
              boxShadow: lastSpeaker === 'user' ? '0 0 8px #2DD4BF, 0 0 18px rgba(45,212,191,0.5)' : '0 0 8px #6366F1, 0 0 18px rgba(99,102,241,0.5)',
            }}
          />
          <span className="text-[10px] font-black uppercase tracking-[0.38em] transition-colors duration-500"
            style={{ color: lastSpeaker === 'user' ? '#2DD4BF' : '#94A3B8' }}>
            {lastSpeaker === 'user' ? 'You' : personality}
          </span>
          <div className="flex items-end gap-[2px]" style={{ height: '14px' }}>
            {([9, 13, 7, 14, 10, 6, 12] as number[]).map((h, i) => (
              <div key={i} className="rounded-full animate-pulse flex-shrink-0"
                style={{
                  width: '2px', height: `${h}px`,
                  background: lastSpeaker === 'user' ? '#2DD4BF' : '#6366F1',
                  opacity: 0.6,
                  animationDelay: `${i * 0.14}s`,
                  animationDuration: `${0.7 + (i % 3) * 0.25}s`,
                }}
              />
            ))}
          </div>
          <div className="h-px transition-all duration-700"
            style={{ width: '40px', background: lastSpeaker === 'user' ? 'linear-gradient(to left, transparent, rgba(45,212,191,0.5))' : 'linear-gradient(to left, transparent, rgba(99,102,241,0.5))' }}
          />
        </div>
        <p className="text-[8px] font-black uppercase tracking-[0.45em] text-text-dim opacity-50">
          {lastSpeaker === 'user' ? 'Responding' : 'Speaking'}
        </p>
      </div>

      <div className="w-full max-w-xl px-8 flex flex-col items-center gap-5 z-10">
        {lastTwo.length === 0 ? (
          <div className="flex items-center gap-3">
            <div style={{ width: '20px', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
            <p className="text-[9px] font-black uppercase tracking-[0.5em] text-white opacity-20">Neural Link Active</p>
            <div style={{ width: '20px', height: '1px', background: 'rgba(255,255,255,0.2)' }} />
          </div>
        ) : (
          lastTwo.map((msg, i) => {
            const isLatest = i === lastTwo.length - 1;
            const isAI = !msg.isUser;
            return (
              <div key={`${msg.isUser ? 'u' : 'a'}-${msg.turnId ?? msg.timestamp}`} className="w-full text-center"
                style={{
                  opacity: isLatest ? 1 : 0.28,
                  transform: isLatest ? 'translateY(0) scale(1)' : 'translateY(-6px) scale(0.96)',
                  transition: 'all 600ms cubic-bezier(0.22, 1, 0.36, 1)',
                }}>
                <p className="text-[8px] font-black uppercase tracking-[0.4em] mb-1.5"
                  style={{ color: isAI ? 'rgba(99,102,241,0.55)' : 'rgba(45,212,191,0.55)' }}>
                  {isAI ? personality : 'You'}
                </p>
                <p style={{
                  fontSize: isLatest ? '15px' : '12px',
                  fontWeight: isLatest ? 500 : 400,
                  lineHeight: 1.65,
                  color: isLatest ? (isAI ? 'rgba(255,255,255,0.91)' : 'rgba(45,212,191,0.88)') : 'rgba(255,255,255,0.32)',
                  textShadow: isLatest && isAI ? '0 0 48px rgba(99,102,241,0.22)' : 'none',
                  transition: 'all 600ms ease',
                }}>
                  {msg.text}
                </p>
              </div>
            );
          })
        )}
      </div>

      <div className="mt-auto pt-6 pb-1 z-10">{EndButton}</div>
    </div>
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ), [lastTwo, lastSpeaker, isGenerating, personality]);

  return (
    <div className="fixed inset-0 bg-background flex flex-col overflow-hidden">
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute top-[-15%] left-[-5%] w-[45%] h-[45%] bg-primary/[0.07] blur-[140px] rounded-full animate-neural-float" />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-secondary/[0.05] blur-[120px] rounded-full animate-neural-float"
          style={{ animationDelay: '-5s' }}
        />
        <div
          className="absolute top-[45%] left-[55%] w-[25%] h-[25%] bg-accent/[0.03] blur-[100px] rounded-full animate-neural-float"
          style={{ animationDelay: '-3s' }}
        />
      </div>

      <div className="fixed inset-0 pointer-events-none after-scan" aria-hidden />

      <div className="relative z-10 flex flex-col h-full px-5 pt-5 pb-5 md:px-8 md:pt-6 md:pb-6">
        {TopBar}

        <div className="flex-1 min-h-0 relative">
          <div
            className="absolute inset-0 flex flex-col overflow-hidden"
            style={{
              transition: 'opacity 220ms ease',
              opacity:       viewMode === 'chat' ? 1 : 0,
              pointerEvents: viewMode === 'chat' ? 'auto' : 'none',
              willChange:    'opacity',
            }}
          >
            {ChatMode}
          </div>
          <div
            className="absolute inset-0 flex flex-col overflow-hidden"
            style={{
              transition: 'opacity 220ms ease',
              opacity:       viewMode === 'immersive' ? 1 : 0,
              pointerEvents: viewMode === 'immersive' ? 'auto' : 'none',
              willChange:    'opacity',
            }}
          >
            {ImmersiveMode}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function InterviewPage() {
  return (
    <Suspense
      fallback={
        <div className="fixed inset-0 bg-background flex flex-col items-center justify-center gap-4">
          <div className="w-12 h-12 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <span className="text-[10px] font-black uppercase tracking-[0.4em] text-primary animate-pulse">
            Neural Linkage...
          </span>
        </div>
      }
    >
      <InterviewContent />
    </Suspense>
  );
}
