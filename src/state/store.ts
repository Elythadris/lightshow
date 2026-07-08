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

type State = {
  scene: SceneId;
  paletteId: string;
  intensity: number;   // 0..1
  density: number;     // 0..1
  cameraMotion: number;// 0..1
  bloom: number;       // 0..1
  audioSensitivity: number; // 0..2
  useMic: boolean;
  usingAudio: boolean;
  hudVisible: boolean;
  reducedMotion: boolean;
  performanceMode: 'auto' | 'high' | 'balanced' | 'low';
  fps: number;
  audio: {
    level: number;
    bass: number;
    mid: number;
    treble: number;
    energy: number;
    beat: number;   // 0..1 impulse
    tempo: number;  // 0..1 running tempo estimator
    onset: boolean;
    mood: number;   // 0..1 (low = calm, high = intense)
  };
  setScene: (s: SceneId) => void;
  setPalette: (id: string) => void;
  set: <K extends keyof State>(key: K, value: State[K]) => void;
  toggleHud: () => void;
  setAudio: (a: Partial<State['audio']>) => void;
  cycleScene: (dir: 1 | -1) => void;
};

export const useStore = create<State>((set, get) => ({
  scene: 'nebula',
  paletteId: 'aurora',
  intensity: 0.6,
  density: 0.5,
  cameraMotion: 0.55,
  bloom: 0.55,
  audioSensitivity: 1.0,
  useMic: false,
  usingAudio: false,
  hudVisible: true,
  reducedMotion: false,
  performanceMode: 'auto',
  fps: 60,
  audio: {
    level: 0, bass: 0, mid: 0, treble: 0, energy: 0,
    beat: 0, tempo: 0, onset: false, mood: 0.4,
  },
  setScene: (s) => set({ scene: s }),
  setPalette: (id) => set({ paletteId: id }),
  set: (key, value) => set({ [key]: value } as any),
  toggleHud: () => set((s) => ({ hudVisible: !s.hudVisible })),
  setAudio: (a) => set((s) => ({ audio: { ...s.audio, ...a } })),
  cycleScene: (dir) => {
    const ids = SCENES.map((x) => x.id);
    const i = ids.indexOf(get().scene);
    const next = ids[(i + dir + ids.length) % ids.length];
    set({ scene: next });
  },
}));

export function getPalette(id: string): Palette {
  return PALETTES.find((p) => p.id === id) ?? PALETTES[0];
}
