# Lightshow

An immersive, audio-reactive digital world in the browser. 100% static. No backend. No accounts. Just WebGL, the Web Audio API, and light.

Move your mouse, tilt your phone, or play any music near your microphone — the world will listen and react.

## Highlights

- **5 procedurally animated worlds** — Nebula, Ribbons, Fractal, Hologrid, Aurora — each with its own visual identity.
- **Real-time audio analysis** — FFT-based feature extraction (bass / mid / treble / RMS / spectral flux) plus onset detection, running-BPM estimation, and a mood proxy. Every field drives the shaders.
- **Cinematic post-processing** — bloom, vignette, and additive blending give every session a filmic look.
- **Interactive camera** — mouse, touch, wheel, and device orientation subtly drive the composition.
- **Full control surface** — intensity, density, camera motion, bloom, audio sensitivity, palette, and performance mode.
- **Ambient fallback** — if microphone permission is denied, an evolving synthetic signal keeps the world alive.
- **Accessibility** — honors `prefers-reduced-motion`, keyboard shortcuts, and reduced-DPR performance modes.
- **Static export** — deploys to any static host (Pages, Netlify, Cloudflare Pages, Vercel).

## Stack

- Next.js 14 (App Router) with `output: 'export'`
- React 18 + TypeScript (strict)
- Tailwind CSS 3
- react-three-fiber + drei + three
- @react-three/postprocessing (Bloom, Vignette)
- Framer Motion
- Zustand
- Web Audio API (mic + element sources + simulated fallback)

## Getting Started

```bash
npm install
npm run dev       # local dev server
npm run build     # produces the static site into ./out
```

The `out/` directory is ready to serve from any static host. Point GitHub Pages, Netlify, Cloudflare Pages, or Vercel at it.

### Deploying to GitHub Pages

The repository ships with a GitHub Actions workflow at `.github/workflows/deploy.yml` that builds the site and publishes the `out/` directory to Pages on every push to `main`.

## Keyboard Shortcuts

| Key | Action |
| --- | ------ |
| `1`–`5` | Switch worlds |
| `←` / `→` | Cycle worlds |
| `H` | Show / hide interface |
| `M` | Toggle microphone |
| `F` | Fullscreen |

## Project Layout

```
src/
  app/            Next.js app router entrypoint + global styles
  audio/          Web Audio engine + feature publisher
  state/          Zustand store (palette, scene, audio state)
  three/          R3F canvas, camera rig, post-processing
    scenes/       Individual immersive environments
  ui/             HUD, intro gate, controls
```

## License

MIT.
