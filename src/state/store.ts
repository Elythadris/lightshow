'use client';
import { create } from 'zustand';

export type SceneId = 'nebula' | 'ribbons' | 'fractal' | 'hologrid' | 'aurora';

export type Palette = {
  id: string;
  name: string;
  base: [number, number, number];
  accent: [number, number, number];
  glow: [number, number, number];
};

export const PALETTES: Palette[] = [
  { id: 'aurora',   name: 'Aurora',    base: [0.08, 0.55, 0.95], accent: [0.55, 0.25, 1.0], glow: [0.25, 1.0, 0.75] },
  { id: 'ember',    name: 'Ember',     base: [1.0, 0.35, 0.15],  accent: [1.0, 0.85, 0.30], glow: [1.0, 0.55, 0.25] },
  { id: 'oceanic',  name: 'Oceanic',   base: [0.02, 0.35, 0.65], accent: [0.10, 0.85, 0.95], glow: [0.65, 0.95, 1.0] },
  { id: 'noir',     name: 'Noir',      base: [0.15, 0.15, 0.20], accent: [0.95, 0.95, 1.0], glow: [0.55, 0.55, 0.65] },
  { id: 'plasma',   name: 'Plasma',    base: [0.85, 0.10, 0.55], accent: [0.30, 0.20, 0.95], glow: [1.0, 0.35, 0.85] },
  { id: 'verdant',  name: 'Verdant',   base: [0.10, 0.75, 0.45], accent: [0.85, 0.95, 0.30], glow: [0.55, 1.0, 0.65] },
];

export const SCENES: { id: SceneId; name: string; hint: string }[] = [
  { id: 'nebula',   name: 'Nebula',    hint: 'Volumetric particle cloud' },
  { id: 'ribbons',  name: 'Ribbons',   hint: 'Flowing energy ribbons' },
  { id: 'fractal',  name: 'Fractal',   hint: 'Recursive ray-marched geometry' },
  { id: 'hologrid', name: 'Hologrid',  hint: 'Holographic infinite grid' },
  { id: 'aurora',   name: 'Aurora',    hint: 'Cinematic atmospheric field' },
];

export type ChapterId = 'awakening' | 'ignition' | 'ascent' | 'bloom' | 'cosmos' | 'return';

export type Chapter = {
  id: ChapterId;
  name: string;
  tag: string;
  // target presence per scene (0..1). Journey Director will lerp toward these.
  presence: Record<SceneId, number>;
  // camera "vibe" — used by CameraRig
  cameraMode: 'orbit' | 'rise' | 'sweep' | 'dive' | 'drift' | 'return';
  // suggested palette bias (optional). If null, keep user palette.
  paletteHint?: string | null;
  duration: number; // seconds
};

// The journey arc — six movements that layer worlds instead of switching them.
export const JOURNEY: Chapter[] = [
  { id: 'awakening', name: 'Awakening', tag: 'First light',
    presence: { nebula: 1.0, ribbons: 0.0, fractal: 0.0, hologrid: 0.0, aurora: 0.15 },
    cameraMode: 'drift', paletteHint: 'oceanic', duration: 45 },
  { id: 'ignition',  name: 'Ignition', tag: 'Something stirs',
    presence: { nebula: 0.75, ribbons: 0.9, fractal: 0.0, hologrid: 0.15, aurora: 0.2 },
    cameraMode: 'orbit', paletteHint: 'aurora', duration: 55 },
  { id: 'ascent',    name: 'Ascent', tag: 'Rising signal',
    presence: { nebula: 0.35, ribbons: 1.0, fractal: 0.0, hologrid: 0.7, aurora: 0.35 },
    cameraMode: 'rise', paletteHint: 'plasma', duration: 60 },
  { id: 'bloom',     name: 'Bloom', tag: 'Everything opens',
    presence: { nebula: 0.55, ribbons: 0.55, fractal: 0.0, hologrid: 0.85, aurora: 1.0 },
    cameraMode: 'sweep', paletteHint: 'verdant', duration: 65 },
  { id: 'cosmos',    name: 'Cosmos', tag: 'Deeper structure',
    presence: { nebula: 0.6, ribbons: 0.15, fractal: 1.0, hologrid: 0.15, aurora: 0.25 },
    cameraMode: 'dive', paletteHint: 'plasma', duration: 70 },
  { id: 'return',    name: 'Return', tag: 'Homeward',
    presence: { nebula: 1.0, ribbons: 0.25, fractal: 0.25, hologrid: 0.0, aurora: 0.5 },
    cameraMode: 'return', paletteHint: 'aurora', duration: 55 },
];

