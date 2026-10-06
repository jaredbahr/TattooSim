/**
 * Procedural tattoo-gun buzz. No audio assets: a detuned sawtooth pair through a
 * lowpass, amplitude-modulated at the coil frequency. Created lazily on first
 * user gesture to satisfy browser autoplay rules.
 */
export class GunAudio {
  private ctx: AudioContext | null = null;
  private gain: GainNode | null = null;
  private muted = false;

  private ensure(): void {
    if (this.ctx) return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const ctx = new Ctor();
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(ctx.destination);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 1400;
    filter.Q.value = 4;
    filter.connect(out);

    const am = ctx.createGain();
    am.gain.value = 0.5;
    am.connect(filter);

    for (const f of [118, 121.5]) {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.connect(am);
      osc.start();
    }
    // Coil rattle: modulate the amplitude at ~60 Hz.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 60;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.35;
    lfo.connect(lfoGain).connect(am.gain);
    lfo.start();

    this.ctx = ctx;
    this.gain = out;
  }

  /** Call from a pointer/key handler so the AudioContext is allowed to start. */
  unlock(): void {
    this.ensure();
    void this.ctx?.resume();
  }

  setBuzzing(on: boolean): void {
    if (!this.ctx || !this.gain) return;
    const target = on && !this.muted ? 0.07 : 0;
    this.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.02);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.muted) this.setBuzzing(false);
    return this.muted;
  }

  /** Short pitched blip for UI feedback (e.g. a yelp when the customer flinches). */
  yelp(): void {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(520, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(980, ctx.currentTime + 0.12);
    osc.frequency.exponentialRampToValueAtTime(340, ctx.currentTime + 0.3);
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.03);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.32);
    osc.connect(g).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  }
}
