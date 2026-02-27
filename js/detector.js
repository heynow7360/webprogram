'use strict';

/**
 * DetectorManager — TensorFlow.js COCO-SSD 기반 사람 감지 루프
 */
class DetectorManager {
  constructor(videoElement) {
    this._video = videoElement;
    this._model = null;
    this._running = false;
    this._rafId = null;
    this._lastTime = 0;
    this.intervalMs = 200;  // 기본 5fps

    this.onDetection = null;  // callback(persons: Array)
    this.onModelLoaded = null; // callback()
    this.onError = null;       // callback(err)
  }

  async loadModel() {
    try {
      // WebGL 우선, 실패 시 CPU 폴백
      try {
        await tf.setBackend('webgl');
        await tf.ready();
      } catch {
        await tf.setBackend('cpu');
        await tf.ready();
      }

      this._model = await cocoSsd.load({ base: 'lite_mobilenet_v2' });
      if (this.onModelLoaded) this.onModelLoaded();
    } catch (err) {
      if (this.onError) this.onError(err);
    }
  }

  start() {
    if (this._running || !this._model) return;
    this._running = true;
    this._lastTime = 0;
    this._loop();
  }

  stop() {
    this._running = false;
    if (this._rafId) {
      cancelAnimationFrame(this._rafId);
      this._rafId = null;
    }
  }

  isRunning() { return this._running; }
  isLoaded()  { return this._model !== null; }

  _loop() {
    if (!this._running) return;

    this._rafId = requestAnimationFrame(async (now) => {
      if (!this._running) return;

      if (now - this._lastTime >= this.intervalMs) {
        this._lastTime = now;
        await this._detect();
      }

      this._loop();
    });
  }

  async _detect() {
    if (!this._model || this._video.readyState < 2) return;

    try {
      const predictions = await this._model.detect(this._video);
      const persons = predictions.filter(p => p.class === 'person');
      if (this.onDetection) this.onDetection(persons);
    } catch (err) {
      // 단일 프레임 오류는 무시하고 계속 진행
      console.warn('[Detector] 감지 오류 (프레임 건너뜀):', err.message);
    }
  }
}
