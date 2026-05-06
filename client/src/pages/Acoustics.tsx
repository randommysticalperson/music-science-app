/*
 * Acoustics.tsx — Bauhaus Frequency Design
 * Theory of Sound: Mechanical Waves, Propagation, Doppler, Resonance, dB Scale
 * Based on: https://www.newton.com.tw/wiki/聲學
 */
import { useState, useEffect, useRef, useCallback } from "react";
import { useLang } from "../contexts/LanguageContext";

// ─── Acoustics constants ──────────────────────────────────────────────────────

const SPEED_OF_SOUND: Record<string, { medium: string; speed: number; unit: string; note: string }> = {
  air_0: { medium: "Air (0°C)", speed: 331, unit: "m/s", note: "Dry air at 0°C" },
  air_20: { medium: "Air (20°C)", speed: 343, unit: "m/s", note: "Standard room temperature" },
  water: { medium: "Fresh Water", speed: 1482, unit: "m/s", note: "At 20°C" },
  seawater: { medium: "Sea Water", speed: 1531, unit: "m/s", note: "At 20°C, 35‰ salinity" },
  steel: { medium: "Steel", speed: 5960, unit: "m/s", note: "Longitudinal wave" },
  glass: { medium: "Glass", speed: 5640, unit: "m/s", note: "Borosilicate" },
  wood: { medium: "Wood (Oak)", speed: 3850, unit: "m/s", note: "Along grain" },
  rubber: { medium: "Rubber", speed: 60, unit: "m/s", note: "Soft rubber" },
};

const DB_SCALE = [
  { level: 0, label: "Threshold of Hearing", example: "Absolute silence", color: "#8a9bb0" },
  { level: 10, label: "Rustling Leaves", example: "Barely audible", color: "#8a9bb0" },
  { level: 20, label: "Whisper", example: "Quiet library", color: "#a78bfa" },
  { level: 30, label: "Quiet Room", example: "Bedroom at night", color: "#a78bfa" },
  { level: 40, label: "Library", example: "Soft background noise", color: "#a78bfa" },
  { level: 50, label: "Moderate Rainfall", example: "Normal conversation distance", color: "#00d4ff" },
  { level: 60, label: "Normal Conversation", example: "1 meter away", color: "#00d4ff" },
  { level: 70, label: "Vacuum Cleaner", example: "Hearing damage begins with prolonged exposure", color: "#fbbf24" },
  { level: 80, label: "Heavy Traffic", example: "City street", color: "#fbbf24" },
  { level: 90, label: "Lawnmower", example: "OSHA limit: 8 hrs/day", color: "#fb923c" },
  { level: 100, label: "Chainsaw", example: "2 hrs/day max", color: "#f97316" },
  { level: 110, label: "Rock Concert", example: "30 min/day max", color: "#ff4f1f" },
  { level: 120, label: "Jet Engine (100m)", example: "Immediate danger", color: "#ff4f1f" },
  { level: 130, label: "Threshold of Pain", example: "Physical pain", color: "#dc2626" },
  { level: 140, label: "Gunshot", example: "Immediate hearing damage", color: "#dc2626" },
];

// ─── Wave animation canvas ────────────────────────────────────────────────────

