'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { getAudioEngine } from '@/audio/AudioEngine';
import { useStore } from '@/state/store';

type EntryMode = 'tab' | 'mic' | 'ambient';

/**
 * Intro
 * Cinematic entry gate. Also serves as the required user gesture to
 * unlock the AudioContext on most browsers.
 */
export function Intro({ onEnter }: { onEnter: () => void }) {
  const [busy, setBusy] = useState<EntryMode | null>(null);
  const setStore = useStore((s) => s.set);

  async function enter(mode: EntryMode) {
    if (busy) return;
    setBusy(mode);
    const engine = getAudioEngine();
    try {
      if (mode === 'tab') {
        try {
          await engine.initTab();
          setStore('useTab', true);
          setStore('useMic', false);
          setStore('usingAudio', true);
          setStore('audioSourceLabel', 'Tab');
        } catch {
          await engine.initSimulated();
          setStore('useTab', false);
          setStore('usingAudio', false);
          setStore('audioSourceLabel', 'Ambient');
        }
      } else if (mode === 'mic') {
        try {
          await engine.initMic();
          setStore('useMic', true);
          setStore('useTab', false);
          setStore('usingAudio', true);
          setStore('audioSourceLabel', 'Mic');
        } catch {
          await engine.initSimulated();
          setStore('useMic', false);
          setStore('usingAudio', false);
          setStore('audioSourceLabel', 'Ambient');
        }
      } else {
        await engine.initSimulated();
        setStore('usingAudio', false);
        setStore('audioSourceLabel', 'Ambient');
      }
    } finally {
      onEnter();
    }
  }

  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: [0.2, 0.8, 0.2, 1] }}
      className="fixed inset-0 z-30 flex items-center justify-center bg-black"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 1.2, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative text-center px-6 max-w-2xl"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1.4, delay: 0.1, ease: [0.2, 0.8, 0.2, 1] }}
          className="mx-auto mb-8 w-24 h-24"
        >
          <svg viewBox="0 0 100 100" className="w-full h-full">
            <defs>
              <radialGradient id="g" cx="50%" cy="50%" r="60%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="0.9" />
                <stop offset="60%" stopColor="#8ec8ff" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#c48eff" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="50" cy="50" r="46" fill="url(#g)">
              <animate attributeName="r" values="42;48;42" dur="4s" repeatCount="indefinite" />
            </circle>
            <circle cx="50" cy="50" r="32" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.6" />
            <circle cx="50" cy="50" r="20" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="0.6" />
            <circle cx="50" cy="50" r="3" fill="#fff" />
          </svg>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.5 }}
          className="text-[clamp(28px,5vw,60px)] font-light tracking-[0.32em] uppercase"
        >
          Lightshow
        </motion.h1>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 0.9 }}
          className="mt-3 text-white/60 text-sm md:text-base tracking-wide"
        >
          A six-movement journey of light that listens.
          <br className="hidden sm:block" />
          Share the tab playing your music. Let it breathe.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.4 }}
          className="mt-10 flex flex-col items-center justify-center gap-3"
        >
          <button
            className="btn primary w-full sm:w-auto min-w-[260px]"
            onClick={() => enter('tab')}
            disabled={!!busy}
          >
            {busy === 'tab' ? 'Requesting…' : 'Share a Browser Tab (recommended)'}
          </button>
          <div className="flex flex-col sm:flex-row gap-3">
            <button className="btn" onClick={() => enter('mic')} disabled={!!busy}>
              {busy === 'mic' ? 'Requesting…' : 'Use Microphone'}
            </button>
            <button className="btn" onClick={() => enter('ambient')} disabled={!!busy}>
              {busy === 'ambient' ? 'Loading…' : 'Enter (ambient)'}
            </button>
          </div>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.9 }}
          className="mt-6 text-[11px] text-white/40 tracking-wide leading-relaxed max-w-md mx-auto"
        >
          Tab sharing lets Lightshow hear music from another browser tab (YouTube, Spotify Web, etc.).
          In the browser prompt, pick the tab playing music and <span className="text-white/70">keep "Share tab audio" enabled</span>.
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 2.2 }}
          className="mt-6 text-[11px] text-white/35 tracking-[0.2em] uppercase"
        >
          Best experienced full-screen · WebGL required
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
