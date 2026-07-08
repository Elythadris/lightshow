'use client';
import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useStore, SCENES, PALETTES, JOURNEY, type SceneId } from '@/state/store';
import { getAudioEngine } from '@/audio/AudioEngine';

export function HUD() {
  const scene = useStore((s) => s.scene);
  const journeyMode = useStore((s) => s.journeyMode);
  const chapterIndex = useStore((s) => s.chapterIndex);
  const chapterProgress = useStore((s) => s.chapterProgress);
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
  const useTab = useStore((s) => s.useTab);
  const audioSourceLabel = useStore((s) => s.audioSourceLabel);
  const audio = useStore((s) => s.audio);
  const fps = useStore((s) => s.fps);
  const setStore = useStore((s) => s.set);
  const setScene = useStore((s) => s.setScene);
  const setPalette = useStore((s) => s.setPalette);
  const jumpChapter = useStore((s) => s.jumpChapter);
  const toggleHud = useStore((s) => s.toggleHud);

  const chapter = JOURNEY[chapterIndex] ?? JOURNEY[0];

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
      if (e.key === 'h' || e.key === 'H') toggleHud();
      if (e.key === 'ArrowRight' || e.key === 'l') jumpChapter(1);
      if (e.key === 'ArrowLeft' || e.key === 'j') jumpChapter(-1);
      if (e.key === 'm' || e.key === 'M') {
        void requestMic();
      }
      if (e.key === 't' || e.key === 'T') {
        void requestTab();
      }
      if (e.key >= '1' && e.key <= '5') {
        const idx = parseInt(e.key, 10) - 1;
        const s = SCENES[idx];
        if (s) setScene(s.id as SceneId);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleHud, jumpChapter, setScene]);

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
      setStore('useTab', false);
      setStore('usingAudio', true);
      setStore('audioSourceLabel', 'Mic');
    } catch (err) {
      console.warn('Mic denied or unavailable', err);
      setStore('useMic', false);
    }
  }

  async function requestTab() {
    const engine = getAudioEngine();
    try {
      await engine.initTab();
      setStore('useTab', true);
      setStore('useMic', false);
      setStore('usingAudio', true);
      setStore('audioSourceLabel', 'Tab');
    } catch (err) {
      console.warn('Tab audio share denied or unavailable', err);
      setStore('useTab', false);
    }
  }

  async function stopAudio() {
    const engine = getAudioEngine();
    engine.stop();
    await engine.initSimulated();
    setStore('useMic', false);
    setStore('useTab', false);
    setStore('usingAudio', false);
    setStore('audioSourceLabel', 'Ambient');
  }

  return (
    <>
      {/* Top-left brand + journey status */}
      <div className="fixed top-4 left-4 z-20 flex items-center gap-3 no-select">
        <Logo />
        <div className="hidden sm:flex flex-col leading-tight">
          <div className="text-[11px] uppercase tracking-[0.28em] text-white/70">Lightshow</div>
          <div className="text-[10px] uppercase tracking-[0.2em] text-white/40">
            {journeyMode ? `Ch ${chapterIndex + 1} · ${chapter.name}` : 'free view'}
          </div>
        </div>
      </div>

      {/* Top-right status */}
      <div className="fixed top-4 right-4 z-20 flex items-center gap-2 no-select">
        <span className="chip">
          <span className={"inline-block w-1.5 h-1.5 rounded-full " + (usingAudio ? (audio.silent ? 'bg-amber-300' : 'bg-emerald-400') : 'bg-white/40')} />
          {audioSourceLabel}
          {usingAudio && audio.silent && <span className="ml-1 text-amber-200/90">quiet</span>}
        </span>
        <span className="chip">{fps} fps</span>
        <button className="btn" onClick={toggleHud} aria-label="Hide interface">
          {hudVisible ? 'Hide UI' : 'Show UI'}
        </button>
      </div>

      <AnimatePresence>
        {hudVisible && (
          <>
            {/* Left: Journey + Worlds */}
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              className="hidden lg:block fixed left-4 top-1/2 -translate-y-1/2 z-20 hud-glass p-3 w-[240px]"
            >
              <div className="flex items-center justify-between px-2 mb-2">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">Journey</div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => jumpChapter(-1)}
                    className="w-6 h-6 rounded border border-white/10 hover:border-white/30 text-[10px] text-white/70"
                    aria-label="Previous chapter"
                  >‹</button>
                  <button
                    onClick={() => jumpChapter(1)}
                    className="w-6 h-6 rounded border border-white/10 hover:border-white/30 text-[10px] text-white/70"
                    aria-label="Next chapter"
                  >›</button>
                </div>
              </div>

              <div className="px-2 mb-3">
                <div className="text-[12px] tracking-wide text-white/90">{chapter.name}</div>
                <div className="text-[10px] text-white/40 italic">{chapter.tag}</div>
                <div className="mt-1.5 h-1 w-full rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full bg-white/60 transition-[width] duration-200"
                    style={{ width: `${Math.round(chapterProgress * 100)}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between px-2 mt-3 mb-2">
                <div className="text-[10px] uppercase tracking-[0.24em] text-white/50">Worlds</div>
                <button
                  onClick={() => setStore('journeyMode', !journeyMode)}
                  className={
                    'text-[9px] uppercase tracking-widest px-2 py-0.5 rounded border ' +
                    (journeyMode ? 'border-emerald-300/40 text-emerald-200/90 bg-emerald-400/10' : 'border-white/15 text-white/60 hover:border-white/30')
                  }
                >{journeyMode ? 'auto' : 'manual'}</button>
              </div>

              <div className="flex flex-col gap-1">
                {SCENES.map((s, i) => (
                  <button
                    key={s.id}
                    onClick={() => setScene(s.id as SceneId)}
                    className={
                      'group text-left w-full px-3 py-2 rounded-lg border transition ' +
                      (!journeyMode && scene === s.id
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
              className="hidden lg:block fixed right-4 top-1/2 -translate-y-1/2 z-20 hud-glass p-4 w-[260px] scroll-thin overflow-y-auto max-h-[calc(100vh-140px)]"
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

              <div className="text-[10px] uppercase tracking-[0.24em] text-white/50 mt-5 mb-2">Audio source</div>
              <div className="flex flex-col gap-2">
                {!useTab ? (
                  <button className="btn primary w-full" onClick={requestTab}>Share a Browser Tab</button>
                ) : (
                  <button className="btn w-full" onClick={stopAudio}>Stop tab audio</button>
                )}
                <div className="flex gap-2">
                  {!useMic ? (
                    <button className="btn flex-1" onClick={requestMic}>Microphone</button>
                  ) : (
                    <button className="btn flex-1" onClick={stopAudio}>Stop mic</button>
                  )}
                </div>
              </div>
              <p className="text-[10px] text-white/40 mt-2 leading-snug">
                To visualize music from another tab (YouTube, Spotify Web, etc.), share that tab here and keep "Share tab audio" checked in the browser prompt.
              </p>
              {usingAudio && audio.silent && (
                <div className="mt-3 text-[10px] text-amber-200/90 leading-snug">
                  Signal detected but very quiet. Turn the music up or re-share the tab with audio enabled.
                </div>
              )}

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
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-20 hud-glass p-3 flex items-center gap-4 flex-wrap justify-center max-w-[calc(100vw-32px)] lg:max-w-[calc(100vw-560px)]"
            >
              <Meter label="Bass" value={audio.bass} color="#e5484d" />
              <Meter label="Mid" value={audio.mid} color="#f5d90a" />
              <Meter label="Treble" value={audio.treble} color="#4cc38a" />
              <Meter label="Energy" value={audio.energy} color="#8ec8ff" />
              <div className="hidden md:flex items-center gap-3 pl-4 border-l border-white/10">
                <Kbd>← →</Kbd><span className="text-[10px] text-white/50">chapter</span>
                <Kbd>1–5</Kbd><span className="text-[10px] text-white/50">world</span>
                <Kbd>T</Kbd><span className="text-[10px] text-white/50">tab</span>
                <Kbd>M</Kbd><span className="text-[10px] text-white/50">mic</span>
                <Kbd>H</Kbd><span className="text-[10px] text-white/50">hide</span>
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
