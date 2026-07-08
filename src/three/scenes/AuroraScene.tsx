'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { useStore } from '@/state/store';
import { usePaletteColors, useScenePresence } from '../hooks';

/**
 * AuroraScene
 * Rendered as a very large back-side sphere behind everything else, so it acts
 * as an atmospheric backdrop other worlds can float in front of.
 * Curtains ripple on fbm noise; sky hue drifts; bass triggers wide flashes.
 */
export function AuroraScene() {
  const audio = useStore((s) => s.audio);
  const intensity = useStore((s) => s.intensity);
  const density = useStore((s) => s.density);
  const palette = usePaletteColors();
  const presence = useScenePresence('aurora');

  const mat = useMemo(() => new THREE.ShaderMaterial({
    depthWrite: false,
    depthTest: false,
    side: THREE.BackSide,
    transparent: true,
    uniforms: {
      uTime: { value: 0 },
      uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
      uEnergy: { value: 0 }, uBeat: { value: 0 }, uMood: { value: 0.4 },
      uIntensity: { value: 1 }, uDensity: { value: 0.6 },
      uPresence: { value: 0 },
      uBase: { value: new THREE.Color() }, uAccent: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
    },
    vertexShader: /* glsl */`
      varying vec3 vDir;
      void main(){
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec3 vDir;
      uniform float uTime, uBass, uMid, uTreble, uEnergy, uBeat, uMood, uIntensity, uDensity, uPresence;
      uniform vec3 uBase, uAccent, uGlow;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){
        vec2 i = floor(p); vec2 f = fract(p);
        float a = hash(i); float b = hash(i + vec2(1.0,0.0));
        float c = hash(i + vec2(0.0,1.0)); float d = hash(i + vec2(1.0,1.0));
        vec2 u = f*f*(3.0-2.0*f);
        return mix(a,b,u.x) + (c-a)*u.y*(1.0-u.x) + (d-b)*u.x*u.y;
      }
      float fbm(vec2 p){
        float v = 0.0; float a = 0.5;
        for (int i=0;i<5;i++){ v += a * noise(p); p *= 2.0; a *= 0.5; }
        return v;
      }
      void main(){
        vec3 d = vDir;
        // Project onto a spherical UV
        float u = atan(d.z, d.x) / 6.2831853 + 0.5;
        float v = asin(clamp(d.y, -1.0, 1.0)) / 3.14159265 + 0.5;
        vec2 uv = vec2(u, v);
        vec2 p = (uv - 0.5) * vec2(2.0, 1.0);

        float warp = fbm(vec2(p.x * (2.0 + uDensity * 3.5), uTime * 0.17));
        float y = p.y + (warp - 0.5) * 0.55;
        float c1 = smoothstep(0.36, 0.0, abs(y + 0.15 + sin(uTime * 0.42 + p.x * 3.0) * 0.06));
        float c2 = smoothstep(0.44, 0.0, abs(y - 0.05 + sin(uTime * 0.31 + p.x * 5.0) * 0.09));
        float c3 = smoothstep(0.32, 0.0, abs(y - 0.22 + sin(uTime * 0.22 + p.x * 7.0) * 0.11));
        float aurora = c1 * (0.35 + uBass * 0.85) + c2 * (0.25 + uMid * 0.7) + c3 * (0.20 + uTreble * 0.8);

        // Stars — only in the upper hemisphere for realism
        float starMask = smoothstep(0.05, 0.55, y);
        float stars = pow(noise(uv * 720.0 + uTime * 0.02), 42.0) * (0.55 + uTreble * 1.6) * starMask;

        vec3 sky = mix(vec3(0.01, 0.015, 0.04), uBase * 0.35, smoothstep(-0.45, 0.4, y));
        vec3 col = mix(uBase, uAccent, 0.5 + sin(uTime * 0.2 + y * 4.0) * 0.5);
        col = mix(col, uGlow, uTreble * 0.7 + uBeat * 0.55);
        vec3 outC = sky + col * aurora * (0.5 + uEnergy * 1.0) + vec3(stars) * 0.9;
        // Beat wash — radial from center of visible hemisphere
        outC += uGlow * uBeat * 0.18 * (1.0 - smoothstep(0.0, 0.7, length(vec2(p.x*0.6, p.y))));
        outC *= uIntensity;
        outC = outC / (1.0 + outC * 0.55);

        gl_FragColor = vec4(outC, uPresence);
      }
    `,
  }), []);

  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uBass.value = audio.bass;
    mat.uniforms.uMid.value = audio.mid;
    mat.uniforms.uTreble.value = audio.treble;
    mat.uniforms.uEnergy.value = audio.energy;
    mat.uniforms.uBeat.value = audio.beat;
    mat.uniforms.uMood.value = audio.mood;
    mat.uniforms.uIntensity.value = 0.7 + intensity * 0.7;
    mat.uniforms.uDensity.value = density;
    mat.uniforms.uPresence.value = presence;
    (mat.uniforms.uBase.value as THREE.Color).lerp(palette.base, 0.06);
    (mat.uniforms.uAccent.value as THREE.Color).lerp(palette.accent, 0.06);
    (mat.uniforms.uGlow.value as THREE.Color).lerp(palette.glow, 0.06);
    if (meshRef.current) meshRef.current.visible = presence > 0.01;
  });

  // renderOrder -100 pushes it firmly to the back layer.
  return (
    <mesh ref={meshRef} material={mat} frustumCulled={false} renderOrder={-100}>
      <sphereGeometry args={[200, 48, 32]} />
    </mesh>
  );
}
