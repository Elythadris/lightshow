'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore, getPalette, type SceneId } from '@/state/store';

/**
 * Palette colors as smooth THREE.Color objects.
 * Rebuilds only when paletteId changes, which is intentional — scenes further
 * lerp their internal uniform colors toward these targets for a smooth swap.
 */
export function usePaletteColors() {
  const paletteId = useStore((s) => s.paletteId);
  return useMemo(() => {
    const p = getPalette(paletteId);
    return {
      base: new THREE.Color(...p.base),
      accent: new THREE.Color(...p.accent),
      glow: new THREE.Color(...p.glow),
    };
  }, [paletteId]);
}

/** Presence (0..1) for a specific scene id. */
export function useScenePresence(id: SceneId) {
  return useStore((s) => s.presence[id] ?? 0);
}
