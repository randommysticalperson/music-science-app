/*
 * Layout.tsx — Bauhaus Frequency Design
 * Dark navy sidebar + chalk main area
 * Persistent left nav with module icons + EN/繁體中文 language toggle
 */
import { Link, useLocation } from "wouter";
import { Music, Activity, Waves, Home, Menu, X, Github, ListMusic, Languages, BookOpen } from "lucide-react";
import { useState } from "react";
import { useLang } from "../contexts/LanguageContext";

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { t, toggleLang, lang } = useLang();

  const navItems = [
    { path: "/", label: t("overview"), icon: Home, accent: "#8a9bb0" },
    { path: "/music-theory", label: t("musicTheory"), icon: Music, accent: "#ff4f1f" },
    { path: "/signal-processing", label: t("signalProcessing"), icon: Activity, accent: "#00d4ff" },
    { path: "/acoustics", label: t("acoustics"), icon: Waves, accent: "#a78bfa" },
    { path: "/sequencer", label: t("sequencer"), icon: ListMusic, accent: "#4ade80" },
    { path: "/sheet-music", label: t("sheetMusicNav"), icon: BookOpen, accent: "#f59e0b" },
  ];

  return (
    <div className="flex h-screen overflow-hidden" style={{ background: "#f7f5f0" }}>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-20 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed lg:static inset-y-0 left-0 z-30 flex flex-col w-64 h-full
          transition-transform duration-300
          ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
        `}
        style={{ background: "#1a2744", borderRight: "1px solid rgba(255,255,255,0.06)" }}
      >
        {/* Logo area */}
        <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div
            className="w-8 h-8 flex items-center justify-center rounded"
            style={{ background: "#ff4f1f" }}
          >
            <Waves size={16} color="white" strokeWidth={2.5} />
          </div>
          <div>
            <div className="text-white font-semibold text-sm tracking-wide" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {t("appName")}
            </div>
            <div className="text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
              {t("appVersion")}
            </div>
          </div>
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Language toggle — cycles EN → 繁中 → 日本語 → EN */}
        <div className="px-4 pt-4 pb-1">
          <button
            onClick={toggleLang}
            className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded text-xs font-semibold transition-all"
            style={{
              background: "rgba(0,212,255,0.1)",
              border: "1px solid rgba(0,212,255,0.25)",
              color: "#00d4ff",
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: "0.02em",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.18)";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,212,255,0.1)";
            }}
            title="Switch language"
          >
            <div className="flex items-center gap-2">
              <Languages size={13} />
              <span style={{ opacity: 0.6 }}>
                {lang === "en" ? "EN" : lang === "zh" ? "繁中" : "日本語"}
              </span>
              <span style={{ opacity: 0.4 }}>→</span>
            </div>
            <span>{t("langToggle")}</span>
          </button>
        </div>

        {/* Module label */}
        <div className="px-6 pt-4 pb-2">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t("modules")}
          </span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 px-3 space-y-1">
          {navItems.map(({ path, label, icon: Icon, accent }) => {
            const isActive = location === path;
            return (
              <Link key={path} href={path}>
                <div
                  className="flex items-center gap-3 px-3 py-2.5 rounded transition-all duration-150 group"
                  style={{
                    background: isActive ? "rgba(255,79,31,0.12)" : "transparent",
                    borderLeft: isActive ? `3px solid ${accent}` : "3px solid transparent",
                    cursor: "pointer",
                  }}
                  onClick={() => setMobileOpen(false)}
                >
                  <Icon
                    size={16}
                    style={{ color: isActive ? accent : "#8a9bb0" }}
                    className="transition-colors group-hover:text-white"
                  />
                  <span
                    className="text-sm font-medium transition-colors"
                    style={{
                      color: isActive ? "white" : "#8a9bb0",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {label}
                  </span>
                </div>
              </Link>
            );
          })}
        </nav>

        {/* Bottom info */}
        <div
          className="px-6 py-4 text-xs"
          style={{
            borderTop: "1px solid rgba(255,255,255,0.06)",
            color: "#8a9bb0",
            fontFamily: "'IBM Plex Mono', monospace",
          }}
        >
          {/* GitHub link */}
          <a
            href="https://github.com/randommysticalperson/music-science-app"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 mb-3 px-3 py-2 rounded transition-all"
            style={{
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#c8d3e0",
              textDecoration: "none",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.1)";
              (e.currentTarget as HTMLAnchorElement).style.color = "white";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLAnchorElement).style.background = "rgba(255,255,255,0.05)";
              (e.currentTarget as HTMLAnchorElement).style.color = "#c8d3e0";
            }}
          >
            <Github size={13} />
            <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{t("viewSource")}</span>
          </a>

          {/* Reference standards */}
          <div className="space-y-0.5 mb-2" style={{ color: "rgba(138,155,176,0.6)", fontSize: 10 }}>
            <div>ISO 16 · A4 = 440 Hz tuning</div>
            <div>MIDI 1.0 Spec · MMA/AMEI 1983</div>
            <div>Equal temperament · f = 440·2^((n-69)/12)</div>
            <div>v<sub>sound</sub> = 343 m/s at 20°C</div>
          </div>

          <div className="mt-2" style={{ color: "rgba(138,155,176,0.35)" }}>
            © 2026 {t("appName")}
          </div>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile topbar */}
        <div
          className="flex items-center gap-3 px-4 py-3 lg:hidden"
          style={{ background: "#1a2744", borderBottom: "1px solid rgba(255,255,255,0.08)" }}
        >
          <button onClick={() => setMobileOpen(true)}>
            <Menu size={20} color="white" />
          </button>
          <span className="text-white font-semibold text-sm" style={{ fontFamily: "'DM Sans', sans-serif" }}>
            {t("appName")}
          </span>
          {/* Mobile lang toggle */}
          <button
            onClick={toggleLang}
            className="ml-auto flex items-center gap-1.5 px-2 py-1 rounded text-xs"
            style={{
              background: "rgba(0,212,255,0.15)",
              border: "1px solid rgba(0,212,255,0.3)",
              color: "#00d4ff",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            <Languages size={11} />
            <span style={{ opacity: 0.6 }}>{lang === "en" ? "EN" : lang === "zh" ? "繁中" : "日本語"}</span>
            <span style={{ opacity: 0.4 }}>→</span>
            {t("langToggle")}
          </button>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: "#f7f5f0" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
