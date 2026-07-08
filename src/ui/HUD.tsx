'use client';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore, SCENES, PALETTES, type SceneId } from '@/state/store';
import { getAudioEngine } from '@/audio/AudioEngine';

export function HUD() {
  const scene = useStore((s) => s.scene);
  const paletteId = useStore((s) => s.paletteId);
  const intensity = useStore((s) => s.intensity);
  const density = useStore((s) => s.density);
  const cameraMotion = useStore((s) => s.cameraMotion);
  const bloom = useStore((s) => s.bloom);
  const audioSensitivity = useStore((s) => s.audioSensitivity);
  const hudVisible = useStore((s) => s.hudVisible);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const performanceMode = useStore((s) => s.performanceMode);
  const usingAudio = useStore((s) => s.usingAudio);
  const useMic = useStore((s) => s.useMic);
  const audio = useStore((s) => s.audio);
  const fps = useStore((s) => s.fps);
  const setStore = useStore((s) => s.set);
  const setScene = useStore((s) => s.setScene);
  const setPalette = useStore((s) => s.setPalette);
  const cycleScene = useStore((s) => s.cycleScene);
  const toggleHud = useStore((s) => s.toggleHud);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'h' || e.key === 'H') toggleHud();
      if (e.key === 'ArrowRight' || e.key === 'l') cycleScene(1);
      if (e.key === 'ArrowLeft' || e.key === 'j') cycleScene(-1);
      if (e.key === 'm' || e.key === 'M') {
        void requestMic();
      }
      if (e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key, 10) - 1;
        const s = SCENES[idx];
        if (s) setScene(s.id as SceneId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleHud, cycleScene, setScene]);

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    setStore('reducedMotion', media.matches);
    const on = () => setStore('reducedMotion', media.matches);
    media.addEventListener?.('change', on);
    return () => media.removeEventListener?.('change', on);
  }, [setStore]);

  async function requestMic() {
    const engine = getAudioEngine();
    try {
      await engine.initMic();
      setStore('useMic', true);
      setStore('usingAudio', true);
    } catch (err) {
      console.warn('Mic denied or unavailable', err);
      setStore('useMic', false);
    }
  }

  async function stopMic() {
    const engine = getAudioEngine();
    engine.stop();
    await engine.initSimulated();
    setStore('useMic', false);
    setStore('usingAudio', false);
  }

  return (
    <>
      {/* Top-left brand */}
      <div className="fixed top-4 left-4 z-20 flex items-center gap-3 no-select">
        <Logo />
        <div className="hidden sm:flex flex-col leading-tight">
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/70">Lightshow</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">audio-reactive world</div>
        </div>
      </div>

      {/* Top-right status */}
      <div className="fixed top-4 right-4 z-20 flex items-center gap-2 no-select">
        <span className="chip">
          <span className={"inline-block w-1.5 h-1.5 rounded-full " + (usingAudio ? 'bg-emerald-400' : 'bg-white/40')} />
          {usingAudio ? (useMic ? 'Mic' : 'Audio') : 'Ambient'}
        </span>
        <span className="chip">{fps} fps</span>
        <button className="btn" onClick={toggleHud} aria-label="Hide interface">
          {hudVisible ? 'Hide UI' : 'Show UI'}
        </button>
      </div>

      <AnimatePresence>
        {hudVisible && (
          <>
            {/* Left: Scenes */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="fixed left-4 top-1/2 -translate-y-1/2 z-20 hud-glass p-3 w-[220px]"
            >
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/50 px-2 mb-2">Worlds</div>
              <div className="flex flex-col gap-1">
                {SCENES.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setScene(s.id as SceneId)}
                    className={
                      'group text-left w-full px-3 py-2 rounded-lg border transition ' +
                      (scene === s.id
                        ? 'border-white/25 bg-white/10'
                        : 'border-transparent hover:border-white/10 hover:bg-white/5')
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-[13px] tracking-wide">{s.name}</div>
                      <div className="text-[10px] text-white/40 font-mono">{i + 1}</div>
                    </div>
                    <div className="text-[10px] text-white/40 leading-snug">{s.hint}</div>
                  </button>
                ))}
              </div>
            </motion.div>

            {/* Right: Controls */}
            <motion.div
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 24 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="fixed right-4 top-1/2 -translate-y-1/2 z-20 hud-glass p-4 w-[260px] scroll-thin"
            >
              <div className="text-[10px] uppercase tracking-[0.24em] text-white/50 mb-3">Composition</div>
              <div className="flex flex-col gap-4">
                <Slider label="Intensity" value={intensity} onChange={(v) => setStore('intensity', v)} />
                <Slider label="Density" value={density} onChange={(v) => setStore('density', v)} />
                <Slider label="Camera" value={cameraMotion} onChange={(v) => setStore('cameraMotion', v)} />
                <Slider label="Bloom" value={bloom} onChange={(v) => setStore('bloom', v)} />
                <Slider label="Audio sensitivity" value={audioSensitivity / 2} onChange={(v) => setStore('audioSensitivity', v * 2)} />
              </div>

              <div className="text-[10px] uppercase tracking-[0.24em] text-white/50 mt-5 mb-2">Palette</div>
              <div className="grid grid-cols-3 gap-2">
                {PALETTES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPalette(p.id)}
                    className={
                      'aspect-square rounded-md border transition ' +
                      (paletteId === p.id ? 'border-white/40 ring-1 ring-white/30' : 'border-white/10 hover:border-white/25')
                    }
                    aria-label={p.name}
                    style={{
                      background: `linear-gradient(135deg,
                        rgb(${(p.base[0]*255)|0}, ${(p.base[1]*255)|0}, ${(p.base[2]*255)|0}) 0%,
                        rgb(${(p.accent[0]*255)|0}, ${(p.accent[1]*255)|0}, ${(p.accent[2]*255)|0}) 55%,
                        rgb(${(p.glow[0]*255)|0}, ${(p.glow[1]*255)|0}, ${(p.glow[2]*255)|0}) 100%)`,
                    }}
                    title={p.name}
                  />
                ))}
              </div>

              <div className="text-[10px] uppercase tracking-[0.24em] text-white/50 mt-5 mb-2">Performance</div>
              <div className="flex gap-1">
                {(['auto','high','balanced','low'] as const).map((k) => (
                  <button
                    key={k}
                    onClick={() => setStore('performanceMode', k)}
                    className={
                      'flex-1 text-[10px] uppercase tracking-widest py-1.5 rounded border ' +
                      (performanceMode === k ? 'border-white/40 bg-white/10' : 'border-white/10 hover:border-white/25')
                    }
                  >{k}</button>
                ))}
              </div>

              <div className="text-[10px] uppercase tracking-[0.24em] text-white/50 mt-5 mb-2">Audio</div>
              <div className="flex gap-2">
                {!useMic ? (
                  <button className="btn primary flex-1" onClick={requestMic}>Use Microphone</button>
                ) : (
                  <button className="btn flex-1" onClick={stopMic}>Stop Mic</button>
                )}
              </div>
              <p className="text-[10px] text-white/40 mt-2 leading-snug">
                Enable microphone to visualize any sound playing near your device. Otherwise, an ambient signal keeps the world alive.
              </p>

              {reducedMotion && (
                <div className="mt-4 text-[10px] text-amber-200/80 leading-snug">
                  Reduced motion is active — visuals are softened.
                </div>
              )}
            </motion.div>

            {/* Bottom: audio meter + shortcuts */}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 24 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 hud-glass p-3 flex items-center gap-4"
            >
              <Meter label="Bass" value={audio.bass} color="#e5484d" />
              <Meter label="Mid" value={audio.mid} color="#f5d90a" />
              <Meter label="Treble" value={audio.treble} color="#4cc38a" />
              <Meter label="Energy" value={audio.energy} color="#8ec8ff" />
              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-white/10">
                <Kbd>1–5</Kbd><span className="text-[10px] text-white/50">worlds</span>
                <Kbd>← →</Kbd><span className="text-[10px] text-white/50">cycle</span>
                <Kbd>H</Kbd><span className="text-[10px] text-white/50">hide</span>
                <Kbd>M</Kbd><span className="text-[10px] text-white/50">mic</span>
                <Kbd>F</Kbd><span className="text-[10px] text-white/50">full</span>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Slider({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] tracking-wide text-white/70">{label}</span>
        <span className="text-[10px] text-white/40 font-mono">{Math.round(value * 100)}</span>
      </div>
      <input
        className="slider"
        type="range" min={0} max={1} step={0.01}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
      />
    </label>
  );
}

