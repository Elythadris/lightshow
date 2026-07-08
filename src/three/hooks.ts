'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useStore, getPalette } from '@/state/store';

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
