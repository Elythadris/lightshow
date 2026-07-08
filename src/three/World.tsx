'use client';
import { Canvas } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { KernelSize } from 'postprocessing';
import * as THREE from 'three';
import { AnimatePresence } from 'framer-motion';
import { Suspense, useEffect } from 'react';
import { useStore } from '@/state/store';
import { NebulaScene } from './scenes/NebulaScene';
import { RibbonsScene } from './scenes/RibbonsScene';
import { FractalScene } from './scenes/FractalScene';
import { HologridScene } from './scenes/HologridScene';
import { AuroraScene } from './scenes/AuroraScene';
import { CameraRig } from './CameraRig';

export function World() {
  const scene = useStore((s) => s.scene);
  const bloom = useStore((s) => s.bloom);
  const performanceMode = useStore((s) => s.performanceMode);
  const setFps = useStore((s) => s.set);

  // Light DPR based on performance mode. Auto = 1.5, high = 2, low = 1.
  const dpr: [number, number] =
    performanceMode === 'low' ? [0.8, 1] :
    performanceMode === 'balanced' ? [1, 1.25] :
    performanceMode === 'high' ? [1, 2] : [1, 1.6];

  useEffect(() => {
    // Simple FPS meter
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
      camera={{ position: [0, 0, 12], fov: 60, near: 0.1, far: 200 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000005, 1);
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 0.85;
        gl.outputColorSpace = THREE.SRGBColorSpace;
      }}
    >
      <color attach="background" args={[0x000005]} />
      <Suspense fallback={null}>
        <CameraRig />
        <AnimatePresence mode="wait">
          {scene === 'nebula'   && <SceneWrap key="nebula"><NebulaScene /></SceneWrap>}
          {scene === 'ribbons'  && <SceneWrap key="ribbons"><RibbonsScene /></SceneWrap>}
          {scene === 'fractal'  && <SceneWrap key="fractal"><FractalScene /></SceneWrap>}
          {scene === 'hologrid' && <SceneWrap key="hologrid"><HologridScene /></SceneWrap>}
          {scene === 'aurora'   && <SceneWrap key="aurora"><AuroraScene /></SceneWrap>}
        </AnimatePresence>
        <EffectComposer multisampling={0}>
          <Bloom
            intensity={0.22 + bloom * 0.55}
            luminanceThreshold={0.62}
            luminanceSmoothing={0.28}
            mipmapBlur
            kernelSize={KernelSize.LARGE}
          />
          <Vignette eskil={false} offset={0.2} darkness={0.85} />
        </EffectComposer>
      </Suspense>
    </Canvas>
  );
}

function SceneWrap({ children }: { children: React.ReactNode }) {
  // <group> can't be animated with framer-motion in R3F v8 the same way
  // so we simply mount/unmount; AnimatePresence handles a 2D overlay fade.
  return <group>{children}</group>;
}
