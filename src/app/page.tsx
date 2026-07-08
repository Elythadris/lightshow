'use client';
import { AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import { useState } from 'react';
import { HUD } from '@/ui/HUD';
import { Intro } from '@/ui/Intro';
import { useAudioPublisher } from '@/audio/useAudio';

// Load the WebGL world only on the client to keep static export clean.
const World = dynamic(() => import('@/three/World').then((m) => m.World), {
  ssr: false,
  loading: () => null,
});

export default function Page() {
  const [entered, setEntered] = useState(false);
  useAudioPublisher();

  return (
    <main className="relative w-full h-full vignette">
      <div className="absolute inset-0">
        <World />
      </div>
      <HUD />
      <AnimatePresence>
        {!entered && <Intro onEnter={() => setEntered(true)} />}
      </AnimatePresence>
    </main>
  );
}
