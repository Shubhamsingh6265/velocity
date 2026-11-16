import { Vec3, WeaponId } from './types';

type MusicMode = 'off' | 'menu' | 'match';

interface ShotProfile {
  /** Centre frequency of the high "crack" (Hz) */
  crackHz: number;
  crackLen: number;
  crackGain: number;
  /** Low body thump start frequency (Hz) */
  bodyHz: number;
  bodyLen: number;
  bodyGain: number;
  /** Low-passed noise tail that feeds the reverb */
  tailLen: number;
  tailHz: number;
  tailGain: number;
}

const SHOT_PROFILES: Record<Exclude<WeaponId, 'knife'>, ShotProfile> = {
  rifle: { crackHz: 3200, crackLen: 0.07, crackGain: 0.55, bodyHz: 135, bodyLen: 0.13, bodyGain: 0.55, tailLen: 0.32, tailHz: 1500, tailGain: 0.26 },
  smg: { crackHz: 4200, crackLen: 0.045, crackGain: 0.45, bodyHz: 175, bodyLen: 0.08, bodyGain: 0.4, tailLen: 0.2, tailHz: 1900, tailGain: 0.16 },
  shotgun: { crackHz: 1800, crackLen: 0.14, crackGain: 0.8, bodyHz: 82, bodyLen: 0.22, bodyGain: 0.8, tailLen: 0.55, tailHz: 1100, tailGain: 0.38 },
  sniper: { crackHz: 2400, crackLen: 0.11, crackGain: 0.95, bodyHz: 60, bodyLen: 0.3, bodyGain: 0.9, tailLen: 0.95, tailHz: 900, tailGain: 0.5 },
  pistol: { crackHz: 2800, crackLen: 0.06, crackGain: 0.5, bodyHz: 150, bodyLen: 0.1, bodyGain: 0.45, tailLen: 0.25, tailHz: 1600, tailGain: 0.2 },
};

const MAX_VOICES = 56; // audio source nodes alive at once
const AUDIBLE_RANGE = 52;

/**
 * Fully synthesised audio engine (no asset downloads, works offline on low-end phones):
 * noise-based gunshots with distance filtering + reverb, footsteps, UI sounds, procedural music
 * and a low-health heartbeat. Everything routes through one master bus so mute / volume are instant.
 */