function drawLongitudinalWave(
  canvas: HTMLCanvasElement,
  time: number,
  frequency: number,
  amplitude: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = "#0d1829";
  ctx.fillRect(0, 0, W, H);

  const numParticles = 80;
  const spacing = W / numParticles;
  const wavelength = W / (frequency * 0.5);

  // Draw particles
  for (let i = 0; i < numParticles; i++) {
    const baseX = i * spacing + spacing / 2;
    const displacement = amplitude * 20 * Math.sin((2 * Math.PI * baseX) / wavelength - time * 0.05);
    const x = baseX + displacement;
    const density = Math.abs(Math.sin((2 * Math.PI * baseX) / wavelength - time * 0.05));

    // Color based on compression/rarefaction
    const r = Math.round(0 + density * 255);
    const g = Math.round(212 - density * 130);
    const b = Math.round(255 - density * 224);
    ctx.fillStyle = `rgba(${r},${g},${b},0.8)`;
    const size = 3 + density * 3;
    ctx.beginPath();
    ctx.arc(x, H / 2, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Labels
  ctx.fillStyle = "rgba(255,79,31,0.8)";
  ctx.font = "10px IBM Plex Mono, monospace";
  ctx.fillText("Compression", W * 0.15, H - 12);
  ctx.fillStyle = "rgba(0,212,255,0.8)";
  ctx.fillText("Rarefaction", W * 0.55, H - 12);

  // Wavelength arrow
  ctx.strokeStyle = "rgba(255,255,255,0.3)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(W * 0.1, H * 0.15);
  ctx.lineTo(W * 0.1 + wavelength, H * 0.15);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.font = "10px IBM Plex Mono, monospace";
  ctx.fillText("λ (wavelength)", W * 0.1 + wavelength / 2 - 40, H * 0.12);
}

function drawTransverseWave(
  canvas: HTMLCanvasElement,
  time: number,
  frequency: number,
  amplitude: number
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;
  ctx.fillStyle = "#0d1829";
  ctx.fillRect(0, 0, W, H);

  const wavelength = W / (frequency * 0.4);

  // Draw wave
  ctx.strokeStyle = "#ff4f1f";
  ctx.lineWidth = 2.5;
  ctx.shadowBlur = 8;
  ctx.shadowColor = "#ff4f1f";
  ctx.beginPath();
  for (let x = 0; x < W; x++) {
    const y = H / 2 + amplitude * 60 * Math.sin((2 * Math.PI * x) / wavelength - time * 0.05);
    if (x === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.shadowBlur = 0;

  // Amplitude marker
  ctx.strokeStyle = "rgba(0,212,255,0.5)";
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.beginPath();
  ctx.moveTo(30, H / 2 - amplitude * 60);
  ctx.lineTo(30, H / 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "rgba(0,212,255,0.8)";
  ctx.font = "10px IBM Plex Mono, monospace";
  ctx.fillText("A", 34, H / 2 - amplitude * 30);

  // Zero line
  ctx.strokeStyle = "rgba(255,255,255,0.1)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, H / 2);
  ctx.lineTo(W, H / 2);
  ctx.stroke();
}

// ─── Doppler calculator ───────────────────────────────────────────────────────

function dopplerFrequency(
  sourceFreq: number,
  sourceVelocity: number, // + = moving toward observer
  observerVelocity: number, // + = moving toward source
  soundSpeed: number
): number {
  return sourceFreq * (soundSpeed + observerVelocity) / (soundSpeed - sourceVelocity);
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type AcTab = "waves" | "doppler" | "decibels" | "resonance" | "history";

export default function Acoustics() {
  const [activeTab, setActiveTab] = useState<AcTab>("waves");
  const [waveMode, setWaveMode] = useState<"longitudinal" | "transverse">("longitudinal");
  const [waveFreq, setWaveFreq] = useState(2);
  const [waveAmp, setWaveAmp] = useState(0.7);
  const [animTime, setAnimTime] = useState(0);
  const [isAnimating, setIsAnimating] = useState(true);

  // Doppler
  const [sourceFreq, setSourceFreq] = useState(440);
  const [sourceVelocity, setSourceVelocity] = useState(30);
  const [observerVelocity, setObserverVelocity] = useState(0);
  const [soundSpeed, setSoundSpeed] = useState(343);

  // Resonance
  const [stringLength, setStringLength] = useState(1.0);
  const [stringTension, setStringTension] = useState(100);
  const [stringDensity, setStringDensity] = useState(0.001);

  const waveCanvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const timeRef = useRef(0);

  // Animation loop
  useEffect(() => {
    if (!isAnimating) return;
    const animate = () => {
      timeRef.current += 1;
      setAnimTime(timeRef.current);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isAnimating]);

  // Draw wave
  useEffect(() => {
    if (activeTab !== "waves") return;
    if (!waveCanvasRef.current) return;
    const canvas = waveCanvasRef.current;
    if (canvas.offsetWidth > 0) {
      canvas.width = canvas.offsetWidth;
      canvas.height = 200;
    }
    if (waveMode === "longitudinal") {
      drawLongitudinalWave(canvas, animTime, waveFreq, waveAmp);
    } else {
      drawTransverseWave(canvas, animTime, waveFreq, waveAmp);
    }
  }, [activeTab, waveMode, waveFreq, waveAmp, animTime]);

  // Doppler calculations
  const freqApproaching = dopplerFrequency(sourceFreq, sourceVelocity, observerVelocity, soundSpeed);
  const freqReceding = dopplerFrequency(sourceFreq, -sourceVelocity, observerVelocity, soundSpeed);

  // String resonance: f = (1/2L) * sqrt(T/μ)
  const fundamentalFreq = (1 / (2 * stringLength)) * Math.sqrt(stringTension / stringDensity);
  const harmonics = [1, 2, 3, 4, 5].map((n) => ({
    n,
    freq: fundamentalFreq * n,
    name: ["Fundamental", "2nd Harmonic", "3rd Harmonic", "4th Harmonic", "5th Harmonic"][n - 1],
  }));

  const { t } = useLang();

  const tabs: { id: AcTab; label: string }[] = [
    { id: "waves", label: t("acWaveTitle") },
    { id: "doppler", label: t("acDopplerTitle") },
    { id: "decibels", label: t("acDbTitle") },
    { id: "resonance", label: t("acResonanceTitle") },
    { id: "history", label: t("acHistoryTitle") },
  ];

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
            style={{ color: "#a78bfa", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            MODULE 03
          </span>
        </div>
        <h1
          className="text-3xl font-bold text-white"
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          {t("acTitle")}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8a9bb0" }}>
          {t("acSubtitle")}
        </p>
      </div>

      <div className="px-8 py-6">
        {/* Tabs */}
        <div
          className="flex flex-wrap gap-1 mb-6 p-1 rounded"
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

        {/* ── WAVE TYPES ── */}
        {activeTab === "waves" && (
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
            <div className="space-y-4">
              {/* Wave mode */}
              <div className="module-card rounded p-4">
                <div
                  className="text-xs font-medium mb-3 uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Wave Type
                </div>
                {(["longitudinal", "transverse"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setWaveMode(mode)}
                    className="w-full text-left px-3 py-2 rounded text-sm transition-all mb-1"
                    style={{
                      background: waveMode === mode ? "rgba(167,139,250,0.1)" : "transparent",
                      color: waveMode === mode ? "#a78bfa" : "#1a2744",
                      borderLeft: waveMode === mode ? "3px solid #a78bfa" : "3px solid transparent",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {mode === "longitudinal" ? "Longitudinal Wave" : "Transverse Wave"}
                  </button>
                ))}
              </div>

              {/* Controls */}
              <div className="module-card rounded p-4 space-y-4">
                <div
                  className="text-xs font-medium uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Controls
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs" style={{ color: "#4a5568" }}>Frequency</label>
                    <span
                      className="text-xs font-bold"
                      style={{ color: "#a78bfa", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {waveFreq}
                    </span>
                  </div>
                  <input
                    type="range" min={1} max={6} step={0.5} value={waveFreq}
                    onChange={(e) => setWaveFreq(Number(e.target.value))}
                    className="w-full" style={{ accentColor: "#a78bfa" }}
                  />
                </div>
                <div>
                  <div className="flex justify-between mb-1">
                    <label className="text-xs" style={{ color: "#4a5568" }}>Amplitude</label>
                    <span
                      className="text-xs font-bold"
                      style={{ color: "#ff4f1f", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {waveAmp.toFixed(2)}
                    </span>
                  </div>
                  <input
                    type="range" min={0.2} max={1.0} step={0.05} value={waveAmp}
                    onChange={(e) => setWaveAmp(Number(e.target.value))}
                    className="w-full" style={{ accentColor: "#ff4f1f" }}
                  />
                </div>
                <button
                  onClick={() => setIsAnimating(!isAnimating)}
                  className="w-full py-2 rounded text-sm font-medium"
                  style={{
                    background: isAnimating ? "#ff4f1f" : "#1a2744",
                    color: "white",
                    fontFamily: "'DM Sans', sans-serif",
                  }}
                >
                  {isAnimating ? "⏸ Pause" : "▶ Animate"}
                </button>
              </div>
            </div>

            <div className="lg:col-span-3 space-y-4">
              {/* Wave canvas */}
              <div
                className="rounded overflow-hidden"
                style={{ background: "#0d1829", border: "1px solid rgba(167,139,250,0.2)" }}
              >
                <div
                  className="px-4 py-2 flex items-center justify-between"
                  style={{ borderBottom: "1px solid rgba(167,139,250,0.1)" }}
                >
                  <span
                    className="text-xs font-medium"
                    style={{ color: "#a78bfa", fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {waveMode === "longitudinal" ? "LONGITUDINAL WAVE — PARTICLE SIMULATION" : "TRANSVERSE WAVE — DISPLACEMENT"}
                  </span>
                </div>
                <canvas
                  ref={waveCanvasRef}
                  width={700}
                  height={200}
                  className="w-full"
                  style={{ display: "block" }}
                />
              </div>

              {/* Wave description */}
              <div className="module-card rounded p-5">
                {waveMode === "longitudinal" ? (
                  <>
                    <h3
                      className="text-lg font-bold mb-2"
                      style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                    >
                      Longitudinal Waves (Sound in Air)
                    </h3>
                    <p className="text-sm leading-relaxed mb-3" style={{ color: "#4a5568" }}>
                      In a longitudinal wave, particles vibrate parallel to the direction of wave propagation. Sound in gases and liquids travels exclusively as longitudinal waves. The particles don't travel with the wave — they oscillate back and forth, creating alternating zones of compression (high pressure, particles close together) and rarefaction (low pressure, particles spread apart).
                    </p>
                    <div className="grid grid-cols-2 gap-3">
                      <div
                        className="p-3 rounded text-center"
                        style={{ background: "rgba(255,79,31,0.08)", border: "1px solid rgba(255,79,31,0.2)" }}
                      >
                        <div
                          className="text-sm font-bold mb-1"
                          style={{ color: "#ff4f1f", fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          Compression
                        </div>
                        <div className="text-xs" style={{ color: "#4a5568" }}>
                          High pressure region. Particles pushed together. Increased density.
                        </div>
                      </div>
                      <div
                        className="p-3 rounded text-center"
                        style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)" }}
                      >
                        <div
                          className="text-sm font-bold mb-1"
                          style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          Rarefaction
                        </div>
                        <div className="text-xs" style={{ color: "#4a5568" }}>
                          Low pressure region. Particles spread apart. Decreased density.
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <h3
                      className="text-lg font-bold mb-2"
                      style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                    >
                      Transverse Waves
                    </h3>
                    <p className="text-sm leading-relaxed" style={{ color: "#4a5568" }}>
                      In a transverse wave, particles vibrate perpendicular to the direction of wave propagation. Sound in solids can travel as transverse (shear) waves in addition to longitudinal waves. Electromagnetic waves (light) are also transverse. On a vibrating string, the displacement is transverse — this is why we can see the string vibrate up and down while the wave travels horizontally.
                    </p>
                  </>
                )}
              </div>

              {/* Speed of sound table */}
              <div className="module-card rounded overflow-hidden">
                <div
                  className="px-5 py-3"
                  style={{ borderBottom: "1px solid #e8e4dc" }}
                >
                  <div
                    className="text-xs font-medium uppercase tracking-widest"
                    style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    Speed of Sound in Different Media
                  </div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr style={{ background: "#f7f5f0" }}>
                        {["Medium", "Speed", "Note"].map((h) => (
                          <th
                            key={h}
                            className="px-4 py-2 text-left text-xs font-medium uppercase tracking-wide"
                            style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(SPEED_OF_SOUND).map((row) => (
                        <tr
                          key={row.medium}
                          className="transition-colors"
                          style={{ borderBottom: "1px solid #f0ede8" }}
                        >
                          <td className="px-4 py-2.5 font-medium" style={{ color: "#1a2744" }}>
                            {row.medium}
                          </td>
                          <td
                            className="px-4 py-2.5 font-bold"
                            style={{ color: "#a78bfa", fontFamily: "'IBM Plex Mono', monospace" }}
                          >
                            {row.speed} {row.unit}
                          </td>
                          <td className="px-4 py-2.5 text-xs" style={{ color: "#8a9bb0" }}>
                            {row.note}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DOPPLER ── */}
        {activeTab === "doppler" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="module-card rounded p-5">
                <h3
                  className="text-lg font-bold mb-3"
                  style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                >
                  Doppler Effect Calculator
                </h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "#4a5568" }}>
                  The Doppler effect is the change in frequency of a wave as the source and observer move relative to each other. When approaching, the perceived frequency is higher (blue shift); when receding, it is lower (red shift).
                </p>

                <div className="space-y-4">
                  {[
                    { label: "Source Frequency", value: sourceFreq, setter: setSourceFreq, min: 100, max: 2000, color: "#ff4f1f", unit: "Hz" },
                    { label: "Source Velocity (toward observer)", value: sourceVelocity, setter: setSourceVelocity, min: 0, max: 300, color: "#ff4f1f", unit: "m/s" },
                    { label: "Observer Velocity (toward source)", value: observerVelocity, setter: setObserverVelocity, min: 0, max: 100, color: "#00d4ff", unit: "m/s" },
                    { label: "Speed of Sound", value: soundSpeed, setter: setSoundSpeed, min: 300, max: 1600, color: "#a78bfa", unit: "m/s" },
                  ].map(({ label, value, setter, min, max, color, unit }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <label className="text-xs" style={{ color: "#4a5568" }}>{label}</label>
                        <span
                          className="text-xs font-bold"
                          style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          {value} {unit}
                        </span>
                      </div>
                      <input
                        type="range" min={min} max={max} value={value}
                        onChange={(e) => setter(Number(e.target.value))}
                        className="w-full" style={{ accentColor: color }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Results */}
              <div className="module-card rounded p-5">
                <div
                  className="text-xs font-medium mb-4 uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Perceived Frequency
                </div>
                <div className="space-y-4">
                  <div
                    className="p-4 rounded"
                    style={{ background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)" }}
                  >
                    <div className="text-xs mb-1" style={{ color: "#8a9bb0" }}>
                      Source Approaching Observer
                    </div>
                    <div
                      className="text-3xl font-bold"
                      style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {freqApproaching.toFixed(1)} Hz
                    </div>
                    <div className="text-xs mt-1" style={{ color: "#8a9bb0" }}>
                      +{((freqApproaching / sourceFreq - 1) * 100).toFixed(1)}% higher than source
                    </div>
                  </div>
                  <div
                    className="p-4 rounded"
                    style={{ background: "rgba(255,79,31,0.08)", border: "1px solid rgba(255,79,31,0.2)" }}
                  >
                    <div className="text-xs mb-1" style={{ color: "#8a9bb0" }}>
                      Source Receding from Observer
                    </div>
                    <div
                      className="text-3xl font-bold"
                      style={{ color: "#ff4f1f", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {freqReceding.toFixed(1)} Hz
                    </div>
                    <div className="text-xs mt-1" style={{ color: "#8a9bb0" }}>
                      -{((1 - freqReceding / sourceFreq) * 100).toFixed(1)}% lower than source
                    </div>
                  </div>
                  <div
                    className="p-3 rounded text-center"
                    style={{ background: "rgba(26,39,68,0.06)" }}
                  >
                    <div className="text-xs mb-1" style={{ color: "#8a9bb0" }}>Formula</div>
                    <div
                      className="text-sm font-medium"
                      style={{ color: "#1a2744", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      f' = f · (v + v_o) / (v - v_s)
                    </div>
                  </div>
                </div>
              </div>

              {/* Real-world examples */}
              <div className="module-card rounded p-5">
                <div
                  className="text-xs font-medium mb-3 uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Real-World Applications
                </div>
                <div className="space-y-2">
                  {[
                    { app: "Police Radar", desc: "Measures vehicle speed via reflected Doppler-shifted radio waves" },
                    { app: "Medical Ultrasound", desc: "Doppler ultrasound measures blood flow velocity in vessels" },
                    { app: "Astronomy", desc: "Redshift/blueshift reveals galaxy recession velocities (Hubble's Law)" },
                    { app: "Weather Radar", desc: "Doppler radar detects wind speed and precipitation movement" },
                    { app: "Ambulance Siren", desc: "Classic audible example — pitch drops as ambulance passes" },
                  ].map(({ app, desc }) => (
                    <div key={app} className="flex gap-3">
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                        style={{ background: "#a78bfa" }}
                      />
                      <div>
                        <span className="text-sm font-medium" style={{ color: "#1a2744" }}>{app}: </span>
                        <span className="text-sm" style={{ color: "#4a5568" }}>{desc}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── DECIBELS ── */}
        {activeTab === "decibels" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="module-card rounded p-5">
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
              >
                The Decibel Scale
              </h3>
              <p className="text-sm leading-relaxed mb-4" style={{ color: "#4a5568" }}>
                The decibel (dB) is a logarithmic unit used to express the ratio of a physical quantity relative to a reference value. For sound pressure level (SPL), the reference is 20 μPa — the threshold of human hearing at 1 kHz. The scale is logarithmic because human hearing perceives loudness logarithmically (Weber-Fechner Law): a 10 dB increase sounds approximately twice as loud, but represents a 10× increase in intensity.
              </p>
              <div
                className="p-3 rounded mb-4"
                style={{
                  background: "rgba(26,39,68,0.06)",
                  fontFamily: "'IBM Plex Mono', monospace",
                  fontSize: "0.8rem",
                  color: "#1a2744",
                }}
              >
                <div>L_p = 20 · log₁₀(p / p₀)</div>
                <div className="text-xs mt-1" style={{ color: "#8a9bb0" }}>
                  where p₀ = 20 μPa (reference pressure)
                </div>
              </div>
              <div className="space-y-1">
                {[
                  { diff: "+10 dB", effect: "10× intensity, ~2× louder" },
                  { diff: "+20 dB", effect: "100× intensity, ~4× louder" },
                  { diff: "+3 dB", effect: "2× intensity, barely noticeable" },
                  { diff: "+1 dB", effect: "Minimum perceptible change" },
                ].map(({ diff, effect }) => (
                  <div key={diff} className="flex gap-3 text-sm">
                    <span
                      className="font-bold w-16 flex-shrink-0"
                      style={{ color: "#ff4f1f", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {diff}
                    </span>
                    <span style={{ color: "#4a5568" }}>{effect}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* dB scale visualization */}
            <div className="module-card rounded p-5">
              <div
                className="text-xs font-medium mb-4 uppercase tracking-widest"
                style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
              >
                Sound Pressure Level Reference Scale
              </div>
              <div className="space-y-1.5 max-h-96 overflow-y-auto">
                {DB_SCALE.map(({ level, label, example, color }) => (
                  <div key={level} className="flex items-center gap-3">
                    <div
                      className="w-10 text-right text-xs font-bold flex-shrink-0"
                      style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {level}
                    </div>
                    <div
                      className="h-2 rounded flex-shrink-0"
                      style={{
                        width: `${(level / 140) * 120}px`,
                        background: color,
                        minWidth: 4,
                      }}
                    />
                    <div>
                      <div className="text-xs font-medium" style={{ color: "#1a2744" }}>{label}</div>
                      <div className="text-xs" style={{ color: "#8a9bb0" }}>{example}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── RESONANCE ── */}
        {activeTab === "resonance" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="module-card rounded p-5">
                <h3
                  className="text-lg font-bold mb-2"
                  style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                >
                  String Resonance Calculator
                </h3>
                <p className="text-sm leading-relaxed mb-4" style={{ color: "#4a5568" }}>
                  A vibrating string produces a fundamental frequency and a series of harmonics. The fundamental frequency depends on the string's length, tension, and linear mass density. This is the physics behind all stringed instruments.
                </p>
                <div
                  className="p-3 rounded mb-4"
                  style={{
                    background: "rgba(26,39,68,0.06)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: "0.8rem",
                    color: "#1a2744",
                  }}
                >
                  f_n = (n / 2L) · √(T / μ)
                  <div className="text-xs mt-1" style={{ color: "#8a9bb0" }}>
                    L = length, T = tension, μ = linear density
                  </div>
                </div>

                <div className="space-y-4">
                  {[
                    { label: "String Length (L)", value: stringLength, setter: setStringLength, min: 0.1, max: 2.0, step: 0.05, color: "#ff4f1f", unit: "m" },
                    { label: "Tension (T)", value: stringTension, setter: setStringTension, min: 10, max: 500, step: 10, color: "#00d4ff", unit: "N" },
                    { label: "Linear Density (μ)", value: stringDensity, setter: setStringDensity, min: 0.0001, max: 0.01, step: 0.0001, color: "#a78bfa", unit: "kg/m" },
                  ].map(({ label, value, setter, min, max, step, color, unit }) => (
                    <div key={label}>
                      <div className="flex justify-between mb-1">
                        <label className="text-xs" style={{ color: "#4a5568" }}>{label}</label>
                        <span
                          className="text-xs font-bold"
                          style={{ color, fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          {value.toFixed(4)} {unit}
                        </span>
                      </div>
                      <input
                        type="range" min={min} max={max} step={step} value={value}
                        onChange={(e) => setter(Number(e.target.value))}
                        className="w-full" style={{ accentColor: color }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              {/* Harmonics */}
              <div className="module-card rounded p-5">
                <div
                  className="text-xs font-medium mb-4 uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Harmonic Series
                </div>
                <div className="space-y-3">
                  {harmonics.map(({ n, freq, name }) => (
                    <div key={n} className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded flex items-center justify-center text-xs font-bold flex-shrink-0"
                        style={{
                          background: n === 1 ? "#ff4f1f" : "rgba(255,79,31,0.1)",
                          color: n === 1 ? "white" : "#ff4f1f",
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        {n}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-xs font-medium" style={{ color: "#1a2744" }}>{name}</span>
                          <span
                            className="text-xs font-bold"
                            style={{ color: "#ff4f1f", fontFamily: "'IBM Plex Mono', monospace" }}
                          >
                            {freq.toFixed(1)} Hz
                          </span>
                        </div>
                        <div
                          className="h-1.5 rounded"
                          style={{
                            width: `${(1 / n) * 100}%`,
                            background: n === 1 ? "#ff4f1f" : `rgba(255,79,31,${1 / n})`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Resonance theory */}
              <div className="module-card rounded p-5">
                <h3
                  className="text-base font-bold mb-2"
                  style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                >
                  What is Resonance?
                </h3>
                <p className="text-sm leading-relaxed" style={{ color: "#4a5568" }}>
                  Resonance occurs when an object vibrates at its natural frequency in response to an external vibration at the same frequency. When two tuning forks of the same pitch are placed near each other, striking one will cause the other to vibrate — this is sympathetic resonance. In architecture, resonance determines room acoustics; in music, it shapes the timbre of every instrument. The Tacoma Narrows Bridge collapse (1940) is a dramatic example of resonance in engineering.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ── HISTORY ── */}
        {activeTab === "history" && (
          <div className="max-w-3xl space-y-4">
            <div
              className="rounded overflow-hidden"
              style={{ border: "1px solid #e8e4dc" }}
            >
              <img
                src="https://d2xsxph8kpxj0f.cloudfront.net/310519663332318761/MqmpMppxQBiZG8tv7iSXFX/hero_mechanical_wave-VREzqtYf3FVN3bNnBxQY88.webp"
                alt="Mechanical wave visualization"
                className="w-full h-48 object-cover"
              />
            </div>

            {[
              {
                period: "Ancient China & Greece (~500 BCE)",
                content: "The earliest systematic acoustic research was in music. In China, the 三分損益法 (Three-Part Reduction/Addition Method) — adding or reducing a pipe's length by one-third — was the first acoustic law. Pythagoras in Greece independently discovered that simple integer ratios of string lengths produce harmonious intervals (3:2 = perfect fifth, 2:1 = octave).",
                accent: "#a78bfa",
              },
              {
                period: "1635 — First Speed of Sound Measurement",
                content: "The first measurement of the speed of sound used a distant cannon shot, assuming light travels instantaneously. By 1738, the Paris Academy of Sciences measured 332 m/s at 0°C using cannon fire — within 1.5‰ of the modern value of 331.45 m/s, a remarkable achievement using only a stopwatch and human ears.",
                accent: "#00d4ff",
              },
              {
                period: "1687 — Newton's Wave Equation",
                content: "Isaac Newton derived the speed of sound in Principia Mathematica as √(P/ρ), where P is atmospheric pressure and ρ is density. His result of 288 m/s was too low. In 1816, Laplace corrected this by recognizing that sound propagation is adiabatic (not isothermal), adding the heat capacity ratio γ: c = √(γP/ρ), giving the correct value.",
                accent: "#ff4f1f",
              },
              {
                period: "1747 — Wave Equation for Strings",
                content: "Jean le Rond d'Alembert derived the first wave equation for a vibrating string, predicting that the same mathematics would describe sound waves. This laid the mathematical foundation for all of wave mechanics.",
                accent: "#fbbf24",
              },
              {
                period: "1877 — Lord Rayleigh's 'Theory of Sound'",
                content: "Lord Rayleigh published his two-volume masterwork 'The Theory of Sound', synthesizing all classical acoustics into a rigorous mathematical framework. This work remains relevant today and marked the beginning of modern acoustics as a scientific discipline.",
                accent: "#00d4ff",
              },
              {
                period: "1900 — Sabine's Reverberation Formula",
                content: "Wallace Clement Sabine derived the first scientific formula for room acoustics: T₆₀ = 0.161·V/A, where V is room volume and A is total absorption. This transformed architectural acoustics from guesswork into engineering, enabling the design of concert halls with predictable acoustic properties.",
                accent: "#a78bfa",
              },
              {
                period: "20th Century — Modern Acoustics",
                content: "The development of electronics enabled measurement and generation of any frequency at any intensity. Branches of acoustics multiplied: ultrasonics (medical imaging, sonar), psychoacoustics (hearing science), architectural acoustics, noise control, and eventually digital signal processing — transforming acoustics from a purely physical science into a cornerstone of modern technology.",
                accent: "#ff4f1f",
              },
            ].map(({ period, content, accent }) => (
              <div key={period} className="module-card rounded p-5">
                <div className="flex gap-4">
                  <div
                    className="w-1 rounded flex-shrink-0"
                    style={{ background: accent }}
                  />
                  <div>
                    <div
                      className="text-xs font-bold mb-1"
                      style={{ color: accent, fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {period}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: "#4a5568" }}>
                      {content}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
