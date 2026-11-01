// camera.js — webcam access only. Knows nothing about MediaPipe or gestures.

/** Error with a machine-readable `code` so the UI can show a friendly message. */
export class CameraError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.name = 'CameraError';
    this.code = code;
    this.cause = cause;
  }
}

/** Translate the browser's cryptic getUserMedia errors into our own codes. */
function mapError(e) {
  switch (e && e.name) {
    case 'NotAllowedError':
    case 'SecurityError':
      return new CameraError('permission-denied', 'Camera permission was denied. Allow camera access in the browser address bar and try again.', e);
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return new CameraError('no-camera', 'No camera found. Plug one in and try again.', e);
    case 'NotReadableError':
    case 'TrackStartError':
      return new CameraError('camera-busy', 'The camera is in use by another app or tab.', e);
    case 'OverconstrainedError':
      return new CameraError('camera-unsupported', 'The camera does not support the requested resolution.', e);
    default:
      return new CameraError('camera-error', 'Could not start the camera: ' + (e && e.message ? e.message : e), e);
  }
}

export class Camera {
  /**
   * @param {object} o
   * @param {HTMLVideoElement} o.video   element that will show / provide frames
   * @param {number} [o.width=640]  ideal width (small = fast; 640x480 is plenty for hands)
   * @param {number} [o.height=480]
   * @param {string} [o.facingMode='user']  'user' = front camera
   * @param {string} [o.deviceId]  pick a specific camera
   * @param {Function} [o.onEnded] called if the camera disappears (unplugged / revoked)
   */
  constructor({ video, width = 640, height = 480, facingMode = 'user', deviceId, onEnded } = {}) {
    this.video = video || document.createElement('video');
    this.constraints = { width, height, facingMode, deviceId };
    this.onEnded = onEnded;
    this.stream = null;
    this._handleEnded = () => { if (this.onEnded) this.onEnded(); };
  }

  isActive() { return !!this.stream; }

  async start() {
    if (this.stream) return this.video;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new CameraError('unsupported', 'getUserMedia is unavailable. Use a modern browser on https:// or http://localhost.');
    }
    const { width, height, facingMode, deviceId } = this.constraints;
    const video = { width: { ideal: width }, height: { ideal: height } };
    if (deviceId) video.deviceId = { exact: deviceId }; else video.facingMode = facingMode;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (e) {
      throw mapError(e);
    }
    // 'ended' fires on a track when the camera is unplugged or access is revoked.
    this.stream.getVideoTracks().forEach(t => t.addEventListener('ended', this._handleEnded));

    this.video.srcObject = this.stream;
    this.video.muted = true;        // required for autoplay
    this.video.playsInline = true;  // required on iOS
    try {
      await this.video.play();
      if (this.video.readyState < 2) {
        await new Promise(res => this.video.addEventListener('loadeddata', res, { once: true }));
      }
    } catch (e) {
      this.stop();
      throw new CameraError('camera-error', 'Could not play the camera stream: ' + e.message, e);
    }
    return this.video;
  }

  /** Release the camera completely (turns off the camera light). */
  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(t => {
        t.removeEventListener('ended', this._handleEnded);
        t.stop();
      });
      this.stream = null;
    }
    this.video.pause();
    this.video.srcObject = null;
  }
}
