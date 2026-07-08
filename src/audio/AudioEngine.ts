'use client';

/**
 * AudioEngine
 *
 * Real-time audio feature extractor built on the Web Audio API.
 * - Supports mic input, HTML audio element input, and a synthetic
 *   "ambient" simulator so the visuals always have signal.
 * - Extracts: level (RMS), bass/mid/treble energies, spectral flux,
 *   onset detection, running BPM/tempo estimate, mood proxy.
 *
 * No external dependencies. Works entirely in the browser.
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
  spectrum: any;
  waveform: any;
};

export type AudioSourceKind = 'mic' | 'element' | 'simulated' | 'none';

const clamp = (x: number, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export class AudioEngine {
  ctx: AudioContext | null = null;
  analyser: AnalyserNode | null = null;
  source: AudioNode | null = null;
  kind: AudioSourceKind = 'none';
  fftSize = 2048;
  freqBins = 1024;
  spectrum: any = new Uint8Array(1024);
  waveform: any = new Uint8Array(1024);
  prevSpectrum: any = new Float32Array(1024);
  // running features
  private _level = 0;
  private _bass = 0;
  private _mid = 0;
  private _treble = 0;
  private _energy = 0;
  private _beat = 0;
  private _tempo = 0;
  private _mood = 0.4;
  // onset detection
  private fluxHistory: number[] = [];
  private lastOnsetTime = 0;
  private beatTimes: number[] = [];
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
    this.attach(src, 'mic');
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
    const analyser = this.ctx!.createAnalyser();
    analyser.fftSize = this.fftSize;
    analyser.smoothingTimeConstant = 0.72;
    node.connect(analyser);
    this.analyser = analyser;
    this.source = node;
    this.kind = kind;
    this.freqBins = analyser.frequencyBinCount;
    this.spectrum = new Uint8Array(this.freqBins);
    this.waveform = new Uint8Array(this.freqBins);
    this.prevSpectrum = new Float32Array(this.freqBins);
  }

  stop() {
    try { this.analyser?.disconnect(); } catch {}
    try { this.source?.disconnect(); } catch {}
    this.analyser = null;
    this.source = null;
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

    // spectral flux for onset
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
    const threshold = mean + std * 1.6 + 0.005;

    const now = performance.now();
    let onset = false;
    if (flux > threshold && now - this.lastOnsetTime > 180) {
      onset = true;
      this.beatTimes.push(now);
      if (this.beatTimes.length > 12) this.beatTimes.shift();
      this.lastOnsetTime = now;
    }

    // tempo estimation from median inter-onset interval
    let bpm = 0;
    if (this.beatTimes.length >= 4) {
      const ivals = [];
      for (let i = 1; i < this.beatTimes.length; i++) {
        ivals.push(this.beatTimes[i] - this.beatTimes[i - 1]);
      }
      ivals.sort((a, b) => a - b);
      const median = ivals[Math.floor(ivals.length / 2)];
      bpm = median > 0 ? 60000 / median : 0;
      // fold into 60..180
      while (bpm > 0 && bpm < 60) bpm *= 2;
      while (bpm > 200) bpm /= 2;
    }
    this._tempo = lerp(this._tempo, clamp((bpm - 40) / 160, 0, 1), 0.08);

    // beat decay envelope
    if (onset) this._beat = 1;
    this._beat = Math.max(0, this._beat - dt * 3.2);

    // energy composite
    const energy = clamp(bass * 0.55 + mid * 0.3 + treble * 0.25 + rms * 0.4, 0, 1);

    // mood proxy: high mid/treble + tempo → intense, low bass-only + slow → calm
    const brightness = clamp(treble / (bass + 0.05), 0, 3) / 3;
    const target = clamp(0.25 + this._tempo * 0.45 + brightness * 0.35, 0, 1);
    this._mood = lerp(this._mood, target, 0.03);

    // smooth publish
    this._level = lerp(this._level, rms * 1.6, 0.25);
    this._bass = lerp(this._bass, bass, 0.35);
    this._mid = lerp(this._mid, mid, 0.35);
    this._treble = lerp(this._treble, treble, 0.35);
    this._energy = lerp(this._energy, energy, 0.25);

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
      spectrum: this.spectrum,
      waveform: this.waveform,
    };
  }

  private tickSimulated(dt: number): AudioFeatures {
    this.simT += dt;
    // synthesized ambient signal — evolving sine layers, drifting bpm
    const t = this.simT;
    const bpm = this.simTargetBpm + Math.sin(t * 0.03) * 8;
    const beatPeriod = 60 / bpm;
    const beatPhase = (t % beatPeriod) / beatPeriod;
    // impulse near beat
    const impulse = Math.max(0, 1 - beatPhase * 6);
    const bass = clamp(0.35 + Math.sin(t * 0.7) * 0.15 + impulse * 0.5, 0, 1);
    const mid = clamp(0.28 + Math.sin(t * 0.35 + 1.3) * 0.18 + impulse * 0.25, 0, 1);
    const treble = clamp(0.22 + Math.sin(t * 1.8 + 0.6) * 0.14 + impulse * 0.15, 0, 1);
    const rms = clamp((bass + mid + treble) * 0.33, 0, 1);
    const energy = clamp(bass * 0.55 + mid * 0.3 + treble * 0.25, 0, 1);
    const onset = beatPhase < 0.02;
    if (onset) this._beat = 1;
    this._beat = Math.max(0, this._beat - dt * 3.2);
    this._tempo = clamp((bpm - 40) / 160, 0, 1);
    this._mood = lerp(this._mood, 0.35 + Math.sin(t * 0.05) * 0.2, 0.03);

    this._level = lerp(this._level, rms, 0.2);
    this._bass = lerp(this._bass, bass, 0.3);
    this._mid = lerp(this._mid, mid, 0.3);
    this._treble = lerp(this._treble, treble, 0.3);
    this._energy = lerp(this._energy, energy, 0.2);

    // fill fake spectrum for visualizations that read it
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
