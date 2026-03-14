'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Scorecard } from '@/types/interview';

function ScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = value / 10;
  const r = 36,
    c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke="rgba(255,255,255,0.07)"
            strokeWidth="7"
          />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="7"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-black text-white">{value}</span>
          <span className="text-[9px] text-white/40">/10</span>
        </div>
      </div>
      <span className="text-xs text-white/60 text-center font-medium">{label}</span>
    </div>
  );
}

export default function ScorecardPage() {
  const router = useRouter();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [meta, setMeta] = useState<{
    type: string;
    personality: string;
    duration: number;
  } | null>(null);

  useEffect(() => {
    const sc = sessionStorage.getItem('scorecard');
    const m = sessionStorage.getItem('interviewMeta');
    if (sc) setScorecard(JSON.parse(sc));
    if (m) setMeta(JSON.parse(m));
  }, []);

  if (!scorecard)
    return (
      <div className="min-h-screen bg-[#0A0A0F] flex items-center justify-center">
        <div className="text-white/50">No scorecard data</div>
      </div>
    );

  // Handle both camelCase (technicalDepth) and snake_case (technical_depth) from API
  const techDepth =
    scorecard.technicalDepth ??
    (scorecard as unknown as Record<string, number>)['technical_depth'] ??
    5;

  const overall = Math.round(
    (scorecard.clarity + scorecard.confidence + techDepth + scorecard.conciseness) / 4
  );

  const formatDuration = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-5 py-10 max-w-lg mx-auto">
      {/* Header */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs text-white/50 mb-4">
          <span>✓</span> Interview Complete
        </div>
        <h1 className="text-2xl font-bold text-white mb-1">Your Scorecard</h1>
        {meta && (
          <p className="text-sm text-white/40">
            {meta.type} · {meta.personality} · {formatDuration(meta.duration)}
          </p>
        )}
      </div>

      {/* Overall score */}
      <div className="flex flex-col items-center mb-8 p-6 rounded-2xl border border-white/10 bg-white/5">
        <div className="relative w-32 h-32 mb-3">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 128 128">
            <circle
              cx="64"
              cy="64"
              r="54"
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth="8"
            />
            <circle
              cx="64"
              cy="64"
              r="54"
              fill="none"
              stroke="url(#overallGrad)"
              strokeWidth="8"
              strokeDasharray={2 * Math.PI * 54}
              strokeDashoffset={2 * Math.PI * 54 * (1 - overall / 10)}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 1.2s ease' }}
            />
            <defs>
              <linearGradient id="overallGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#22D3EE" />
                <stop offset="100%" stopColor="#A78BFA" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-black text-white">{overall}</span>
            <span className="text-xs text-white/40">/10</span>
          </div>
        </div>
        <span className="text-sm text-white/60 font-medium">Overall Score</span>
      </div>

      {/* Score rings */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="p-5 rounded-2xl border border-white/10 bg-white/5 flex justify-center">
          <ScoreRing value={scorecard.clarity} label="Clarity" color="#22D3EE" />
        </div>
        <div className="p-5 rounded-2xl border border-white/10 bg-white/5 flex justify-center">
          <ScoreRing value={scorecard.confidence} label="Confidence" color="#A78BFA" />
        </div>
        <div className="p-5 rounded-2xl border border-white/10 bg-white/5 flex justify-center">
          <ScoreRing value={techDepth} label="Technical Depth" color="#34D399" />
        </div>
        <div className="p-5 rounded-2xl border border-white/10 bg-white/5 flex justify-center">
          <ScoreRing value={scorecard.conciseness} label="Conciseness" color="#FB7185" />
        </div>
      </div>

      {/* Suggestions */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-3">
          <div
            className="w-0.5 h-5 rounded-full"
            style={{ background: 'linear-gradient(#22D3EE, #A78BFA)' }}
          />
          <span className="text-xs tracking-[0.2em] text-white/50 uppercase font-medium">
            Improvement Suggestions
          </span>
        </div>
        <div className="space-y-2.5">
          {scorecard.suggestions.map((s, i) => (
            <div key={i} className="flex gap-3 p-4 rounded-xl border border-white/10 bg-white/5">
              <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold text-cyan-400 border border-cyan-400/30 bg-cyan-400/10 mt-0.5">
                {i + 1}
              </div>
              <p className="text-sm text-white/70 leading-relaxed">{s}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={() => router.push('/history')}
          className="flex-1 h-12 rounded-xl border border-white/15 bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 transition-colors"
        >
          View History
        </button>
        <button
          onClick={() => router.push('/')}
          className="flex-1 h-12 rounded-xl text-[#0A0A0F] text-sm font-bold relative overflow-hidden"
        >
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(90deg, #22D3EE, #A78BFA)' }}
          />
          <span className="relative z-10">New Interview</span>
        </button>
      </div>
    </div>
  );
}
