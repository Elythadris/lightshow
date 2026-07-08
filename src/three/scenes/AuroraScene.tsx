'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '@/state/store';
import { usePaletteColors } from '../hooks';

/**
 * AuroraScene
 * Full-screen shader that paints a cinematic aurora field driven by fbm noise.
 * Vertical ribbons ripple; sky hue drifts; bass triggers wide flashes.
 */
export function AuroraScene() {
  const audio = useStore((s) => s.audio);
  const intensity = useStore((s) => s.intensity);
  const density = useStore((s) => s.density);
  const palette = usePaletteColors();
  const { size } = useThree();

  const mat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uResolution: { value: new THREE.Vector2(1, 1) },
      uBass: { value: 0 }, uMid: { value: 0 }, uTreble: { value: 0 },
      uEnergy: { value: 0 }, uBeat: { value: 0 }, uMood: { value: 0.4 },
      uIntensity: { value: 1 }, uDensity: { value: 0.6 },
      uBase: { value: new THREE.Color() }, uAccent: { value: new THREE.Color() }, uGlow: { value: new THREE.Color() },
    },
    vertexShader: /* glsl */`varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position,1.0); }`,
    fragmentShader: /* glsl */`
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uBass, uMid, uTreble, uEnergy, uBeat, uMood, uIntensity, uDensity;
      uniform vec2 uResolution;
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
        vec2 uv = vUv;
        vec2 p = (uv - 0.5) * vec2(uResolution.x/uResolution.y, 1.0);
        // vertical curtain warp
        float warp = fbm(vec2(p.x * (2.0 + uDensity * 3.0), uTime * 0.15));
        float y = p.y + (warp - 0.5) * 0.6;
        // curtains — several frequency layers with drift
        float c1 = smoothstep(0.4, 0.0, abs(y + 0.15 + sin(uTime * 0.4 + p.x * 3.0) * 0.06));
        float c2 = smoothstep(0.5, 0.0, abs(y - 0.05 + sin(uTime * 0.31 + p.x * 5.0) * 0.09));
        float c3 = smoothstep(0.35, 0.0, abs(y - 0.22 + sin(uTime * 0.22 + p.x * 7.0) * 0.11));
        float aurora = c1 * (0.35 + uBass * 0.8) + c2 * (0.25 + uMid * 0.6) + c3 * (0.20 + uTreble * 0.7);
        // stars
        float stars = pow(noise(uv * 640.0 + uTime * 0.03), 40.0) * (0.6 + uTreble * 1.4);
        // sky gradient
        vec3 sky = mix(vec3(0.02,0.03,0.07), uBase * 0.4, smoothstep(-0.4, 0.4, y));
        // color blend
        vec3 c = mix(uBase, uAccent, 0.5 + sin(uTime * 0.2 + y * 4.0) * 0.5);
        c = mix(c, uGlow, uTreble * 0.6 + uBeat * 0.6);
        vec3 col = sky + c * aurora * (0.55 + uEnergy * 0.9) + vec3(stars) * 0.85;
        // beat wash
        col += uGlow * uBeat * 0.2 * (1.0 - smoothstep(0.0, 0.6, length(p)));
        col *= uIntensity;
        col = col / (1.0 + col * 0.5);
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  }), []);

  useFrame((state) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uResolution.value.set(size.width, size.height);
    mat.uniforms.uBass.value = audio.bass;
    mat.uniforms.uMid.value = audio.mid;
    mat.uniforms.uTreble.value = audio.treble;
    mat.uniforms.uEnergy.value = audio.energy;
    mat.uniforms.uBeat.value = audio.beat;
    mat.uniforms.uMood.value = audio.mood;
    mat.uniforms.uIntensity.value = 0.6 + intensity * 0.7;
    mat.uniforms.uDensity.value = density;
    mat.uniforms.uBase.value.copy(palette.base);
    mat.uniforms.uAccent.value.copy(palette.accent);
    mat.uniforms.uGlow.value.copy(palette.glow);
  });

  return (
    <mesh material={mat} frustumCulled={false}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
