'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import type { InterviewType, InterviewPersonality } from '@/types/interview';

const INTERVIEW_TYPES: { type: InterviewType; emoji: string; description: string; gridArea: string }[] = [
  { type: 'Android Developer', emoji: '📱', description: 'Architecture & Compose', gridArea: 'md:col-span-2 md:row-span-2' },
  { type: 'DSA', emoji: '🧠', description: 'Logic & Patterns', gridArea: 'md:col-span-1 md:row-span-2' },
  { type: 'HR Interview', emoji: '🤝', description: 'EQ & Behavior', gridArea: 'md:col-span-1 md:row-span-1' },
  { type: 'System Design', emoji: '🏗️', description: 'Scale & Infra', gridArea: 'md:col-span-1 md:row-span-1' },
];

const PERSONALITIES: { type: InterviewPersonality; emoji: string; description: string }[] = [
  { type: 'Friendly', emoji: '✨', description: 'Collaborative AI' },
  { type: 'Strict', emoji: '💠', description: 'High-Bar Agent' },
  { type: 'FAANG-style', emoji: '🚀', description: 'Optimal-Mode' },
];

export default function Home() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<InterviewType>('DSA');
  const [selectedPersonality, setSelectedPersonality] = useState<InterviewPersonality>('Friendly');

  // Precompile the interview page in the background while user is on home screen
  useEffect(() => { router.prefetch('/interview'); }, [router]);

  const navigate = () => {
    window.location.href = `/interview?type=${encodeURIComponent(selectedType)}&personality=${encodeURIComponent(selectedPersonality)}`;
  };

  return (
    <div className="min-h-screen bg-background text-white selection:bg-primary/30 p-4 md:p-8 flex items-center justify-center">
      {/* Decorative Neural Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-neural-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[35%] h-[35%] bg-secondary/10 blur-[100px] rounded-full animate-neural-float [animation-delay:-5s]" />
      </div>

      <div className="relative z-10 max-w-5xl w-full">
        {/* Header Section */}
        <header className="mb-12 flex flex-col items-center text-center">
          <div className="w-16 h-16 mb-6">
            <img src="/crux-icon.svg" alt="Crux.ai" className="w-full h-full" />
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tightest mb-4 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/40">
            Crux<span className="text-primary font-serif">.ai</span>
          </h1>
          <p className="text-text-secondary text-lg max-w-xl leading-relaxed">
            Neural-agent driven mock interviews. Designed for the 2026 talent landscape.
          </p>
        </header>

        {/* Bento Grid Layout */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-6 mb-12">
          
          {/* Main Selection Panel */}
          <section className="md:col-span-4 neural-card p-8 flex flex-col justify-between group">
             <div>
               <div className="flex items-center gap-3 mb-8">
                 <div className="w-2 h-2 rounded-full bg-primary shadow-[0_0_8px_rgba(99,102,241,1)]" />
                 <h2 className="text-xs font-black uppercase tracking-[0.3em] text-text-secondary">Neural Domains</h2>
               </div>
               <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                 {INTERVIEW_TYPES.map(({ type, emoji, description }) => (
                   <button
                     key={type}
                     onClick={() => setSelectedType(type)}
                     className={`tactile-button p-6 rounded-[1.5rem] text-left transition-all relative overflow-hidden
                       ${selectedType === type 
                         ? 'bg-primary/10 border-2 border-primary/40 shadow-xl' 
                         : 'bg-white/[0.03] border border-white/[0.05] hover:bg-white/[0.06]'}`}
                   >
                     <span className="text-3xl mb-4 block">{emoji}</span>
                     <div className="font-bold text-lg mb-1">{type}</div>
                     <div className="text-xs text-text-secondary font-medium uppercase tracking-wider">{description}</div>
                     {selectedType === type && (
                       <div className="absolute top-2 right-2 w-2 h-2 bg-primary rounded-full animate-pulse" />
                     )}
                   </button>
                 ))}
               </div>
             </div>
             
             <div className="mt-12 pt-8 border-t border-white/5 flex items-center justify-between">
                <div className="text-xs font-medium text-text-dim uppercase tracking-widest">Targeting: <span className="text-white ml-2">{selectedType}</span></div>
                <div className="flex -space-x-2">
                   {[1,2,3,4].map(i => (
                     <div key={i} className="w-8 h-8 rounded-full border-2 border-background bg-surface flex items-center justify-center text-[10px] font-black overflow-hidden">
                        <img src={`https://i.pravatar.cc/100?u=${i*123}`} alt="User" />
                     </div>
                   ))}
                   <div className="w-8 h-8 rounded-full border-2 border-background bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary backdrop-blur-sm">+12k</div>
                </div>
             </div>
          </section>

          {/* Personality & Mode Panel */}
          <section className="md:col-span-2 flex flex-col gap-6">
             <div className="neural-card p-8 flex-1">
                <div className="flex items-center gap-3 mb-6">
                   <div className="w-2 h-2 rounded-full bg-secondary shadow-[0_0_8px_rgba(45,212,191,1)]" />
                   <h2 className="text-xs font-black uppercase tracking-[0.3em] text-text-secondary">Agent Persona</h2>
                </div>
                <div className="space-y-3">
                  {PERSONALITIES.map(({ type, emoji, description }) => (
                    <button
                      key={type}
                      onClick={() => setSelectedPersonality(type)}
                      className={`tactile-button w-full flex items-center gap-4 p-4 rounded-2xl border transition-all
                        ${selectedPersonality === type 
                          ? 'bg-secondary/10 border-secondary/40' 
                          : 'bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]'}`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all
                        ${selectedPersonality === type ? 'bg-secondary text-background shadow-inner' : 'bg-white/5'}`}>
                        {emoji}
                      </div>
                      <div className="text-left">
                        <div className={`font-bold text-sm ${selectedPersonality === type ? 'text-white' : 'text-text-secondary'}`}>{type}</div>
                        <div className="text-[10px] text-text-dim font-black uppercase tracking-widest">{description}</div>
                      </div>
                    </button>
                  ))}
                </div>
             </div>

             {/* History Vault card */}
             <button
               onClick={() => window.location.href = '/history'}
               className="tactile-button neural-glass rounded-2xl px-5 py-4 flex items-center justify-between group border border-white/[0.05] hover:border-primary/30 hover:bg-primary/[0.04] transition-all w-full"
             >
               <div className="flex items-center gap-3">
                 <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                   <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2.5" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                 </div>
                 <div className="text-left">
                   <div className="text-xs font-black text-white leading-none">History Vault</div>
                   <div className="text-[9px] font-black uppercase tracking-widest text-text-dim mt-0.5">Past Sessions</div>
                 </div>
               </div>
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" className="text-text-dim group-hover:text-primary group-hover:translate-x-0.5 transition-all">
                 <path d="M9 18l6-6-6-6"/>
               </svg>
             </button>

             <button
               onClick={navigate}
               className="tactile-button h-24 rounded-[2rem] bg-white group relative overflow-hidden shadow-2xl w-full"
             >
                <div className="absolute inset-0 bg-gradient-to-r from-primary to-secondary opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <div className="relative z-10 flex items-center justify-center gap-4">
                  <span className="text-background group-hover:text-white font-black text-xl transition-colors">INITIATE_SESSION</span>
                  <div className="w-10 h-10 rounded-full bg-background flex items-center justify-center group-hover:scale-110 transition-transform">
                     <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3">
                        <path d="M5 12h14M12 5l7 7-7 7" />
                     </svg>
                  </div>
                </div>
             </button>
          </section>
        </div>

      </div>
    </div>
  );
}
