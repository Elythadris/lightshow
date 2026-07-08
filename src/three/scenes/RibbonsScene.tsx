'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '@/state/store';
import { usePaletteColors, useScenePresence } from '../hooks';

/**
 * RibbonsScene
 * Long flowing tube geometries traced along noise-flow paths.
 * Presence gates opacity; scale contracts when fading out.
 */
export function RibbonsScene() {
  const density = useStore((s) => s.density);
  const intensity = useStore((s) => s.intensity);
  const audio = useStore((s) => s.audio);
  const palette = usePaletteColors();
  const presence = useScenePresence('ribbons');

  const ribbonCount = useMemo(() => Math.max(3, Math.floor(3 + density * 9)), [density]);

  const ribbons = useMemo(() => {
    return new Array(ribbonCount).fill(0).map(() => {
      const seed = Math.random() * 100;
      const points: THREE.Vector3[] = [];
      const N = 220;
      for (let k = 0; k < N; k++) {
        const t = k / (N - 1);
        const a = t * Math.PI * 4 + seed;
        const r = 5 + Math.sin(seed + t * 6) * 2.2;
        const x = Math.cos(a) * r + Math.sin(t * 12 + seed) * 1.4;
        const y = Math.sin(t * 8 + seed * 0.5) * 3.2 + (t - 0.5) * 6;
        const z = Math.sin(a) * r + Math.cos(t * 10 + seed) * 1.4;
        points.push(new THREE.Vector3(x, y, z));
      }
      const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.5);
      const geo = new THREE.TubeGeometry(curve, 220, 0.055, 8, false);
      return { geo, seed, hueOffset: Math.random() };
    });
  }, [ribbonCount]);

  // Shared uniforms; per-ribbon material clones share these references so
  // updating one object updates all ribbons at once.
  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBass: { value: 0 },
    uMid: { value: 0 },
    uTreble: { value: 0 },
    uEnergy: { value: 0 },
    uBeat: { value: 0 },
    uPresence: { value: 0 },
    uIntensity: { value: 0.7 },
    uBase: { value: new THREE.Color(0.1, 0.5, 1.0) },
    uAccent: { value: new THREE.Color(0.6, 0.2, 1.0) },
    uGlow: { value: new THREE.Color(0.3, 1.0, 0.8) },
  }), []);

  const materials = useMemo(() => {
    return ribbons.map((r) => {
      const m = new THREE.ShaderMaterial({
        transparent: true,
        blending: THREE.NormalBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        uniforms: {
          ...uniforms,
          uHueOffset: { value: r.hueOffset },
          uSeed: { value: r.seed },
        },
        vertexShader: /* glsl */`
          varying float vAlong;
          varying vec3 vNormal;
          uniform float uTime;
          uniform float uBass;
          uniform float uBeat;
          uniform float uSeed;
          uniform float uPresence;
          void main(){
            vAlong = uv.x;
            vNormal = normalize(normalMatrix * normal);
            vec3 p = position;
            float breathe = sin(uTime * 1.4 + uv.x * 26.0 + uSeed) * (0.12 + uBass * 0.5 + uBeat * 0.4);
            p += normal * breathe;
            p *= mix(0.85, 1.0, uPresence);
            gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
          }
        `,
        fragmentShader: /* glsl */`
          precision highp float;
          varying float vAlong;
          varying vec3 vNormal;
          uniform float uTime;
          uniform float uBass;
          uniform float uMid;
          uniform float uTreble;
          uniform float uEnergy;
          uniform float uBeat;
          uniform float uHueOffset;
          uniform float uIntensity;
          uniform float uPresence;
          uniform vec3 uBase;
          uniform vec3 uAccent;
          uniform vec3 uGlow;

          void main(){
            float flow = fract(vAlong * 6.0 - uTime * (0.4 + uEnergy * 1.6));
            float glow = smoothstep(0.42, 0.5, 1.0 - abs(flow - 0.5));
            float t1 = clamp(uBass * 1.7 + uBeat * 1.4, 0.0, 1.8);
            float t2 = clamp(uTreble * 1.4 + uMid * 0.6, 0.0, 1.5);
            vec3 c = mix(uBase, uAccent, sin(vAlong * 12.0 + uHueOffset * 6.28 + uTime * 0.3) * 0.5 + 0.5);
            c = mix(c, uGlow, glow * (0.4 + t2 * 0.9));
            float edge = smoothstep(0.0, 0.5, 1.0 - abs(vNormal.z));
            float streak = pow(smoothstep(0.4, 0.5, 1.0 - abs(flow - 0.5)), 2.0);
            float a = (0.14 + streak * 0.48) * (0.5 + t1 * 0.35 + t2 * 0.3);
            vec3 outC = c * (0.55 + uEnergy * 0.5) * uIntensity + uGlow * streak * 0.28 * uIntensity;
            gl_FragColor = vec4(outC, clamp(a * (0.55 + edge * 0.35), 0.0, 0.55) * uPresence);
          }
        `,
      });
      return m;
    });
  }, [ribbons, uniforms]);

  const group = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    uniforms.uTime.value = t;
    uniforms.uBass.value = audio.bass;
    uniforms.uMid.value = audio.mid;
    uniforms.uTreble.value = audio.treble;
    uniforms.uEnergy.value = audio.energy;
    uniforms.uBeat.value = audio.beat;
    uniforms.uPresence.value = presence;
    uniforms.uIntensity.value = 0.35 + intensity * 0.5;
    (uniforms.uBase.value as THREE.Color).lerp(palette.base, 0.06);
    (uniforms.uAccent.value as THREE.Color).lerp(palette.accent, 0.06);
    (uniforms.uGlow.value as THREE.Color).lerp(palette.glow, 0.06);

    if (group.current) {
      group.current.rotation.y += dt * (0.05 + audio.tempo * 0.4);
      group.current.rotation.x = Math.sin(t * 0.15) * 0.15;
      const s = (0.85 + presence * 0.15) * (1 + audio.beat * 0.05);
      group.current.scale.setScalar(s);
      group.current.visible = presence > 0.02;
    }
  });

  return (
    <group ref={group}>
      {ribbons.map((r, i) => (
        <mesh key={i} geometry={r.geo} material={materials[i]} />
      ))}
    </group>
  );
}
