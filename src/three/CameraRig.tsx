'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useStore } from '@/state/store';
import * as THREE from 'three';

/**
 * CameraRig
 * Smoothly moves the camera in response to:
 *  - mouse / touch position
 *  - device orientation (mobile tilt)
 *  - audio beat impulses
 *  - user-tuned "cameraMotion" amount
 * Also ignores 3D motion for fullscreen shader scenes.
 */
export function CameraRig() {
  const { camera, size } = useThree();
  const target = useRef(new THREE.Vector3(0, 0, 0));
  const pointer = useRef({ x: 0, y: 0 });
  const tilt = useRef({ x: 0, y: 0 });
  const scroll = useRef(0);
  const scene = useStore((s) => s.scene);
  const cameraMotion = useStore((s) => s.cameraMotion);
  const audio = useStore((s) => s.audio);
  const reducedMotion = useStore((s) => s.reducedMotion);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      pointer.current.x = (e.clientX / size.width) * 2 - 1;
      pointer.current.y = -((e.clientY / size.height) * 2 - 1);
    };
    const onWheel = (e: WheelEvent) => {
      scroll.current = Math.max(-1, Math.min(1, scroll.current + Math.sign(e.deltaY) * 0.08));
    };
    const onOrient = (e: DeviceOrientationEvent) => {
      const beta = (e.beta ?? 0) / 90;   // -1..1 (front/back)
      const gamma = (e.gamma ?? 0) / 90;  // -1..1 (left/right)
      tilt.current.x = Math.max(-1, Math.min(1, gamma));
      tilt.current.y = Math.max(-1, Math.min(1, beta));
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('wheel', onWheel, { passive: true });
    window.addEventListener('deviceorientation', onOrient);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('deviceorientation', onOrient);
    };
  }, [size.width, size.height]);

  useFrame((state, dt) => {
    // Fullscreen shader scenes: keep camera identity to avoid weird clip issues.
    const shaderScene = scene === 'fractal' || scene === 'aurora';
    const amt = reducedMotion ? 0.2 : (0.4 + cameraMotion * 1.6);

    const px = pointer.current.x + tilt.current.x * 0.8;
    const py = pointer.current.y + tilt.current.y * 0.6;

    if (shaderScene) {
      camera.position.set(0, 0, 5);
      camera.lookAt(0, 0, 0);
      return;
    }

    const targetX = px * 3 * amt;
    const targetY = py * 2 * amt;
    const zoom = 12 - scroll.current * 4 - audio.beat * 0.4;

    camera.position.x += (targetX - camera.position.x) * Math.min(1, dt * 3);
    camera.position.y += (targetY - camera.position.y) * Math.min(1, dt * 3);
    camera.position.z += (zoom - camera.position.z) * Math.min(1, dt * 2);
    camera.lookAt(target.current);
  });
  return null;
}
