'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Scorecard } from '@/types/interview';

function NeuralScoreRing({ value, label, color }: { value: number; label: string; color: string }) {
  const pct = value / 10;
  const r = 36, c = 2 * Math.PI * r;
  return (
    <div className="flex flex-col items-center gap-4 group">
      <div className="relative w-28 h-28">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 88 88">
          <circle cx="44" cy="44" r={r} fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="6" />
          <circle
            cx="44"
            cy="44"
            r={r}
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - pct)}
            strokeLinecap="round"
            className="transition-all duration-1000 ease-out group-hover:stroke-white"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-black text-white group-hover:scale-110 transition-transform">{value}</span>
          <span className="text-[10px] text-text-dim font-black uppercase tracking-widest mt-[-4px]">/ 10</span>
        </div>
      </div>
      <span className="text-[10px] text-text-secondary font-black uppercase tracking-[0.2em]">{label}</span>
    </div>
  );
}

export default function ScorecardPage() {
  const router = useRouter();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [meta, setMeta] = useState<{ type: string; personality: string; duration: number } | null>(null);

  useEffect(() => {
    const sc = sessionStorage.getItem('scorecard');
    const m = sessionStorage.getItem('interviewMeta');
    if (sc) setScorecard(JSON.parse(sc));
    if (m) setMeta(JSON.parse(m));
  }, []);

  if (!scorecard) return null;

  const overall = Math.round((scorecard.clarity + scorecard.confidence + (scorecard.technicalDepth || 5) + scorecard.conciseness) / 4);

  return (
    <div className="min-h-screen bg-background text-white p-6 md:p-12 flex flex-col items-center selection:bg-primary/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-primary/10 blur-[150px] rounded-full animate-neural-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-secondary/10 blur-[120px] rounded-full animate-neural-float [animation-delay:-4s]" />
      </div>

      <div className="relative z-10 max-w-4xl w-full">
        {/* Header Section */}
        <header className="mb-16 text-center">
           <div className="inline-flex items-center gap-3 px-6 py-2 rounded-full neural-glass border-primary/20 text-primary text-[10px] font-black uppercase tracking-[0.3em] mb-8">
              <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              Analysis Protocol Complete
           </div>
           <h1 className="text-5xl md:text-7xl font-black tracking-tightest mb-4">Performance Report</h1>
           <p className="text-text-secondary text-lg font-medium">{meta?.type} Session • Agent {meta?.personality}</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 mb-12">
          {/* Main Score Card */}
          <section className="md:col-span-8 neural-card p-10 flex flex-col md:flex-row items-center gap-12 group">
             <div className="relative w-48 h-48 flex-shrink-0">
                <div className="absolute inset-0 bg-primary/20 blur-[60px] rounded-full group-hover:bg-primary/30 transition-all duration-700" />
                <svg className="w-full h-full -rotate-90 relative z-10" viewBox="0 0 128 128">
                  <circle cx="64" cy="64" r="58" fill="none" stroke="rgba(255,255,255,0.03)" strokeWidth="10" />
                  <circle cx="64" cy="64" r="58" fill="none" stroke="url(#overallGrad)" strokeWidth="10" strokeDasharray={2 * Math.PI * 58} strokeDashoffset={2 * Math.PI * 58 * (1 - overall/10)} strokeLinecap="round" className="transition-all duration-[1.5s] ease-out" />
                  <defs>
                    <linearGradient id="overallGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#6366F1" />
                      <stop offset="100%" stopColor="#2DD4BF" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center z-10">
                  <span className="text-6xl font-black text-white tracking-tighter group-hover:scale-105 transition-transform">{overall}</span>
                  <span className="text-xs text-text-dim font-black uppercase tracking-[0.4em] mt-[-4px]">Neural Score</span>
                </div>
             </div>
             
             <div className="flex-1 space-y-8">
                <div>
                   <h3 className="text-xs font-black uppercase tracking-[0.3em] text-text-dim mb-4">Core Dimensions</h3>
                   <div className="grid grid-cols-2 gap-8">
                      <NeuralScoreRing value={scorecard.clarity} label="Clarity" color="#6366F1" />
                      <NeuralScoreRing value={scorecard.confidence} label="Confidence" color="#818CF8" />
                      <NeuralScoreRing value={scorecard.technicalDepth || 5} label="Technical" color="#2DD4BF" />
                      <NeuralScoreRing value={scorecard.conciseness} label="Precision" color="#F43F5E" />
                   </div>
                </div>
             </div>
          </section>

          {/* Action Panel */}
          <section className="md:col-span-4 flex flex-col gap-6">
             <div className="neural-card p-8 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs font-black uppercase tracking-[0.3em] text-text-dim mb-6">Session Metrics</h3>
                  <div className="space-y-4">
                     <div className="flex justify-between items-center p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Duration</span>
                        <span className="text-sm font-bold">{Math.floor((meta?.duration || 0)/60)}m { (meta?.duration || 0)%60}s</span>
                     </div>
                     <div className="flex justify-between items-center p-4 rounded-2xl bg-white/[0.02] border border-white/5">
                        <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Responses</span>
                        <span className="text-sm font-bold">12 Total</span>
                     </div>
                  </div>
                </div>

                <button onClick={() => router.push('/')} className="tactile-button h-20 bg-white rounded-[1.5rem] mt-8 group relative overflow-hidden">
                   <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                   <span className="relative z-10 text-background group-hover:text-white font-black text-sm uppercase tracking-widest">New Session</span>
                </button>
             </div>
          </section>
        </div>

        {/* Coaching Feed */}
        <div className="mb-20">
           <div className="flex items-center gap-4 mb-8">
              <div className="w-1.5 h-6 bg-primary rounded-full" />
              <h2 className="text-xs font-black uppercase tracking-[0.4em] text-text-secondary">Neural Coaching Insight</h2>
           </div>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {scorecard.suggestions.map((s, i) => (
                <div key={i} className="neural-card p-8 group hover:bg-white/[0.04]">
                   <div className="w-10 h-10 rounded-2xl bg-primary/10 flex items-center justify-center text-primary font-black mb-6 group-hover:scale-110 transition-transform">
                      {String(i + 1).padStart(2, '0')}
                   </div>
                   <p className="text-text-primary text-sm leading-relaxed font-medium">{s}</p>
                </div>
              ))}
           </div>
        </div>

        {/* Footer Meta */}
        <footer className="flex items-center justify-between px-8 text-text-dim text-[10px] font-black uppercase tracking-[0.4em]">
           <div>Session ID: IX-2026-N9</div>
           <div className="flex gap-8">
              <span className="hover:text-primary transition-colors cursor-pointer">Export Report</span>
              <span className="hover:text-secondary transition-colors cursor-pointer">History Vault</span>
           </div>
        </footer>
      </div>
    </div>
  );
}
