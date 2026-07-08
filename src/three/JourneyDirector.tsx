'use client';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useStore, JOURNEY, SCENES, type SceneId } from '@/state/store';

/**
 * JourneyDirector
 *
 * The invisible conductor. Every frame it:
 *   1. Advances chapter progress on wall-clock time, accelerated by energy.
 *   2. Blends the *current* chapter's presence targets with a smoothed live
 *      presence map, then writes that into the store so all scenes can react.
 *   3. Optionally biases the palette when the current chapter has a hint.
 *   4. Auto-loops the journey.
 *   5. In manual mode (user clicked a specific world), snaps presence to a
 *      single scene so users can still explore individual worlds.
 *
 * Renders no geometry — just drives store state.
 */
export function JourneyDirector() {
  const journeyMode = useStore((s) => s.journeyMode);
  const chapterIndex = useStore((s) => s.chapterIndex);
  const setStore = useStore((s) => s.set);
  const setPalette = useStore((s) => s.setPalette);
  const paletteId = useStore((s) => s.paletteId);
  const audio = useStore((s) => s.audio);
  const setPresence = useStore((s) => s.setPresence);
  const scene = useStore((s) => s.scene);
  const presence = useStore((s) => s.presence);

  // Local mutable "smoothed presence" — avoids Zustand thrash and keeps easing smooth.
  const smoothRef = useRef<Record<SceneId, number>>({ ...presence });
  const paletteFadeRef = useRef({ from: paletteId, to: paletteId, t: 1 });
  const lastChapterRef = useRef<number>(chapterIndex);

  // Fire palette hint whenever chapter changes (manual jump or auto-advance).
  if (lastChapterRef.current !== chapterIndex) {
    const hint = JOURNEY[chapterIndex]?.paletteHint;
    if (journeyMode && hint && hint !== paletteId) {
      // switch palette id immediately; individual scenes lerp their color uniforms toward the new target
      setPalette(hint);
    }
    lastChapterRef.current = chapterIndex;
  }

  useFrame((_state, dt) => {
    const cd = Math.min(0.1, dt);

    if (journeyMode) {
      const chapter = JOURNEY[chapterIndex];
      // Energy accelerates progress (max 1.75x), silence slows it slightly (0.75x)
      const energyMul = 1 + audio.energy * 0.75 - (audio.silent ? 0.25 : 0);
      const progress = useStore.getState().chapterProgress + (cd / chapter.duration) * Math.max(0.4, energyMul);
      if (progress >= 1) {
        const next = (chapterIndex + 1) % JOURNEY.length;
        setStore('chapterIndex', next);
        setStore('chapterProgress', 0);
        // Palette hint handled by the chapter-change effect above on next tick.
      } else {
        setStore('chapterProgress', progress);
      }

      // Lerp smoothed presence toward chapter targets, biased by mood/energy.
      const target = chapter.presence;
      const speed = 0.55; // seconds to reach 63% of the target
      const alpha = 1 - Math.exp(-cd / speed);
      for (const id of Object.keys(target) as SceneId[]) {
        const t = target[id];
        smoothRef.current[id] += (t - smoothRef.current[id]) * alpha;
      }

      // Palette hint applied on chapter change above; individual scenes lerp colors smoothly.
    } else {
      // Manual mode: presence collapses toward the user-selected scene.
      const alpha = 1 - Math.exp(-cd / 0.4);
      for (const id of SCENES.map((s) => s.id) as SceneId[]) {
        const t = id === scene ? 1 : 0;
        smoothRef.current[id] += (t - smoothRef.current[id]) * alpha;
      }
    }

    // Publish presence to the store roughly every frame. Only write when it
    // moved meaningfully to avoid re-render churn.
    const cur = presence;
    let dirty = false;
    for (const id of Object.keys(smoothRef.current) as SceneId[]) {
      if (Math.abs((cur[id] ?? 0) - smoothRef.current[id]) > 0.003) { dirty = true; break; }
    }
    if (dirty) setPresence({ ...smoothRef.current });
  });

  return null;
}