function Meter({ label, value, color }: { label: string; value: number; color: string }) {
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="flex flex-col items-center gap-1 w-12">
      <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
        <div style={{ width: `${v * 100}%`, background: color, boxShadow: `0 0 6px ${color}` }} className="h-full transition-[width] duration-75" />
      </div>
      <div className="text-[9px] uppercase tracking-widest text-white/50">{label}</div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <span className="px-1.5 py-0.5 rounded border border-white/15 bg-white/5 font-mono text-[10px] text-white/70">{children}</span>;
}

function Logo() {
  return (
    <svg width="28" height="28" viewBox="0 0 32 32" aria-label="Lightshow" role="img">
      <defs>
        <linearGradient id="lg" x1="0" x2="1" y1="0" y2="1">
          <stop offset="0%" stopColor="#8ec8ff" />
          <stop offset="60%" stopColor="#c48eff" />
          <stop offset="100%" stopColor="#4cffb9" />
        </linearGradient>
      </defs>
      <circle cx="16" cy="16" r="12" fill="none" stroke="url(#lg)" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="6" fill="none" stroke="url(#lg)" strokeWidth="1.2" />
      <circle cx="16" cy="16" r="1.6" fill="url(#lg)" />
      <line x1="16" y1="1" x2="16" y2="6" stroke="url(#lg)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="16" y1="26" x2="16" y2="31" stroke="url(#lg)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="1" y1="16" x2="6" y2="16" stroke="url(#lg)" strokeWidth="1.2" strokeLinecap="round" />
      <line x1="26" y1="16" x2="31" y2="16" stroke="url(#lg)" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}
