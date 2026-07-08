'use client';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { Suspense, useEffect } from 'react';
import { useStore } from '@/state/store';
import { NebulaScene } from './scenes/NebulaScene';
import { RibbonsScene } from './scenes/RibbonsScene';
import { FractalScene } from './scenes/FractalScene';
import { HologridScene } from './scenes/HologridScene';
import { AuroraScene } from './scenes/AuroraScene';
import { CameraRig } from './CameraRig';
import { JourneyDirector } from './JourneyDirector';

/**
 * World
 *
 * A single 3D stage where every scene renders simultaneously. Their per-scene
 * presence (0..1) controls opacity/emission/scale, so the JourneyDirector can
 * cross-fade them as the journey progresses.
 */
export function World() {
  const bloom = useStore((s) => s.bloom);
  const performanceMode = useStore((s) => s.performanceMode);
  const audio = useStore((s) => s.audio);
  const setFps = useStore((s) => s.set);

  const dpr: [number, number] =
    performanceMode === 'low' ? [0.8, 1] :
    performanceMode === 'balanced' ? [1, 1.25] :
    performanceMode === 'high' ? [1, 2] : [1, 1.6];

  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let frames = 0;
    const tick = () => {
      const now = performance.now();
      frames++;
      if (now - last >= 1000) {
        setFps('fps', Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [setFps]);

  return (
    <Canvas
      dpr={dpr}
      gl={{
        antialias: false,
        alpha: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: true,
      }}
      camera={{ position: [0, 0, 14], fov: 60, near: 0.1, far: 500 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000005, 1);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.9;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <color attach="background" args={[0x000005]} />
      <Suspense fallback={null}>
        <JourneyDirector />
        <CameraRig />
        {/* All scenes render at once; presence gates their opacity/scale/emission. */}
        <AuroraScene />
        <NebulaScene />
        <HologridScene />
        <RibbonsScene />
        <FractalScene />
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.24 + bloom * 0.6 + audio.beat * 0.18}
            luminanceThreshold={0.58 - audio.energy * 0.1}
            luminanceSmoothing={0.3}
            mipmapBlur
            kernelSize={KernelSize.LARGE}
          />
          <Vignette eskil={false} offset={0.22} darkness={0.86} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}
