/*
 * Layout.tsx — Bauhaus Frequency Design
 * Dark navy sidebar + chalk main area
 * Persistent left nav with module icons
 */
import { Link, useLocation } from "wouter";
import { Music, Activity, Waves, Home, Menu, X } from "lucide-react";
import { useState } from "react";

const navItems = [
  { path: "/", label: "Overview", icon: Home, accent: "#8a9bb0" },
  { path: "/music-theory", label: "Music Theory", icon: Music, accent: "#ff4f1f" },
  { path: "/signal-processing", label: "Signal Processing", icon: Activity, accent: "#00d4ff" },
  { path: "/acoustics", label: "Acoustics", icon: Waves, accent: "#a78bfa" },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

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
              SoundLab
            </div>
            <div className="text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
              v1.0
            </div>
          </div>
          <button
            className="ml-auto lg:hidden text-white/60 hover:text-white"
            onClick={() => setMobileOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Module label */}
        <div className="px-6 pt-5 pb-2">
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Modules
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
          <div>Music Theory</div>
          <div>Signal Processing</div>
          <div>Acoustics</div>
          <div className="mt-2" style={{ color: "rgba(138,155,176,0.5)" }}>
            © 2026 SoundLab
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
            SoundLab
          </span>
        </div>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto" style={{ background: "#f7f5f0" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
