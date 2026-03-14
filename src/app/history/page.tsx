'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { onAuthStateChanged, signInWithPopup } from 'firebase/auth';
import { db, auth, googleProvider } from '@/lib/firebase';
import type { InterviewHistory } from '@/types/interview';

export default function HistoryPage() {
  const router = useRouter();
  const [history, setHistory] = useState<InterviewHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    return onAuthStateChanged(auth, async (user) => {
      if (user) {
        setUserId(user.uid);
        const q = query(
          collection(db, 'users', user.uid, 'interviews'),
          orderBy('timestamp', 'desc'),
          limit(20)
        );
        try {
          const snap = await getDocs(q);
          setHistory(
            snap.docs.map((d) => ({
              id: d.id,
              timestamp: d.data().timestamp?.toMillis?.() ?? 0,
              type: d.data().type,
              personality: d.data().personality,
              durationSeconds: d.data().durationSeconds,
              scorecard: d.data().scorecard,
              transcript: d.data().transcript ?? [],
            }))
          );
        } catch (e) {
          console.error(e);
        }
      }
      setLoading(false);
    });
  }, []);

  const signIn = () => signInWithPopup(auth, googleProvider).catch(console.error);

  const formatDate = (ms: number) =>
    new Date(ms).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric',
    });

  const formatDuration = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  const overall = (sc: InterviewHistory['scorecard']) =>
    Math.round(
      ((sc.clarity || 0) + (sc.confidence || 0) + (sc.technicalDepth || 0) + (sc.conciseness || 0)) / 4
    );

  return (
    <div className="min-h-screen bg-background text-white p-6 md:p-12 flex flex-col items-center">
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] right-[-10%] w-[40%] h-[40%] bg-primary/10 blur-[120px] rounded-full animate-neural-float" />
      </div>

      <div className="relative z-10 max-w-4xl w-full">
        <header className="mb-12 flex items-center justify-between">
           <div className="flex items-center gap-6">
              <button onClick={() => router.push('/')} className="tactile-button w-12 h-12 neural-glass rounded-2xl flex items-center justify-center text-text-dim hover:text-white">
                 <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><path d="M15 18l-6-6 6-6"/></svg>
              </button>
              <h1 className="text-4xl font-black tracking-tightest">Session History</h1>
           </div>
           
           {!loading && userId && (
              <div className="hidden md:flex items-center gap-3 neural-glass px-4 py-2 rounded-full border-white/5">
                 <div className="w-2 h-2 rounded-full bg-secondary animate-pulse" />
                 <span className="text-[10px] font-black uppercase tracking-widest text-text-secondary">Neural Cloud Sync Active</span>
              </div>
           )}
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 gap-4">
             <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
             <p className="text-[10px] font-black uppercase tracking-[0.4em] text-text-dim">Accessing Neural Vault</p>
          </div>
        ) : !userId ? (
          <div className="neural-card p-12 text-center max-w-lg mx-auto">
             <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-8">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
             </div>
             <h2 className="text-xl font-black mb-4">Identity Verification Required</h2>
             <p className="text-text-secondary text-sm mb-10 leading-relaxed">Securely access your historical performance metrics and neural coaching logs.</p>
             <button onClick={signIn} className="tactile-button h-16 w-full bg-white rounded-2xl group relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
                <span className="relative z-10 text-background group-hover:text-white font-black text-xs uppercase tracking-widest">Sign in with Google</span>
             </button>
          </div>
        ) : history.length === 0 ? (
          <div className="neural-card p-16 text-center border-dashed border-white/10 bg-transparent">
             <p className="text-text-dim font-black uppercase tracking-[0.4em]">Vault Empty</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {history.map((item) => (
              <div key={item.id} className="neural-card p-8 group hover:scale-[1.02] transition-all cursor-pointer shadow-xl hover:shadow-primary/5">
                <div className="flex items-start justify-between mb-8">
                   <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center text-2xl">
                         {item.type === 'DSA' ? '🧠' : item.type === 'Android Developer' ? '📱' : '🏗️'}
                      </div>
                      <div>
                         <div className="font-black text-sm tracking-tight">{item.type}</div>
                         <div className="text-[9px] font-black text-text-dim uppercase tracking-widest mt-1">{formatDate(item.timestamp)} • {formatDuration(item.durationSeconds)}</div>
                      </div>
                   </div>
                   <div className="text-right">
                      <div className="text-3xl font-black text-primary leading-none">{overall(item.scorecard)}</div>
                      <div className="text-[8px] font-black text-text-dim uppercase tracking-tighter">Overall</div>
                   </div>
                </div>

                <div className="grid grid-cols-4 gap-2 pt-6 border-t border-white/5">
                   {[
                     { l: 'CLR', v: item.scorecard.clarity, c: 'text-primary' },
                     { l: 'CNF', v: item.scorecard.confidence, c: 'text-neural-teal' },
                     { l: 'TCH', v: item.scorecard.technicalDepth, c: 'text-secondary' },
                     { l: 'PRC', v: item.scorecard.conciseness, c: 'text-accent' },
                   ].map(s => (
                     <div key={s.l} className="text-center">
                        <div className={`text-xs font-black ${s.c}`}>{s.v || '–'}</div>
                        <div className="text-[7px] text-text-dim font-black tracking-tighter mt-1">{s.l}</div>
                     </div>
                   ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <footer className="mt-20 text-center">
           <p className="text-text-dim text-[10px] font-black uppercase tracking-[0.5em]">Neural Vault Archive System 2.6</p>
        </footer>
      </div>
    </div>
  );
}
