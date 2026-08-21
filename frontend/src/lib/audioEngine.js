/**
 * The single source of microphone audio for the whole app.
 *
 * Why a module-level singleton rather than a hook per consumer:
 *
 *   1. ONE microphone stream. Recording (MediaRecorder) and every visualiser
 *      read from the same getUserMedia stream and the same AnalyserNode, so
 *      the browser is never asked for the microphone twice and the orb, the
 *      background field and the recorder can never disagree about the signal.
 *
 *   2. NO React state per audio frame. The analyser runs at ~60fps; pushing
 *      that through useState would re-render the page tree sixty times a
 *      second. Instead every frame writes into `metrics`, a stable mutable
 *      object that canvas render loops read directly. React only ever hears
 *      about coarse transitions (started, stopped, failed).
 *
 * Consumers call `acquire()` / `release()`. The stream is reference-counted
 * and torn down completely when the last consumer lets go, so the OS
 * microphone indicator turns off the moment nothing needs it.
 */

/**
 * 72 bands mirror to 144 radial spikes around the orb, which is dense enough
 * to read as a continuous crown rather than countable bars.
 */
export const BANDS = 72;
export const WAVE_POINTS = 128;

/**
 * Live analyser output. Same object identity for the life of the page — read
 * it inside requestAnimationFrame, never copy it into state.
 *
 *   level    smoothed RMS, 0–1, with a fast attack and slow release so the
 *            visualiser settles naturally instead of snapping to silence
 *   raw      unsmoothed RMS, for anything that wants the true instantaneous value
 *   peak     slow-decaying maximum, used for headroom-relative scaling
 *   bands    smoothed per-band magnitudes, 0–1
 *   wave     time-domain samples, -1..1, downsampled to WAVE_POINTS
 *   energy   0–1 blend of level and spectral spread; drives ambient activity
 *   active   true only while a live stream is attached
 */
export const metrics = {
  level: 0,
  raw: 0,
  peak: 0,
  bands: new Float32Array(BANDS),
  wave: new Float32Array(WAVE_POINTS),
  energy: 0,
  active: false,
};

/**
 * Attack/release envelope.
 *
 * Speech transients need to show up immediately, but a hard cut to zero on a
 * pause reads as the visualiser breaking. Rising fast and falling slowly is
 * what makes the waveform feel physical rather than reactive.
 */
const ATTACK = 0.38;
const RELEASE = 0.075;

const smoothToward = (current, target) =>
  current + (target - current) * (target > current ? ATTACK : RELEASE);

const state = {
  refs: 0,
  stream: null,
  ctx: null,
  analyser: null,
  source: null,
  raf: 0,
  timeBuf: null,
  freqBuf: null,
  pending: null,
  envelope: [],
  recording: false,
};

const listeners = new Set();

/** Coarse notifications only: 'started' | 'stopped' | 'error'. */
export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function emit(event, payload) {
  for (const listener of listeners) listener(event, payload);
}

function resetMetrics() {
  metrics.level = 0;
  metrics.raw = 0;
  metrics.peak = 0;
  metrics.energy = 0;
  metrics.active = false;
  metrics.bands.fill(0);
  metrics.wave.fill(0);
}

function loop() {
  state.raf = requestAnimationFrame(loop);
  const { analyser, timeBuf, freqBuf } = state;
  if (!analyser) return;

  // ── Time domain: RMS and the waveform itself ──────────────────────────
  analyser.getByteTimeDomainData(timeBuf);
  let sum = 0;
  for (let i = 0; i < timeBuf.length; i += 1) {
    const v = (timeBuf[i] - 128) / 128;
    sum += v * v;
  }
  // 3.2x brings conversational speech into a usable 0–1 range without
  // clipping on a shout; anything higher makes normal talking peg the meter.
  const raw = Math.min(1, Math.sqrt(sum / timeBuf.length) * 3.2);
  metrics.raw = raw;
  metrics.level = smoothToward(metrics.level, raw);
  metrics.peak = Math.max(raw, metrics.peak * 0.985);

  // Downsample to a fixed point count so the radial waveform is resolution
  // independent and does not shimmer as fftSize changes across browsers.
  const stride = timeBuf.length / WAVE_POINTS;
  for (let i = 0; i < WAVE_POINTS; i += 1) {
    const start = Math.floor(i * stride);
    const end = Math.max(start + 1, Math.floor((i + 1) * stride));
    let acc = 0;
    for (let j = start; j < end; j += 1) acc += (timeBuf[j] - 128) / 128;
    const value = acc / (end - start);
    metrics.wave[i] += (value - metrics.wave[i]) * 0.35;
  }

  // ── Frequency domain ──────────────────────────────────────────────────
  analyser.getByteFrequencyData(freqBuf);
  // Speech energy sits in the lower ~45% of the spectrum; sampling the whole
  // range would render the upper half as permanently dead bars.
  const usable = Math.floor(freqBuf.length * 0.45);
  const per = Math.max(1, Math.floor(usable / BANDS));
  let spread = 0;
  for (let b = 0; b < BANDS; b += 1) {
    let acc = 0;
    for (let i = 0; i < per; i += 1) acc += freqBuf[b * per + i] ?? 0;
    const target = Math.min(1, acc / per / 190);
    metrics.bands[b] = smoothToward(metrics.bands[b], target);
    spread += metrics.bands[b];
  }
  spread /= BANDS;

  metrics.energy = Math.min(1, metrics.level * 0.7 + spread * 0.6);

  if (state.recording) state.envelope.push(raw);
}

