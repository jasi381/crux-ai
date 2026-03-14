'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { InterviewConfig, InterviewType, InterviewPersonality } from '@/types/interview';

const INTERVIEW_TYPES: { type: InterviewType; emoji: string; description: string }[] = [
  { type: 'Android Developer', emoji: '📱', description: 'Android SDK, Jetpack Compose, architecture patterns' },
  { type: 'DSA', emoji: '🧠', description: 'Data structures, algorithms, problem solving' },
  { type: 'HR Interview', emoji: '🤝', description: 'Behavioral questions, situational judgment' },
  { type: 'System Design', emoji: '🏗️', description: 'Scalability, architecture, trade-offs' },
];

const PERSONALITIES: { type: InterviewPersonality; emoji: string; description: string }[] = [
  { type: 'Friendly', emoji: '😊', description: 'Encouraging, gives hints' },
  { type: 'Strict', emoji: '🧐', description: 'Expects precise answers' },
  { type: 'FAANG-style', emoji: '🚀', description: 'High-bar, optimal solutions' },
];

// Suppress unused import warning — InterviewConfig is used as a type reference for clarity
type _Config = InterviewConfig;

export default function Home() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<InterviewType>('DSA');
  const [selectedPersonality, setSelectedPersonality] = useState<InterviewPersonality>('Friendly');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);

  const [mounted, setMounted] = useState(false);

  // Animated orb canvas
  useEffect(() => {
    setMounted(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    let t = 0;

    const draw = () => {
      const w = (canvas.width = canvas.offsetWidth);
      const h = (canvas.height = canvas.offsetHeight);
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2,
        cy = h / 2;

      // Ambient blobs
      const blobs = [
        { x: cx * 0.6 + Math.sin(t * 0.3) * 60, y: cy * 0.4, color: '#22D3EE', r: w * 0.5, a: 0.06 },
        { x: cx * 1.5 + Math.cos(t * 0.25) * 50, y: cy, color: '#A78BFA', r: w * 0.4, a: 0.04 },
        { x: cx + Math.sin(t * 0.35) * 40, y: cy * 1.7, color: '#34D399', r: w * 0.35, a: 0.03 },
      ];
      blobs.forEach((b) => {
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        g.addColorStop(
          0,
          b.color + Math.round(b.a * 255).toString(16).padStart(2, '0')
        );
        g.addColorStop(1, 'transparent');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Floating particles
      for (let i = 0; i < 20; i++) {
        const px = w * ((i * 0.047 + 0.03) % 1) + Math.sin(t + i * 0.7) * 25;
        const py = h * ((i * 0.043 + 0.05) % 1) + Math.cos(t * 0.8 + i * 1.1) * 20;
        const a = 0.2 + Math.sin(t + i * 0.4) * 0.15;
        const colors = ['#22D3EE', '#A78BFA', '#34D399'];
        ctx.fillStyle =
          colors[i % 3] +
          Math.round(Math.max(0.05, Math.min(0.35, a)) * 255)
            .toString(16)
            .padStart(2, '0');
        ctx.beginPath();
        ctx.arc(px, py, 1.5, 0, Math.PI * 2);
        ctx.fill();
      }

      t += 0.016;
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, []);

  const handleStart = () => {
    const params = new URLSearchParams({ type: selectedType, personality: selectedPersonality });
    router.push(`/interview?${params}`);
  };

  return (
    <div className="relative min-h-screen bg-[#0A0A0F] overflow-hidden">
      {/* Animated background canvas */}
      <canvas ref={canvasRef} className="absolute inset-0 w-full h-full pointer-events-none" />

      <div className="relative z-10 max-w-lg mx-auto px-6 py-12">
        {/* Hero orb */}
        <div className="flex flex-col items-center mb-10">
          <div className="relative w-32 h-32 flex items-center justify-center mb-4">
            {/* Rings */}
            {[1.6, 1.35, 1.1].map((scale, i) => (
              <div
                key={i}
                className="absolute rounded-full border border-cyan-400/20 animate-breathe"
                style={{
                  width: `${scale * 100}%`,
                  height: `${scale * 100}%`,
                  animationDelay: `${i * 0.4}s`,
                }}
              />
            ))}
            {/* Core */}
            <div
              className="w-20 h-20 rounded-full animate-breathe"
              style={{
                background:
                  'radial-gradient(circle, rgba(34,211,238,0.3) 0%, rgba(167,139,250,0.15) 50%, transparent 70%)',
              }}
            >
              <div className="w-full h-full rounded-full flex items-center justify-center text-3xl font-black text-cyan-400">
                AI
              </div>
            </div>
            {/* Orbiting dots */}
            <div className="absolute inset-0 animate-spin-slow">
              {mounted && [0, 1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="absolute w-1.5 h-1.5 rounded-full bg-cyan-400/60"
                  style={{
                    top: `${50 - 42 * Math.cos((i * Math.PI) / 3)}%`,
                    left: `${50 + 42 * Math.sin((i * Math.PI) / 3)}%`,
                  }}
                />
              ))}
            </div>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">InterviewCoach</h1>
          <p className="text-xs tracking-[0.3em] text-cyan-400/70 uppercase">Powered by Gemini</p>
        </div>

        {/* Interview Type */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-0.5 h-5 rounded-full"
              style={{ background: 'linear-gradient(#22D3EE, #A78BFA)' }}
            />
            <span className="text-xs tracking-[0.2em] text-white/50 uppercase font-medium">
              Interview Type
            </span>
          </div>
          <div className="space-y-2.5">
            {INTERVIEW_TYPES.map(({ type, emoji, description }) => (
              <button
                key={type}
                onClick={() => setSelectedType(type)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 text-left
                  ${
                    selectedType === type
                      ? 'border-cyan-400/60 bg-cyan-400/10'
                      : 'border-white/10 bg-white/5 hover:bg-white/8 hover:border-white/20'
                  }`}
              >
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0
                  ${selectedType === type ? 'bg-cyan-400/20' : 'bg-white/5'}`}
                >
                  {emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div
                    className={`font-semibold text-sm ${selectedType === type ? 'text-white' : 'text-white/70'}`}
                  >
                    {type}
                  </div>
                  <div className="text-xs text-white/30 mt-0.5">{description}</div>
                </div>
                <div
                  className={`w-5 h-5 rounded-full border flex-shrink-0 flex items-center justify-center transition-all
                  ${
                    selectedType === type
                      ? 'border-cyan-400 bg-cyan-400/20'
                      : 'border-white/20 bg-white/5'
                  }`}
                >
                  {selectedType === type && (
                    <div className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                  )}
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Personality */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-0.5 h-5 rounded-full"
              style={{ background: 'linear-gradient(#22D3EE, #A78BFA)' }}
            />
            <span className="text-xs tracking-[0.2em] text-white/50 uppercase font-medium">
              Interviewer Style
            </span>
          </div>
          <div className="flex gap-2.5 flex-wrap">
            {PERSONALITIES.map(({ type, emoji, description }) => (
              <button
                key={type}
                onClick={() => setSelectedPersonality(type)}
                className={`flex flex-col items-center px-5 py-3.5 rounded-2xl border transition-all duration-300 flex-1 min-w-[100px]
                  ${
                    selectedPersonality === type
                      ? 'border-violet-400/60 bg-violet-400/15'
                      : 'border-white/10 bg-white/5 hover:bg-white/8'
                  }`}
              >
                <span className="text-xl mb-1">{emoji}</span>
                <span
                  className={`text-xs font-semibold ${selectedPersonality === type ? 'text-white' : 'text-white/70'}`}
                >
                  {type}
                </span>
                <span className="text-[10px] text-white/30 text-center mt-0.5">{description}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Start button */}
        <button
          onClick={handleStart}
          className="relative w-full h-16 rounded-2xl overflow-hidden font-bold text-base text-[#0A0A0F] transition-transform hover:scale-[1.02] active:scale-[0.98]"
        >
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(90deg, #22D3EE, #A78BFA, #22D3EE)' }}
          />
          <div
            className="absolute inset-0 animate-shimmer"
            style={{
              background:
                'linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)',
              width: '50%',
            }}
          />
          <span className="relative z-10">Start Mock Interview →</span>
        </button>
      </div>
    </div>
  );
}
