'use strict';

/**
 * CameraManager — getUserMedia 및 비디오 스트림 관리
 */
class CameraManager {
  constructor(videoElement) {
    this._video = videoElement;
    this._stream = null;
    this.onReady = null;   // callback(videoElement)
    this.onError = null;   // callback(errorType, message)
    this.onEnded = null;   // callback() — 카메라 연결 끊김
  }

  async start() {
    // HTTPS 체크 (localhost는 예외)
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      this._triggerError('https', 'HTTPS 환경에서만 카메라를 사용할 수 있습니다.\n현재 주소: ' + location.origin);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      this._stream = stream;
      this._video.srcObject = stream;

      // 트랙 종료 감지 (카메라 물리적 연결 끊김)
      const track = stream.getVideoTracks()[0];
      if (track) {
        track.addEventListener('ended', () => {
          this._stream = null;
          if (this.onEnded) this.onEnded();
        });
      }

      // 비디오 메타데이터 로드 완료 후 준비 완료 신호
      this._video.addEventListener('loadedmetadata', () => {
        this._video.play().catch(() => {});
        if (this.onReady) this.onReady(this._video);
      }, { once: true });

    } catch (err) {
      this._handleGetUserMediaError(err);
    }
  }

  stop() {
    if (this._stream) {
      this._stream.getTracks().forEach(t => t.stop());
      this._stream = null;
    }
    this._video.srcObject = null;
  }

  getStream() { return this._stream; }

  _handleGetUserMediaError(err) {
    let type, msg;
    switch (err.name) {
      case 'NotAllowedError':
      case 'PermissionDeniedError':
        type = 'permission';
        msg = '카메라 접근 권한이 거부되었습니다.\n\n브라우저 주소창 좌측의 자물쇠 아이콘을 클릭하여\n카메라 권한을 허용해 주세요.';
        break;
      case 'NotFoundError':
      case 'DevicesNotFoundError':
        type = 'notfound';
        msg = '카메라 장치를 찾을 수 없습니다.\n카메라가 연결되어 있는지 확인해 주세요.';
        break;
      case 'NotReadableError':
      case 'TrackStartError':
        type = 'inuse';
        msg = '카메라가 다른 애플리케이션에서 사용 중입니다.\n다른 탭이나 앱을 종료하고 다시 시도해 주세요.';
        break;
      case 'OverconstrainedError':
        type = 'constraints';
        msg = '카메라가 요청한 해상도를 지원하지 않습니다.\n다시 시도해 주세요.';
        break;
      default:
        type = 'unknown';
        msg = `카메라 오류가 발생했습니다.\n${err.message || err.name}`;
    }
    this._triggerError(type, msg);
  }

  _triggerError(type, message) {
    if (this.onError) this.onError(type, message);
  }
}
