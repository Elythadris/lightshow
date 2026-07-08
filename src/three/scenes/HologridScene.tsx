'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '@/state/store';
import { usePaletteColors } from '../hooks';

/**
 * HologridScene
 * Infinite scrolling holographic grid on the ground plane
 * plus overhead orbital rings and volumetric fog. Bass drives a
 * chromatic burst radiating from the horizon.
 */
export function HologridScene() {
  const audio = useStore((s) => s.audio);
  const intensity = useStore((s) => s.intensity);
  const cameraMotion = useStore((s) => s.cameraMotion);
  const density = useStore((s) => s.density);
  const palette = usePaletteColors();

  const groundMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uEnergy: { value: 0 },
      uBeat: { value: 0 },
      uIntensity: { value: 1 },
      uBase: { value: new THREE.Color() },
      uAccent: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uBass, uEnergy, uBeat, uIntensity;
      uniform vec3 uBase, uAccent, uGlow;
      float grid(vec2 uv, float scale){
        vec2 g = abs(fract(uv * scale) - 0.5);
        float l = min(g.x, g.y);
        return smoothstep(0.03, 0.0, l);
      }
      void main(){
        vec2 uv = vUv * 2.0 - 1.0;
        // perspective warp
        uv.y = uv.y * 0.5 + 0.5;
        float yy = uv.y;
        // scrolling toward viewer
        vec2 gUv = vec2(uv.x, uv.y - uTime * (0.15 + uEnergy * 0.6));
        float g1 = grid(gUv, 22.0);
        float g2 = grid(gUv * 0.5, 6.0) * 0.6;
        float g = max(g1, g2);
        float horizon = smoothstep(0.0, 0.4, yy);
        float bassBurst = smoothstep(0.5, 0.0, abs(yy - 0.5)) * (uBass * 1.8 + uBeat * 1.6);
        vec3 c = mix(uBase, uAccent, 0.4 + sin(uTime + uv.x * 3.0) * 0.3);
        c = mix(c, uGlow, bassBurst);
        float a = (g * (0.85 + uEnergy * 0.6) + bassBurst * 0.55) * horizon;
        // fade edges
        a *= smoothstep(1.0, 0.15, abs(uv.x));
        // horizon glow band
        float band = smoothstep(0.02, 0.0, abs(yy - 0.5)) * 0.6;
        vec3 outC = c * (0.9 + uEnergy * 0.9) * uIntensity + uGlow * band * 0.7 * uIntensity;
        gl_FragColor = vec4(outC, clamp(a + band * 0.7, 0.0, 1.0));
      }
    `,
  }), []);

  const ringMat = useMemo(() => new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 },
      uTreble: { value: 0 },
      uEnergy: { value: 0 },
      uBeat: { value: 0 },
      uIntensity: { value: 1 },
      uBase: { value: new THREE.Color() },
      uAccent: { value: new THREE.Color() },
      uGlow: { value: new THREE.Color() },
    },
    vertexShader: /* glsl */`
      varying vec2 vUv;
      void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uBass, uTreble, uEnergy, uBeat, uIntensity;
      uniform vec3 uBase, uAccent, uGlow;
      void main(){
        float ring = smoothstep(0.02, 0.0, abs(vUv.y - 0.5));
        float pulse = sin(vUv.x * 40.0 - uTime * (3.0 + uEnergy * 6.0)) * 0.5 + 0.5;
        float glow = pow(pulse, 3.0);
        vec3 c = mix(uBase, uAccent, pulse);
        c = mix(c, uGlow, uTreble);
        float a = ring * (0.25 + glow * 0.55) * (0.5 + uBass * 0.9 + uBeat * 0.7);
        gl_FragColor = vec4(c * (0.65 + uBeat * 0.9) * uIntensity, a * 0.9);
      }
    `,
  }), []);

  const g = useRef<THREE.Group>(null);
  const rings = useMemo(() => {
    const n = Math.max(3, Math.floor(4 + density * 7));
    return new Array(n).fill(0).map((_, i) => ({
      radius: 2.2 + i * 0.9,
      y: 1.2 + i * 0.35,
      speed: (i % 2 === 0 ? 1 : -1) * (0.08 + Math.random() * 0.12),
      tilt: Math.random() * 0.6 - 0.3,
    }));
  }, [density]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    for (const m of [groundMat, ringMat]) {
      m.uniforms.uTime.value = t;
      m.uniforms.uBass.value = audio.bass;
      m.uniforms.uEnergy.value = audio.energy;
      m.uniforms.uBeat.value = audio.beat;
      m.uniforms.uIntensity.value = 0.4 + intensity * 0.7;
      m.uniforms.uBase.value.copy(palette.base);
      m.uniforms.uAccent.value.copy(palette.accent);
      m.uniforms.uGlow.value.copy(palette.glow);
    }
    (ringMat.uniforms.uTreble.value as number) = audio.treble;
    if (g.current) {
      const cam = 0.3 + cameraMotion * 1.2;
      g.current.rotation.y += dt * 0.03 * cam;
    }
  });

  return (
    <group ref={g}>
      {/* Ground */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -2.8, 0]} material={groundMat}>
        <planeGeometry args={[120, 120, 1, 1]} />
      </mesh>
      {/* Orbital rings */}
      {rings.map((r, i) => (
        <mesh key={i} position={[0, r.y - 1.5, 0]} rotation={[Math.PI / 2 + r.tilt, 0, r.speed * 6]} material={ringMat}>
          <cylinderGeometry args={[r.radius, r.radius, 0.05, 128, 1, true]} />
        </mesh>
      ))}
    </group>
  );
}
