'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '@/state/store';
import { usePaletteColors } from '../hooks';

/**
 * NebulaScene
 * A GPU-driven point cloud drifting through a volumetric field.
 * Points are perturbed by curl noise and their brightness/color
 * responds to bass, mid, and treble bands.
 */
export function NebulaScene() {
  const density = useStore((s) => s.density);
  const intensity = useStore((s) => s.intensity);
  const cameraMotion = useStore((s) => s.cameraMotion);
  const audio = useStore((s) => s.audio);
  const palette = usePaletteColors();

  const count = Math.floor(6000 + density * 34000);

  const geom = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const positions = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // Distributed in a squashed sphere
      const r = Math.pow(Math.random(), 0.6) * 22 + 2;
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
        uniform float uSize;
        varying float vSeed;
        varying float vEnergy;

        // Cheap hash-based curl approximation
        vec3 curl(vec3 p){
          float e = 0.6;
          vec3 dx = vec3(e,0.0,0.0);
          vec3 dy = vec3(0.0,e,0.0);
          vec3 dz = vec3(0.0,0.0,e);
          vec3 n1 = sin(p.yzx * 0.5 + uTime * 0.15);
          vec3 n2 = cos(p.zxy * 0.4 - uTime * 0.11);
          return normalize(n1 + n2);
        }

        void main(){
          vSeed = aSeed;
          vec3 p = position;
          vec3 flow = curl(p * 0.15 + vec3(aSeed*10.0));
          float pulse = uBass * 2.2 + uBeat * 1.5;
          p += flow * (0.6 + pulse * 0.8) * (0.6 + uIntensity);
          // gentle orbit
          float a = uTime * 0.05 + aSeed * 6.2831;
          mat2 R = mat2(cos(a*0.1), -sin(a*0.1), sin(a*0.1), cos(a*0.1));
          p.xz = R * p.xz;

          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float dist = -mv.z;
          float size = uSize * (1.0 + uTreble * 3.0 + uBeat * 2.0) * (300.0 / max(dist, 0.001));
          gl_PointSize = clamp(size, 1.0, 22.0);
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
        void main(){
          vec2 uv = gl_PointCoord - 0.5;
          float d = length(uv);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.0, d);
          a = pow(a, 2.6);
          vec3 c = mix(uBase, uAccent, vSeed);
          c = mix(c, uGlow, clamp(vEnergy * 0.6, 0.0, 1.0));
          gl_FragColor = vec4(c * (0.35 + vEnergy * 0.6) * uIntensity, a * 0.55);
        }
      `,
    });
  }, []);

  const pointsRef = useRef<THREE.Points>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    (mat.uniforms.uTime.value as number) = t;
    mat.uniforms.uBass.value = audio.bass;
    mat.uniforms.uMid.value = audio.mid;
    mat.uniforms.uTreble.value = audio.treble;
    mat.uniforms.uEnergy.value = audio.energy;
    mat.uniforms.uBeat.value = audio.beat;
    mat.uniforms.uIntensity.value = 0.18 + intensity * 0.55;
    mat.uniforms.uBase.value.copy(palette.base);
    mat.uniforms.uAccent.value.copy(palette.accent);
    mat.uniforms.uGlow.value.copy(palette.glow);

    if (groupRef.current) {
      const camAmt = 0.2 + cameraMotion * 1.4;
      groupRef.current.rotation.y += dt * 0.03 * camAmt;
      groupRef.current.rotation.x = Math.sin(t * 0.08) * 0.14 * camAmt;
      const s = 1 + audio.beat * 0.06 + audio.energy * 0.03;
      groupRef.current.scale.setScalar(s);
    }
  });

  return (
    <group ref={groupRef}>
      <points ref={pointsRef} geometry={geom} material={mat} frustumCulled={false} />
    </group>
  );
}
