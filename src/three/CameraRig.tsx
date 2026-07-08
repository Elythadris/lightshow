'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore, JOURNEY } from '@/state/store';
import * as THREE from 'three';

/**
 * CameraRig
 *
 * Journey-aware camera choreography. Each chapter has a "cameraMode" that
 * defines the base motion pattern (orbit, rise, dive, sweep, drift, return),
 * which is then subtly modulated by:
 *   - mouse / touch pointer
 *   - device orientation
 *   - beat impulses (small dolly kick)
 *   - user "cameraMotion" amount (0..1)
 *
 * In manual mode (user clicked a specific world), a simpler pointer-driven
 * camera is used so people can freely explore.
 */
export function CameraRig() {
  const { camera, size } = useThree();
  const pointer = useRef({ x: 0, y: 0 });
  const tilt = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);
  const lookAt = useRef(new THREE.Vector3(0, 0, 0));

  const journeyMode = useStore((s) => s.journeyMode);
  const chapterIndex = useStore((s) => s.chapterIndex);
  const chapterProgress = useStore((s) => s.chapterProgress);
  const cameraMotion = useStore((s) => s.cameraMotion);
  const audio = useStore((s) => s.audio);
  const reducedMotion = useStore((s) => s.reducedMotion);
  const scene = useStore((s) => s.scene);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / size.width) * 2 - 1;
      pointer.current.y = -((e.clientY / size.height) * 2 - 1);
    };
    const onTouch = (e: TouchEvent) => {
      if (!e.touches[0]) return;
      pointer.current.x = (e.touches[0].clientX / size.width) * 2 - 1;
      pointer.current.y = -((e.touches[0].clientY / size.height) * 2 - 1);
    };
    const onWheel = (e: WheelEvent) => {
      scroll.current = Math.max(-1, Math.min(1, scroll.current + Math.sign(e.deltaY) * 0.06));
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      const beta = (e.beta ?? 0) / 90;
      const gamma = (e.gamma ?? 0) / 90;
      tilt.current.x = Math.max(-1, Math.min(1, gamma));
      tilt.current.y = Math.max(-1, Math.min(1, beta));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('touchmove', onTouch, { passive: true });
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('deviceorientation', onOrient);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('deviceorientation', onOrient);
    };
  }, [size.width, size.height]);

  useFrame((state, dt) => {
    const t = state.clock.elapsedTime;
    const amt = reducedMotion ? 0.25 : (0.35 + cameraMotion * 1.4);
    const px = pointer.current.x + tilt.current.x * 0.6;
    const py = pointer.current.y + tilt.current.y * 0.5;

    let tx = 0, ty = 0, tz = 14, lx = 0, ly = 0, lz = 0;

    if (!journeyMode) {
      // Manual world: gentle pointer-driven orbit
      const focusZ = (scene === 'fractal') ? 6 : (scene === 'aurora' ? 10 : 12);
      tx = px * 3.4 * amt;
      ty = py * 2.2 * amt;
      tz = focusZ - scroll.current * 3 - audio.beat * 0.5;
    } else {
      const chapter = JOURNEY[chapterIndex];
      const p = chapterProgress;
      // Base position per camera mode, driven by chapter progress
      switch (chapter.cameraMode) {
        case 'drift': { // slow inward drift
          const a = t * 0.06;
          tx = Math.sin(a) * 3.2;
          ty = Math.cos(a * 0.7) * 1.2;
          tz = 16 - p * 4.5;
          break;
        }
        case 'orbit': { // wider orbit
          const a = t * 0.16 + p * Math.PI;
          tx = Math.sin(a) * 8.0;
          ty = Math.sin(a * 0.5) * 2.4;
          tz = 12 - Math.cos(a) * 3.0;
          break;
        }
        case 'rise': { // ascending sweep
          const a = t * 0.13;
          tx = Math.sin(a) * 5.5;
          ty = -3 + p * 12; // rise from below to above
          tz = 14 - p * 3;
          ly = -1 + p * 6;
          break;
        }
        case 'sweep': { // horizon glide
          const a = t * 0.11;
          tx = Math.sin(a * 0.7) * 12;
          ty = 5 + Math.sin(a) * 1.5;
          tz = 12;
          ly = 3;
          break;
        }
        case 'dive': { // pushing into the fractal
          const a = t * 0.09;
          tx = Math.sin(a) * 1.4;
          ty = Math.cos(a * 0.7) * 0.9;
          tz = 12 - p * 9; // dive from 12 to 3
          break;
        }
        case 'return': { // pulling back and up
          const a = t * 0.05;
          tx = Math.sin(a) * 2.8;
          ty = 2 + p * 5;
          tz = 8 + p * 10;
          break;
        }
      }
      // Pointer nudges the base pose
      tx += px * 3.2 * amt;
      ty += py * 2.0 * amt;
      // Beat dolly kick
      tz -= audio.beat * 0.6;
      // Scroll adjusts
      tz -= scroll.current * 2;
    }

    // Smooth follow
    camera.position.x += (tx - camera.position.x) * Math.min(1, dt * 1.8);
    camera.position.y += (ty - camera.position.y) * Math.min(1, dt * 1.6);
    camera.position.z += (tz - camera.position.z) * Math.min(1, dt * 1.4);

    lookAt.current.x += (lx - lookAt.current.x) * Math.min(1, dt * 1.2);
    lookAt.current.y += (ly - lookAt.current.y) * Math.min(1, dt * 1.2);
    lookAt.current.z += (lz - lookAt.current.z) * Math.min(1, dt * 1.2);
    camera.lookAt(lookAt.current);

    // Tiny roll on strong beats for cinematic feel
    (camera as any).rotation.z = Math.sin(t * 0.3) * 0.015 * amt + audio.beat * 0.02;
  });

  return null;
}
