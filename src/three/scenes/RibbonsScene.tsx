'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '@/state/store';
import { usePaletteColors } from '../hooks';

/**
 * RibbonsScene
 * Long flowing tube geometries traced along noise-flow paths.
 * Number, thickness and hue shift with mid/treble bands; twist with tempo.
 */
export function RibbonsScene() {
  const density = useStore((s) => s.density);
  const intensity = useStore((s) => s.intensity);
  const cameraMotion = useStore((s) => s.cameraMotion);
  const audio = useStore((s) => s.audio);
  const palette = usePaletteColors();

  const ribbonCount = Math.max(3, Math.floor(4 + density * 14));

  const ribbons = useMemo(() => {
    return new Array(ribbonCount).fill(0).map((_, i) => {
      const seed = Math.random() * 100;
      // Build a smooth base curve using layered sines
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
      const geo = new THREE.TubeGeometry(curve, 240, 0.08, 10, false);
      return { geo, seed, hueOffset: Math.random() };
    });
  }, [ribbonCount]);

  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      blending: THREE.NormalBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      uniforms: {
        uTime: { value: 0 },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uEnergy: { value: 0 },
        uBeat: { value: 0 },
        uHueOffset: { value: 0 },
        uSeed: { value: 0 },
        uIntensity: { value: 0.7 },
        uBase: { value: new THREE.Color(0.1, 0.5, 1.0) },
        uAccent: { value: new THREE.Color(0.6, 0.2, 1.0) },
        uGlow: { value: new THREE.Color(0.3, 1.0, 0.8) },
      },
      vertexShader: /* glsl */`
        varying float vAlong;
        varying vec3 vNormal;
        uniform float uTime;
        uniform float uBass;
        uniform float uSeed;
        void main(){
          vAlong = uv.x;
          vNormal = normalize(normalMatrix * normal);
          vec3 p = position;
          // sinuous breathing displacement
          float breathe = sin(uTime * 1.2 + uv.x * 24.0 + uSeed) * (0.12 + uBass * 0.4);
          p += normal * breathe;
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
        uniform vec3 uBase;
        uniform vec3 uAccent;
        uniform vec3 uGlow;

        void main(){
          // stripes flowing along the ribbon
          float flow = fract(vAlong * 6.0 - uTime * (0.4 + uEnergy * 1.4));
          float glow = smoothstep(0.42, 0.5, 1.0 - abs(flow - 0.5));
          float t1 = clamp(uBass * 1.6 + uBeat * 1.2, 0.0, 1.6);
          float t2 = clamp(uTreble * 1.3 + uMid * 0.6, 0.0, 1.4);
          vec3 c = mix(uBase, uAccent, sin(vAlong * 12.0 + uHueOffset * 6.28 + uTime * 0.3) * 0.5 + 0.5);
          c = mix(c, uGlow, glow * (0.4 + t2 * 0.9));
          float edge = smoothstep(0.0, 0.5, 1.0 - abs(vNormal.z));
          // Bright flowing streaks along the ribbon
          float streak = pow(smoothstep(0.4, 0.5, 1.0 - abs(flow - 0.5)), 2.0);
          float a = (0.25 + streak * 0.55) * (0.55 + t1 * 0.3 + t2 * 0.3);
          vec3 outC = c * (0.65 + uEnergy * 0.5) * uIntensity + uGlow * streak * 0.35 * uIntensity;
          gl_FragColor = vec4(outC, clamp(a * (0.65 + edge * 0.35), 0.0, 0.75));
        }
      `,
    });
  }, []);

  const group = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uBass.value = audio.bass;
    mat.uniforms.uMid.value = audio.mid;
    mat.uniforms.uTreble.value = audio.treble;
    mat.uniforms.uEnergy.value = audio.energy;
    mat.uniforms.uBeat.value = audio.beat;
    mat.uniforms.uIntensity.value = 0.35 + intensity * 0.6;
    mat.uniforms.uBase.value.copy(palette.base);
    mat.uniforms.uAccent.value.copy(palette.accent);
    mat.uniforms.uGlow.value.copy(palette.glow);

    if (group.current) {
      const cam = 0.3 + cameraMotion * 1.4;
      group.current.rotation.y += dt * (0.05 + audio.tempo * 0.35) * cam;
      group.current.rotation.x = Math.sin(t * 0.15) * 0.15 * cam;
      const s = 1 + audio.beat * 0.05;
      group.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={group}>
      {ribbons.map((r, i) => {
        // clone material per-ribbon so hueOffset differs
        const m = mat.clone();
        (m.uniforms as any).uHueOffset = { value: r.hueOffset };
        (m.uniforms as any).uSeed = { value: r.seed };
        // Share the time-varying uniforms by binding same object refs
        (m.uniforms as any).uTime = mat.uniforms.uTime;
        (m.uniforms as any).uBass = mat.uniforms.uBass;
        (m.uniforms as any).uMid = mat.uniforms.uMid;
        (m.uniforms as any).uTreble = mat.uniforms.uTreble;
        (m.uniforms as any).uEnergy = mat.uniforms.uEnergy;
        (m.uniforms as any).uBeat = mat.uniforms.uBeat;
        (m.uniforms as any).uIntensity = mat.uniforms.uIntensity;
        (m.uniforms as any).uBase = mat.uniforms.uBase;
        (m.uniforms as any).uAccent = mat.uniforms.uAccent;
        (m.uniforms as any).uGlow = mat.uniforms.uGlow;
        return <mesh key={i} geometry={r.geo} material={m} />;
      })}
    </group>
  );
}
