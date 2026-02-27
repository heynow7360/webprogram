'use strict';

/**
 * CanvasManager — 캔버스 사이징 및 좌표 변환 유틸
 *
 * 좌표 공간:
 *   - 비디오 공간(video space): video.videoWidth x video.videoHeight 픽셀
 *   - 캔버스 공간: canvas.width x canvas.height (= 비디오 공간과 동일)
 *   - CSS 공간(display space): getBoundingClientRect() 기준 화면 픽셀
 */
class CanvasManager {
  constructor(videoElement, canvasElement) {
    this._video = videoElement;
    this._canvas = canvasElement;
    this._ctx = canvasElement.getContext('2d');
    this._scaleX = 1;
    this._scaleY = 1;
    this._offsetX = 0;
    this._offsetY = 0;

    this._resizeObserver = new ResizeObserver(() => this._updateScale());
    this._resizeObserver.observe(this._video);
  }

  /**
   * 비디오 메타데이터 로드 후 호출 — 캔버스를 비디오 크기로 동기화
   */
  sizeToVideo() {
    const w = this._video.videoWidth;
    const h = this._video.videoHeight;
    this._canvas.width  = w;
    this._canvas.height = h;

    // 캔버스 CSS 크기를 비디오 요소의 렌더링 크기에 맞춤
    this._canvas.style.width  = '100%';
    this._canvas.style.height = '100%';

    this._updateScale();
  }

  _updateScale() {
    const rect = this._canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    this._scaleX = this._canvas.width  / rect.width;
    this._scaleY = this._canvas.height / rect.height;
    this._offsetX = rect.left;
    this._offsetY = rect.top;
  }

  /**
   * CSS 이벤트 좌표 → 비디오/캔버스 좌표
   */
  toVideoCoords(clientX, clientY) {
    this._updateScale();
    const rect = this._canvas.getBoundingClientRect();
    return {
      x: (clientX - rect.left) * this._scaleX,
      y: (clientY - rect.top)  * this._scaleY
    };
  }

  /**
   * 비디오 좌표 → CSS 화면 좌표 (현재는 캔버스 자체에 draw하므로 주로 내부용)
   */
  toDisplayCoords(videoX, videoY) {
    return {
      x: videoX / this._scaleX,
      y: videoY / this._scaleY
    };
  }

  getContext() { return this._ctx; }
  getWidth()   { return this._canvas.width; }
  getHeight()  { return this._canvas.height; }
  getCanvas()  { return this._canvas; }

  clear() {
    this._ctx.clearRect(0, 0, this._canvas.width, this._canvas.height);
  }

  destroy() {
    this._resizeObserver.disconnect();
  }
}
