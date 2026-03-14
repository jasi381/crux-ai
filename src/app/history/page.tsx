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
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const formatDuration = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  const overall = (sc: InterviewHistory['scorecard']) =>
    Math.round(
      ((sc.clarity || 0) + (sc.confidence || 0) + (sc.technicalDepth || 0) + (sc.conciseness || 0)) /
        4
    );

  return (
    <div className="min-h-screen bg-[#0A0A0F] px-5 py-10 max-w-lg mx-auto">
      <div className="flex items-center gap-4 mb-8">
        <button
          onClick={() => router.push('/')}
          className="text-white/40 hover:text-white transition-colors text-lg"
        >
          ←
        </button>
        <h1 className="text-2xl font-bold text-white">Interview History</h1>
      </div>

      {loading && (
        <div className="text-center text-white/40 py-20">Loading…</div>
      )}

      {!loading && !userId && (
        <div className="text-center py-20">
          <p className="text-white/50 mb-6">Sign in to view your interview history</p>
          <button
            onClick={signIn}
            className="px-6 py-3 rounded-xl text-[#0A0A0F] font-bold relative overflow-hidden"
          >
            <div
              className="absolute inset-0"
              style={{ background: 'linear-gradient(90deg, #22D3EE, #A78BFA)' }}
            />
            <span className="relative z-10">Sign in with Google</span>
          </button>
        </div>
      )}

      {!loading && userId && history.length === 0 && (
        <div className="text-center py-20 text-white/40">
          No interviews yet. Start your first one!
        </div>
      )}

      <div className="space-y-3">
        {history.map((item) => (
          <div key={item.id} className="p-4 rounded-2xl border border-white/10 bg-white/5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <div className="font-semibold text-white text-sm">{item.type}</div>
                <div className="text-xs text-white/40 mt-0.5">
                  {item.personality} · {formatDuration(item.durationSeconds)}
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-white">
                  {overall(item.scorecard)}
                  <span className="text-sm text-white/30 font-normal">/10</span>
                </div>
                <div className="text-xs text-white/40">{formatDate(item.timestamp)}</div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: 'Clarity', value: item.scorecard.clarity, color: '#22D3EE' },
                { label: 'Confidence', value: item.scorecard.confidence, color: '#A78BFA' },
                { label: 'Technical', value: item.scorecard.technicalDepth, color: '#34D399' },
                { label: 'Conciseness', value: item.scorecard.conciseness, color: '#FB7185' },
              ].map(({ label, value, color }) => (
                <div key={label} className="text-center">
                  <div className="text-base font-bold" style={{ color }}>
                    {value || '–'}
                  </div>
                  <div className="text-[9px] text-white/30">{label}</div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
