/*
 * Home.tsx — SoundLab Overview / Landing
 * Bauhaus Frequency: chalk bg, navy accents, signal orange CTAs
 * Supports EN / 繁體中文 via LanguageContext
 */
import { Link } from "wouter";
import { Music, Activity, Waves, ArrowRight, Zap, Github, ListMusic } from "lucide-react";
import { useLang } from "../contexts/LanguageContext";

export default function Home() {
  const { t } = useLang();

  const modules = [
    {
      path: "/music-theory",
      icon: Music,
      accent: "#ff4f1f",
      label: t("homePillar1Title"),
      subtitle: "Scales · Chords · Intervals · Progressions",
      description: t("homePillar1Desc"),
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
      label: t("homePillar2Title"),
      subtitle: "Waveforms · FFT · Filters · Oscilloscope",
      description: t("homePillar2Desc"),
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
      label: t("homePillar3Title"),
      subtitle: "Mechanical Waves · Resonance · Doppler · dB",
      description: t("homePillar3Desc"),
      stats: [
        { label: "Wave Types", value: "3" },
        { label: "Speed in Air", value: "343 m/s" },
        { label: "Hearing Range", value: "20–20k Hz" },
      ],
      image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663332318761/MqmpMppxQBiZG8tv7iSXFX/hero_mechanical_wave-VREzqtYf3FVN3bNnBxQY88.webp",
    },
    {
      path: "/sequencer",
      icon: ListMusic,
      accent: "#4ade80",
      label: t("homeSequencerTitle"),
      subtitle: "soundio/sequence · Composer · Exporter · Visualizer",
      description: t("homeSequencerDesc"),
      stats: [
        { label: "Steps", value: "16" },
        { label: "Waveforms", value: "4" },
        { label: "Format", value: "JSON" },
      ],
      image: "https://d2xsxph8kpxj0f.cloudfront.net/310519663332318761/MqmpMppxQBiZG8tv7iSXFX/hero_spectrum-4Jh3yjFbfpCJqJXMdJP4Hn.webp",
    },
  ];

  const facts = [
    { label: t("homeFact1Sub"), value: t("homeFact1") },
    { label: t("homeFact2Sub"), value: t("homeFact2") },
    { label: t("homeFact3Sub"), value: t("homeFact3") },
    { label: t("homeFact4Sub"), value: t("homeFact4") },
  ];

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
            {t("homeTag")}
          </div>
          <h1
            className="text-5xl font-bold text-white mb-4 leading-tight"
            style={{ fontFamily: "'DM Serif Display', serif" }}
          >
            {t("homeTitle")}
          </h1>
          <p className="text-lg mb-8" style={{ color: "#8a9bb0", fontFamily: "'DM Sans', sans-serif" }}>
            {t("homeSubtitle")}
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/music-theory">
              <button
                className="flex items-center gap-2 px-5 py-2.5 rounded font-medium text-sm transition-all hover:opacity-90"
                style={{ background: "#ff4f1f", color: "white", fontFamily: "'DM Sans', sans-serif" }}
              >
                {t("homeStart")} <ArrowRight size={14} />
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
            {t("homePillarsTitle")}
          </h2>
          <div className="w-12 h-0.5" style={{ background: "#ff4f1f" }} />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-6">
          {modules.map(({ path, icon: Icon, accent, label, subtitle, description, stats, image }) => (
            <Link key={path} href={path}>
              <div
                className="group overflow-hidden rounded cursor-pointer transition-all duration-200 hover:-translate-y-1 h-full"
                style={{
                  background: "white",
                  border: "1px solid #e8e4dc",
                  borderTop: `3px solid ${accent}`,
                  boxShadow: "0 2px 12px rgba(26,39,68,0.08)",
                }}
              >
                {/* Image */}
                <div className="h-36 overflow-hidden">
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
                    className="flex items-center gap-1 mt-4 text-xs font-medium transition-all group-hover:gap-2"
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-5">
          {facts.map(({ label, value }) => (
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

        {/* References & GitHub */}
        <div
          className="pt-4 flex flex-wrap items-center justify-between gap-3"
          style={{ borderTop: "1px solid rgba(255,255,255,0.08)" }}
        >
          <div
            className="text-xs flex flex-wrap gap-x-4 gap-y-1"
            style={{ color: "rgba(138,155,176,0.55)", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            <span>ISO 16 · A4 = 440 Hz</span>
            <span>MIDI 1.0 Spec · MMA/AMEI 1983</span>
            <span>f = 440×2^((n−69)/12)</span>
            <span>DFT: X[k] = Σ x[n]·e^(−j2πkn/N)</span>
          </div>
          <a
            href="https://github.com/randommysticalperson/music-science-app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 px-4 py-2 rounded text-xs font-medium transition-all"
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#c8d3e0",
              textDecoration: "none",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.12)";
              (e.currentTarget as HTMLAnchorElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.06)";
              (e.currentTarget as HTMLAnchorElement).style.color = "#c8d3e0";
            }}
          >
            <Github size={13} />
            {t("viewSource")}
          </a>
        </div>
      </div>
    </div>
  );
}