export class VelocityAudio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicBus: GainNode | null = null;
  private reverbSend: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  private muted = false;
  private volume = 0.7;
  private musicEnabled = true;
  private musicMode: MusicMode = 'off';
  private musicTimer: number | null = null;
  private musicStep = 0;
  private musicNextTime = 0;
  private heartbeatTimer: number | null = null;
  private activeVoices = 0;

  public unlock() {
    if (typeof window === 'undefined') return;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return;
      try {
        this.ctx = new AudioCtx();
      } catch {
        return;
      }
      this.buildGraph();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  private buildGraph() {
    const ctx = this.ctx!;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;

    // Gentle bus compressor keeps explosions of simultaneous shots from clipping on phone speakers.
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16;
    comp.knee.value = 18;
    comp.ratio.value = 5;
    comp.attack.value = 0.004;
    comp.release.value = 0.18;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = 1;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = 0.16;
    this.musicBus.connect(this.master);

    // Shared reverb (generated impulse response, ~1.1s)
    const convolver = ctx.createConvolver();
    const len = Math.floor(ctx.sampleRate * 1.1);
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = ir.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    convolver.buffer = ir;
    this.reverbSend = ctx.createGain();
    this.reverbSend.gain.value = 1;
    const wet = ctx.createGain();
    wet.gain.value = 0.42;
    this.reverbSend.connect(convolver);
    convolver.connect(wet);
    wet.connect(this.master);

    // 2 seconds of white noise reused by every noise-based sound
    const nlen = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, nlen, ctx.sampleRate);
    const nd = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < nlen; i++) nd[i] = Math.random() * 2 - 1;
  }

  public setMuted(muted: boolean) {
    this.muted = muted;
    this.applyMaster();
    if (muted) this.stopHeartbeat();
  }

  public setVolume(vol: number) {
    this.volume = Math.max(0, Math.min(1, vol));
    this.applyMaster();
  }

  public setMusicEnabled(enabled: boolean) {
    this.musicEnabled = enabled;
    if (!enabled) this.stopMusicTimer();
    else if (this.musicMode !== 'off') this.startMusicTimer();
  }

  private applyMaster() {
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    this.master.gain.cancelScheduledValues(t);
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, t, 0.015);
  }

  private ready(): boolean {
    return Boolean(this.ctx && this.master && this.sfxBus && this.ctx.state === 'running' && !this.muted);
  }

  private spatial(origin: Vec3 | undefined, listenerPos: Vec3, listenerYaw: number) {
    if (!origin) return { gain: 1, pan: 0, dist: 0, lowpass: 20000 };
    const dx = origin.x - listenerPos.x;
    const dy = origin.y - listenerPos.y;
    const dz = origin.z - listenerPos.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > AUDIBLE_RANGE) return { gain: 0, pan: 0, dist, lowpass: 800 };
    const gain = Math.max(0.04, 1 - dist / AUDIBLE_RANGE) ** 1.35 * 0.85;
    const rightX = Math.cos(listenerYaw);
    const rightZ = -Math.sin(listenerYaw);
    const pan = Math.max(-0.9, Math.min(0.9, (dx * rightX + dz * rightZ) / Math.max(1, dist)));
    // Air absorption: distant sounds are duller.
    const lowpass = Math.max(1200, 16000 - dist * 330);
    return { gain, pan, dist, lowpass };
  }

  /** Builds gain -> lowpass -> panner -> sfxBus (+ optional reverb send) and returns its input. */
  private chain(gain: number, pan = 0, lowpass = 20000, reverb = 0): GainNode {
    const ctx = this.ctx!;
    const g = ctx.createGain();
    g.gain.value = gain;
    let tail: AudioNode = g;
    if (lowpass < 19000) {
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = lowpass;
      tail.connect(lp);
      tail = lp;
    }
    if (pan !== 0 && typeof ctx.createStereoPanner === 'function') {
      const p = ctx.createStereoPanner();
      p.pan.value = pan;
      tail.connect(p);
      tail = p;
    }
    tail.connect(this.sfxBus!);
    if (reverb > 0 && this.reverbSend) {
      const send = ctx.createGain();
      send.gain.value = reverb;
      tail.connect(send);
      send.connect(this.reverbSend);
    }
    return g;
  }

  /** Cheap polyphony guard so a firefight cannot flood a low-end phone with audio nodes. */
  private voiceStart(): boolean {
    return this.activeVoices < MAX_VOICES;
  }

  private voiceEnd = () => {
    this.activeVoices = Math.max(0, this.activeVoices - 1);
  };

  private noise(
    out: AudioNode,
    t: number,
    dur: number,
    opts: { type?: BiquadFilterType; freq: number; freqEnd?: number; q?: number; gain: number; attack?: number },
  ) {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = opts.type || 'bandpass';
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t + dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    const atk = opts.attack ?? 0.002;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f);
    f.connect(g);
    g.connect(out);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.02);
    this.activeVoices++;
    src.onended = this.voiceEnd;
  }

  private tone(
    out: AudioNode,
    t: number,
    dur: number,
    opts: { type?: OscillatorType; freq: number; freqEnd?: number; gain: number; attack?: number },
  ) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = opts.type || 'sine';
    osc.frequency.setValueAtTime(opts.freq, t);
    if (opts.freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.freqEnd), t + dur);
    const g = ctx.createGain();
    const atk = opts.attack ?? 0.003;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, opts.gain), t + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(out);
    osc.start(t);
    osc.stop(t + dur + 0.02);
    this.activeVoices++;
    osc.onended = this.voiceEnd;
  }

  // ───────────────────────── Weapons ─────────────────────────

  public playShot(weaponId: WeaponId, origin: Vec3 | undefined, listenerPos: Vec3, listenerYaw: number) {
    if (!this.ready()) return;
    const { gain, pan, lowpass } = this.spatial(origin, listenerPos, listenerYaw);
    if (gain <= 0.01 || !this.voiceStart()) return;
    const t = this.ctx!.currentTime;
    const own = !origin;

    if (weaponId === 'knife') {
      const out = this.chain(0.5 * gain, pan, lowpass, 0.04);
      this.noise(out, t, 0.16, { type: 'bandpass', freq: 500, freqEnd: 2600, q: 1.2, gain: 0.9, attack: 0.03 });
      return;
    }

    const p = SHOT_PROFILES[weaponId as Exclude<WeaponId, 'knife'>] ?? SHOT_PROFILES.rifle;
    const out = this.chain((own ? 0.95 : 0.8) * gain, pan, lowpass, own ? 0.35 : 0.6);
    // Per-shot variation stops machine-gun fire sounding robotic.
    const vary = 0.92 + Math.random() * 0.16;
    this.noise(out, t, p.crackLen, { type: 'bandpass', freq: p.crackHz * vary, q: 0.7, gain: p.crackGain, attack: 0.001 });
    this.noise(out, t, p.crackLen * 0.6, { type: 'highpass', freq: 5000, q: 0.5, gain: p.crackGain * 0.5, attack: 0.001 });
    this.tone(out, t, p.bodyLen, { type: 'sine', freq: p.bodyHz * vary, freqEnd: p.bodyHz * 0.3, gain: p.bodyGain, attack: 0.002 });
    this.noise(out, t, p.tailLen, { type: 'lowpass', freq: p.tailHz, freqEnd: 260, q: 0.4, gain: p.tailGain, attack: 0.008 });

    if (weaponId === 'sniper') {
      // Supersonic "crack" followed by a rolling echo
      const echo = this.chain(0.4 * gain, pan, Math.min(lowpass, 5000), 0.9);
      this.noise(echo, t + 0.12, 0.7, { type: 'lowpass', freq: 700, freqEnd: 180, q: 0.3, gain: 0.35, attack: 0.05 });
    }
  }

  public playEmptyClick() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.35);
    this.noise(out, t, 0.03, { type: 'highpass', freq: 2500, q: 0.7, gain: 0.5, attack: 0.001 });
    this.tone(out, t, 0.04, { type: 'square', freq: 900, freqEnd: 500, gain: 0.08 });
  }

  public playImpact(origin: Vec3, listenerPos: Vec3, listenerYaw: number) {
    if (!this.ready()) return;
    const { gain, pan, lowpass } = this.spatial(origin, listenerPos, listenerYaw);
    if (gain <= 0.05 || !this.voiceStart()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.35 * gain, pan, lowpass, 0.2);
    this.noise(out, t, 0.06, { type: 'bandpass', freq: 2200 + Math.random() * 1500, q: 1.2, gain: 0.6, attack: 0.001 });
    this.tone(out, t, 0.12, { type: 'triangle', freq: 1900 + Math.random() * 900, freqEnd: 900, gain: 0.05 });
  }

  public playWhiz(pan: number) {
    if (!this.ready() || !this.voiceStart()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.28, Math.max(-0.9, Math.min(0.9, pan)));
    this.noise(out, t, 0.18, { type: 'bandpass', freq: 3400, freqEnd: 1100, q: 2.2, gain: 0.7, attack: 0.02 });
  }

  public playHitmarker(headshot: boolean) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(headshot ? 0.5 : 0.4);
    this.tone(out, t, 0.06, { type: 'sine', freq: headshot ? 1480 : 980, freqEnd: headshot ? 1920 : 720, gain: 0.5 });
    this.noise(out, t, 0.025, { type: 'highpass', freq: 3000, gain: 0.35, attack: 0.001 });
    if (headshot) this.tone(out, t + 0.045, 0.1, { type: 'triangle', freq: 2300, freqEnd: 2900, gain: 0.3 });
  }

  public playKillChime() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.55, 0, 20000, 0.25);
    this.tone(out, t, 0.2, { type: 'triangle', freq: 660, gain: 0.5 });
    this.tone(out, t + 0.07, 0.26, { type: 'triangle', freq: 880, gain: 0.5 });
    this.tone(out, t + 0.14, 0.34, { type: 'sine', freq: 1320, gain: 0.3 });
  }

  public playDamaged() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.65, 0, 20000, 0.15);
    this.tone(out, t, 0.16, { type: 'sine', freq: 130, freqEnd: 48, gain: 0.7, attack: 0.002 });
    this.noise(out, t, 0.12, { type: 'lowpass', freq: 900, freqEnd: 250, gain: 0.45, attack: 0.002 });
  }

  public playMedicate() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.5, 0, 20000, 0.3);
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
      this.tone(out, t + i * 0.05, 0.28, { type: 'sine', freq: f, gain: 0.28 });
    });
  }

  public playReload(weaponId?: WeaponId) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.5, 0, 20000, 0.12);
    const heavy = weaponId === 'shotgun' || weaponId === 'sniper';
    // mag out
    this.noise(out, t, 0.05, { type: 'bandpass', freq: 1800, q: 1.4, gain: 0.55, attack: 0.001 });
    this.tone(out, t, 0.06, { type: 'square', freq: 360, freqEnd: 220, gain: 0.07 });
    // mag in
    const t2 = t + (heavy ? 0.7 : 0.48);
    this.noise(out, t2, 0.07, { type: 'bandpass', freq: 900, q: 1.1, gain: 0.7, attack: 0.001 });
    this.tone(out, t2, 0.08, { type: 'triangle', freq: 190, freqEnd: 110, gain: 0.45 });
    // slide / bolt
    const t3 = t + (heavy ? 1.15 : 0.82);
    this.noise(out, t3, 0.06, { type: 'bandpass', freq: 2400, q: 1.6, gain: 0.55, attack: 0.001 });
    this.tone(out, t3 + 0.03, 0.05, { type: 'square', freq: 520, freqEnd: 340, gain: 0.06 });
  }

  public playWeaponSwitch(weaponId: WeaponId) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.45);
    this.noise(out, t, 0.06, { type: 'bandpass', freq: weaponId === 'knife' ? 3200 : 1400, q: 1.2, gain: 0.5, attack: 0.002 });
    this.tone(out, t + 0.02, 0.07, {
      type: 'triangle',
      freq: weaponId === 'knife' ? 920 : weaponId === 'sniper' ? 280 : 400,
      freqEnd: weaponId === 'knife' ? 1680 : 560,
      gain: 0.22,
    });
  }

  public playScopeToggle(entering: boolean) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.3);
    this.tone(out, t, 0.05, { type: 'triangle', freq: entering ? 520 : 680, freqEnd: entering ? 760 : 440, gain: 0.4 });
    this.noise(out, t, 0.04, { type: 'highpass', freq: 3500, gain: 0.2, attack: 0.001 });
  }

  // ───────────────────────── Movement ─────────────────────────

  public playJump() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.35);
    this.noise(out, t, 0.1, { type: 'bandpass', freq: 500, freqEnd: 900, q: 0.7, gain: 0.45, attack: 0.01 });
    this.tone(out, t, 0.08, { type: 'sine', freq: 180, freqEnd: 320, gain: 0.18 });
  }

  public playSlide() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.4);
    this.noise(out, t, 0.42, { type: 'bandpass', freq: 1500, freqEnd: 380, q: 0.6, gain: 0.55, attack: 0.04 });
  }

  public playLand(impact: number) {
    if (!this.ready()) return;
    const power = Math.max(0.15, Math.min(1, impact / 14));
    const t = this.ctx!.currentTime;
    const out = this.chain(0.35 + power * 0.4);
    this.tone(out, t, 0.14, { type: 'sine', freq: 110, freqEnd: 45, gain: 0.6 * power });
    this.noise(out, t, 0.09, { type: 'lowpass', freq: 800, freqEnd: 200, gain: 0.5 * power, attack: 0.002 });
  }

  /** Footstep; pass an origin for other players so they are heard in 3D. */
  public playFootstep(origin: Vec3 | undefined, listenerPos: Vec3, listenerYaw: number, sprint = false) {
    if (!this.ready()) return;
    const { gain, pan, lowpass } = this.spatial(origin, listenerPos, listenerYaw);
    const scaled = origin ? gain * 0.55 : 0.3;
    if (scaled <= 0.012 || !this.voiceStart()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(scaled * (sprint ? 1.2 : 1), pan, Math.min(lowpass, 7000), 0.08);
    this.noise(out, t, 0.07, { type: 'bandpass', freq: 240 + Math.random() * 160, q: 0.9, gain: 0.8, attack: 0.002 });
    this.tone(out, t, 0.06, { type: 'sine', freq: 95 + Math.random() * 25, freqEnd: 55, gain: 0.35 });
  }

  // ───────────────────────── Match / UI ─────────────────────────

  public playCountdownBeep(isGo: boolean) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(isGo ? 0.7 : 0.5, 0, 20000, 0.2);
    if (isGo) {
      this.tone(out, t, 0.12, { type: 'triangle', freq: 880, gain: 0.5 });
      this.tone(out, t + 0.07, 0.3, { type: 'triangle', freq: 1174.66, gain: 0.5 });
    } else {
      this.tone(out, t, 0.14, { type: 'sine', freq: 520, gain: 0.5 });
    }
  }

  public playDeath() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.7, 0, 20000, 0.5);
    this.tone(out, t, 0.7, { type: 'sawtooth', freq: 260, freqEnd: 40, gain: 0.25, attack: 0.01 });
    this.tone(out, t, 0.5, { type: 'sine', freq: 90, freqEnd: 30, gain: 0.6 });
    this.noise(out, t, 0.4, { type: 'lowpass', freq: 1400, freqEnd: 120, gain: 0.5 });
  }

  public playRespawn() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.5, 0, 20000, 0.4);
    this.tone(out, t, 0.4, { type: 'triangle', freq: 220, freqEnd: 880, gain: 0.3, attack: 0.05 });
    this.noise(out, t, 0.35, { type: 'bandpass', freq: 600, freqEnd: 3200, q: 1.1, gain: 0.25, attack: 0.1 });
  }

  public playMatchEnd(won: boolean) {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.75, 0, 20000, 0.5);
    const notes = won ? [523.25, 659.25, 783.99, 1046.5] : [392, 349.23, 293.66, 261.63];
    notes.forEach((f, i) => {
      this.tone(out, t + i * 0.16, won ? 0.5 : 0.6, { type: won ? 'triangle' : 'sine', freq: f, gain: 0.4 });
      if (won) this.tone(out, t + i * 0.16, 0.5, { type: 'sine', freq: f * 2, gain: 0.12 });
    });
  }

  public playUiClick() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.3);
    this.tone(out, t, 0.05, { type: 'triangle', freq: 700, freqEnd: 1000, gain: 0.4 });
  }

  public playUiHover() {
    if (!this.ready()) return;
    const t = this.ctx!.currentTime;
    const out = this.chain(0.12);
    this.tone(out, t, 0.03, { type: 'sine', freq: 1200, gain: 0.3 });
  }

  // ───────────────────────── Heartbeat (low health) ─────────────────────────

  public setLowHealth(active: boolean) {
    if (!active) {
      this.stopHeartbeat();
      return;
    }
    if (this.heartbeatTimer !== null || typeof window === 'undefined') return;
    const beat = () => {
      if (!this.ready()) return;
      const t = this.ctx!.currentTime;
      const out = this.chain(0.7);
      this.tone(out, t, 0.13, { type: 'sine', freq: 70, freqEnd: 40, gain: 0.7 });
      this.tone(out, t + 0.2, 0.12, { type: 'sine', freq: 62, freqEnd: 38, gain: 0.5 });
    };
    beat();
    this.heartbeatTimer = window.setInterval(beat, 860);
  }

  private stopHeartbeat() {
    if (this.heartbeatTimer !== null) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  // ───────────────────────── Music ─────────────────────────

  public setMusicMode(mode: MusicMode) {
    if (this.musicMode === mode) return;
    this.musicMode = mode;
    if (mode === 'off') {
      this.stopMusicTimer();
      return;
    }
    this.musicStep = 0;
    if (this.musicEnabled) this.startMusicTimer();
  }

  private startMusicTimer() {
    if (this.musicTimer !== null || typeof window === 'undefined') return;
    this.musicNextTime = 0;
    this.musicTimer = window.setInterval(() => this.scheduleMusic(), 90);
  }

  private stopMusicTimer() {
    if (this.musicTimer !== null) {
      clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }

  /** Lookahead scheduler: Am – F – C – G pad progression with bass, arp and (in matches) drums. */
  private scheduleMusic() {
    const ctx = this.ctx;
    if (!ctx || !this.musicBus || ctx.state !== 'running' || this.muted || this.musicMode === 'off') return;
    const bpm = this.musicMode === 'match' ? 118 : 84;
    const stepDur = 60 / bpm / 2; // eighth notes
    if (this.musicNextTime < ctx.currentTime) this.musicNextTime = ctx.currentTime + 0.05;

    const roots = [57, 53, 48, 55]; // A3 F3 C3 G3 (MIDI)
    const chords = [
      [0, 3, 7],
      [0, 4, 7],
      [0, 4, 7],
      [0, 4, 7],
    ];
    const minorFirst = [true, false, false, false];
    const midiToHz = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

    while (this.musicNextTime < ctx.currentTime + 0.25) {
      const step = this.musicStep;
      const t = this.musicNextTime;
      const bar = Math.floor(step / 8) % 4;
      const inBar = step % 8;
      const root = roots[bar];
      const chord = chords[bar].map((iv, i) => (i === 1 && minorFirst[bar] ? 3 : iv));

      if (inBar === 0) {
        // Pad chord (two detuned triangles per note) through a slow low-pass
        chord.forEach((iv) => {
          const f = midiToHz(root + 12 + iv);
          this.musicVoice(t, stepDur * 8 * 0.98, f, 'triangle', 0.1, 0.4);
          this.musicVoice(t, stepDur * 8 * 0.98, f * 1.006, 'sawtooth', 0.025, 0.4);
        });
      }
      if (inBar % 4 === 0) this.musicVoice(t, stepDur * 3.5, midiToHz(root - 12), 'sine', 0.32, 0.02);
      if (this.musicMode === 'match') {
        const arp = [0, 7, 12, 7, 3, 7, 12, 15][inBar];
        this.musicVoice(t, stepDur * 0.9, midiToHz(root + 24 + (arp % 12)), 'square', 0.035, 0.01, 1800);
        if (inBar % 2 === 0) this.musicKick(t);
        if (inBar % 2 === 1) this.musicHat(t);
      } else if (inBar % 2 === 0) {
        const arp = [0, 7, 12, 7][(inBar / 2) % 4];
        this.musicVoice(t, stepDur * 1.6, midiToHz(root + 24 + arp), 'sine', 0.06, 0.01);
      }

      this.musicNextTime += stepDur;
      this.musicStep++;
    }
  }

  private musicVoice(t: number, dur: number, freq: number, type: OscillatorType, gain: number, attack: number, lp = 1200) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = lp;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
    osc.connect(f);
    f.connect(g);
    g.connect(this.musicBus!);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  private musicKick(t: number) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    osc.connect(g);
    g.connect(this.musicBus!);
    osc.start(t);
    osc.stop(t + 0.2);
  }

  private musicHat(t: number) {
    const ctx = this.ctx!;
    if (!this.noiseBuf) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.12, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
    src.connect(hp);
    hp.connect(g);
    g.connect(this.musicBus!);
    src.start(t, Math.random());
    src.stop(t + 0.06);
  }

  public dispose() {
    this.stopHeartbeat();
    this.stopMusicTimer();
    this.ctx?.close().catch(() => {});
    this.ctx = null;
  }
}
