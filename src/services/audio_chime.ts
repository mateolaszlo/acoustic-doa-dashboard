/**
 * Web Audio API synthesized sonar ping for eyes-free acoustic monitoring
 */

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
  return audioCtx;
}

/**
 * Plays a short, subtle acoustic sonar chime
 * @param frequency Frequency in Hz (e.g. 880Hz or higher for loud sounds)
 * @param volume Master gain between 0.01 and 0.1
 */
export function playSonarPing(frequency = 880, volume = 0.04) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(frequency, ctx.currentTime);
    // Slight pitch drop for sonar character
    osc.frequency.exponentialRampToValueAtTime(frequency * 0.75, ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(volume, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.1);
  } catch (err) {
    // Gracefully ignore audio autoplay or hardware errors
  }
}
