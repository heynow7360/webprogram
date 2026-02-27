'use strict';

/**
 * AlarmManager — Web Audio API 기반 2음 반복 경보
 */
class AlarmManager {
  constructor() {
    this._ctx = null;
    this._isPlaying = false;
    this._scheduleTimer = null;
    this.volume = 0.5;      // 0.0 ~ 1.0
    this.enabled = true;
  }

  /**
   * 첫 번째 사용자 제스처 시 AudioContext 초기화 (자동재생 정책 우회)
   */
  init() {
    if (!this._ctx) {
      this._ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
  }

  start() {
    if (!this.enabled || this._isPlaying) return;
    this.init();
    this._isPlaying = true;
    this._schedulePattern();
  }

  stop() {
    this._isPlaying = false;
    if (this._scheduleTimer) {
      clearTimeout(this._scheduleTimer);
      this._scheduleTimer = null;
    }
  }

  setEnabled(val) {
    this.enabled = val;
    if (!val) this.stop();
  }

  setVolume(val) {
    this.volume = Math.max(0, Math.min(1, val));
  }

  _schedulePattern() {
    if (!this._isPlaying || !this._ctx) return;

    const BEEP   = 0.28;  // 각 음 길이(초)
    const GAP    = 0.08;  // 음 사이 간격(초)
    const CYCLE  = (BEEP + GAP) * 2;
    const PAIRS  = 6;     // 한 번에 스케줄할 쌍 수

    const now = this._ctx.currentTime;

    for (let i = 0; i < PAIRS; i++) {
      const t = now + i * CYCLE;
      this._scheduleTone(880,  t,               BEEP);
      this._scheduleTone(1100, t + BEEP + GAP,  BEEP);
    }

    // 패턴 끝나기 직전에 재스케줄
    this._scheduleTimer = setTimeout(() => {
      if (this._isPlaying) this._schedulePattern();
    }, (PAIRS * CYCLE - 0.4) * 1000);
  }

  _scheduleTone(frequency, startTime, duration) {
    if (!this._ctx) return;
    const osc  = this._ctx.createOscillator();
    const gain = this._ctx.createGain();

    osc.connect(gain);
    gain.connect(this._ctx.destination);

    osc.type = 'square';
    osc.frequency.value = frequency;

    const peakVolume = this.volume * 0.4;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(peakVolume, startTime + 0.01);
    gain.gain.setValueAtTime(peakVolume, startTime + duration - 0.02);
    gain.gain.linearRampToValueAtTime(0, startTime + duration);

    osc.start(startTime);
    osc.stop(startTime + duration);
  }

  isPlaying() { return this._isPlaying; }
}
