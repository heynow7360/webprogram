'use strict';

const SETTINGS_KEY = 'absence-detector-settings';

const DEFAULTS = {
  detectionIntervalMs:  200,
  confidenceThreshold:  0.5,
  showBoundingBoxes:    false,
  alarmEnabled:         true,
  alarmVolume:          0.5,
  absenceDelaySeconds:  2,
  showZoneOutline:      true
};

/**
 * SettingsManager — 설정 UI 및 localStorage 영속화
 */
class SettingsManager {
  constructor() {
    this.values = this._load();
    this.onChange = null;  // callback(key, value, settings)
  }

  _load() {
    try {
      const stored = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
      return { ...DEFAULTS, ...stored };
    } catch {
      return { ...DEFAULTS };
    }
  }

  _save() {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.values));
  }

  _set(key, value) {
    this.values[key] = value;
    this._save();
    if (this.onChange) this.onChange(key, value, this.values);
  }

  /**
   * DOM에 현재 값 반映하고 이벤트 리스너 연결
   */
  bindUI() {
    // 감지 속도 라디오
    document.querySelectorAll('input[name="detection-speed"]').forEach(radio => {
      radio.checked = (parseInt(radio.value) === this.values.detectionIntervalMs);
      radio.addEventListener('change', () => {
        this._set('detectionIntervalMs', parseInt(radio.value));
      });
    });

    // 신뢰도 슬라이더
    const confSlider = document.getElementById('confidence-slider');
    const confValue  = document.getElementById('confidence-value');
    confSlider.value = this.values.confidenceThreshold;
    confValue.textContent = this.values.confidenceThreshold.toFixed(2);
    confSlider.addEventListener('input', () => {
      const v = parseFloat(confSlider.value);
      confValue.textContent = v.toFixed(2);
      this._set('confidenceThreshold', v);
    });

    // 바운딩 박스 토글
    const bboxToggle = document.getElementById('show-bbox-toggle');
    bboxToggle.checked = this.values.showBoundingBoxes;
    bboxToggle.addEventListener('change', () => {
      this._set('showBoundingBoxes', bboxToggle.checked);
    });

    // 경보 활성화 토글
    const alarmToggle = document.getElementById('alarm-enabled-toggle');
    alarmToggle.checked = this.values.alarmEnabled;
    alarmToggle.addEventListener('change', () => {
      this._set('alarmEnabled', alarmToggle.checked);
    });

    // 볼륨 슬라이더
    const volSlider = document.getElementById('volume-slider');
    const volValue  = document.getElementById('volume-value');
    volSlider.value = this.values.alarmVolume;
    volValue.textContent = Math.round(this.values.alarmVolume * 100);
    volSlider.addEventListener('input', () => {
      const v = parseFloat(volSlider.value);
      volValue.textContent = Math.round(v * 100);
      this._set('alarmVolume', v);
    });

    // 부재 지연 슬라이더
    const delaySlider = document.getElementById('delay-slider');
    const delayValue  = document.getElementById('delay-value');
    delaySlider.value = this.values.absenceDelaySeconds;
    delayValue.textContent = this.values.absenceDelaySeconds;
    delaySlider.addEventListener('input', () => {
      const v = parseInt(delaySlider.value);
      delayValue.textContent = v;
      this._set('absenceDelaySeconds', v);
    });

    // 영역 테두리 표시 토글
    const zoneToggle = document.getElementById('show-zone-toggle');
    zoneToggle.checked = this.values.showZoneOutline;
    zoneToggle.addEventListener('change', () => {
      this._set('showZoneOutline', zoneToggle.checked);
    });

    // 설정 패널 열기/닫기
    const panel = document.getElementById('settings-panel');
    const overlay = document.getElementById('settings-overlay');

    document.getElementById('settings-btn').addEventListener('click', () => {
      panel.classList.remove('hidden');
    });
    document.getElementById('settings-close-btn').addEventListener('click', () => {
      panel.classList.add('hidden');
    });
    overlay.addEventListener('click', () => {
      panel.classList.add('hidden');
    });
  }
}
