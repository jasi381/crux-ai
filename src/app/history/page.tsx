'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { InterviewHistory } from '@/types/interview';

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<InterviewHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    try {
      const stored = localStorage.getItem('interview_history');
      setHistory(stored ? JSON.parse(stored) : []);
    } catch {}
    setLoading(false);
  }, []);

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  const formatDuration = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  const overall = (sc: InterviewHistory['scorecard']) => {
    const tech = sc.technicalDepth ?? (sc as any).technical_depth ?? 0;
    return Math.round(((sc.clarity || 0) + (sc.confidence || 0) + tech + (sc.conciseness || 0)) / 4);
  };

  const typeEmoji: Record<string, string> = {
    'DSA': '🧠', 'Android Developer': '📱', 'HR Interview': '🤝', 'System Design': '🏗️',
  };

  const openScorecard = (item: InterviewHistory) => {
    // Normalize legacy entries that may have technical_depth instead of technicalDepth
    const sc = { ...item.scorecard, technicalDepth: item.scorecard.technicalDepth ?? (item.scorecard as any).technical_depth ?? 5 };
    sessionStorage.setItem('scorecard', JSON.stringify(sc));
    sessionStorage.setItem('interviewMeta', JSON.stringify({ type: item.type, personality: item.personality, duration: item.durationSeconds }));
    router.push('/scorecard');
  };

  const handleClear = () => {
    if (!confirm('Clear all history?')) return;
    localStorage.removeItem('interview_history');
    setHistory([]);
  };

  return (
    <div className="min-h-screen bg-background text-white p-6 md:p-12 flex flex-col items-center selection:bg-primary/30">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-neural-float" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[30%] h-[30%] bg-secondary/[0.06] blur-[100px] rounded-full animate-neural-float" style={{ animationDelay: '-3s' }} />
      </div>

      <div className="relative z-10 max-w-4xl w-full">
        <header className="mb-12 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push('/')}
              className="tactile-button w-11 h-11 neural-glass rounded-2xl flex items-center justify-center text-text-dim hover:text-white transition-colors"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <div>
              <h1 className="text-3xl font-black tracking-tighter">History Vault</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-dim mt-0.5">
                {history.length} session{history.length !== 1 ? 's' : ''} stored locally
              </p>
            </div>
          </div>

          {history.length > 0 && (
            <button
              onClick={handleClear}
              className="tactile-button px-4 py-2 rounded-xl neural-glass text-[10px] font-black uppercase tracking-widest text-text-dim hover:text-accent hover:border-accent/30 transition-all border border-transparent"
            >
              Clear All
            </button>
          )}
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
            <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-dim">Loading...</p>
          </div>
        ) : history.length === 0 ? (
          <div className="neural-card p-16 text-center border border-dashed border-white/10 bg-transparent">
            <div className="w-14 h-14 rounded-full bg-white/[0.03] flex items-center justify-center mx-auto mb-5">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="1.5"><path d="M3 3h18v18H3zM9 9h6M9 13h4" strokeLinecap="round" /></svg>
            </div>
            <p className="text-text-dim font-black uppercase tracking-[0.4em] text-[10px]">No sessions yet</p>
            <p className="text-text-dim/60 text-xs mt-2">Complete an interview to see it here</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {history.map((item) => {
              const score = overall(item.scorecard);
              const tech = item.scorecard.technicalDepth ?? (item.scorecard as any).technical_depth ?? 0;
              const scoreColor  = score >= 8 ? '#2DD4BF'              : score >= 6 ? '#6366F1'              : '#F43F5E';
              const scoreBg     = score >= 8 ? 'rgba(45,212,191,0.05)' : score >= 6 ? 'rgba(99,102,241,0.05)' : 'rgba(244,63,94,0.05)';
              const typeColorMap: Record<string, string> = { 'DSA': '#6366F1', 'Android Developer': '#2DD4BF', 'HR Interview': '#F59E0B', 'System Design': '#F43F5E' };
              const typeColor = typeColorMap[item.type] ?? '#6366F1';
              const subScores = [
                { l: 'Clarity',    v: item.scorecard.clarity    ?? 0, c: '#6366F1' },
                { l: 'Confidence', v: item.scorecard.confidence ?? 0, c: '#818CF8' },
                { l: 'Technical',  v: tech,                           c: '#2DD4BF' },
                { l: 'Precision',  v: item.scorecard.conciseness ?? 0, c: '#F43F5E' },
              ];

              return (
                <div
                  key={item.id}
                  onClick={() => openScorecard(item)}
                  className="group cursor-pointer relative rounded-3xl border border-white/[0.06] overflow-hidden transition-all duration-300 hover:border-white/[0.14] hover:scale-[1.02]"
                  style={{ background: `linear-gradient(140deg, rgba(255,255,255,0.02) 0%, ${scoreBg} 100%)` }}
                >
                  {/* Top shimmer line */}
                  <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${scoreColor}70, transparent)` }} />

                  <div className="p-6">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest" style={{ background: `${typeColor}18`, color: typeColor, border: `1px solid ${typeColor}30` }}>
                          {item.type}
                        </span>
                        <span className="px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest text-text-dim bg-white/[0.03] border border-white/[0.06]">
                          {item.personality}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 ml-3">
                        <div className="text-right">
                          <div className="text-4xl font-black leading-none tracking-tighter" style={{ color: scoreColor }}>{score}</div>
                          <div className="text-[8px] font-black uppercase tracking-widest text-text-dim mt-0.5 text-right">/ 10</div>
                        </div>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-text-dim group-hover:text-white group-hover:translate-x-0.5 transition-all mt-1 shrink-0">
                          <path d="M9 18l6-6-6-6" />
                        </svg>
                      </div>
                    </div>

                    {/* Sub-score bars */}
                    <div className="space-y-2.5 mb-5">
                      {subScores.map((s) => (
                        <div key={s.l} className="flex items-center gap-3">
                          <span className="text-[8px] font-black uppercase tracking-widest text-text-dim w-16 shrink-0">{s.l}</span>
                          <div className="flex-1 h-[3px] bg-white/[0.05] rounded-full overflow-hidden">
                            <div className="h-full rounded-full" style={{ width: `${(s.v / 10) * 100}%`, background: s.c }} />
                          </div>
                          <span className="text-[9px] font-black tabular-nums w-4 text-right shrink-0" style={{ color: s.c }}>{s.v || '–'}</span>
                        </div>
                      ))}
                    </div>

                    {/* Footer metadata */}
                    <div className="flex items-center justify-between pt-4 border-t border-white/[0.04]">
                      <div className="flex items-center gap-1.5">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-text-dim">
                          <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                        </svg>
                        <span className="text-[9px] font-black uppercase tracking-widest text-text-dim">{formatDuration(item.durationSeconds)}</span>
                      </div>
                      <span className="text-[9px] font-black uppercase tracking-widest text-text-dim">{formatDate(item.timestamp)}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
