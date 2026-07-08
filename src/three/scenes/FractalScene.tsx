'use client';
import * as THREE from 'three';
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '@/state/store';
import { usePaletteColors } from '../hooks';

/**
 * FractalScene
 * A raymarched fractal (mandelbulb-like folding) rendered as a
 * fullscreen shader quad. Iteration count, palette, and animation
 * speed adapt to the audio spectrum.
 */
export function FractalScene() {
  const audio = useStore((s) => s.audio);
  const intensity = useStore((s) => s.intensity);
  const cameraMotion = useStore((s) => s.cameraMotion);
  const density = useStore((s) => s.density);
  const palette = usePaletteColors();
  const { size } = useThree();

  const mat = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uResolution: { value: new THREE.Vector2(1, 1) },
        uBass: { value: 0 },
        uMid: { value: 0 },
        uTreble: { value: 0 },
        uEnergy: { value: 0 },
        uBeat: { value: 0 },
        uMood: { value: 0.4 },
        uIntensity: { value: 0.7 },
        uCam: { value: 0.5 },
        uSteps: { value: 60 },
        uBase: { value: new THREE.Color(0.1, 0.5, 1.0) },
        uAccent: { value: new THREE.Color(0.6, 0.2, 1.0) },
        uGlow: { value: new THREE.Color(0.3, 1.0, 0.8) },
      },
      vertexShader: /* glsl */`
        varying vec2 vUv;
        void main(){ vUv = uv; gl_Position = vec4(position, 1.0); }
      `,
      fragmentShader: /* glsl */`
        precision highp float;
        varying vec2 vUv;
        uniform float uTime;
        uniform vec2 uResolution;
        uniform float uBass, uMid, uTreble, uEnergy, uBeat, uMood, uIntensity, uCam;
        uniform int uSteps;
        uniform vec3 uBase, uAccent, uGlow;

        // Folded box fractal — inspired by kaleidoscopic IFS
        float fractalDE(vec3 p){
          float scale = 2.0 + uMood * 0.7 + uBass * 0.4;
          float minRad2 = 0.20 + uTreble * 0.10;
          vec3 c = p;
          float dr = 1.0;
          float r = 0.0;
          for (int i = 0; i < 8; i++){
            p = clamp(p, -1.0, 1.0) * 2.0 - p;
            r = dot(p, p);
            if (r > 8.0) break;
            float k = max(minRad2 / r, 1.0);
            p *= k; dr *= k;
            p = p * scale + c;
            dr = dr * scale + 1.0;
          }
          float len = length(p);
          return 0.5 * len / dr;
        }

        // Returns (hitT, iterCount, minDist)
        vec3 raymarch(vec3 ro, vec3 rd){
          float t = 0.02;
          float minD = 1e10;
          float steps = 0.0;
          const int MAX_STEPS = 96;
          for (int i = 0; i < MAX_STEPS; i++){
            if (i >= uSteps) break;
            vec3 p = ro + rd * t;
            float d = fractalDE(p);
            minD = min(minD, d);
            steps += 1.0;
            if (d < 0.0015) return vec3(t, steps, minD);
            t += d;
            if (t > 12.0) break;
          }
          return vec3(-1.0, steps, minD);
        }

        vec3 estimateNormal(vec3 p){
          float e = 0.0015;
          return normalize(vec3(
            fractalDE(p + vec3(e,0.0,0.0)) - fractalDE(p - vec3(e,0.0,0.0)),
            fractalDE(p + vec3(0.0,e,0.0)) - fractalDE(p - vec3(0.0,e,0.0)),
            fractalDE(p + vec3(0.0,0.0,e)) - fractalDE(p - vec3(0.0,0.0,e))
          ));
        }

        void main(){
          vec2 uv = (vUv * 2.0 - 1.0);
          uv.x *= uResolution.x / uResolution.y;
          float camMove = 0.4 + uCam * 1.4;
          float a = uTime * 0.06 * camMove;
          float rad = 2.6 + sin(uTime * 0.13) * 0.35;
          vec3 ro = vec3(sin(a) * rad, sin(uTime * 0.08) * 0.6, cos(a) * rad);
          vec3 fwd = normalize(-ro);
          vec3 right = normalize(cross(vec3(0.0,1.0,0.0), fwd));
          vec3 up = cross(fwd, right);
          float fov = 1.05 - uEnergy * 0.12;
          vec3 rd = normalize(fwd * fov + right * uv.x + up * uv.y);

          vec3 hit = raymarch(ro, rd);
          float t = hit.x; float steps = hit.y; float minD = hit.z;
          vec3 col = vec3(0.0);
          // orbital glow — brighter where ray got close to surface
          float glow = exp(-minD * (22.0 - uBeat * 8.0));
          float ao = clamp(1.0 - steps / float(uSteps), 0.0, 1.0);
          if (t > 0.0){
            vec3 p = ro + rd * t;
            vec3 n = estimateNormal(p);
            vec3 L = normalize(vec3(0.6, 0.9, 0.4));
            float diff = clamp(dot(n, L), 0.0, 1.0);
            float rim = pow(1.0 - clamp(dot(n, -rd), 0.0, 1.0), 3.0);
            float depth = clamp(1.0 - t / 8.0, 0.0, 1.0);
            vec3 c = mix(uBase, uAccent, depth * 0.6 + rim * 0.4);
            c = mix(c, uGlow, rim * (0.6 + uTreble * 0.8));
            col = c * (0.25 + diff * 0.85) * (0.6 + ao * 0.6);
            col += uGlow * rim * (0.4 + uBeat * 0.8);
          } else {
            // miss — subtle background gradient
            float bg = smoothstep(1.4, 0.0, length(uv));
            col = mix(vec3(0.01,0.015,0.03), uBase * 0.35, bg);
          }
          // additive orbit glow always
          col += mix(uBase, uGlow, uTreble * 0.7) * glow * (0.25 + uEnergy * 0.9);
          col *= uIntensity;
          // filmic-ish
          col = col / (1.0 + col * 0.55);
          // vignette
          float v = smoothstep(1.55, 0.55, length(uv));
          col *= 0.6 + v * 0.55;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
  }, []);

  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((state, dt) => {
    mat.uniforms.uTime.value = state.clock.elapsedTime;
    mat.uniforms.uResolution.value.set(size.width, size.height);
    mat.uniforms.uBass.value = audio.bass;
    mat.uniforms.uMid.value = audio.mid;
    mat.uniforms.uTreble.value = audio.treble;
    mat.uniforms.uEnergy.value = audio.energy;
    mat.uniforms.uBeat.value = audio.beat;
    mat.uniforms.uMood.value = audio.mood;
    mat.uniforms.uIntensity.value = 0.55 + intensity * 0.7;
    mat.uniforms.uCam.value = cameraMotion;
    mat.uniforms.uSteps.value = Math.floor(48 + density * 40);
    mat.uniforms.uBase.value.copy(palette.base);
    mat.uniforms.uAccent.value.copy(palette.accent);
    mat.uniforms.uGlow.value.copy(palette.glow);
  });

  return (
    // Fullscreen quad; rendered with no camera dependency (clip-space vertices).
    <mesh ref={meshRef} frustumCulled={false} material={mat}>
      <planeGeometry args={[2, 2]} />
    </mesh>
  );
}
