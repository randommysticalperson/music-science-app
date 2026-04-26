/*
 * Home.tsx — SoundLab Overview / Landing
 * Bauhaus Frequency: chalk bg, navy accents, signal orange CTAs
 */
import { Link } from "wouter";
import { Music, Activity, Waves, ArrowRight, Zap } from "lucide-react";

const modules = [
  {
    path: "/music-theory",
    icon: Music,
    accent: "#ff4f1f",
    label: "Music Theory",
    subtitle: "Scales · Chords · Intervals · Progressions",
    description:
      "Explore the mathematical foundations of music. Understand how scales are constructed, how chords derive from harmonic series, and how chord progressions create emotional movement.",
    stats: [
      { label: "Scales", value: "12+" },
      { label: "Chord Types", value: "20+" },
      { label: "Intervals", value: "13" },
    ],
    image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663332318761/MqmpMppxQBiZG8tv7iSXFX/hero_piano_keys-Y99wonfxvX4AbvDP64UYmN.webp",
  },
  {
    path: "/signal-processing",
    icon: Activity,
    accent: "#00d4ff",
    label: "Signal Processing",
    subtitle: "Waveforms · FFT · Filters · Oscilloscope",
    description:
      "Visualize sound as a mathematical signal. Decompose complex waveforms via Fourier analysis, explore filter responses, and understand how digital audio processing works.",
    stats: [
      { label: "Waveforms", value: "5" },
      { label: "Filter Types", value: "4" },
      { label: "FFT Bins", value: "1024" },
    ],
    image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663332318761/MqmpMppxQBiZG8tv7iSXFX/hero_waveform-2Ukt7tG4QY7RPxv8XDVY7Z.webp",
  },
  {
    path: "/acoustics",
    icon: Waves,
    accent: "#a78bfa",
    label: "Acoustics",
    subtitle: "Mechanical Waves · Resonance · Doppler · dB",
    description:
      "Dive into the physics of sound as a mechanical wave. Study wave propagation, compression and rarefaction, the Doppler effect, resonance, and the decibel scale.",
    stats: [
      { label: "Wave Types", value: "3" },
      { label: "Speed in Air", value: "343 m/s" },
      { label: "Hearing Range", value: "20–20k Hz" },
    ],
    image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663332318761/MqmpMppxQBiZG8tv7iSXFX/hero_mechanical_wave-VREzqtYf3FVN3bNnBxQY88.webp",
  },
];

export default function Home() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <div
        className="relative overflow-hidden"
        style={{ background: "#1a2744", minHeight: 420 }}
      >
        <img
          src="https://d2xsxph8kpxj0f.cloudfront.net/310519663332318761/MqmpMppxQBiZG8tv7iSXFX/hero_waveform-2Ukt7tG4QY7RPxv8XDVY7Z.webp"
          alt="Waveform visualization"
          className="absolute inset-0 w-full h-full object-cover opacity-25"
        />
        <div className="relative z-10 px-8 py-16 max-w-3xl">
          <div
            className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full text-xs font-medium"
            style={{
              background: "rgba(255,79,31,0.2)",
              color: "#ff4f1f",
              border: "1px solid rgba(255,79,31,0.3)",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            <Zap size={10} />
            Interactive Science Platform
          </div>
          <h1
            className="text-5xl font-bold text-white mb-4 leading-tight"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            The Science of Sound
          </h1>
          <p className="text-lg mb-8" style={{ color: "#8a9bb0", fontFamily: "'DM Sans', sans-serif" }}>
            An interactive exploration of music theory, digital signal processing, and the physics of
            acoustic waves — from the mathematics of harmony to the mechanics of vibration.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/music-theory">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded font-medium text-sm transition-all hover:opacity-90"
                style={{ background: "#ff4f1f", color: "white", fontFamily: "'DM Sans', sans-serif" }}
              >
                Start Exploring <ArrowRight size={14} />
              </button>
            </Link>
          </div>

          {/* Frequency watermark */}
          <div
            className="absolute right-8 top-1/2 -translate-y-1/2 text-8xl font-bold select-none pointer-events-none hidden lg:block"
            style={{
              color: "rgba(255,255,255,0.04)",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            440 Hz
          </div>
        </div>
      </div>

      {/* Module cards */}
      <div className="px-8 py-12">
        <div className="mb-8">
          <h2
            className="text-2xl font-bold mb-2"
            style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
          >
            Three Pillars of Sound Science
          </h2>
          <div className="w-12 h-0.5" style={{ background: "#ff4f1f" }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {modules.map(({ path, icon: Icon, accent, label, subtitle, description, stats, image }) => (
            <Link key={path} href={path}>
              <div
                className="group overflow-hidden rounded cursor-pointer transition-all duration-200 hover:-translate-y-1"
                style={{
                  background: "white",
                  border: "1px solid #e8e4dc",
                  borderTop: `3px solid ${accent}`,
                  boxShadow: "0 2px 12px rgba(26,39,68,0.08)",
                }}
              >
                {/* Image */}
                <div className="h-40 overflow-hidden">
                  <img
                    src={image}
                    alt={label}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                </div>

                {/* Content */}
                <div className="p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon size={16} style={{ color: accent }} />
                    <span
                      className="font-semibold text-base"
                      style={{ color: "#1a2744", fontFamily: "'DM Sans', sans-serif" }}
                    >
                      {label}
                    </span>
                  </div>
                  <div
                    className="text-xs mb-3"
                    style={{
                      color: accent,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {subtitle}
                  </div>
                  <p className="text-sm leading-relaxed mb-4" style={{ color: "#4a5568" }}>
                    {description}
                  </p>

                  {/* Stats */}
                  <div
                    className="grid grid-cols-3 gap-2 pt-3"
                    style={{ borderTop: "1px solid #e8e4dc" }}
                  >
                    {stats.map(({ label: sl, value }) => (
                      <div key={sl} className="text-center">
                        <div
                          className="text-sm font-bold"
                          style={{ color: accent, fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          {value}
                        </div>
                        <div className="text-xs" style={{ color: "#8a9bb0" }}>
                          {sl}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* CTA */}
                  <div
                    className="flex items-center gap-1 mt-4 text-xs font-medium transition-colors group-hover:gap-2"
                    style={{ color: accent, fontFamily: "'DM Sans', sans-serif" }}
                  >
                    Open Module <ArrowRight size={12} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick facts strip */}
      <div
        className="mx-8 mb-12 rounded p-6"
        style={{ background: "#1a2744" }}
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {[
            { label: "Speed of Sound (air, 20°C)", value: "343 m/s" },
            { label: "Concert A Pitch", value: "440 Hz" },
            { label: "Human Hearing Range", value: "20 Hz – 20 kHz" },
            { label: "Pain Threshold", value: "130 dB SPL" },
          ].map(({ label, value }) => (
            <div key={label}>
              <div
                className="text-xl font-bold mb-1"
                style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {value}
              </div>
              <div className="text-xs" style={{ color: "#8a9bb0" }}>
                {label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
