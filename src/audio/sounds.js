// Frequency/duration/waveform map for all 8 game sounds
const SOUND_CONFIG = {
  move:      { freq: 200,  duration: 0.05, type: 'square'   },
  rotate:    { freq: 300,  duration: 0.05, type: 'square'   },
  softDrop:  { freq: 150,  duration: 0.04, type: 'square'   },
  hardDrop:  { freq: 440,  duration: 0.08, type: 'square'   },
  lineClear: { freq: 600,  duration: 0.15, type: 'square'   },
  tetris:    { freq: 880,  duration: 0.25, type: 'square'   },
  levelUp:   { freq: 1000, duration: 0.20, type: 'sine'     },
  gameOver:  { freq: 110,  duration: 0.50, type: 'sawtooth' },
};

/**
 * Play a synthesized tone using the given (or a new) AudioContext.
 * The oscillator is automatically stopped and disconnected after playback.
 *
 * @param {number} freq - frequency in Hz
 * @param {number} duration - duration in seconds
 * @param {OscillatorType} type - waveform type ('square'|'sine'|'sawtooth'|'triangle')
 * @param {Function|null} gainEnvelope - optional fn(gainNode, ctx) for custom envelope
 * @param {AudioContext|null} ctx - injectable AudioContext (creates new one if null)
 */
export function playTone(freq, duration, type = 'square', gainEnvelope = null, ctx = null) {
  const audioCtx = ctx ?? new AudioContext();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();

  osc.connect(gain);
  gain.connect(audioCtx.destination);

  osc.type = type;
  osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
  gain.gain.setValueAtTime(0.25, audioCtx.currentTime);

  if (gainEnvelope) {
    gainEnvelope(gain, audioCtx);
  } else {
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  }

  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
  osc.onended = () => {
    osc.disconnect();
    gain.disconnect();
  };
}

/**
 * Play the sound for a named game event.
 * @param {string} event - event name (e.g. 'move', 'rotate', 'lineClear')
 * @param {AudioContext} ctx - the shared AudioContext from main.js
 */
export function playGameSound(event, ctx) {
  const config = SOUND_CONFIG[event];
  if (config) {
    playTone(config.freq, config.duration, config.type, null, ctx);
  }
}
