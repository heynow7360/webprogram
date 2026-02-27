'use strict';

/**
 * AABB 교차 판정 함수
 * @param {Object} a { x, y, width, height }
 * @param {Object} b { x, y, width, height }
 * @returns {boolean}
 */
function rectsOverlap(a, b) {
  return !(
    a.x + a.width  < b.x ||
    b.x + b.width  < a.x ||
    a.y + a.height < b.y ||
    b.y + b.height < a.y
  );
}

/**
 * 사람이 지정 영역 안에 있는지 판정
 * @param {Array} persons — COCO-SSD predictions (class === 'person')
 * @param {Object} zone  — { x, y, width, height } in video coords
 * @param {number} minScore — 신뢰도 임계값
 * @returns {boolean}
 */
function isPersonInZone(persons, zone, minScore = 0.5) {
  if (!zone || !persons || persons.length === 0) return false;

  return persons.some(person => {
    if (person.score < minScore) return false;
    const [px, py, pw, ph] = person.bbox;
    const personRect = { x: px, y: py, width: pw, height: ph };
    return rectsOverlap(personRect, zone);
  });
}

/**
 * PresenceTracker — 연속 프레임 기반 부재/존재 상태 디바운서
 *
 * 노이즈가 있는 단일 프레임 감지 결과를 안정적인 상태로 변환한다.
 * - PRESENT → N프레임 연속 미감지 → ABSENT (경보 트리거)
 * - ABSENT  → M프레임 연속 감지   → PRESENT (경보 해제)
 */
class PresenceTracker {
  /**
   * @param {number} absenceThreshold — 부재로 전환하기 위한 연속 미감지 프레임 수
   * @param {number} returnThreshold  — 존재로 전환하기 위한 연속 감지 프레임 수
   */
  constructor(absenceThreshold = 10, returnThreshold = 3) {
    this.absenceThreshold = absenceThreshold;
    this.returnThreshold  = returnThreshold;
    this._state = 'PRESENT';
    this._missCount = 0;
    this._hitCount  = 0;
  }

  /**
   * 프레임마다 호출
   * @param {boolean} detectedThisFrame
   * @returns {{ state: 'present'|'absent', changed: boolean }}
   */
  update(detectedThisFrame) {
    const prevState = this._state;

    if (detectedThisFrame) {
      this._missCount = 0;
      this._hitCount++;
      if (this._state === 'ABSENT' && this._hitCount >= this.returnThreshold) {
        this._state = 'PRESENT';
      }
    } else {
      this._hitCount = 0;
      this._missCount++;
      if (this._state === 'PRESENT' && this._missCount >= this.absenceThreshold) {
        this._state = 'ABSENT';
      }
    }

    return {
      state:   this._state.toLowerCase(),
      changed: this._state !== prevState
    };
  }

  reset() {
    this._state = 'PRESENT';
    this._missCount = 0;
    this._hitCount  = 0;
  }

  getState() { return this._state.toLowerCase(); }
  getMissCount() { return this._missCount; }
}
