'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '@/state/store';
import { usePaletteColors, useScenePresence } from '../hooks';

/**
 * NebulaScene
 * GPU-driven point cloud drifting through a volumetric field. Points are
 * perturbed by curl noise; size/color respond to bass, mid, treble bands.
 * Gated by presence: opacity + emission fade when the journey moves elsewhere.
 */
export function NebulaScene() {
  const density = useStore((s) => s.density);
  const intensity = useStore((s) => s.intensity);
  const audio = useStore((s) => s.audio);
  const palette = usePaletteColors();
  const presence = useScenePresence('nebula');

  // Keep the count stable — mutating it would rebuild the buffer.
  const count = useMemo(() => Math.floor(6000 + density * 34000), [density]);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const r = Math.pow(Math.random(), 0.6) * 24 + 2;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3 + 0] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.55;
      positions[i * 3 + 2] = r * Math.cos(phi);
      seeds[i] = Math.random();
    }
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    return g;
  }, [count]);

  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
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
        uSize: { value: 3.0 },
      },
      vertexShader: /* glsl */`
        attribute float aSeed;
        uniform float uTime;
        uniform float uBass;
        uniform float uMid;
        uniform float uTreble;
        uniform float uBeat;
        uniform float uIntensity;
        uniform float uPresence;
        uniform float uSize;
        varying float vSeed;
        varying float vEnergy;

        vec3 curl(vec3 p){
          vec3 n1 = sin(p.yzx * 0.5 + uTime * 0.15);
          vec3 n2 = cos(p.zxy * 0.4 - uTime * 0.11);
          return normalize(n1 + n2);
        }

        void main(){
          vSeed = aSeed;
          vec3 p = position;
          vec3 flow = curl(p * 0.15 + vec3(aSeed*10.0));
          float pulse = uBass * 2.4 + uBeat * 1.8;
          p += flow * (0.55 + pulse * 0.9) * (0.6 + uIntensity);
          // Presence pulls the cloud in slightly when fading out
          p *= (0.75 + uPresence * 0.25);
          float a = uTime * 0.05 + aSeed * 6.2831;
          mat2 R = mat2(cos(a*0.1), -sin(a*0.1), sin(a*0.1), cos(a*0.1));
          p.xz = R * p.xz;

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = -mv.z;
          float size = uSize * (1.0 + uTreble * 3.2 + uBeat * 2.4) * (300.0 / max(dist, 0.001));
          gl_PointSize = clamp(size, 1.0, 22.0) * mix(0.4, 1.0, uPresence);
          vEnergy = clamp(uBass * 0.4 + uMid * 0.35 + uTreble * 0.4 + uBeat * 0.6, 0.0, 2.0);
        }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        varying float vSeed;
        varying float vEnergy;
        uniform vec3 uBase;
        uniform vec3 uAccent;
        uniform vec3 uGlow;
        uniform float uIntensity;
        uniform float uPresence;
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          a = pow(a, 2.6);
          vec3 c = mix(uBase, uAccent, vSeed);
          c = mix(c, uGlow, clamp(vEnergy * 0.6, 0.0, 1.0));
          gl_FragColor = vec4(c * (0.35 + vEnergy * 0.6) * uIntensity, a * 0.55 * uPresence);
        }
      `,
    });
  }, []);

  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    mat.uniforms.uTime.value = t;
    mat.uniforms.uBass.value = audio.bass;
    mat.uniforms.uMid.value = audio.mid;
    mat.uniforms.uTreble.value = audio.treble;
    mat.uniforms.uEnergy.value = audio.energy;
    mat.uniforms.uBeat.value = audio.beat;
    mat.uniforms.uPresence.value = presence;
    mat.uniforms.uIntensity.value = (0.22 + intensity * 0.6);
    (mat.uniforms.uBase.value as THREE.Color).lerp(palette.base, 0.06);
    (mat.uniforms.uAccent.value as THREE.Color).lerp(palette.accent, 0.06);
    (mat.uniforms.uGlow.value as THREE.Color).lerp(palette.glow, 0.06);

    if (groupRef.current) {
      groupRef.current.rotation.y += dt * 0.04;
      groupRef.current.rotation.x = Math.sin(t * 0.08) * 0.14;
      const s = 1 + audio.beat * 0.06 + audio.energy * 0.03;
      groupRef.current.scale.setScalar(s);
      groupRef.current.visible = presence > 0.02;
    }
  });

  return (
    <group ref={groupRef}>
      <points geometry={geom} material={mat} frustumCulled={false} />
    </group>
  );
}
