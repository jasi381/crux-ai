'use client';
export const dynamic = 'force-dynamic';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Scorecard } from '@/types/interview';

// ─── Animated progress bar ────────────────────────────────────────────────────
function MetricBar({
  label, value, color, delay = 0,
}: { label: string; value: number; color: string; delay?: number }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth((value / 10) * 100), 400 + delay);
    return () => clearTimeout(t);
  }, [value, delay]);

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[10px] font-black uppercase tracking-[0.25em] text-text-secondary">{label}</span>
        <span className="font-black text-sm text-white tabular-nums">
          {value}<span className="text-text-dim text-[10px] font-black"> / 10</span>
        </span>
      </div>
      <div className="h-1 bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-[1100ms] ease-out"
          style={{ width: `${width}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ─── Hero score ring ──────────────────────────────────────────────────────────
function HeroRing({ value }: { value: number }) {
  const r = 68, circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    const t = setTimeout(() => setOffset(circ * (1 - value / 10)), 250);
    return () => clearTimeout(t);
  }, [value, circ]);

  const grade = value >= 9 ? 'S' : value >= 8 ? 'A' : value >= 6 ? 'B' : value >= 4 ? 'C' : 'D';
  const gradeColor = value >= 8 ? '#2DD4BF' : value >= 6 ? '#6366F1' : value >= 4 ? '#F59E0B' : '#F43F5E';

  return (
    <div className="relative flex items-center justify-center w-44 h-44 md:w-52 md:h-52 shrink-0">
      {/* Ambient glow */}
      <div
        className="absolute inset-[-20%] rounded-full blur-3xl opacity-25 transition-colors duration-1000"
        style={{ background: gradeColor }}
      />
      {/* Track ring */}
      <svg className="w-full h-full -rotate-90 absolute" viewBox="0 0 160 160">
        <circle cx="80" cy="80" r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth="7" />
        <circle
          cx="80" cy="80" r={r} fill="none"
          stroke="url(#heroGrad)"
          strokeWidth="7"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1.5s cubic-bezier(0.22,1,0.36,1)' }}
        />
        <defs>
          <linearGradient id="heroGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#6366F1" />
            <stop offset="100%" stopColor="#2DD4BF" />
          </linearGradient>
        </defs>
      </svg>
      {/* Center content */}
      <div className="relative z-10 flex flex-col items-center">
        <span className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-none">{value}</span>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[9px] font-black uppercase tracking-[0.3em] text-text-dim">Neural Score</span>
          <span className="text-[9px] font-black px-1.5 py-0.5 rounded" style={{ background: `${gradeColor}22`, color: gradeColor }}>
            {grade}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function ScorecardPage() {
  const router = useRouter();
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);
  const [meta, setMeta] = useState<{ type: string; personality: string; duration: number } | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const sc = sessionStorage.getItem('scorecard');
    const m  = sessionStorage.getItem('interviewMeta');
    if (sc) setScorecard(JSON.parse(sc));
    if (m)  setMeta(JSON.parse(m));
    setTimeout(() => setMounted(true), 60);
  }, []);

  if (!scorecard) return null;

  const overall = Math.round(
    (scorecard.clarity + scorecard.confidence + (scorecard.technicalDepth || 5) + scorecard.conciseness) / 4
  );

  const formatDuration = (s: number) => `${Math.floor(s / 60)}m ${s % 60}s`;

  const handleExport = () => {
    const date = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    const W = 1200, PAD = 72;
    const CARD_INNER_W = W - PAD * 2 - 80;
    const LINE_H = 20, CARD_PAD = 40, CARD_MIN_H = 72, CARD_GAP = 16;

    // ── helpers ────────────────────────────────────────────────────────
    const measureLines = (ctx: CanvasRenderingContext2D, text: string, maxW: number) => {
      const words = text.split(' ');
      let line = '', lines: string[] = [];
      words.forEach(w => {
        const test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
        else line = test;
      });
      if (line) lines.push(line);
      return lines;
    };
    const rr = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
      ctx.beginPath(); ctx.moveTo(x+r,y);
      ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
      ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
      ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
      ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
    };

    // ── pre-measure suggestion card heights ────────────────────────────
    const tmp = document.createElement('canvas').getContext('2d')!;
    tmp.font = '500 14px system-ui';
    const suggLines = scorecard.suggestions.map(s => measureLines(tmp, s, CARD_INNER_W));
    const cardHs    = suggLines.map(l => Math.max(l.length * LINE_H + CARD_PAD, CARD_MIN_H));
    const CARDS_H   = cardHs.reduce((a,b)=>a+b,0) + (cardHs.length-1) * CARD_GAP;

    // ── dynamic canvas height ───────────────────────────────────────────
    const H = 460 + CARDS_H + 32 + 20 + 48;
    const canvas = document.createElement('canvas');
    canvas.width = W; canvas.height = H;
    const c = canvas.getContext('2d')!;

    // ── background ──
    c.fillStyle = '#07070B'; c.fillRect(0, 0, W, H);
    const g1 = c.createRadialGradient(240, 60, 0, 240, 60, 500);
    g1.addColorStop(0,'rgba(99,102,241,0.14)'); g1.addColorStop(1,'transparent');
    c.fillStyle = g1; c.fillRect(0,0,W,H);
    const g2 = c.createRadialGradient(W-140, H, 0, W-140, H, 440);
    g2.addColorStop(0,'rgba(45,212,191,0.10)'); g2.addColorStop(1,'transparent');
    c.fillStyle = g2; c.fillRect(0,0,W,H);

    // noise texture — 800 random 1px dots
    for (let i = 0; i < 800; i++) {
      c.fillStyle = `rgba(255,255,255,${(Math.random()*0.03).toFixed(3)})`;
      c.fillRect(Math.random()*W|0, Math.random()*H|0, 1, 1);
    }

    c.textAlign = 'left';

    // ── branding lockup (top-left, y=36) ──
    c.beginPath(); c.arc(PAD, 36, 5, 0, Math.PI*2);
    c.fillStyle = '#6366F1'; c.fill();
    c.font = '800 13px system-ui';
    c.fillStyle = '#ffffff';
    c.fillText('InterviewCoach', PAD + 14, 41);
    const brandW = c.measureText('InterviewCoach').width;
    c.fillStyle = '#6366F1';
    c.fillText('.ai', PAD + 14 + brandW, 41);

    // ── eyebrow (y=74) ──
    c.font = '700 10px system-ui';
    c.fillStyle = '#475569';
    c.fillText('PERFORMANCE REPORT', PAD, 74);

    // ── H1 (y=116) ──
    c.font = '900 38px system-ui';
    c.fillStyle = '#ffffff';
    c.fillText(`${meta?.type || ''} Interview`, PAD, 116);

    // ── meta line (y=148) ──
    c.font = '600 12px system-ui';
    c.fillStyle = '#64748B';
    const metaParts = [meta?.personality, meta?.duration ? formatDuration(meta.duration) : null, date].filter(Boolean);
    c.fillText(metaParts.join('   ·   ').toUpperCase(), PAD, 148);

    // ── score ring (right, CX=W-PAD-56, CY=100, R=56) ──
    const CX = W - PAD - 56, CY = 100, R = 56;
    const scoreColor = overall >= 8 ? '#2DD4BF' : overall >= 6 ? '#6366F1' : overall >= 4 ? '#F59E0B' : '#F43F5E';
    const sg = c.createRadialGradient(CX, CY, 0, CX, CY, 92);
    sg.addColorStop(0, `${scoreColor}30`); sg.addColorStop(1, 'transparent');
    c.fillStyle = sg; c.beginPath(); c.arc(CX, CY, 92, 0, Math.PI*2); c.fill();
    // track
    c.beginPath(); c.arc(CX, CY, R, -Math.PI/2, Math.PI*2 - Math.PI/2);
    c.strokeStyle = 'rgba(255,255,255,0.05)'; c.lineWidth = 8; c.stroke();
    // fill arc
    const arcGrad = c.createLinearGradient(CX-R, CY, CX+R, CY);
    arcGrad.addColorStop(0, '#6366F1'); arcGrad.addColorStop(1, '#2DD4BF');
    c.beginPath(); c.arc(CX, CY, R, -Math.PI/2, -Math.PI/2 + 2*Math.PI*(overall/10));
    c.strokeStyle = arcGrad; c.lineWidth = 8; c.lineCap = 'round'; c.stroke();
    // score number
    c.font = '900 46px system-ui';
    c.fillStyle = '#ffffff'; c.textAlign = 'center';
    c.fillText(`${overall}`, CX, CY + 16);
    // label BELOW ring (CY+R+22 = 178 — clear of ring)
    c.font = '700 9px system-ui';
    c.fillStyle = '#475569';
    c.fillText('NEURAL SCORE', CX, CY + R + 22);
    c.textAlign = 'left';

    // ── divider 1 (y=172) ──
    const mkDivGrad = (y0: number) => {
      const dg = c.createLinearGradient(PAD, y0, W-PAD, y0);
      dg.addColorStop(0, 'transparent'); dg.addColorStop(0.5, 'rgba(255,255,255,0.08)'); dg.addColorStop(1, 'transparent');
      return dg;
    };
    c.strokeStyle = mkDivGrad(172); c.lineWidth = 1;
    c.beginPath(); c.moveTo(PAD, 172); c.lineTo(W-PAD, 172); c.stroke();

    // ── CORE DIMENSIONS (label=204, accent bar y=188) ──
    c.fillStyle = '#6366F1'; c.fillRect(PAD, 188, 3, 20);
    c.font = '700 10px system-ui';
    c.fillStyle = '#475569';
    c.fillText('CORE DIMENSIONS', PAD + 14, 204);

    // metrics 2×2 grid starting y=224, row height=76
    const barColors = ['#6366F1','#818CF8','#2DD4BF','#F43F5E'];
    const barLabels = ['Clarity','Confidence','Technical Depth','Precision'];
    const barVals   = [scorecard.clarity, scorecard.confidence, scorecard.technicalDepth||5, scorecard.conciseness];
    const colW = (W - PAD*2 - 48) / 2;

    barVals.forEach((val, i) => {
      const col = i % 2, row = Math.floor(i / 2);
      const bx = PAD + col*(colW+48), by = 224 + row*76;
      c.font = '600 11px system-ui'; c.fillStyle = '#94A3B8'; c.textAlign = 'left';
      c.fillText(barLabels[i].toUpperCase(), bx, by+14);
      c.font = '900 14px system-ui'; c.fillStyle = '#ffffff'; c.textAlign = 'right';
      c.fillText(`${val}`, bx+colW-24, by+14);
      c.font = '600 10px system-ui'; c.fillStyle = '#475569';
      c.fillText('/10', bx+colW, by+14); c.textAlign = 'left';
      // track
      rr(c, bx, by+26, colW, 4, 2); c.fillStyle = 'rgba(255,255,255,0.05)'; c.fill();
      // fill
      if (val > 0) {
        const fillW = colW*(val/10);
        rr(c, bx, by+26, fillW, 4, 2); c.fillStyle = barColors[i]; c.fill();
        // end-cap glow
        const glowGrad = c.createRadialGradient(bx+fillW, by+28, 0, bx+fillW, by+28, 9);
        glowGrad.addColorStop(0, `${barColors[i]}70`); glowGrad.addColorStop(1, 'transparent');
        c.fillStyle = glowGrad; c.fillRect(bx+fillW-9, by+20, 18, 16);
      }
    });

    // ── divider 2 (y=400) ──
    c.strokeStyle = mkDivGrad(400); c.lineWidth = 1;
    c.beginPath(); c.moveTo(PAD, 400); c.lineTo(W-PAD, 400); c.stroke();

    // ── NEURAL COACHING (label=436, accent bar y=420) ──
    c.fillStyle = '#2DD4BF'; c.fillRect(PAD, 420, 3, 20);
    c.font = '700 10px system-ui';
    c.fillStyle = '#475569';
    c.fillText('NEURAL COACHING', PAD + 14, 436);

    // ── coaching cards (start y=460) ──
    let cardY = 460;
    scorecard.suggestions.forEach((s, i) => {
      const cardH = cardHs[i];
      rr(c, PAD, cardY, W-PAD*2, cardH, 12);
      c.fillStyle = 'rgba(255,255,255,0.025)'; c.fill();
      c.fillStyle = '#6366F1'; c.fillRect(PAD, cardY, 2, cardH);
      c.font = '900 11px monospace'; c.fillStyle = 'rgba(99,102,241,0.4)'; c.textAlign = 'left';
      c.fillText(String(i+1).padStart(2,'0'), PAD+18, cardY + cardH/2 + 5);
      c.font = '500 14px system-ui'; c.fillStyle = 'rgba(255,255,255,0.82)';
      const lines = suggLines[i];
      const textStartY = cardY + (cardH - lines.length*LINE_H)/2 + LINE_H - 4;
      lines.forEach((ln, li) => c.fillText(ln, PAD+48, textStartY + li*LINE_H));
      cardY += cardH + CARD_GAP;
    });

    // ── footer ──
    const footerY = cardY + 48;
    c.strokeStyle = mkDivGrad(footerY - 24); c.lineWidth = 1;
    c.beginPath(); c.moveTo(PAD, footerY-24); c.lineTo(W-PAD, footerY-24); c.stroke();
    c.font = '700 10px system-ui'; c.fillStyle = '#6366F1'; c.textAlign = 'left';
    c.fillText('InterviewCoach.ai', PAD, footerY);
    c.font = '500 10px system-ui'; c.fillStyle = '#475569'; c.textAlign = 'right';
    c.fillText('Generated by InterviewCoach.ai', W-PAD, footerY);
    c.textAlign = 'left';

    // ── download ──
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `interview-report-${(meta?.type||'').toLowerCase().replace(/\s+/g,'-')}-${Date.now()}.png`;
      a.click(); URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const metrics = [
    { label: 'Clarity',        value: scorecard.clarity,                color: '#6366F1' },
    { label: 'Confidence',     value: scorecard.confidence,             color: '#818CF8' },
    { label: 'Technical Depth',value: scorecard.technicalDepth || 5,    color: '#2DD4BF' },
    { label: 'Precision',      value: scorecard.conciseness,            color: '#F43F5E' },
  ];

  return (
    <div className="min-h-screen bg-background text-white selection:bg-primary/30 overflow-x-hidden">
      {/* Background glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute top-[-20%] left-[-10%] w-[55%] h-[55%] bg-primary/[0.07] blur-[160px] rounded-full animate-neural-float" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[40%] h-[45%] bg-secondary/[0.06] blur-[130px] rounded-full animate-neural-float" style={{ animationDelay: '-5s' }} />
        <div className="absolute top-[40%] left-[50%] w-[25%] h-[25%] bg-accent/[0.03] blur-[100px] rounded-full animate-neural-float" style={{ animationDelay: '-2s' }} />
      </div>
      <div className="fixed inset-0 pointer-events-none after-scan" aria-hidden />

      {/* ── HERO SECTION ──────────────────────────────────────────────────────── */}
      <section className="relative border-b border-white/[0.04] py-14 px-6 flex flex-col items-center">
        {/* Analysis badge */}
        <div
          className={`inline-flex items-center gap-2.5 px-5 py-2 rounded-full neural-glass border border-primary/20 mb-10 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-2'}`}
          style={{ transitionDelay: '100ms' }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#6366F1]" />
          <span className="text-[9px] font-black uppercase tracking-[0.35em] text-primary">Analysis Protocol Complete</span>
        </div>

        {/* Score + meta row */}
        <div
          className={`flex flex-col md:flex-row items-center gap-10 md:gap-16 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}
          style={{ transitionDelay: '200ms' }}
        >
          <HeroRing value={overall} />

          <div>
            <h1 className="text-4xl md:text-5xl font-black tracking-tighter mb-4 bg-clip-text text-transparent bg-gradient-to-r from-white to-white/40">
              Performance<br />Report
            </h1>

            {/* Tags */}
            <div className="flex flex-wrap gap-2 mb-5">
              <span className="px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-black uppercase tracking-widest text-primary">
                {meta?.type}
              </span>
              <span className="px-3 py-1 rounded-full neural-glass border border-white/[0.08] text-[9px] font-black uppercase tracking-widest text-text-secondary">
                {meta?.personality}
              </span>
              {meta?.duration != null && (
                <span className="px-3 py-1 rounded-full neural-glass border border-white/[0.08] text-[9px] font-black uppercase tracking-widest text-text-dim">
                  {formatDuration(meta.duration)}
                </span>
              )}
            </div>

            <p className="text-[10px] font-black uppercase tracking-[0.3em] text-text-dim">
              {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          </div>
        </div>
      </section>

      {/* ── BODY ──────────────────────────────────────────────────────────────── */}
      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12 space-y-14">

        {/* Core Dimensions */}
        <section
          className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ transitionDelay: '350ms' }}
        >
          <div className="flex items-center gap-3 mb-7">
            <div className="w-1 h-5 bg-primary rounded-full" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-text-secondary">Core Dimensions</h2>
          </div>
          <div className="neural-glass rounded-3xl p-8 grid grid-cols-1 md:grid-cols-2 gap-7">
            {metrics.map((m, i) => (
              <MetricBar key={m.label} {...m} delay={i * 120} />
            ))}
          </div>
        </section>

        {/* Neural Coaching */}
        <section
          className={`transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ transitionDelay: '500ms' }}
        >
          <div className="flex items-center gap-3 mb-7">
            <div className="w-1 h-5 bg-secondary rounded-full" />
            <h2 className="text-[10px] font-black uppercase tracking-[0.4em] text-text-secondary">Neural Coaching</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {scorecard.suggestions.map((s, i) => (
              <div
                key={i}
                className="neural-glass rounded-2xl p-6 border-l-2 border-primary/60 hover:border-primary hover:bg-white/[0.03] transition-all duration-300 group"
              >
                <div className="flex items-start gap-4">
                  <span className="font-mono text-[10px] font-black text-primary/50 group-hover:text-primary shrink-0 mt-0.5 transition-colors">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                  <p className="text-sm text-white/75 leading-relaxed group-hover:text-white/95 transition-colors">{s}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Action row */}
        <section
          className={`flex flex-col sm:flex-row gap-3 pb-6 transition-all duration-700 ${mounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-6'}`}
          style={{ transitionDelay: '650ms' }}
        >
          {/* New Session */}
          <button
            onClick={() => router.push('/')}
            className="tactile-button flex-1 h-14 rounded-2xl bg-white group relative overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
            <span className="relative z-10 text-background group-hover:text-white font-black text-[11px] uppercase tracking-[0.22em] transition-colors">
              New Session
            </span>
          </button>

          {/* Export */}
          <button
            onClick={handleExport}
            className="tactile-button flex-1 h-14 rounded-2xl neural-glass border border-white/[0.08] hover:border-secondary/40 hover:bg-secondary/[0.05] transition-all group flex items-center justify-center gap-2.5"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-dim group-hover:text-secondary transition-colors">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
            </svg>
            <span className="font-black text-[11px] uppercase tracking-[0.22em] text-text-dim group-hover:text-secondary transition-colors">
              Export Report
            </span>
          </button>

          {/* History */}
          <button
            onClick={() => router.push('/history')}
            className="tactile-button flex-1 h-14 rounded-2xl neural-glass border border-white/[0.08] hover:border-primary/40 hover:bg-primary/[0.05] transition-all group"
          >
            <span className="font-black text-[11px] uppercase tracking-[0.22em] text-text-dim group-hover:text-primary transition-colors">
              History Vault
            </span>
          </button>
        </section>
      </div>
    </div>
  );
}