async function open() {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
  });

  state.stream = stream;

  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  const ctx = new AudioCtx();
  // Autoplay policy can hand back a suspended context even after a gesture.
  if (ctx.state === 'suspended') await ctx.resume().catch(() => {});

  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  // Light native smoothing only — the envelope above does the expressive work.
  analyser.smoothingTimeConstant = 0.6;

  const source = ctx.createMediaStreamSource(stream);
  source.connect(analyser);
  // Deliberately not connected to ctx.destination: routing the mic to the
  // speakers would feed back.

  state.ctx = ctx;
  state.analyser = analyser;
  state.source = source;
  state.timeBuf = new Uint8Array(analyser.fftSize);
  state.freqBuf = new Uint8Array(analyser.frequencyBinCount);

  metrics.active = true;
  state.raf = requestAnimationFrame(loop);
  emit('started');

  return stream;
}

export function isSupported() {
  return (
    typeof window !== 'undefined' &&
    Boolean(navigator?.mediaDevices?.getUserMedia) &&
    Boolean(window.AudioContext || window.webkitAudioContext)
  );
}

/**
 * Take a reference on the microphone. Resolves with the live MediaStream,
 * which MediaRecorder can attach to directly — the visualiser and the
 * recorder share one stream.
 */
export function acquire() {
  state.refs += 1;

  if (state.stream) return Promise.resolve(state.stream);
  if (state.pending) return state.pending;

  state.pending = open()
    .catch((err) => {
      // Roll the reference back so a failed attempt does not pin the engine
      // open and block a later retry.
      state.refs = Math.max(0, state.refs - 1);
      state.pending = null;
      emit('error', err);
      throw err;
    })
    .then((stream) => {
      state.pending = null;
      return stream;
    });

  return state.pending;
}

/** Drop a reference. The stream closes when the last one goes. */
export function release() {
  state.refs = Math.max(0, state.refs - 1);
  if (state.refs > 0) return;

  cancelAnimationFrame(state.raf);
  state.raf = 0;

  state.stream?.getTracks().forEach((track) => track.stop());
  try {
    state.source?.disconnect();
  } catch {
    /* already disconnected */
  }
  if (state.ctx && state.ctx.state !== 'closed') state.ctx.close().catch(() => {});

  state.stream = null;
  state.ctx = null;
  state.analyser = null;
  state.source = null;
  state.timeBuf = null;
  state.freqBuf = null;
  state.recording = false;

  resetMetrics();
  emit('stopped');
}

export function getStream() {
  return state.stream;
}

/** Amplitude envelope capture, for the memory-formation animation. */
export function beginEnvelope() {
  state.envelope = [];
  state.recording = true;
}

export function endEnvelope() {
  state.recording = false;
  return state.envelope.slice();
}

/** Human-readable reason a getUserMedia attempt failed. */
export function describeError(err) {
  if (err?.name === 'NotAllowedError' || err?.name === 'SecurityError') {
    return 'Microphone permission denied. Allow mic access in your browser to record.';
  }
  if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') {
    return 'No microphone found. Connect an input device and try again.';
  }
  if (err?.name === 'NotReadableError') {
    return 'The microphone is in use by another application.';
  }
  return 'The microphone could not be opened.';
}
