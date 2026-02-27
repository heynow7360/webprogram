'use strict';

/**
 * App — 최상위 오케스트레이터
 *
 * 시작 순서:
 *   1. DOM ready
 *   2. localStorage 설정 로드 + UI 바인딩
 *   3. CameraManager.start()
 *      └─ loadedmetadata:
 *         4. CanvasManager.sizeToVideo()
 *         5. ZoneManager.init
 *         6. DetectorManager.loadModel()  (로딩 오버레이)
 *            └─ 모델 준비:
 *               7. 오버레이 숨김, 감지 루프 시작
 */

document.addEventListener('DOMContentLoaded', () => {

  // ── DOM 참조 ─────────────────────────────────────────────
  const videoEl       = document.getElementById('camera-feed');
  const canvasEl      = document.getElementById('overlay');
  const loadingOverlay = document.getElementById('loading-overlay');
  const loadingMsg    = document.getElementById('loading-message');
  const errorScreen   = document.getElementById('error-screen');
  const errorTitle    = document.getElementById('error-title');
  const errorMsg      = document.getElementById('error-message');
  const retryBtn      = document.getElementById('retry-btn');
  const appEl         = document.getElementById('app');
  const statusBadge   = document.getElementById('status-badge');
  const clearZoneBtn  = document.getElementById('clear-zone-btn');
  const toggleDetBtn  = document.getElementById('toggle-detection-btn');
  const alarmIndicator = document.getElementById('alarm-indicator');
  const zoneInstruction = document.getElementById('zone-instruction');

  // ── 컴포넌트 초기화 ─────────────────────────────────────
  const settings  = new SettingsManager();
  const camera    = new CameraManager(videoEl);
  const alarm     = new AlarmManager();
  let   canvas    = null;  // CanvasManager (비디오 로드 후 생성)
  let   zone      = null;  // ZoneManager
  let   detector  = null;  // DetectorManager
  let   tracker   = null;  // PresenceTracker

  let detectionActive = false;
  let lastPersons     = [];
  let presenceState   = 'present';  // 'present' | 'absent'

  // ── 설정 UI 바인딩 ───────────────────────────────────────
  settings.bindUI();
  settings.onChange = (key, value) => {
    if (detector) {
      if (key === 'detectionIntervalMs') detector.intervalMs = value;
    }
    if (alarm) {
      if (key === 'alarmVolume')  alarm.setVolume(value);
      if (key === 'alarmEnabled') alarm.setEnabled(value);
    }
    if (tracker && key === 'absenceDelaySeconds') {
      tracker.absenceThreshold = Math.round(value / (settings.values.detectionIntervalMs / 1000));
    }
  };

  // 초기 경보 설정 적용
  alarm.setVolume(settings.values.alarmVolume);
  alarm.setEnabled(settings.values.alarmEnabled);

  // ── 유틸 ─────────────────────────────────────────────────
  function setStatus(state, label) {
    statusBadge.className = 'status-badge status-' + state;
    statusBadge.textContent = label;
  }

  function showLoading(msg) {
    loadingMsg.textContent = msg;
    loadingOverlay.classList.remove('hidden');
  }

  function hideLoading() {
    loadingOverlay.classList.add('hidden');
  }

  function showError(title, msg) {
    hideLoading();
    appEl.classList.add('hidden');
    errorTitle.textContent  = title;
    errorMsg.textContent    = msg;
    errorScreen.classList.remove('hidden');
  }

  function hideError() {
    errorScreen.classList.add('hidden');
  }

  // ── 카메라 시작 ──────────────────────────────────────────
  function startCamera() {
    showLoading('카메라 연결 중...');
    hideError();
    camera.start();
  }

  camera.onReady = (video) => {
    // 앱 화면 표시
    appEl.classList.remove('hidden');

    // 캔버스 설정
    canvas = new CanvasManager(video, canvasEl);
    canvas.sizeToVideo();

    // 존 설정
    zone = new ZoneManager(canvas);
    zone.enable();
    zone.onZoneChanged = (z) => {
      clearZoneBtn.disabled = !z;
      if (z) {
        zoneInstruction.textContent = '감지 영역이 설정되었습니다. 감지 시작을 눌러주세요.';
        toggleDetBtn.disabled = false;
        // 트래커 리셋
        if (tracker) tracker.reset();
      } else {
        zoneInstruction.textContent = '드래그하여 감지 영역을 설정하세요';
        toggleDetBtn.disabled = true;
        stopDetection();
      }
    };

    // 모델 로딩
    showLoading('AI 감지 모델 로딩 중... (첫 실행 시 수 초 소요)');
    detector = new DetectorManager(video);
    detector.intervalMs = settings.values.detectionIntervalMs;

    detector.onModelLoaded = () => {
      hideLoading();
      setStatus('idle', '대기 중');

      // 탐지 루프 연결
      detector.onDetection = onDetectionResult;

      // 렌더 루프 시작 (항상 실행, 존/바운딩박스 표시용)
      startRenderLoop();
    };

    detector.onError = (err) => {
      console.error('[Detector]', err);
      showError('모델 로딩 실패', 'AI 모델을 불러오지 못했습니다.\n인터넷 연결을 확인하고 페이지를 새로고침해 주세요.');
    };

    detector.loadModel();
  };

  camera.onError = (type, msg) => {
    const titles = {
      permission:  '카메라 권한 필요',
      notfound:    '카메라 없음',
      inuse:       '카메라 사용 중',
      constraints: '카메라 오류',
      https:       'HTTPS 필요',
      unknown:     '카메라 오류'
    };
    showError(titles[type] || '카메라 오류', msg);
  };

  camera.onEnded = () => {
    stopDetection();
    showError('카메라 연결 끊김', '카메라 연결이 끊겼습니다.\n카메라를 확인하고 다시 시도해 주세요.');
  };

  // ── 감지 결과 처리 ───────────────────────────────────────
  function onDetectionResult(persons) {
    lastPersons = persons;

    if (!detectionActive || !zone || !zone.zone) return;

    const inZone = isPersonInZone(persons, zone.zone, settings.values.confidenceThreshold);
    const result = tracker.update(inZone);

    if (result.changed) {
      presenceState = result.state;
      updateAlarm();
      updateStatusBadge();
    }
  }

  function updateAlarm() {
    if (presenceState === 'absent' && detectionActive && zone && zone.zone) {
      alarm.start();
      alarmIndicator.classList.remove('hidden');
    } else {
      alarm.stop();
      alarmIndicator.classList.add('hidden');
    }
  }

  function updateStatusBadge() {
    if (!detectionActive) {
      setStatus('idle', '대기 중');
    } else if (presenceState === 'present') {
      setStatus('present', '감지됨');
    } else {
      setStatus('absent', '부재');
    }
  }

  // ── 렌더 루프 (requestAnimationFrame) ───────────────────
  let renderRafId = null;

  function startRenderLoop() {
    if (renderRafId) return;
    renderFrame();
  }

  function renderFrame() {
    renderRafId = requestAnimationFrame(renderFrame);
    if (!canvas) return;

    const ctx = canvas.getContext();
    canvas.clear();

    // 존 그리기
    if (settings.values.showZoneOutline && zone) {
      let personPresent = null;
      if (detectionActive) {
        personPresent = presenceState === 'present';
      }
      zone.draw(ctx, personPresent);
    }

    // 바운딩 박스 그리기
    if (settings.values.showBoundingBoxes && lastPersons.length > 0) {
      drawBoundingBoxes(ctx, lastPersons, settings.values.confidenceThreshold);
    }
  }

  function drawBoundingBoxes(ctx, persons, minScore) {
    persons.forEach(p => {
      if (p.score < minScore) return;
      const [x, y, w, h] = p.bbox;
      ctx.save();
      ctx.strokeStyle = 'rgba(255, 200, 0, 0.85)';
      ctx.lineWidth = 2;
      ctx.strokeRect(x, y, w, h);
      ctx.fillStyle = 'rgba(255, 200, 0, 0.85)';
      ctx.font = '12px sans-serif';
      ctx.fillText(`사람 ${Math.round(p.score * 100)}%`, x + 4, y > 16 ? y - 4 : y + 14);
      ctx.restore();
    });
  }

  // ── 감지 시작/중지 ───────────────────────────────────────
  function startDetection() {
    if (!detector || !detector.isLoaded()) return;

    const fps5frames = Math.round(settings.values.absenceDelaySeconds / (settings.values.detectionIntervalMs / 1000));
    tracker = new PresenceTracker(Math.max(1, fps5frames), 3);
    presenceState = 'present';

    detectionActive = true;
    detector.start();

    toggleDetBtn.textContent = '감지 중지';
    toggleDetBtn.classList.add('active');
    zoneInstruction.textContent = '영역 안에 사람이 없으면 경보가 울립니다';

    alarm.init();  // AudioContext 준비
    updateStatusBadge();
  }

  function stopDetection() {
    detectionActive = false;
    if (detector) detector.stop();
    alarm.stop();
    alarmIndicator.classList.add('hidden');
    lastPersons = [];
    presenceState = 'present';

    toggleDetBtn.textContent = '감지 시작';
    toggleDetBtn.classList.remove('active');
    if (zone && zone.zone) {
      zoneInstruction.textContent = '감지 영역이 설정되었습니다. 감지 시작을 눌러주세요.';
    }
    setStatus('idle', '대기 중');
  }

  // ── 버튼 이벤트 ─────────────────────────────────────────
  toggleDetBtn.addEventListener('click', () => {
    alarm.init();  // 사용자 제스처 시점에 AudioContext 초기화
    if (detectionActive) {
      stopDetection();
    } else {
      startDetection();
    }
  });

  clearZoneBtn.addEventListener('click', () => {
    if (zone) zone.clearZone();
    stopDetection();
  });

  retryBtn.addEventListener('click', () => {
    startCamera();
  });

  // ── 탭 비활성화 시 경보 일시정지 ──────────────────────────
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      alarm.stop();
    } else {
      updateAlarm();
    }
  });

  // ── 시작 ─────────────────────────────────────────────────
  startCamera();

});
