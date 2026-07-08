'use client';
import { useEffect, useRef } from 'react';
import { getAudioEngine } from './AudioEngine';
import { useStore } from '@/state/store';

// Publishes AudioEngine features into the Zustand store every frame.
// This lets both 2D UI and Three.js scenes read the same live feature bus.
export function useAudioPublisher() {
  const setAudio = useStore((s) => s.setAudio);
  const sensitivity = useStore((s) => s.audioSensitivity);
  const raf = useRef<number | null>(null);
  const last = useRef<number>(0);

  useEffect(() => {
    const engine = getAudioEngine();
    // Ensure simulated source available immediately so visuals never freeze
    if (engine.kind === 'none') engine.initSimulated();

    const loop = (t: number) => {
      const dt = last.current ? Math.min(0.08, (t - last.current) / 1000) : 0.016;
      last.current = t;
      const f = engine.tick(dt);
      const s = Math.max(0.1, Math.min(2, sensitivity));
      setAudio({
        level: Math.min(1, f.level * s),
        bass: Math.min(1, f.bass * s),
        mid: Math.min(1, f.mid * s),
        treble: Math.min(1, f.treble * s),
        energy: Math.min(1, f.energy * s),
        beat: f.beat,
        tempo: f.tempo,
        onset: f.onset,
        mood: f.mood,
        silent: f.silent,
      });
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, [setAudio, sensitivity]);
}
