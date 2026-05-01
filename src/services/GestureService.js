/**
 * GestureService — wraps MediaPipe Hands for gesture-based drawing.
 *
 * Since @mediapipe/hands uses UMD format, we load it via CDN script tags
 * to avoid Vite build issues with non-ESM packages.
 *
 * Landmarks used:
 *   4  = THUMB_TIP
 *   8  = INDEX_FINGER_TIP
 *
 * "Pinch" gesture = distance(thumb_tip, index_tip) < threshold
 *   → treated as "pen down" (drawing)
 * Otherwise → "pen up" (cursor moves but no stroke)
 */

const PINCH_THRESHOLD = 0.12; // Increased for easier drawing
const SMOOTHING_FACTOR = 0.4; // Smoothing factor (0 to 1), lower is smoother but lags more

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve();
      return;
    }
    const s = document.createElement('script');
    s.src = src;
    s.crossOrigin = 'anonymous';
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

export class GestureController {
  constructor() {
    this.hands = null;
    this.camera = null;
    this.onGestureResult = null;
    this.running = false;
    this.lastX = null;
    this.lastY = null;
  }

  async start(videoEl, callback) {
    if (this.running) return;
    this.onGestureResult = callback;
    this.lastX = null;
    this.lastY = null;

    // Load MediaPipe scripts from CDN
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/hands/hands.js');
    await loadScript('https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js');

    const { Hands } = window;
    const { Camera } = window;

    if (!Hands || !Camera) {
      throw new Error('Failed to load MediaPipe libraries');
    }

    this.hands = new Hands({
      locateFile: (file) =>
        `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`,
    });

    this.hands.setOptions({
      maxNumHands: 1,
      modelComplexity: 1,
      minDetectionConfidence: 0.7,
      minTrackingConfidence: 0.5,
    });

    this.hands.onResults((results) => this._processResults(results));

    this.camera = new Camera(videoEl, {
      onFrame: async () => {
        if (this.hands) {
          await this.hands.send({ image: videoEl });
        }
      },
      width: 640,
      height: 480,
    });

    await this.camera.start();
    this.running = true;
  }

  stop() {
    if (this.camera) {
      this.camera.stop();
      this.camera = null;
    }
    if (this.hands) {
      this.hands.close();
      this.hands = null;
    }
    this.running = false;
    this.lastX = null;
    this.lastY = null;
  }

  _processResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) {
      this.lastX = null;
      this.lastY = null;
      return;
    }

    const landmarks = results.multiHandLandmarks[0];
    const thumbTip = landmarks[4];
    const indexTip = landmarks[8];

    const dx = thumbTip.x - indexTip.x;
    const dy = thumbTip.y - indexTip.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const isPinching = dist < PINCH_THRESHOLD;

    // Mirror x-axis for natural feel
    const targetX = 1 - indexTip.x;
    const targetY = indexTip.y;

    // Apply exponential smoothing
    if (this.lastX === null || this.lastY === null) {
      this.lastX = targetX;
      this.lastY = targetY;
    } else {
      this.lastX += (targetX - this.lastX) * SMOOTHING_FACTOR;
      this.lastY += (targetY - this.lastY) * SMOOTHING_FACTOR;
    }

    if (this.onGestureResult) {
      this.onGestureResult({ x: this.lastX, y: this.lastY, isPinching });
    }
  }
}

export default GestureController;
