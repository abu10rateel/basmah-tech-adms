/**
 * Generates a clean, pleasant notification chime audio file (notification.mp3 / notification.wav)
 */
import fs from 'fs';
import path from 'path';

function generateChimeWav() {
  const sampleRate = 44100;
  const duration = 0.8; // seconds
  const numSamples = Math.floor(sampleRate * duration);
  const buffer = Buffer.alloc(44 + numSamples * 2);

  // RIFF header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + numSamples * 2, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // subchunk1 size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // Mono
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * 2, 28); // byte rate
  buffer.writeUInt16LE(2, 32); // block align
  buffer.writeUInt16LE(16, 34); // bits per sample
  buffer.write('data', 36);
  buffer.writeUInt32LE(numSamples * 2, 40);

  // Generate pleasant 2-tone chime: Tone 1 (C6 ~ 1046 Hz), Tone 2 (E6 ~ 1318 Hz)
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Tone 1: starts at 0s, decays over 0.4s
    if (t < 0.5) {
      const envelope1 = Math.exp(-t * 8);
      sample += Math.sin(2 * Math.PI * 880 * t) * envelope1 * 0.5;
      sample += Math.sin(2 * Math.PI * 1760 * t) * envelope1 * 0.15;
    }
    
    // Tone 2: starts at 0.15s, decays over 0.65s
    if (t >= 0.12) {
      const t2 = t - 0.12;
      const envelope2 = Math.exp(-t2 * 6);
      sample += Math.sin(2 * Math.PI * 1320 * t2) * envelope2 * 0.6;
      sample += Math.sin(2 * Math.PI * 2640 * t2) * envelope2 * 0.2;
    }

    // Clamp
    sample = Math.max(-1, Math.min(1, sample));
    const intSample = Math.floor(sample * 32767);
    buffer.writeInt16LE(intSample, 44 + i * 2);
  }

  return buffer;
}

const wavBuffer = generateChimeWav();
const publicDir = path.join(process.cwd(), 'public');
const distDir = path.join(process.cwd(), 'dist');

if (!fs.existsSync(publicDir)) fs.mkdirSync(publicDir, { recursive: true });
fs.writeFileSync(path.join(publicDir, 'notification.mp3'), wavBuffer);
fs.writeFileSync(path.join(publicDir, 'notification.wav'), wavBuffer);

if (fs.existsSync(distDir)) {
  fs.writeFileSync(path.join(distDir, 'notification.mp3'), wavBuffer);
  fs.writeFileSync(path.join(distDir, 'notification.wav'), wavBuffer);
}

console.log('Notification chime generated successfully in public/notification.mp3 and public/notification.wav');
