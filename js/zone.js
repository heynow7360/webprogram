'use strict';

/**
 * ZoneManager — 감지 영역 드로우 상태 머신
 *
 * 상태: IDLE → DRAWING → DEFINED
 *              ↑____________|  (재드로우)
 */
class ZoneManager {
  constructor(canvasManager) {
    this._cm = canvasManager;
    this._canvas = canvasManager.getCanvas();

    this._state = 'IDLE';  // IDLE | DRAWING | DEFINED
    this._startX = 0;
    this._startY = 0;
    this._currentX = 0;
    this._currentY = 0;
    this.zone = null;       // { x, y, width, height } in video coords

    this.onZoneChanged = null;  // callback(zone | null)

    this._bindEvents();
  }

  _bindEvents() {
    const c = this._canvas;

    // 마우스 이벤트
    c.addEventListener('mousedown',  e => this._onStart(e.clientX, e.clientY));
    c.addEventListener('mousemove',  e => this._onMove(e.clientX, e.clientY));
    c.addEventListener('mouseup',    e => this._onEnd(e.clientX, e.clientY));
    c.addEventListener('mouseleave', e => { if (this._state === 'DRAWING') this._onEnd(e.clientX, e.clientY); });

    // 터치 이벤트
    c.addEventListener('touchstart', e => {
      e.preventDefault();
      const t = e.touches[0];
      this._onStart(t.clientX, t.clientY);
    }, { passive: false });
    c.addEventListener('touchmove', e => {
      e.preventDefault();
      const t = e.touches[0];
      this._onMove(t.clientX, t.clientY);
    }, { passive: false });
    c.addEventListener('touchend', e => {
      e.preventDefault();
      const t = e.changedTouches[0];
      this._onEnd(t.clientX, t.clientY);
    }, { passive: false });
  }

  _onStart(clientX, clientY) {
    if (!this._enabled) return;
    const v = this._cm.toVideoCoords(clientX, clientY);
    this._startX = v.x;
    this._startY = v.y;
    this._currentX = v.x;
    this._currentY = v.y;
    this._state = 'DRAWING';
  }

  _onMove(clientX, clientY) {
    if (this._state !== 'DRAWING') return;
    const v = this._cm.toVideoCoords(clientX, clientY);
    this._currentX = Math.max(0, Math.min(v.x, this._cm.getWidth()));
    this._currentY = Math.max(0, Math.min(v.y, this._cm.getHeight()));
  }

  _onEnd(clientX, clientY) {
    if (this._state !== 'DRAWING') return;
    const v = this._cm.toVideoCoords(clientX, clientY);
    this._currentX = Math.max(0, Math.min(v.x, this._cm.getWidth()));
    this._currentY = Math.max(0, Math.min(v.y, this._cm.getHeight()));

    const normalized = ZoneManager.normalizeRect(
      this._startX, this._startY,
      this._currentX, this._currentY
    );

    // 너무 작은 영역은 무시
    if (normalized.width < 10 || normalized.height < 10) {
      this._state = this.zone ? 'DEFINED' : 'IDLE';
      return;
    }

    this.zone = normalized;
    this._state = 'DEFINED';
    if (this.onZoneChanged) this.onZoneChanged(this.zone);
  }

  clearZone() {
    this.zone = null;
    this._state = 'IDLE';
    if (this.onZoneChanged) this.onZoneChanged(null);
  }

  enable()  { this._enabled = true; }
  disable() { this._enabled = false; }

  getDrawingRect() {
    if (this._state !== 'DRAWING') return null;
    return ZoneManager.normalizeRect(this._startX, this._startY, this._currentX, this._currentY);
  }

  /**
   * 캔버스에 영역 그리기 (app.js의 렌더 루프에서 호출)
   * @param {CanvasRenderingContext2D} ctx
   * @param {boolean} personPresent — true: 녹색 / false: 빨간색 / null: 파란색(대기)
   */
  draw(ctx, personPresent) {
    const rect = this._state === 'DRAWING' ? this.getDrawingRect() : this.zone;
    if (!rect) return;

    let strokeColor, fillColor;
    if (personPresent === null || personPresent === undefined) {
      strokeColor = 'rgba(59, 130, 246, 0.9)';    // 파랑 — 대기
      fillColor   = 'rgba(59, 130, 246, 0.08)';
    } else if (personPresent) {
      strokeColor = 'rgba(34, 197, 94, 0.9)';     // 초록 — 감지됨
      fillColor   = 'rgba(34, 197, 94, 0.08)';
    } else {
      strokeColor = 'rgba(239, 68, 68, 0.9)';     // 빨강 — 부재
      fillColor   = 'rgba(239, 68, 68, 0.08)';
    }

    ctx.save();
    ctx.fillStyle = fillColor;
    ctx.fillRect(rect.x, rect.y, rect.width, rect.height);
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 3;
    ctx.setLineDash(this._state === 'DRAWING' ? [8, 4] : []);
    ctx.strokeRect(rect.x, rect.y, rect.width, rect.height);

    // 라벨
    ctx.setLineDash([]);
    ctx.font = 'bold 13px sans-serif';
    const label = this._state === 'DRAWING' ? '영역 설정 중...' :
                  personPresent === null ? '감지 대기' :
                  personPresent ? '감지됨' : '부재';
    ctx.fillStyle = strokeColor;
    const textX = rect.x + 6;
    const textY = rect.y > 20 ? rect.y - 6 : rect.y + 18;
    ctx.fillText(label, textX, textY);
    ctx.restore();
  }

  static normalizeRect(x1, y1, x2, y2) {
    return {
      x:      Math.min(x1, x2),
      y:      Math.min(y1, y2),
      width:  Math.abs(x2 - x1),
      height: Math.abs(y2 - y1)
    };
  }
}
