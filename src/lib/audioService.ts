/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

// Web Audio API Synthesizer & Audio Element Chime Player
let audioContext: AudioContext | null = null;

export function playNotificationSound() {
  try {
    // 1. Try playing audio element if supported
    const audio = new Audio('/notification.mp3');
    audio.volume = 0.85;
    audio.play().catch(() => {
      // Browser autoplay policy might restrict, fallback to Web Audio
      playWebAudioChime();
    });
  } catch (e) {
    playWebAudioChime();
  }
}

export function playWebAudioChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    if (!audioContext || audioContext.state === 'closed') {
      audioContext = new AudioCtx();
    }

    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }

    const now = audioContext.currentTime;

    // Tone 1: High crisp pleasant chime (880Hz -> A5)
    const osc1 = audioContext.createOscillator();
    const gain1 = audioContext.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc1.connect(gain1);
    gain1.connect(audioContext.destination);

    osc1.start(now);
    osc1.stop(now + 0.45);

    // Tone 2: Harmonious resonance (1320Hz -> E6)
    const osc2 = audioContext.createOscillator();
    const gain2 = audioContext.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1320, now + 0.12);
    gain2.gain.setValueAtTime(0.0001, now);
    gain2.gain.setValueAtTime(0.4, now + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.0001, now + 0.7);

    osc2.connect(gain2);
    gain2.connect(audioContext.destination);

    osc2.start(now + 0.12);
    osc2.stop(now + 0.7);
  } catch (err) {
    console.warn('[AudioService] Could not play synth chime:', err);
  }
}
