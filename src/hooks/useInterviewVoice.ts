'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { CloudVoice } from '@/lib/cloudVoices';

type SpeechRecognitionEvent = Event & {
  results: ArrayLike<{ 0: { transcript: string }; isFinal: boolean; length: number }> & {
    length: number;
  };
  resultIndex: number;
};

type SpeechRecognitionErrorEvent = Event & { error: string };

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type SpeechRecognitionCtor = new () => SpeechRecognitionInstance;

type PuterSdk = {
  ai: {
    txt2speech: (
      text: string,
      options?: Record<string, unknown>,
    ) => Promise<HTMLAudioElement>;
  };
};

declare global {
  interface Window {
    webkitSpeechRecognition?: SpeechRecognitionCtor;
    SpeechRecognition?: SpeechRecognitionCtor;
    puter?: PuterSdk;
  }
}

export type VoicePhase = 'idle' | 'speaking' | 'listening';

export interface UseInterviewVoice {
  supported: boolean | null;
  phase: VoicePhase;
  interimTranscript: string;
  /** Speak `text`. Resolves when audio playback ends (or fallback synth ends). */
  speak: (text: string) => Promise<void>;
  /** Listen for one user turn. Resolves with the final transcript on STT end. */
  listen: () => Promise<string>;
  /** Stop both directions (used on End Interview / unmount). */
  cancel: () => void;
}

function waitForPuter(timeoutMs = 5000): Promise<PuterSdk | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') return resolve(null);
    if (window.puter) return resolve(window.puter);
    const start = Date.now();
    const tick = () => {
      if (window.puter) return resolve(window.puter);
      if (Date.now() - start > timeoutMs) return resolve(null);
      setTimeout(tick, 100);
    };
    tick();
  });
}

export function useInterviewVoice(voice: CloudVoice): UseInterviewVoice {
  const [supported, setSupported] = useState<boolean | null>(null);
  const [phase, setPhase] = useState<VoicePhase>('idle');
  const [interimTranscript, setInterimTranscript] = useState('');

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voiceRef = useRef<CloudVoice>(voice);

  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor || !('speechSynthesis' in window)) {
      setSupported(false);
      return;
    }
    setSupported(true);

    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      window.speechSynthesis.cancel();
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const speakBrowser = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        resolve();
        return;
      }
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'en-US';
      u.rate = 1.02;
      u.pitch = 1.0;
      const voices = window.speechSynthesis.getVoices();
      const preferred =
        voices.find((v) => /en-US/i.test(v.lang) && /female|samantha|google us/i.test(v.name)) ??
        voices.find((v) => /en-US/i.test(v.lang)) ??
        voices[0];
      if (preferred) u.voice = preferred;
      u.onstart = () => setPhase('speaking');
      u.onend = () => {
        setPhase('idle');
        resolve();
      };
      u.onerror = () => {
        setPhase('idle');
        resolve();
      };
      window.speechSynthesis.speak(u);
    });
  }, []);

  const speak = useCallback(
    async (text: string): Promise<void> => {
      if (!text || typeof window === 'undefined') return;

      // Stop anything still playing or listening before speaking.
      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      window.speechSynthesis.cancel();

      const puter = await waitForPuter();
      if (!puter) return speakBrowser(text);

      try {
        const audio = await puter.ai.txt2speech(text, voiceRef.current.options);
        audioRef.current = audio;
        setPhase('speaking');
        await new Promise<void>((resolve) => {
          audio.onended = () => {
            if (audioRef.current === audio) audioRef.current = null;
            setPhase('idle');
            resolve();
          };
          audio.onerror = () => {
            if (audioRef.current === audio) audioRef.current = null;
            setPhase('idle');
            resolve();
          };
          audio.play().catch(() => {
            setPhase('idle');
            resolve();
          });
        });
      } catch {
        return speakBrowser(text);
      }
    },
    [speakBrowser],
  );

  const listen = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      if (typeof window === 'undefined') return resolve('');
      const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
      if (!Ctor) return resolve('');

      try {
        recognitionRef.current?.abort();
      } catch {
        /* noop */
      }

      const r = new Ctor();
      r.continuous = false;
      r.interimResults = true;
      r.lang = 'en-US';
      recognitionRef.current = r;

      let finalBuffer = '';

      r.onresult = (e) => {
        let interim = '';
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const result = e.results[i];
          const transcript = result[0].transcript;
          if (result.isFinal) finalBuffer += transcript;
          else interim += transcript;
        }
        setInterimTranscript(interim);
      };

      r.onerror = () => {
        // onend will still fire and resolve.
      };

      r.onstart = () => setPhase('listening');

      r.onend = () => {
        if (recognitionRef.current === r) recognitionRef.current = null;
        setPhase('idle');
        setInterimTranscript('');
        resolve(finalBuffer.trim());
      };

      try {
        r.start();
      } catch {
        setPhase('idle');
        resolve('');
      }
    });
  }, []);

  const cancel = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      recognitionRef.current?.abort();
    } catch {
      /* noop */
    }
    recognitionRef.current = null;
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    window.speechSynthesis.cancel();
    setPhase('idle');
    setInterimTranscript('');
  }, []);

  return { supported, phase, interimTranscript, speak, listen, cancel };
}
