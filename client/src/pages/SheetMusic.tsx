/**
 * SheetMusic.tsx — 樂譜 (Sheet Music) Module
 * Design: Bauhaus Frequency — dark navy sidebar, chalk background, signal orange + electric cyan
 * Typography: DM Serif Display (headings), IBM Plex Mono (values), DM Sans (body)
 *
 * Uses alphaTab (@coderline/alphatab) for:
 *  - Rendering MusicXML / Guitar Pro / alphaTex notation as SVG
 *  - Built-in MIDI synthesizer playback (SONiVOX SoundFont)
 *  - Live cursor tracking during playback
 *  - File upload for .musicxml / .xml / .gp / .gp5 / .gpx
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useLang } from "../contexts/LanguageContext";
import { Music, Upload, Play, Pause, Square, SkipBack, Volume2, ChevronDown, ChevronUp, FileMusic, Info } from "lucide-react";
import * as alphaTab from "@coderline/alphatab";

// ─── Built-in demo score in alphaTex format ───────────────────────────────────
// Ode to Joy (Beethoven) — first 8 bars, treble clef
const ODE_TO_JOY_TEX = `
\\title "Ode to Joy"
\\subtitle "L. van Beethoven, Op. 125"
\\tempo 120
\\clef G2
.
:4 e5 e5 f5 g5 | g5 f5 e5 d5 | c5 c5 d5 e5 | e5.2 d5.4 d5.2 |
e5 e5 f5 g5 | g5 f5 e5 d5 | c5 c5 d5 e5 | d5.2 c5.4 c5.2 |
d5 d5 e5 c5 | d5 e5.8 f5.8 e5 c5 | d5 e5.8 f5.8 e5 d5 | c5 d5 g4 r |
e5 e5 f5 g5 | g5 f5 e5 d5 | c5 c5 d5 e5 | d5.2 c5.4 c5.2
`.trim();

// ─── Additional sample scores in alphaTex format ────────────────────────────
const PENTATONIC_SCALE_TEX = `
\\title "C Major Pentatonic Scale"
\\subtitle "5-note scale: C D E G A"
\\tempo 90
\\clef G2
.
:4 c5 d5 e5 g5 | a5 g5 e5 d5 | c5 d5 e5 g5 | a5.1 |
:8 c5 d5 e5 g5 a5 g5 e5 d5 | c5.1
`.trim();

const BLUES_RIFF_TEX = `
\\title "12-Bar Blues Riff"
\\subtitle "E Blues — classic shuffle pattern"
\\tempo 100
\\clef G2
.
:8 e4 g4 a4 b4 | e4 g4 a4 b4 | e4 g4 a4 b4 | e4 g4 a4 b4 |
a4 c5 d5 e5 | a4 c5 d5 e5 | e4 g4 a4 b4 | e4 g4 a4 b4 |
b4 d5 e5 f5 | a4 c5 d5 e5 | e4 g4 a4 b4 | b4.2 e4.2
`.trim();

const BACH_INVENTION_TEX = `
\\title "Two-Part Invention No. 1"
\\subtitle "J.S. Bach, BWV 772 (excerpt)"
\\tempo 112
\\clef G2
.
:16 c5 d5 e5 f5 | g5 a5 b5 c6 | b5 g5 a5 f5 | g5.4 r.4 |
:16 e5 f5 g5 a5 | b5 c6 d6 e6 | d6 b5 c6 a5 | b5.4 r.4
`.trim();

// ─── Sample scores list ───────────────────────────────────────────────────────
const SAMPLE_SCORES = [
  {
    id: "ode",
    label: "Ode to Joy",
    composer: "L. van Beethoven",
    format: "alphaTex",
    tex: ODE_TO_JOY_TEX,
  },
  {
    id: "twinkle",
    label: "Twinkle Twinkle",
    composer: "Traditional",
    format: "alphaTex",
    tex: `\\title "Twinkle Twinkle Little Star"
\\subtitle "Traditional"
\\tempo 100
\\clef G2
.
:4 c5 c5 g5 g5 | a5 a5 g5.2 | f5 f5 e5 e5 | d5 d5 c5.2 |
g5 g5 f5 f5 | e5 e5 d5.2 | g5 g5 f5 f5 | e5 e5 d5.2 |
c5 c5 g5 g5 | a5 a5 g5.2 | f5 f5 e5 e5 | d5 d5 c5.2`,
  },
  {
    id: "minuet",
    label: "Minuet in G",
    composer: "J.S. Bach",
    format: "alphaTex",
    tex: `\\title "Minuet in G"
\\subtitle "J.S. Bach, BWV Anh. 114"
\\tempo 132
\\clef G2
.
:4 d5 g4 a4 b4 | c5 d5 g4.2 | e5 c5 d5 e5 | f5.8 e5.8 d5.2 |
c5 e5 d5 c5 | b4 d5 c5 b4 | a4 b4 c5 d5 | g4.1 |
b4 g4 a4 b4 | c5.2 d5.2 | e5 g4 f5.8 e5.8 d5 | e5.1`,
  },
  {
    id: "pentatonic",
    label: "Pentatonic Scale",
    composer: "C Major — 5 notes",
    format: "alphaTex",
    tex: PENTATONIC_SCALE_TEX,
  },
  {
    id: "blues",
    label: "12-Bar Blues",
    composer: "E Blues Riff",
    format: "alphaTex",
    tex: BLUES_RIFF_TEX,
  },
  {
    id: "bach_invention",
    label: "Invention No. 1",
    composer: "J.S. Bach, BWV 772",
    format: "alphaTex",
    tex: BACH_INVENTION_TEX,
  },
];

// ─── Playback state type ──────────────────────────────────────────────────────
type PlaybackState = "stopped" | "playing" | "paused";

// ─── Main Component ───────────────────────────────────────────────────────────
export default function SheetMusic() {
  const { t } = useLang();

  // alphaTab refs
  const containerRef = useRef<HTMLDivElement>(null);
  const apiRef = useRef<alphaTab.AlphaTabApi | null>(null);

  // UI state
  const [playbackState, setPlaybackState] = useState<PlaybackState>("stopped");
  const [currentTime, setCurrentTime] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [tempo, setTempo] = useState(120);
  const [volume, setVolume] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedSample, setSelectedSample] = useState("ode");
  const [scoreTitle, setScoreTitle] = useState("Ode to Joy");
  const [scoreComposer, setScoreComposer] = useState("L. van Beethoven");
  const [scoreFormat, setScoreFormat] = useState("alphaTex");
  const [showInfo, setShowInfo] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1.0);
  const [transpose, setTranspose] = useState(0);

  // ─── Read URL params (e.g. ?tex=... from Music Theory) ─────────────────────
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const texParam = params.get("tex");
    if (texParam) {
      const decoded = decodeURIComponent(texParam);
      // Wait for alphaTab to be ready, then load the tex
      const tryLoad = () => {
        if (apiRef.current) {
          setSelectedSample("");
          setUploadedFileName("From Music Theory");
          setScoreFormat("alphaTex");
          setPlaybackState("stopped");
          setCurrentTime(0);
          setIsLoading(true);
          apiRef.current.tex(decoded);
          // Clean the URL without reloading
          window.history.replaceState({}, "", window.location.pathname);
        } else {
          setTimeout(tryLoad, 200);
        }
      };
      setTimeout(tryLoad, 300);
    }
  }, []);

  // ─── Initialize alphaTab ────────────────────────────────────────────────────
  const initAlphaTab = useCallback(() => {
    if (!containerRef.current) return;

    // Destroy existing instance
    if (apiRef.current) {
      try { apiRef.current.destroy(); } catch { /* ignore */ }
      apiRef.current = null;
    }

    setIsLoading(true);
    setLoadError(null);

    const settings = new alphaTab.Settings();
    // Use html5 canvas engine — avoids the SVG worker BoundsLookup.fromJson crash
    // (SVG engine serializes beat bounds via worker messages before voices are ready)
    settings.core.engine = "html5";
    settings.core.logLevel = alphaTab.LogLevel.None;
    // Explicitly point to the public/font directory so Bravura loads correctly
    settings.core.fontDirectory = "/font/";
    settings.display.layoutMode = alphaTab.LayoutMode.Page;
    settings.display.scale = zoom;
    settings.display.staveProfile = alphaTab.StaveProfile.Score;
    settings.player.enablePlayer = true;
    settings.player.enableCursor = true;
    settings.player.enableAnimatedBeatCursor = true;
    settings.player.soundFont = "/soundfont/sonivox.sf2";

    const api = new alphaTab.AlphaTabApi(containerRef.current, settings);
    apiRef.current = api;

    // Event listeners
    api.renderStarted.on(() => setIsLoading(true));
    api.renderFinished.on(() => setIsLoading(false));
    api.scoreLoaded.on((score: alphaTab.model.Score) => {
      setScoreTitle(score.title || "Untitled");
      // Score has artist field; composer is not a standard field in alphaTab model
      setScoreComposer((score as unknown as { artist?: string; composer?: string }).artist || (score as unknown as { artist?: string; composer?: string }).composer || "");
      setTotalTime(0);
    });
    api.playerStateChanged.on((args: alphaTab.synth.PlayerStateChangedEventArgs) => {
      if (args.state === alphaTab.synth.PlayerState.Playing) {
        setPlaybackState("playing");
      } else if (args.state === alphaTab.synth.PlayerState.Paused) {
        setPlaybackState("paused");
      } else {
        setPlaybackState("stopped");
      }
    });
    api.playerPositionChanged.on((args: alphaTab.synth.PositionChangedEventArgs) => {
      setCurrentTime(args.currentTime);
      setTotalTime(args.endTime);
    });
    api.playerFinished.on(() => {
      setPlaybackState("stopped");
      setCurrentTime(0);
    });
    api.error.on((err: { message?: string; type?: string }) => {
      const msg = err.message ?? String(err);
      // Suppress the known BoundsLookup.fromJson worker race condition error
      // which is a non-fatal alphaTab internal timing issue
      if (msg.includes("voices") || msg.includes("BoundsLookup") || msg.includes("fromJson")) {
        console.warn("[alphaTab] Suppressed non-fatal BoundsLookup error:", msg);
        return;
      }
      setLoadError(`Error: ${msg}`);
      setIsLoading(false);
    });

    // Load the default sample
    loadSample("ode", api);
  }, [zoom]);

  useEffect(() => {
    // Guard against the alphaTab BoundsLookup.fromJson uncaught TypeError
    // that fires from the Web Worker message handler before voices are ready.
    // This is a known alphaTab 1.x race condition with the SVG/cursor system.
    const handleWorkerError = (event: ErrorEvent) => {
      if (
        event.message?.includes("voices") ||
        event.message?.includes("BoundsLookup") ||
        event.filename?.includes("alphatab")
      ) {
        event.preventDefault();
        event.stopPropagation();
        return true;
      }
    };
    window.addEventListener("error", handleWorkerError);

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      initAlphaTab();
    }, 100);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("error", handleWorkerError);
      if (apiRef.current) {
        try { apiRef.current.destroy(); } catch { /* ignore */ }
        apiRef.current = null;
      }
    };
  }, []);

  // ─── Load a built-in sample ─────────────────────────────────────────────────
  const loadSample = (id: string, api?: alphaTab.AlphaTabApi) => {
    const at = api || apiRef.current;
    if (!at) return;
    const sample = SAMPLE_SCORES.find((s) => s.id === id);
    if (!sample) return;
    setSelectedSample(id);
    setScoreTitle(sample.label);
    setScoreComposer(sample.composer);
    setScoreFormat(sample.format);
    setUploadedFileName(null);
    setPlaybackState("stopped");
    setCurrentTime(0);
    setIsLoading(true);
    setLoadError(null);
    at.tex(sample.tex);
  };

  // ─── Handle file upload ─────────────────────────────────────────────────────
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !apiRef.current) return;
    const api = apiRef.current;
    setUploadedFileName(file.name);
    setSelectedSample("");
    setPlaybackState("stopped");
    setCurrentTime(0);
    setIsLoading(true);
    setLoadError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const supportedFormats = ["musicxml", "xml", "gp", "gp3", "gp4", "gp5", "gpx", "mxl"];
    if (!supportedFormats.includes(ext)) {
      setLoadError(`Unsupported format ".${ext}". Supported: .musicxml, .xml, .gp, .gp3–5, .gpx, .mxl`);
      setIsLoading(false);
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const buffer = ev.target?.result as ArrayBuffer;
      if (buffer) {
        try {
          api.load(new Uint8Array(buffer));
        } catch (err) {
          setLoadError(`Failed to load file: ${String(err)}`);
          setIsLoading(false);
        }
      }
    };
    reader.readAsArrayBuffer(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  };

  // ─── Playback controls ──────────────────────────────────────────────────────
  const handlePlayPause = () => {
    if (!apiRef.current) return;
    if (playbackState === "playing") {
      apiRef.current.pause();
    } else {
      apiRef.current.play();
    }
  };

  const handleStop = () => {
    if (!apiRef.current) return;
    apiRef.current.stop();
    setCurrentTime(0);
    setPlaybackState("stopped");
  };

  const handleRestart = () => {
    if (!apiRef.current) return;
    apiRef.current.stop();
    setTimeout(() => apiRef.current?.play(), 50);
  };

  const handleTempoChange = (val: number) => {
    setTempo(val);
    if (apiRef.current) {
      apiRef.current.playbackSpeed = val / 120;
    }
  };

  const handleVolumeChange = (val: number) => {
    setVolume(val);
    if (apiRef.current) {
      apiRef.current.masterVolume = val;
    }
  };

  const handleZoomChange = (val: number) => {
    setZoom(val);
    if (apiRef.current) {
      apiRef.current.settings.display.scale = val;
      apiRef.current.updateSettings();
      apiRef.current.render();
    }
  };

  const handleTransposeChange = (semitones: number) => {
    setTranspose(semitones);
    if (apiRef.current) {
      // transpositionPitches lives in settings.notation (one entry per track)
      apiRef.current.settings.notation.transpositionPitches = semitones !== 0 ? [semitones] : [];
      apiRef.current.updateSettings();
      apiRef.current.render();
    }
  };

  // ─── Format time ────────────────────────────────────────────────────────────
  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  // ─── Progress bar click ─────────────────────────────────────────────────────
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!apiRef.current || totalTime === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    const cache = apiRef.current.tickCache;
    const barCount = cache ? (cache as unknown as { masterBarCount?: number }).masterBarCount ?? 100 : 100;
    apiRef.current.tickPosition = Math.floor(ratio * barCount * 100);
  };

  const progressPct = totalTime > 0 ? (currentTime / totalTime) * 100 : 0;

  return (
    <div className="min-h-screen" style={{ background: "#f7f5f0" }}>
      {/* ── Page header ── */}
      <div
        className="px-8 pt-8 pb-6"
        style={{ borderBottom: "2px solid #e8e4dc" }}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div
                className="w-8 h-8 rounded flex items-center justify-center"
                style={{ background: "#7c3aed" }}
              >
                <Music size={16} color="white" />
              </div>
              <span
                className="text-xs font-semibold uppercase tracking-widest"
                style={{ color: "#7c3aed", fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {t("sheetMusicModule")}
              </span>
            </div>
            <h1
              className="text-3xl font-bold mb-1"
              style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
            >
              {t("sheetMusicTitle")}
            </h1>
            <p className="text-sm" style={{ color: "#8a9bb0", fontFamily: "'DM Sans', sans-serif" }}>
              {t("sheetMusicSubtitle")}
            </p>
          </div>
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="flex items-center gap-2 px-3 py-2 rounded text-xs transition-all"
            style={{
              background: showInfo ? "rgba(124,58,237,0.1)" : "transparent",
              border: "1px solid rgba(124,58,237,0.3)",
              color: "#7c3aed",
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            <Info size={13} />
            {t("sheetMusicAbout")}
            {showInfo ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>

        {/* Info panel */}
        {showInfo && (
          <div
            className="mt-4 p-4 rounded text-sm"
            style={{
              background: "rgba(124,58,237,0.05)",
              border: "1px solid rgba(124,58,237,0.2)",
              color: "#4a5568",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <p className="mb-2">
              <strong style={{ color: "#1a2744" }}>Rendering engine:</strong>{" "}
              <a href="https://alphatab.net" target="_blank" rel="noopener noreferrer" style={{ color: "#7c3aed" }}>
                alphaTab v1.8
              </a>{" "}
              — open-source music notation library with built-in MIDI synthesizer.
            </p>
            <p className="mb-2">
              <strong style={{ color: "#1a2744" }}>Notation font:</strong> Bravura (SMuFL-compliant) — the same font used by Sibelius and Dorico.
            </p>
            <p className="mb-2">
              <strong style={{ color: "#1a2744" }}>Audio engine:</strong> TinySoundFont MIDI synthesizer with SONiVOX SoundFont (Apache 2.0).
            </p>
            <p>
              <strong style={{ color: "#1a2744" }}>Supported formats:</strong> alphaTex (built-in), MusicXML (.xml, .musicxml, .mxl), Guitar Pro (.gp, .gp3–5, .gpx).
            </p>
          </div>
        )}
      </div>

      <div className="flex gap-0" style={{ minHeight: "calc(100vh - 140px)" }}>
        {/* ── Left panel: score selector + upload ── */}
        <div
          className="w-64 shrink-0 p-5 space-y-5"
          style={{ borderRight: "1px solid #e8e4dc", background: "#faf9f7" }}
        >
          {/* Sample scores */}
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {t("sheetMusicSamples")}
            </div>
            <div className="space-y-1">
              {SAMPLE_SCORES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => loadSample(s.id)}
                  className="w-full text-left px-3 py-2.5 rounded transition-all"
                  style={{
                    background: selectedSample === s.id ? "rgba(124,58,237,0.1)" : "transparent",
                    borderLeft: selectedSample === s.id ? "3px solid #7c3aed" : "3px solid transparent",
                  }}
                >
                  <div
                    className="text-sm font-medium"
                    style={{ color: selectedSample === s.id ? "#7c3aed" : "#1a2744", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    {s.label}
                  </div>
                  <div
                    className="text-xs mt-0.5"
                    style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {s.composer}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Upload */}
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {t("sheetMusicUpload")}
            </div>
            <label
              className="flex flex-col items-center gap-2 px-3 py-4 rounded cursor-pointer transition-all"
              style={{
                border: "2px dashed rgba(124,58,237,0.3)",
                background: uploadedFileName ? "rgba(124,58,237,0.05)" : "transparent",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(124,58,237,0.08)")}
              onMouseLeave={(e) => (e.currentTarget.style.background = uploadedFileName ? "rgba(124,58,237,0.05)" : "transparent")}
            >
              <Upload size={20} style={{ color: "#7c3aed" }} />
              {uploadedFileName ? (
                <div className="text-center">
                  <div className="text-xs font-medium" style={{ color: "#7c3aed", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {uploadedFileName}
                  </div>
                </div>
              ) : (
                <div className="text-center">
                  <div className="text-xs font-medium" style={{ color: "#1a2744", fontFamily: "'DM Sans', sans-serif" }}>
                    {t("sheetMusicDropFile")}
                  </div>
                  <div className="text-xs mt-1" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
                    .xml .musicxml .gp .gpx
                  </div>
                </div>
              )}
              <input
                type="file"
                accept=".musicxml,.xml,.mxl,.gp,.gp3,.gp4,.gp5,.gpx"
                onChange={handleFileUpload}
                className="hidden"
              />
            </label>
          </div>

          {/* Zoom */}
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {t("sheetMusicZoom")} — <span style={{ color: "#7c3aed" }}>{Math.round(zoom * 100)}%</span>
            </div>
            <input
              type="range"
              min={0.5}
              max={2.0}
              step={0.1}
              value={zoom}
              onChange={(e) => handleZoomChange(parseFloat(e.target.value))}
              className="w-full"
              style={{ accentColor: "#7c3aed" }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
              <span>50%</span><span>100%</span><span>200%</span>
            </div>
          </div>

          {/* Transpose */}
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              Transpose —{" "}
              <span style={{ color: transpose === 0 ? "#8a9bb0" : "#ff4f1f" }}>
                {transpose > 0 ? `+${transpose}` : transpose} st
              </span>
            </div>
            <input
              type="range"
              min={-12}
              max={12}
              step={1}
              value={transpose}
              onChange={(e) => handleTransposeChange(parseInt(e.target.value))}
              className="w-full"
              style={{ accentColor: "#ff4f1f" }}
            />
            <div className="flex justify-between text-xs mt-1" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
              <span>-12</span><span>0</span><span>+12</span>
            </div>
            {transpose !== 0 && (
              <button
                onClick={() => handleTransposeChange(0)}
                className="mt-2 text-xs px-2 py-0.5 rounded transition-all"
                style={{
                  background: "rgba(255,79,31,0.1)",
                  color: "#ff4f1f",
                  border: "1px solid rgba(255,79,31,0.3)",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                Reset
              </button>
            )}
          </div>

          {/* Format badge */}
          <div>
            <div
              className="text-xs font-semibold uppercase tracking-widest mb-2"
              style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              Format
            </div>
            <div className="flex items-center gap-2">
              <FileMusic size={13} style={{ color: "#7c3aed" }} />
              <span
                className="text-xs px-2 py-0.5 rounded"
                style={{
                  background: "rgba(124,58,237,0.1)",
                  color: "#7c3aed",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {scoreFormat}
              </span>
            </div>
          </div>
        </div>

        {/* ── Right panel: score display + playback ── */}
        <div className="flex-1 flex flex-col">
          {/* Score header */}
          <div
            className="px-6 py-4 flex items-center justify-between"
            style={{ borderBottom: "1px solid #e8e4dc", background: "#faf9f7" }}
          >
            <div>
              <h2
                className="text-lg font-bold"
                style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
              >
                {scoreTitle}
              </h2>
              {scoreComposer && (
                <div className="text-xs mt-0.5" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
                  {scoreComposer}
                </div>
              )}
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-xs" style={{ color: "#7c3aed", fontFamily: "'IBM Plex Mono', monospace" }}>
                <div
                  className="w-3 h-3 rounded-full animate-spin"
                  style={{ border: "2px solid rgba(124,58,237,0.2)", borderTop: "2px solid #7c3aed" }}
                />
                Rendering…
              </div>
            )}
          </div>

          {/* Error display */}
          {loadError && (
            <div
              className="mx-6 mt-4 px-4 py-3 rounded text-sm"
              style={{
                background: "rgba(239,68,68,0.08)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "#dc2626",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {loadError}
            </div>
          )}

          {/* alphaTab render container */}
          <div
            className="flex-1 overflow-auto px-4 py-4"
            style={{ background: "#fff" }}
          >
            <div
              ref={containerRef}
              className="at-wrap"
              style={{
                minHeight: 300,
                opacity: isLoading ? 0.4 : 1,
                transition: "opacity 0.3s ease",
                position: "relative",
              }}
            />
          </div>

          {/* ── Playback controls bar ── */}
          <div
            className="px-6 py-4 space-y-3"
            style={{
              borderTop: "2px solid #e8e4dc",
              background: "#1a2744",
            }}
          >
            {/* Progress bar */}
            <div className="flex items-center gap-3">
              <span
                className="text-xs w-10 text-right shrink-0"
                style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {formatTime(currentTime)}
              </span>
              <div
                className="flex-1 h-2 rounded-full cursor-pointer relative"
                style={{ background: "rgba(255,255,255,0.1)" }}
                onClick={handleProgressClick}
              >
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${progressPct}%`,
                    background: "linear-gradient(90deg, #7c3aed, #a855f7)",
                  }}
                />
              </div>
              <span
                className="text-xs w-10 shrink-0"
                style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
              >
                {formatTime(totalTime)}
              </span>
            </div>

            {/* Controls row */}
            <div className="flex items-center justify-between gap-4">
              {/* Transport buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleRestart}
                  className="w-9 h-9 rounded flex items-center justify-center transition-all"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#8a9bb0" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                  title="Restart"
                >
                  <SkipBack size={15} />
                </button>
                <button
                  onClick={handlePlayPause}
                  className="w-11 h-11 rounded-full flex items-center justify-center transition-all"
                  style={{
                    background: playbackState === "playing" ? "#ff4f1f" : "#7c3aed",
                    color: "white",
                    boxShadow: "0 0 12px rgba(124,58,237,0.4)",
                  }}
                  title={playbackState === "playing" ? "Pause" : "Play"}
                >
                  {playbackState === "playing" ? <Pause size={18} /> : <Play size={18} />}
                </button>
                <button
                  onClick={handleStop}
                  className="w-9 h-9 rounded flex items-center justify-center transition-all"
                  style={{ background: "rgba(255,255,255,0.08)", color: "#8a9bb0" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.15)")}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                  title="Stop"
                >
                  <Square size={15} />
                </button>
              </div>

              {/* Tempo */}
              <div className="flex items-center gap-3">
                <span className="text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
                  ♩=
                </span>
                <input
                  type="range"
                  min={40}
                  max={240}
                  step={1}
                  value={tempo}
                  onChange={(e) => handleTempoChange(parseInt(e.target.value))}
                  className="w-24"
                  style={{ accentColor: "#7c3aed" }}
                />
                <span
                  className="text-xs w-8"
                  style={{ color: "#7c3aed", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {tempo}
                </span>
              </div>

              {/* Volume */}
              <div className="flex items-center gap-3">
                <Volume2 size={14} style={{ color: "#8a9bb0" }} />
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.05}
                  value={volume}
                  onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                  className="w-20"
                  style={{ accentColor: "#7c3aed" }}
                />
                <span
                  className="text-xs w-8"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {Math.round(volume * 100)}%
                </span>
              </div>

              {/* Status badge */}
              <div
                className="px-3 py-1 rounded text-xs font-medium"
                style={{
                  background:
                    playbackState === "playing"
                      ? "rgba(255,79,31,0.2)"
                      : playbackState === "paused"
                      ? "rgba(0,212,255,0.15)"
                      : "rgba(255,255,255,0.08)",
                  color:
                    playbackState === "playing"
                      ? "#ff4f1f"
                      : playbackState === "paused"
                      ? "#00d4ff"
                      : "#8a9bb0",
                  fontFamily: "'IBM Plex Mono', monospace",
                  border: `1px solid ${
                    playbackState === "playing"
                      ? "rgba(255,79,31,0.3)"
                      : playbackState === "paused"
                      ? "rgba(0,212,255,0.25)"
                      : "rgba(255,255,255,0.1)"
                  }`,
                }}
              >
                {playbackState === "playing" ? "▶ PLAYING" : playbackState === "paused" ? "⏸ PAUSED" : "■ STOPPED"}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
