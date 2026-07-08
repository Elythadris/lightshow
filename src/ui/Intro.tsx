'use client';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { getAudioEngine } from '@/audio/AudioEngine';
import { useStore } from '@/state/store';

/**
 * Intro
 * Cinematic entry gate. Also serves as the required user gesture to
 * unlock the AudioContext on most browsers.
 */
export function Intro({ onEnter }: { onEnter: () => void }) {
  const [busy, setBusy] = useState(false);
  const setStore = useStore((s) => s.set);

  async function enter(withMic: boolean) {
    if (busy) return;
    setBusy(true);
    const engine = getAudioEngine();
    if (withMic) {
      try {
        await engine.initMic();
        setStore('useMic', true);
        setStore('usingAudio', true);
      } catch {
        await engine.initSimulated();
        setStore('useMic', false);
        setStore('usingAudio', false);
      }
    } else {
      await engine.initSimulated();
      setStore('usingAudio', false);
    }
    onEnter();
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
          A living world of light that listens.
          <br className="hidden sm:block" />
          Move your mouse. Play music. Let it breathe.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 1.4 }}
          className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <button className="btn primary" onClick={() => enter(true)} disabled={busy}>
            Enter with Microphone
          </button>
          <button className="btn" onClick={() => enter(false)} disabled={busy}>
            Enter (ambient)
          </button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1, delay: 1.9 }}
          className="mt-8 text-[11px] text-white/35 tracking-[0.2em] uppercase"
        >
          Best experienced full-screen · WebGL required
        </motion.p>
      </motion.div>
    </motion.div>
  );
}
