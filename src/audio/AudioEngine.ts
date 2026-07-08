'use client';

/**
 * AudioEngine
 *
 * Real-time audio feature extractor built on the Web Audio API.
 *
 * Sources (priority order):
 *   1. Tab / system audio via getDisplayMedia({ audio: true })  ← recommended
 *   2. Microphone via getUserMedia({ audio: true })
 *   3. HTMLMediaElement (for future <audio> uploads)
 *   4. Simulated ambient signal (fallback so visuals never freeze)
 *
 * Extracts: level (RMS), bass/mid/treble energies, spectral flux,
 * onset detection, running BPM/tempo estimate, mood proxy, silence flag.
 */

export type AudioFeatures = {
  level: number;
  bass: number;
  mid: number;
  treble: number;
  energy: number;
  beat: number;
  tempo: number;
  onset: boolean;
  mood: number;
  silent: boolean;
  spectrum: any;
  waveform: any;
};

export type AudioSourceKind = 'mic' | 'tab' | 'element' | 'simulated' | 'none';

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class AudioEngine {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  source: AudioNode | null = null;
  gain: GainNode | null = null;
  stream: MediaStream | null = null;
  kind: AudioSourceKind = 'none';
  fftSize = 2048;
  freqBins = 1024;
  spectrum: any = new Uint8Array(1024);
  waveform: any = new Uint8Array(1024);
  prevSpectrum: any = new Float32Array(1024);

  // running smoothed features
  private _level = 0;
  private _bass = 0;
  private _mid = 0;
  private _treble = 0;
  private _energy = 0;
  private _beat = 0;
  private _tempo = 0;
  private _mood = 0.4;
  private _silent = false;

  // onset detection
  private fluxHistory: number[] = [];
  private lastOnsetTime = 0;
  private beatTimes: number[] = [];

  // silence detector
  private quietSince = 0;

  // simulator state
  private simT = 0;
  private simTargetBpm = 96;

  async initMic() {
    await this.ensureCtx();
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });
    const src = this.ctx!.createMediaStreamSource(stream);
    this.stream = stream;
    this.attach(src, 'mic');
  }

  /**
   * Capture tab or system audio. Requires user to pick a tab / window / screen
   * in the browser's share-picker AND check "Share tab audio" (Chrome/Edge)
   * or "Share system audio" (Edge/Windows).
   * The video track is immediately discarded — only audio is used.
   */
  async initTab() {
    await this.ensureCtx();
    const mediaAny = (navigator as any).mediaDevices;
    if (!mediaAny || !mediaAny.getDisplayMedia) {
      throw new Error('Tab capture is not supported in this browser.');
    }
    const stream: MediaStream = await mediaAny.getDisplayMedia({
      video: true,      // required by spec; we discard it
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      selfBrowserSurface: 'include',
      systemAudio: 'include',
    });
    // Drop the video track — we only need audio
    stream.getVideoTracks().forEach((t) => t.stop());
    if (stream.getAudioTracks().length === 0) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('No audio was shared. Re-run and check "Share tab audio".');
    }
    // If the user stops sharing from the browser toolbar, fall back gracefully.
    stream.getAudioTracks().forEach((t) => {
      t.onended = () => {
        this.stop();
        this.initSimulated();
      };
    });
    const src = this.ctx!.createMediaStreamSource(stream);
    this.stream = stream;
    this.attach(src, 'tab');
  }

  async initElement(el: HTMLMediaElement) {
    await this.ensureCtx();
    const src = this.ctx!.createMediaElementSource(el);
    src.connect(this.ctx!.destination);
    this.attach(src, 'element');
  }

  async initSimulated() {
    await this.ensureCtx();
    this.kind = 'simulated';
    this.analyser = null;
  }

  private async ensureCtx() {
    if (!this.ctx) {
      const AnyWin = window as any;
      const Ctx: typeof AudioContext = AnyWin.AudioContext || AnyWin.webkitAudioContext;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch {}
    }
  }

  private attach(node: AudioNode, kind: AudioSourceKind) {
    // Insert a soft gain so we can trim later without losing the pipeline.
    const gain = this.ctx!.createGain();
    gain.gain.value = 1.0;
    const analyser = this.ctx!.createAnalyser();
    analyser.fftSize = this.fftSize;
    analyser.smoothingTimeConstant = 0.62;
    node.connect(gain);
    gain.connect(analyser);
    this.analyser = analyser;
    this.source = node;
    this.gain = gain;
    this.kind = kind;
    this.freqBins = analyser.frequencyBinCount;
    this.spectrum = new Uint8Array(this.freqBins);
    this.waveform = new Uint8Array(this.freqBins);
    this.prevSpectrum = new Float32Array(this.freqBins);
    // reset detectors
    this.fluxHistory = [];
    this.beatTimes = [];
    this.lastOnsetTime = 0;
    this.quietSince = 0;
  }

  stop() {
    try { this.analyser?.disconnect(); } catch {}
    try { this.gain?.disconnect(); } catch {}
    try { this.source?.disconnect(); } catch {}
    if (this.stream) {
      try { this.stream.getTracks().forEach((t) => t.stop()); } catch {}
    }
    this.analyser = null;
    this.source = null;
    this.gain = null;
    this.stream = null;
    this.kind = 'none';
  }

  tick(dt: number): AudioFeatures {
    if (this.analyser) return this.tickReal(dt);
    return this.tickSimulated(dt);
  }

  private tickReal(dt: number): AudioFeatures {
    const a = this.analyser!;
    a.getByteFrequencyData(this.spectrum);
    a.getByteTimeDomainData(this.waveform);

    const N = this.spectrum.length;
    const sr = this.ctx!.sampleRate;
    const nyquist = sr / 2;
    const binHz = nyquist / N;

    const rangeAvg = (lo: number, hi: number) => {
      const i0 = Math.max(0, Math.floor(lo / binHz));
      const i1 = Math.min(N - 1, Math.floor(hi / binHz));
      let sum = 0, count = 0;
      for (let i = i0; i <= i1; i++) { sum += this.spectrum[i]; count++; }
      return count ? sum / count / 255 : 0;
    };

    const bass = rangeAvg(20, 180);
    const mid = rangeAvg(180, 2000);
    const treble = rangeAvg(2000, 8000);

    // waveform RMS
    let rms = 0;
    for (let i = 0; i < this.waveform.length; i++) {
      const v = (this.waveform[i] - 128) / 128;
      rms += v * v;
    }
    rms = Math.sqrt(rms / this.waveform.length);

    // spectral flux for onset (positive changes only)
    let flux = 0;
    for (let i = 0; i < N; i++) {
      const cur = this.spectrum[i] / 255;
      const diff = cur - this.prevSpectrum[i];
      if (diff > 0) flux += diff;
      this.prevSpectrum[i] = cur;
    }
    flux /= N;

    this.fluxHistory.push(flux);
    if (this.fluxHistory.length > 43) this.fluxHistory.shift();
    const mean = this.fluxHistory.reduce((s, v) => s + v, 0) / this.fluxHistory.length;
    const variance = this.fluxHistory.reduce((s, v) => s + (v - mean) * (v - mean), 0) / this.fluxHistory.length;
    const std = Math.sqrt(variance);
    // Slightly more sensitive than before so it fires on real music
    const threshold = mean + std * 1.35 + 0.003;

    const now = performance.now();
    let onset = false;
    if (flux > threshold && now - this.lastOnsetTime > 150 && rms > 0.008) {
      onset = true;
      this.beatTimes.push(now);
      if (this.beatTimes.length > 16) this.beatTimes.shift();
      this.lastOnsetTime = now;
    }

    // Tempo estimation from median inter-onset interval
    let bpm = 0;
    if (this.beatTimes.length >= 5) {
      const ivals: number[] = [];
      for (let i = 1; i < this.beatTimes.length; i++) {
        ivals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
      }
      ivals.sort((a, b) => a - b);
      const median = ivals[Math.floor(ivals.length / 2)];
      bpm = median > 0 ? 60000 / median : 0;
      while (bpm > 0 && bpm < 60) bpm *= 2;
      while (bpm > 200) bpm /= 2;
    }
    this._tempo = lerp(this._tempo, clamp((bpm - 40) / 160, 0, 1), 0.06);

    // Beat decay envelope — fast attack, ~250ms decay
    if (onset) this._beat = 1;
    this._beat = Math.max(0, this._beat - dt * 3.6);

    // Composite energy
    const energy = clamp(bass * 0.55 + mid * 0.3 + treble * 0.28 + rms * 0.45, 0, 1);

    // Mood proxy
    const brightness = clamp(treble / (bass + 0.05), 0, 3) / 3;
    const target = clamp(0.2 + this._tempo * 0.45 + brightness * 0.4, 0, 1);
    this._mood = lerp(this._mood, target, 0.025);

    // Silence detection: if the source is streaming but the room is dead, hint UI.
    const isQuiet = rms < 0.006 && bass + mid + treble < 0.08;
    if (isQuiet) this.quietSince += dt; else this.quietSince = 0;
    this._silent = this.quietSince > 2.5;

    // Faster attack for reactivity, slower release for smoothness
    const attackLerp = (a: number, b: number) => (b > a ? lerp(a, b, 0.45) : lerp(a, b, 0.15));
    this._level = attackLerp(this._level, clamp(rms * 1.8, 0, 1));
    this._bass = attackLerp(this._bass, bass);
    this._mid = attackLerp(this._mid, mid);
    this._treble = attackLerp(this._treble, treble);
    this._energy = attackLerp(this._energy, energy);

    return {
      level: this._level,
      bass: this._bass,
      mid: this._mid,
      treble: this._treble,
      energy: this._energy,
      beat: this._beat,
      tempo: this._tempo,
      onset,
      mood: this._mood,
      silent: this._silent,
      spectrum: this.spectrum,
      waveform: this.waveform,
    };
  }

  private tickSimulated(dt: number): AudioFeatures {
    this.simT += dt;
    const t = this.simT;
    // Layered "musical" progression: base groove + rise/fall over 40s cycles
    const wave1 = Math.sin(t * 0.09) * 0.5 + 0.5;
    const wave2 = Math.sin(t * 0.033 + 1.3) * 0.5 + 0.5;
    const arc = wave1 * 0.65 + wave2 * 0.35;
    const bpm = this.simTargetBpm + Math.sin(t * 0.05) * 12;
    const beatPeriod = 60 / bpm;
    const beatPhase = (t % beatPeriod) / beatPeriod;
    const impulse = Math.max(0, 1 - beatPhase * 6);
    const bass = clamp(0.25 + arc * 0.35 + impulse * 0.45, 0, 1);
    const mid = clamp(0.20 + Math.sin(t * 0.4 + 1.3) * 0.15 + arc * 0.25 + impulse * 0.22, 0, 1);
    const treble = clamp(0.18 + Math.sin(t * 1.7 + 0.6) * 0.12 + arc * 0.22 + impulse * 0.18, 0, 1);
    const rms = clamp((bass + mid + treble) * 0.32, 0, 1);
    const energy = clamp(bass * 0.55 + mid * 0.3 + treble * 0.25, 0, 1);
    const onset = beatPhase < 0.025;
    if (onset) this._beat = 1;
    this._beat = Math.max(0, this._beat - dt * 3.4);
    this._tempo = clamp((bpm - 40) / 160, 0, 1);
    this._mood = lerp(this._mood, 0.35 + arc * 0.4, 0.02);
    this._silent = false;

    this._level = lerp(this._level, rms, 0.25);
    this._bass = lerp(this._bass, bass, 0.35);
    this._mid = lerp(this._mid, mid, 0.35);
    this._treble = lerp(this._treble, treble, 0.35);
    this._energy = lerp(this._energy, energy, 0.25);

    // Fake spectrum so any component reading it still gets shape.
    const N = this.spectrum.length || 1024;
    if (this.spectrum.length !== N) this.spectrum = new Uint8Array(N);
    if (this.waveform.length !== N) this.waveform = new Uint8Array(N);
    for (let i = 0; i < N; i++) {
      const f = i / N;
      const shape = Math.exp(-f * 3.5) * bass + Math.exp(-Math.abs(f - 0.25) * 8) * mid + Math.exp(-Math.abs(f - 0.7) * 6) * treble;
      const noise = (Math.sin(t * 40 + i * 0.13) * 0.5 + 0.5) * 0.15;
      this.spectrum[i] = clamp(shape * 0.9 + noise, 0, 1) * 255;
      this.waveform[i] = 128 + Math.sin(t * 6 + i * 0.05) * 40 * rms;
    }

    return {
      level: this._level,
      bass: this._bass,
      mid: this._mid,
      treble: this._treble,
      energy: this._energy,
      beat: this._beat,
      tempo: this._tempo,
      onset,
      mood: this._mood,
      silent: this._silent,
      spectrum: this.spectrum,
      waveform: this.waveform,
    };
  }
}

// singleton
let _engine: AudioEngine | null = null;
export function getAudioEngine(): AudioEngine {
  if (!_engine) _engine = new AudioEngine();
  return _engine;
}
