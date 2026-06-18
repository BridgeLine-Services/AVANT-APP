/**
 * ╔══════════════════════════════════════════════════════════════╗
 * ║  AVANT — Screen Vision Engine                               ║
 * ║                                                              ║
 * ║  JS layer for screen capture.                               ║
 * ║  On Android: bridges to AvantScreenCaptureService.kt        ║
 * ║  which uses MediaProjection API with user consent.          ║
 * ║                                                              ║
 * ║  In web/Expo Go: uses html2canvas or screenshot-js          ║
 * ║  to capture the React Native WebView content.               ║
 * ╚══════════════════════════════════════════════════════════════╝
 */

const isNative = typeof (window as any).Capacitor !== 'undefined' &&
                 (window as any).Capacitor?.isNative;

// ── Screen capture → base64 ────────────────────────────────────
export async function captureScreen(): Promise<string | null> {
  if (isNative) {
    return captureScreenNative();
  }
  return captureScreenWeb();
}

// Native path — calls AvantScreenCaptureService via Capacitor bridge
async function captureScreenNative(): Promise<string | null> {
  try {
    const { Capacitor } = window as any;
    const result = await Capacitor?.Plugins?.AvantPlugin?.captureScreen?.();
    if (result?.base64) return result.base64;
    return null;
  } catch (e: any) {
    console.warn('[AVANT Screen] Native capture unavailable:', e.message);
    return captureScreenWeb(); // fall back to web method
  }
}

// Web/Expo Go path — use html2canvas on the webview root
async function captureScreenWeb(): Promise<string | null> {
  try {
    const html2canvas = (await import('html2canvas')).default;
    const canvas = await html2canvas(document.body, {
      scale:              0.5,    // halve resolution for speed
      useCORS:            true,
      allowTaint:         true,
      backgroundColor:    '#050510',
      logging:            false,
    });
    return canvas.toDataURL('image/jpeg', 0.75)
      .replace(/^data:image\/\w+;base64,/, '');
  } catch (e: any) {
    console.error('[AVANT Screen] html2canvas failed:', e.message);
    return null;
  }
}

// ── Accessibility text read (zero-image fallback) ─────────────
// When image capture isn't available, extract visible text from DOM
export function readScreenText(): string {
  if (typeof document === 'undefined') return '';
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    { acceptNode: (node) => node.textContent?.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP }
  );
  const parts: string[] = [];
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const text = node.textContent?.trim();
    if (text && text.length > 1) parts.push(text);
  }
  return parts.join(' ').slice(0, 1500);
}

// ── Screen live loop ───────────────────────────────────────────
let _screenRunning = false;

export function isScreenLiveRunning(): boolean { return _screenRunning; }

export async function startScreenLive(
  onFrame: (frame: string) => void,
  intervalMs = 3000
): Promise<void> {
  if (_screenRunning) return;
  _screenRunning = true;
  console.log('[AVANT Screen] Live loop started');

  while (_screenRunning) {
    const frame = await captureScreen();
    if (frame) onFrame(frame);
    await new Promise<void>(r => setTimeout(r, intervalMs));
  }
  console.log('[AVANT Screen] Live loop stopped');
}

export function stopScreenLive(): void {
  _screenRunning = false;
}
