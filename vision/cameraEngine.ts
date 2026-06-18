/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Camera Vision Engine                               ║
 * ║                                                              ║
 * ║  Handles:                                                   ║
 * ║  • Single-shot "what am I looking at?" captures             ║
 * ║  • Live vision loop (user-enabled, battery-safe)            ║
 * ║  • Frame throttling based on battery + charging state       ║
 * ║                                                              ║
 * ║  All capture is user-triggered or user-enabled.             ║
 * ║  No silent background camera access.                        ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

// ── Platform check ────────────────────────────────────────────
const isNative = typeof (window as any).Capacitor !== 'undefined' &&
                 (window as any).Capacitor?.isNative;

// ── Single-shot camera capture → base64 ───────────────────────
export async function captureVision(): Promise<string | null> {
  if (isNative) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const image = await Camera.getPhoto({
        quality:       85,
        resultType:    CameraResultType.Base64,
        source:        CameraSource.Camera,
        saveToGallery: false,
        correctOrientation: true,
        // No UI flash — silent capture with user knowledge
      });
      return image.base64String ?? null;
    } catch (e: any) {
      console.error('Camera capture failed:', e.message);
      return null;
    }
  }

  // Web fallback — use getUserMedia + canvas snapshot
  return captureFromWebcam();
}

// ── Webcam fallback (Expo Go / browser) ───────────────────────
async function captureFromWebcam(): Promise<string | null> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
    const video  = document.createElement('video');
    video.srcObject = stream;
    await new Promise<void>(r => { video.onloadedmetadata = () => r(); });
    video.play();
    await new Promise<void>(r => setTimeout(r, 300)); // let frame settle

    const canvas = document.createElement('canvas');
    canvas.width  = video.videoWidth  || 640;
    canvas.height = video.videoHeight || 480;
    canvas.getContext('2d')?.drawImage(video, 0, 0);

    stream.getTracks().forEach(t => t.stop());
    // Return base64 without data URL prefix
    return canvas.toDataURL('image/jpeg', 0.8).replace(/^data:image\/\w+;base64,/, '');
  } catch (e: any) {
    console.error('Webcam fallback failed:', e.message);
    return null;
  }
}

// ── Battery-safe frame delay ───────────────────────────────────
async function getFrameDelay(): Promise<number> {
  try {
    const bat = await (navigator as any).getBattery?.();
    if (bat) {
      if (bat.charging)         return 1500;   // charging: 1.5s
      if (bat.level < 0.15)     return 8000;   // <15% battery: 8s
      if (bat.level < 0.30)     return 5000;   // <30% battery: 5s
    }
  } catch {}
  return 2500;   // default: 2.5s
}

// ── Live vision loop controller ────────────────────────────────
let _liveRunning  = false;
let _liveCallback: ((frame: string) => void) | null = null;

export function isLiveRunning(): boolean { return _liveRunning; }

export async function startLiveVision(
  onFrame: (frame: string) => void,
  options: { maxFrames?: number; stopSignal?: () => boolean } = {}
): Promise<void> {
  if (_liveRunning) {
    console.warn('Live vision already running');
    return;
  }
  _liveRunning  = true;
  _liveCallback = onFrame;

  const maxFrames = options.maxFrames ?? Infinity;
  let frameCount  = 0;

  console.log('[AVANT Vision] Live loop started');

  while (_liveRunning) {
    // External stop signal
    if (options.stopSignal?.()) break;
    if (frameCount >= maxFrames)   break;

    const frame = await captureVision();
    if (frame) {
      onFrame(frame);
      frameCount++;
    }

    const delay = await getFrameDelay();
    await new Promise<void>(r => setTimeout(r, delay));
  }

  _liveRunning  = false;
  _liveCallback = null;
  console.log('[AVANT Vision] Live loop stopped — frames captured:', frameCount);
}

export function stopLiveVision(): void {
  _liveRunning = false;
  console.log('[AVANT Vision] Stop requested');
}

// ── Resize helper (keep payloads small for faster AI response) ─
export function resizeBase64(base64: string, maxWidth = 768): Promise<string> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined') { resolve(base64); return; }
    const img = new Image();
    img.onload = () => {
      const ratio  = Math.min(1, maxWidth / img.width);
      const canvas = document.createElement('canvas');
      canvas.width  = Math.round(img.width  * ratio);
      canvas.height = Math.round(img.height * ratio);
      canvas.getContext('2d')?.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', 0.75).replace(/^data:image\/\w+;base64,/, ''));
    };
    img.onerror = () => resolve(base64);
    img.src = `data:image/jpeg;base64,${base64}`;
  });
}
