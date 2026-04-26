/*
 * SignalProcessing.tsx — Bauhaus Frequency Design
 * Waveform generator, oscilloscope, FFT spectrum, filter explorer
 * Uses Web Audio API + Canvas for real-time visualization
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type WaveType = "sine" | "square" | "sawtooth" | "triangle" | "custom";
type FilterType = "lowpass" | "highpass" | "bandpass" | "notch";

// ─── Waveform math ────────────────────────────────────────────────────────────

function generateWaveform(type: WaveType, frequency: number, amplitude: number, phase: number, samples: number): Float32Array {
  const buffer = new Float32Array(samples);
  for (let i = 0; i < samples; i++) {
    const t = i / samples;
    const angle = 2 * Math.PI * frequency * t + phase;
    switch (type) {
      case "sine":
        buffer[i] = amplitude * Math.sin(angle);
        break;
      case "square":
        buffer[i] = amplitude * Math.sign(Math.sin(angle));
        break;
      case "sawtooth":
        buffer[i] = amplitude * (2 * ((frequency * t + phase / (2 * Math.PI)) % 1) - 1);
        break;
      case "triangle":
        buffer[i] = amplitude * (2 / Math.PI) * Math.asin(Math.sin(angle));
        break;
      case "custom": {
        // Additive synthesis: fundamental + harmonics
        let val = 0;
        for (let h = 1; h <= 7; h += 2) {
          val += (1 / h) * Math.sin(h * angle);
        }
        buffer[i] = amplitude * val * (4 / Math.PI) * 0.5;
        break;
      }
    }
  }
  return buffer;
}

// Simple DFT for visualization (not full FFT but sufficient for display)
function computeFFT(signal: Float32Array, bins: number): Float32Array {
  const N = signal.length;
  const result = new Float32Array(bins);
  for (let k = 0; k < bins; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += signal[n] * Math.cos(angle);
      im -= signal[n] * Math.sin(angle);
    }
    result[k] = Math.sqrt(re * re + im * im) / N;
  }
  return result;
}

// ─── Canvas drawing utilities ─────────────────────────────────────────────────

function drawOscilloscope(
  canvas: HTMLCanvasElement,
  signal: Float32Array,
  color: string,
  bgColor: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "rgba(0,212,255,0.1)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (H / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  for (let i = 0; i <= 8; i++) {
    const x = (W / 8) * i;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
    ctx.stroke();
  }

  // Zero line
  ctx.strokeStyle = "rgba(255,255,255,0.15)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();

  // Waveform
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.shadowBlur = 6;
  ctx.shadowColor = color;
  ctx.beginPath();
  const step = W / signal.length;
  for (let i = 0; i < signal.length; i++) {
    const x = i * step;
    const y = H / 2 - (signal[i] * H * 0.4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;
}

function drawSpectrum(
  canvas: HTMLCanvasElement,
  spectrum: Float32Array,
  color1: string,
  color2: string,
  bgColor: string
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Grid lines
  ctx.strokeStyle = "rgba(0,212,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (H / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  const bins = spectrum.length;
  const barW = W / bins - 1;
  const maxVal = Math.max(...Array.from(spectrum), 0.001);

  for (let i = 0; i < bins; i++) {
    const normalized = spectrum[i] / maxVal;
    const barH = normalized * H * 0.9;
    const x = i * (W / bins);
    const t = i / bins;
    // Gradient from cyan to orange
    const r = Math.round(0 + t * 255);
    const g = Math.round(212 - t * 130);
    const b = Math.round(255 - t * 224);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(x, H - barH, barW, barH);
  }
}

// ─── Filter frequency response ────────────────────────────────────────────────

function filterResponse(type: FilterType, freq: number, cutoff: number, Q: number): number {
  const w = freq / cutoff;
  switch (type) {
    case "lowpass": {
      const denom = Math.sqrt(Math.pow(1 - w * w, 2) + Math.pow(w / Q, 2));
      return Math.min(1, 1 / denom);
    }
    case "highpass": {
      const denom = Math.sqrt(Math.pow(1 - 1 / (w * w), 2) + Math.pow(1 / (w * Q), 2));
      return Math.min(1, 1 / denom);
    }
    case "bandpass": {
      const denom = Math.sqrt(1 + Math.pow(Q * (w - 1 / w), 2));
      return Math.min(1, 1 / denom);
    }
    case "notch": {
      const num = Math.abs(w * w - 1);
      const denom = Math.sqrt(Math.pow(w * w - 1, 2) + Math.pow(w / Q, 2));
      return Math.min(1, num / denom);
    }
    default:
      return 1;
  }
}

function drawFilterResponse(
  canvas: HTMLCanvasElement,
  type: FilterType,
  cutoff: number,
  Q: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = "#0d1829";
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = "rgba(0,212,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (H / 4) * i;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }

  // dB labels
  ctx.fillStyle = "rgba(138,155,176,0.6)";
  ctx.font = "10px IBM Plex Mono, monospace";
  ["0 dB", "-12 dB", "-24 dB", "-36 dB"].forEach((label, i) => {
    ctx.fillText(label, 4, (H / 4) * i + 12);
  });

  // Filter curve
  ctx.strokeStyle = "#00d4ff";
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#00d4ff";
  ctx.beginPath();
  const freqMin = 20, freqMax = 20000;
  for (let px = 0; px < W; px++) {
    const logFreq = freqMin * Math.pow(freqMax / freqMin, px / W);
    const gain = filterResponse(type, logFreq, cutoff, Q);
    const dB = 20 * Math.log10(Math.max(gain, 0.0001));
    const y = H / 2 - (dB / 40) * H * 0.8;
    if (px === 0) ctx.moveTo(px, Math.max(0, Math.min(H, y)));
    else ctx.lineTo(px, Math.max(0, Math.min(H, y)));
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Cutoff marker
  const cutoffX = W * Math.log(cutoff / freqMin) / Math.log(freqMax / freqMin);
  ctx.strokeStyle = "rgba(255,79,31,0.6)";
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(cutoffX, 0);
  ctx.lineTo(cutoffX, H);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#ff4f1f";
  ctx.font = "10px IBM Plex Mono, monospace";
  ctx.fillText(`${cutoff} Hz`, cutoffX + 4, H - 8);
}

// ─── Waveform info ────────────────────────────────────────────────────────────

const WAVEFORM_INFO: Record<WaveType, { label: string; description: string; harmonics: string; icon: string }> = {
  sine: {
    label: "Sine Wave",
    description: "The purest waveform — a single frequency with no harmonics. All other waveforms can be decomposed into sums of sine waves (Fourier theorem). Sounds like a pure tone.",
    harmonics: "Fundamental only (1f)",
    icon: "∿",
  },
  square: {
    label: "Square Wave",
    description: "Contains only odd harmonics (1f, 3f, 5f, 7f...) with amplitudes 1/n. Sounds buzzy, hollow. Used in classic synthesizers and chiptune music.",
    harmonics: "Odd harmonics: 1f + 1/3(3f) + 1/5(5f) + ...",
    icon: "⊓",
  },
  sawtooth: {
    label: "Sawtooth Wave",
    description: "Contains all harmonics (1f, 2f, 3f...) with amplitudes 1/n. Rich, bright, buzzy sound. The basis of many synthesizer patches and brass emulation.",
    harmonics: "All harmonics: 1f + 1/2(2f) + 1/3(3f) + ...",
    icon: "⋀",
  },
  triangle: {
    label: "Triangle Wave",
    description: "Contains only odd harmonics like square wave, but amplitudes fall off as 1/n². Softer than square, more hollow than sine. Used for flute-like tones.",
    harmonics: "Odd harmonics: 1f - 1/9(3f) + 1/25(5f) - ...",
    icon: "△",
  },
  custom: {
    label: "Additive Synthesis",
    description: "Demonstrates Fourier synthesis by adding odd harmonics with decreasing amplitude. Shows how complex waveforms emerge from simple sine wave combinations.",
    harmonics: "Partial series: Σ (1/n)·sin(n·ω·t) for odd n",
    icon: "Σ",
  },
};

const FILTER_INFO: Record<FilterType, { label: string; description: string; use: string }> = {
  lowpass: {
    label: "Low-Pass Filter",
    description: "Passes frequencies below the cutoff, attenuates above. The most common filter in audio processing. Used to remove harshness, simulate distance, and shape tone.",
    use: "Bass enhancement, anti-aliasing, removing high-frequency noise",
  },
  highpass: {
    label: "High-Pass Filter",
    description: "Passes frequencies above the cutoff, attenuates below. Removes rumble and low-frequency noise. Essential for mixing to prevent muddiness.",
    use: "Removing low-frequency rumble, thinning out instruments, kick drum separation",
  },
  bandpass: {
    label: "Band-Pass Filter",
    description: "Passes a band of frequencies around the cutoff, attenuates both above and below. Q factor controls bandwidth. Creates telephone or radio effects.",
    use: "Wah-wah effects, formant synthesis, isolating specific frequency ranges",
  },
  notch: {
    label: "Notch (Band-Reject) Filter",
    description: "Attenuates a narrow band of frequencies. Used to remove specific interference (e.g., 50/60 Hz hum) while leaving the rest of the signal intact.",
    use: "Removing 60 Hz hum, feedback elimination, surgical EQ",
  },
};

// ─── Main Page ────────────────────────────────────────────────────────────────

type SPTab = "oscilloscope" | "spectrum" | "filters" | "theory";

export default function SignalProcessing() {
  const [activeTab, setActiveTab] = useState<SPTab>("oscilloscope");
  const [waveType, setWaveType] = useState<WaveType>("sine");
  const [frequency, setFrequency] = useState(440);
  const [amplitude, setAmplitude] = useState(0.8);
  const [phase, setPhase] = useState(0);
  const [filterType, setFilterType] = useState<FilterType>("lowpass");
  const [cutoffFreq, setCutoffFreq] = useState(1000);
  const [qFactor, setQFactor] = useState(1.0);
  const [isPlaying, setIsPlaying] = useState(false);

  const oscCanvasRef = useRef<HTMLCanvasElement>(null);
  const specCanvasRef = useRef<HTMLCanvasElement>(null);
  const filterCanvasRef = useRef<HTMLCanvasElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const oscNodeRef = useRef<OscillatorNode | null>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const animFrameRef = useRef<number>(0);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  // Draw waveform on canvas
  useEffect(() => {
    if (activeTab !== "oscilloscope" && activeTab !== "spectrum") return;
    const samples = 512;
    const signal = generateWaveform(waveType, 3, amplitude, phase, samples);

    const drawAll = () => {
      if (oscCanvasRef.current && activeTab === "oscilloscope") {
        const canvas = oscCanvasRef.current;
        canvas.width = canvas.offsetWidth || 700;
        canvas.height = 220;
        drawOscilloscope(canvas, signal, "#ff4f1f", "#0d1829");
      }
      if (specCanvasRef.current && activeTab === "spectrum") {
        const canvas = specCanvasRef.current;
        canvas.width = canvas.offsetWidth || 700;
        canvas.height = 220;
        const fftBins = 64;
        const fftSignal = generateWaveform(waveType, frequency / 100, amplitude, phase, 1024);
        const spectrum = computeFFT(fftSignal, fftBins);
        drawSpectrum(canvas, spectrum, "#00d4ff", "#ff4f1f", "#0d1829");
      }
    };
    // Small delay to ensure DOM is ready
    const timer = setTimeout(drawAll, 10);
    return () => clearTimeout(timer);
  }, [activeTab, waveType, frequency, amplitude, phase]);

  // Draw filter response
  useEffect(() => {
    if (activeTab !== "filters") return;
    const draw = () => {
      if (filterCanvasRef.current) {
        const canvas = filterCanvasRef.current;
        canvas.width = canvas.offsetWidth || 700;
        canvas.height = 220;
        drawFilterResponse(canvas, filterType, cutoffFreq, qFactor);
      }
    };
    const timer = setTimeout(draw, 10);
    return () => clearTimeout(timer);
  }, [activeTab, filterType, cutoffFreq, qFactor]);

  // Audio playback
  const togglePlay = () => {
    const ctx = getAudioCtx();
    if (isPlaying) {
      oscNodeRef.current?.stop();
      oscNodeRef.current = null;
      setIsPlaying(false);
    } else {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.type = waveType === "custom" ? "sawtooth" : waveType;
      osc.frequency.setValueAtTime(frequency, ctx.currentTime);
      gain.gain.setValueAtTime(amplitude * 0.3, ctx.currentTime);
      osc.start();
      oscNodeRef.current = osc;
      gainNodeRef.current = gain;
      setIsPlaying(true);
    }
  };

  // Update oscillator when params change
  useEffect(() => {
    if (oscNodeRef.current && gainNodeRef.current && audioCtxRef.current) {
      oscNodeRef.current.frequency.setValueAtTime(frequency, audioCtxRef.current.currentTime);
      gainNodeRef.current.gain.setValueAtTime(amplitude * 0.3, audioCtxRef.current.currentTime);
    }
  }, [frequency, amplitude]);

  // Cleanup
  useEffect(() => {
    return () => {
      oscNodeRef.current?.stop();
      cancelAnimationFrame(animFrameRef.current);
    };
  }, []);

  const tabs: { id: SPTab; label: string }[] = [
    { id: "oscilloscope", label: "Oscilloscope" },
    { id: "spectrum", label: "FFT Spectrum" },
    { id: "filters", label: "Filters" },
    { id: "theory", label: "Theory" },
  ];

  const waveTypes: WaveType[] = ["sine", "square", "sawtooth", "triangle", "custom"];

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div
        className="px-8 py-6"
        style={{ background: "#1a2744", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
      >
        <div className="flex items-center gap-3 mb-1">
          <span
            className="text-xs font-medium"
            style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            MODULE 02
          </span>
        </div>
        <h1
          className="text-3xl font-bold text-white"
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          Signal Processing
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8a9bb0" }}>
          Waveforms · Oscilloscope · FFT Spectrum Analysis · Filter Design
        </p>
      </div>

      <div className="px-8 py-6">
        {/* Tabs */}
        <div
          className="flex gap-1 mb-6 p-1 rounded"
          style={{ background: "white", border: "1px solid #e8e4dc", display: "inline-flex" }}
        >
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="px-4 py-2 rounded text-sm font-medium transition-all"
              style={{
                background: activeTab === tab.id ? "#1a2744" : "transparent",
                color: activeTab === tab.id ? "white" : "#8a9bb0",
                fontFamily: "'DM Sans', sans-serif",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── OSCILLOSCOPE ── */}
        {(activeTab === "oscilloscope" || activeTab === "spectrum") && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            {/* Controls */}
            <div className="space-y-4">
              {/* Waveform type */}
              <div className="module-card rounded p-4">
                <div
                  className="text-xs font-medium mb-3 uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Waveform
                </div>
                <div className="space-y-1">
                  {waveTypes.map((wt) => (
                    <button
                      key={wt}
                      onClick={() => setWaveType(wt)}
                      className="w-full text-left px-3 py-2 rounded text-sm transition-all flex items-center gap-2"
                      style={{
                        background: waveType === wt ? "rgba(0,212,255,0.1)" : "transparent",
                        color: waveType === wt ? "#00d4ff" : "#1a2744",
                        borderLeft: waveType === wt ? "3px solid #00d4ff" : "3px solid transparent",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      <span
                        className="w-6 text-center font-bold"
                        style={{ fontFamily: "'IBM Plex Mono', monospace" }}
                      >
                        {WAVEFORM_INFO[wt].icon}
                      </span>
                      {WAVEFORM_INFO[wt].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Parameters */}
              <div className="module-card rounded p-4 space-y-4">
                <div
                  className="text-xs font-medium uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Parameters
                </div>

                {/* Frequency */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs" style={{ color: "#4a5568" }}>Frequency</label>
                    <span
                      className="text-xs font-bold"
                      style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {frequency} Hz
                    </span>
                  </div>
                  <input
                    type="range"
                    min={20}
                    max={2000}
                    value={frequency}
                    onChange={(e) => setFrequency(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "#00d4ff" }}
                  />
                </div>

                {/* Amplitude */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs" style={{ color: "#4a5568" }}>Amplitude</label>
                    <span
                      className="text-xs font-bold"
                      style={{ color: "#ff4f1f", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {amplitude.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1.0}
                    step={0.01}
                    value={amplitude}
                    onChange={(e) => setAmplitude(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "#ff4f1f" }}
                  />
                </div>

                {/* Phase */}
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs" style={{ color: "#4a5568" }}>Phase</label>
                    <span
                      className="text-xs font-bold"
                      style={{ color: "#a78bfa", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {((phase / Math.PI) * 180).toFixed(0)}°
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={2 * Math.PI}
                    step={0.01}
                    value={phase}
                    onChange={(e) => setPhase(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "#a78bfa" }}
                  />
                </div>

                <button
                  onClick={togglePlay}
                  className="w-full py-2 rounded text-sm font-medium transition-all"
                  style={{
                    background: isPlaying ? "#ff4f1f" : "#1a2744",
                    color: "white",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {isPlaying ? "⏹ Stop" : "▶ Play Tone"}
                </button>
              </div>
            </div>

            {/* Canvas + info */}
            <div className="lg:col-span-3 space-y-4">
              {/* Canvas */}
              <div
                className="rounded overflow-hidden"
                style={{ background: "#0d1829", border: "1px solid rgba(0,212,255,0.2)" }}
              >
                <div
                  className="px-4 py-2 flex items-center justify-between"
                  style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}
                >
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {activeTab === "oscilloscope" ? "TIME DOMAIN" : "FREQUENCY DOMAIN (FFT)"}
                  </span>
                  <div className="flex gap-3 text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
                    <span>{frequency} Hz</span>
                    <span>A={amplitude.toFixed(2)}</span>
                    <span>φ={((phase / Math.PI) * 180).toFixed(0)}°</span>
                  </div>
                </div>
                {activeTab === "oscilloscope" ? (
                  <canvas
                    ref={oscCanvasRef}
                    width={700}
                    height={220}
                    className="w-full"
                    style={{ display: "block" }}
                  />
                ) : (
                  <canvas
                    ref={specCanvasRef}
                    width={700}
                    height={220}
                    className="w-full"
                    style={{ display: "block" }}
                  />
                )}
              </div>

              {/* Waveform info */}
              <div className="module-card rounded p-5">
                <div className="flex items-start gap-4">
                  <div
                    className="w-12 h-12 rounded flex items-center justify-center text-2xl flex-shrink-0"
                    style={{ background: "rgba(0,212,255,0.1)", color: "#00d4ff" }}
                  >
                    {WAVEFORM_INFO[waveType].icon}
                  </div>
                  <div>
                    <h3
                      className="text-lg font-bold mb-1"
                      style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                    >
                      {WAVEFORM_INFO[waveType].label}
                    </h3>
                    <p className="text-sm leading-relaxed mb-2" style={{ color: "#4a5568" }}>
                      {WAVEFORM_INFO[waveType].description}
                    </p>
                    <div
                      className="text-xs px-3 py-1.5 rounded inline-block"
                      style={{
                        background: "rgba(0,212,255,0.08)",
                        color: "#00d4ff",
                        border: "1px solid rgba(0,212,255,0.2)",
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {WAVEFORM_INFO[waveType].harmonics}
                    </div>
                  </div>
                </div>
              </div>

              {/* Signal metrics */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: "Period", value: `${(1000 / frequency).toFixed(2)} ms`, color: "#ff4f1f" },
                  { label: "Angular Freq (ω)", value: `${(2 * Math.PI * frequency).toFixed(1)} rad/s`, color: "#00d4ff" },
                  { label: "Wavelength (air)", value: `${(343 / frequency).toFixed(3)} m`, color: "#a78bfa" },
                ].map(({ label, value, color }) => (
                  <div
                    key={label}
                    className="module-card rounded p-3 text-center"
                  >
                    <div
                      className="text-sm font-bold mb-1"
                      style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {value}
                    </div>
                    <div className="text-xs" style={{ color: "#8a9bb0" }}>{label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── FILTERS ── */}
        {activeTab === "filters" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="space-y-4">
              {/* Filter type */}
              <div className="module-card rounded p-4">
                <div
                  className="text-xs font-medium mb-3 uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Filter Type
                </div>
                <div className="space-y-1">
                  {(["lowpass", "highpass", "bandpass", "notch"] as FilterType[]).map((ft) => (
                    <button
                      key={ft}
                      onClick={() => setFilterType(ft)}
                      className="w-full text-left px-3 py-2 rounded text-sm transition-all"
                      style={{
                        background: filterType === ft ? "rgba(0,212,255,0.1)" : "transparent",
                        color: filterType === ft ? "#00d4ff" : "#1a2744",
                        borderLeft: filterType === ft ? "3px solid #00d4ff" : "3px solid transparent",
                        fontFamily: "'DM Sans', sans-serif",
                      }}
                    >
                      {FILTER_INFO[ft].label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter params */}
              <div className="module-card rounded p-4 space-y-4">
                <div
                  className="text-xs font-medium uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Parameters
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs" style={{ color: "#4a5568" }}>Cutoff Frequency</label>
                    <span
                      className="text-xs font-bold"
                      style={{ color: "#ff4f1f", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {cutoffFreq} Hz
                    </span>
                  </div>
                  <input
                    type="range"
                    min={50}
                    max={10000}
                    value={cutoffFreq}
                    onChange={(e) => setCutoffFreq(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "#ff4f1f" }}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs" style={{ color: "#4a5568" }}>Q Factor (Resonance)</label>
                    <span
                      className="text-xs font-bold"
                      style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {qFactor.toFixed(1)}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={10}
                    step={0.1}
                    value={qFactor}
                    onChange={(e) => setQFactor(Number(e.target.value))}
                    className="w-full"
                    style={{ accentColor: "#00d4ff" }}
                  />
                </div>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-4">
              {/* Filter canvas */}
              <div
                className="rounded overflow-hidden"
                style={{ background: "#0d1829", border: "1px solid rgba(0,212,255,0.2)" }}
              >
                <div
                  className="px-4 py-2 flex items-center justify-between"
                  style={{ borderBottom: "1px solid rgba(0,212,255,0.1)" }}
                >
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    FREQUENCY RESPONSE — {FILTER_INFO[filterType].label.toUpperCase()}
                  </span>
                  <span
                    className="text-xs"
                    style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    fc={cutoffFreq} Hz · Q={qFactor.toFixed(1)}
                  </span>
                </div>
                <canvas
                  ref={filterCanvasRef}
                  width={700}
                  height={220}
                  className="w-full"
                  style={{ display: "block" }}
                />
              </div>

              {/* Filter info */}
              <div className="module-card rounded p-5">
                <h3
                  className="text-lg font-bold mb-2"
                  style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                >
                  {FILTER_INFO[filterType].label}
                </h3>
                <p className="text-sm leading-relaxed mb-3" style={{ color: "#4a5568" }}>
                  {FILTER_INFO[filterType].description}
                </p>
                <div
                  className="text-xs px-3 py-1.5 rounded inline-block"
                  style={{
                    background: "rgba(0,212,255,0.08)",
                    color: "#00d4ff",
                    border: "1px solid rgba(0,212,255,0.2)",
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  Use: {FILTER_INFO[filterType].use}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── THEORY TAB ── */}
        {activeTab === "theory" && (
          <div className="space-y-6 max-w-3xl">
            {[
              {
                title: "Fourier's Theorem",
                content: "Any periodic waveform can be decomposed into a sum of sine waves at integer multiples of the fundamental frequency. This is the mathematical foundation of all signal processing. The Fourier Transform converts a time-domain signal into its frequency-domain representation, revealing which frequencies are present and at what amplitudes.",
                formula: "f(t) = a₀ + Σ [aₙcos(nωt) + bₙsin(nωt)]",
                accent: "#ff4f1f",
              },
              {
                title: "Nyquist-Shannon Sampling Theorem",
                content: "To accurately represent a signal digitally, the sampling rate must be at least twice the highest frequency in the signal. CD audio uses 44,100 Hz to capture frequencies up to 22,050 Hz — just above the upper limit of human hearing. Sampling below the Nyquist rate causes aliasing, where high frequencies are misrepresented as lower ones.",
                formula: "fs ≥ 2 · fmax",
                accent: "#00d4ff",
              },
              {
                title: "Decibel Scale",
                content: "Sound intensity is measured on a logarithmic scale because human hearing perceives loudness logarithmically (Weber-Fechner Law). A 10 dB increase represents a 10× increase in intensity but sounds approximately twice as loud. The reference level (0 dB SPL) corresponds to the threshold of human hearing at 1 kHz.",
                formula: "L = 20 · log₁₀(p / p₀)  where p₀ = 20 μPa",
                accent: "#a78bfa",
              },
              {
                title: "Filter Roll-Off",
                content: "A first-order filter attenuates at 6 dB per octave (20 dB/decade) beyond the cutoff frequency. A second-order filter (biquad) rolls off at 12 dB/octave. The Q factor determines the sharpness of the filter — higher Q creates a resonant peak at the cutoff frequency before the roll-off begins.",
                formula: "H(jω) = ω₀² / (ω₀² + jω·ω₀/Q - ω²)",
                accent: "#fbbf24",
              },
            ].map(({ title, content, formula, accent }) => (
              <div key={title} className="module-card rounded p-5">
                <div
                  className="w-1 h-6 rounded mb-3"
                  style={{ background: accent }}
                />
                <h3
                  className="text-lg font-bold mb-2"
                  style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                >
                  {title}
                </h3>
                <p className="text-sm leading-relaxed mb-3" style={{ color: "#4a5568" }}>
                  {content}
                </p>
                <div
                  className="text-sm px-4 py-2.5 rounded font-medium"
                  style={{
                    background: `${accent}10`,
                    color: accent,
                    border: `1px solid ${accent}30`,
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}
                >
                  {formula}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