type State = {
  // Journey
  journeyMode: boolean;       // when true, presence + palette + camera are auto-driven
  chapterIndex: number;
  chapterProgress: number;    // 0..1 through current chapter
  presence: Record<SceneId, number>; // smoothed live values scenes should read

  // User-overrideable "manual scene" for when journeyMode is false
  scene: SceneId;

  // Palette + composition
  paletteId: string;
  intensity: number;
  density: number;
  cameraMotion: number;
  bloom: number;
  audioSensitivity: number;

  // Audio source
  useMic: boolean;
  useTab: boolean;
  usingAudio: boolean;
  audioSourceLabel: string;

  // UI
  hudVisible: boolean;
  reducedMotion: boolean;
  performanceMode: 'auto' | 'high' | 'balanced' | 'low';
  fps: number;

  // Live audio features
  audio: {
    level: number;
    bass: number;
    mid: number;
    treble: number;
    energy: number;
    beat: number;
    tempo: number;
    onset: boolean;
    mood: number;
    silent: boolean; // true when the source is present but quiet
  };

  // Setters
  setScene: (s: SceneId) => void;
  setPalette: (id: string) => void;
  set: <K extends keyof State>(key: K, value: State[K]) => void;
  toggleHud: () => void;
  setAudio: (a: Partial<State['audio']>) => void;
  cycleScene: (dir: 1 | -1) => void;
  jumpChapter: (dir: 1 | -1) => void;
  setPresence: (p: Record<SceneId, number>) => void;
};

const zeroPresence: Record<SceneId, number> = {
  nebula: 1, ribbons: 0, fractal: 0, hologrid: 0, aurora: 0.15,
};

export const useStore = create<State>((set, get) => ({
  journeyMode: true,
  chapterIndex: 0,
  chapterProgress: 0,
  presence: { ...zeroPresence },

  scene: 'nebula',
  paletteId: 'aurora',
  intensity: 0.7,
  density: 0.55,
  cameraMotion: 0.6,
  bloom: 0.6,
  audioSensitivity: 1.0,

  useMic: false,
  useTab: false,
  usingAudio: false,
  audioSourceLabel: 'Ambient',

  hudVisible: true,
  reducedMotion: false,
  performanceMode: 'auto',
  fps: 60,
  audio: {
    level: 0, bass: 0, mid: 0, treble: 0, energy: 0,
    beat: 0, tempo: 0, onset: false, mood: 0.4, silent: false,
  },
  setScene: (s) => set({ scene: s, journeyMode: false }),
  setPalette: (id) => set({ paletteId: id }),
  set: (key, value) => set({ [key]: value } as any),
  toggleHud: () => set((s) => ({ hudVisible: !s.hudVisible })),
  setAudio: (a) => set((s) => ({ audio: { ...s.audio, ...a } })),
  cycleScene: (dir) => {
    const ids = SCENES.map((x) => x.id);
    const i = ids.indexOf(get().scene);
    const next = ids[(i + dir + ids.length) % ids.length];
    set({ scene: next, journeyMode: false });
  },
  jumpChapter: (dir) => {
    const n = JOURNEY.length;
    const i = (get().chapterIndex + dir + n) % n;
    set({ chapterIndex: i, chapterProgress: 0, journeyMode: true });
  },
  setPresence: (p) => set({ presence: p }),
}));

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
