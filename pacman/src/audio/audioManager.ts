/**
 * Original arcade-style audio synthesis (spec E): siren loops, waka-waka,
 * energizer loop, ghost-eaten jingle, death and fruit sounds — all generated
 * with oscillators/noise through the Web Audio API. No external audio files.
 *
 * Every public entry point runs through safe(): audio failures are logged
 * once and can never break the game loop.
 */

export type SirenMode = 'chase' | 'scatter' | 'frightened';

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private siren: OscillatorNode | null = null;
  private sirenGain: GainNode | null = null;
  private sirenLfo: OscillatorNode | null = null;
  private sirenLfoGain: GainNode | null = null;
  private energyOsc: OscillatorNode | null = null;
  private energyGain: GainNode | null = null;
  private wakaToggle = false;
  private muted = false;
  private warned = new Set<string>();

  /** Run `fn`, swallowing (once-logged) Web Audio failures. */
  private safe(label: string, fn: () => void): void {
    try {
      fn();
    } catch (err) {
      if (!this.warned.has(label)) {
        this.warned.add(label);
        console.warn(`[audio] ${label} failed (audio disabled for it):`, err);
      }
    }
  }

  /** Must run inside a user gesture; safe to call repeatedly. */
  unlock(): void {
    this.safe('unlock', () => {
      if (!this.ctx) {
        const Ctor =
          window.AudioContext ??
          (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!Ctor) return;
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.22;
        this.master.connect(this.ctx.destination);
      }
      if (this.ctx.state === 'suspended') void this.ctx.resume();
    });
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    this.safe('setMuted', () => {
      if (this.master) this.master.gain.value = muted ? 0 : 0.22;
    });
  }

  // ─── Waka-waka dot eating ─────────────────────────────────────────────────
  waka(): void {
    this.safe('waka', () => {
      if (!this.ctx || !this.master) return;
      this.wakaToggle = !this.wakaToggle;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = this.wakaToggle ? 392 : 330;
      gain.gain.setValueAtTime(0.5, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + 0.07);
    });
  }

  // ─── Siren loop (mode + proximity control the sweep) ─────────────────────
  startSiren(): void {
    this.safe('startSiren', () => {
      if (!this.ctx || !this.master || this.siren) return;
      const t = this.ctx.currentTime;
      this.siren = this.ctx.createOscillator();
      this.sirenGain = this.ctx.createGain();
      this.sirenLfo = this.ctx.createOscillator();
      this.sirenLfoGain = this.ctx.createGain();

      this.siren.type = 'sawtooth';
      this.siren.frequency.value = 320;
      this.sirenLfo.type = 'sine';
      this.sirenLfo.frequency.value = 4; // sweep rate
      this.sirenLfoGain.gain.value = 140; // sweep depth

      this.sirenGain.gain.setValueAtTime(0.14, t);
      this.sirenLfo.connect(this.sirenLfoGain).connect(this.siren.frequency);
      this.siren.connect(this.sirenGain).connect(this.master);
      this.siren.start(t);
      this.sirenLfo.start(t);
    });
  }

  stopSiren(): void {
    this.safe('stopSiren', () => {
      if (!this.siren || !this.ctx) return;
      const t = this.ctx.currentTime;
      this.sirenGain?.gain.setTargetAtTime(0, t, 0.02);
      const osc = this.siren;
      const lfo = this.sirenLfo;
      osc.stop(t + 0.1);
      if (lfo) lfo.stop(t + 0.1);
      this.siren = null;
      this.sirenLfo = null;
    });
  }

  /** Distance 0..1 (1 = ghosts far away). Closer ghosts = higher, faster wail. */
  updateSiren(mode: SirenMode, proximity: number): void {
    this.safe('updateSiren', () => {
      if (!this.siren || !this.sirenLfo || !this.ctx) return;
      const t = this.ctx.currentTime;
      if (mode === 'frightened') {
        this.siren.type = 'square';
        this.siren.frequency.setTargetAtTime(180 + Math.sin(t * 9) * 60, t, 0.05);
        this.sirenLfo.frequency.setTargetAtTime(9, t, 0.05);
        return;
      }
      this.siren.type = 'sawtooth';
      const base = mode === 'scatter' ? 240 : 300;
      const closeness = 1 - Math.max(0, Math.min(1, proximity));
      this.siren.frequency.setTargetAtTime(base + closeness * 160, t, 0.1);
      this.sirenLfo.frequency.setTargetAtTime(3 + closeness * 6, t, 0.1);
    });
  }

  // ─── Energizer loop ───────────────────────────────────────────────────────
  startEnergy(): void {
    this.safe('startEnergy', () => {
      if (!this.ctx || !this.master || this.energyOsc) return;
      this.energyOsc = this.ctx.createOscillator();
      this.energyGain = this.ctx.createGain();
      this.energyOsc.type = 'triangle';
      this.energyGain.gain.value = 0.16;
      this.energyOsc.connect(this.energyGain).connect(this.master);
      this.energyOsc.start();
    });
  }

  stopEnergy(): void {
    this.safe('stopEnergy', () => {
      if (!this.energyOsc) return;
      this.energyOsc.stop();
      this.energyOsc = null;
    });
  }

  /** Alternate pitch while the energizer blink runs (arcade pulse). */
  tickEnergy(blinkHigh: boolean): void {
    this.safe('tickEnergy', () => {
      if (!this.energyOsc || !this.ctx) return;
      this.energyOsc.frequency.setTargetAtTime(blinkHigh ? 900 : 620, this.ctx.currentTime, 0.01);
    });
  }

  // ─── One-shots ────────────────────────────────────────────────────────────
  ghostEaten(): void {
    this.arp('ghostEaten', [392, 523, 659, 784, 1046], 0.045, 'square');
  }

  fruitGot(): void {
    this.arp('fruitGot', [659, 880, 1046, 1318], 0.06, 'triangle');
  }

  readyJingle(): void {
    this.arp('readyJingle', [523, 659, 784, 1046], 0.12, 'square');
  }

  death(): void {
    this.safe('death', () => {
      if (!this.ctx || !this.master) return;
      const t = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(660, t);
      osc.frequency.exponentialRampToValueAtTime(110, t + 1.0);
      gain.gain.setValueAtTime(0.4, t);
      gain.gain.setValueAtTime(0.4, t + 0.9);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 1.2);
      osc.connect(gain).connect(this.master);
      osc.start(t);
      osc.stop(t + 1.25);
    });
  }

  lifeLost(): void {
    this.death();
  }

  extraLife(): void {
    this.arp('extraLife', [784, 1046, 1318, 1568], 0.07, 'square');
  }

  private arp(label: string, freqs: number[], step: number, type: OscillatorType): void {
    this.safe(label, () => {
      if (!this.ctx || !this.master) return;
      let t = this.ctx.currentTime;
      for (const f of freqs) {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = type;
        osc.frequency.value = f;
        gain.gain.setValueAtTime(0.35, t);
        gain.gain.exponentialRampToValueAtTime(0.001, t + step * 0.9);
        osc.connect(gain).connect(this.master);
        osc.start(t);
        osc.stop(t + step);
        t += step;
      }
    });
  }
}
