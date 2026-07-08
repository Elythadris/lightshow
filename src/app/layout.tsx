import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'LIGHTSHOW — An Audio-Reactive Digital World',
  description:
    'An immersive audio-reactive browser experience. Explore evolving procedural worlds that respond to sound, motion, and emotion. 100% static, built with WebGL and the Web Audio API.',
  keywords: [
    'lightshow', 'audio reactive', 'webgl', 'three.js', 'react three fiber',
    'music visualizer', 'generative art', 'immersive web', 'interactive experience'
  ],
  openGraph: {
    title: 'LIGHTSHOW',
    description: 'An immersive audio-reactive browser world.',
    type: 'website',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#04050a',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
