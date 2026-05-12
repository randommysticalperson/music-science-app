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
import { Music, Upload, Play, Pause, Square, SkipBack, Volume2, ChevronDown, ChevronUp, FileMusic, Info, Download, Repeat, Database, ExternalLink } from "lucide-react";
import * as alphaTab from "@coderline/alphatab";

// ─── Built-in demo score in alphaTex format ───────────────────────────────────
// Ode to Joy (Beethoven) — first 16 bars, treble clef
// alphaTex pitched note syntax: NoteOctave (e.g. E5, F5, G5)
// Duration change: :4 = quarter, :8 = eighth, :2 = half, :1 = whole
// Beat duration suffix: note.duration overrides for that beat only
const ODE_TO_JOY_TEX = `\\title "Ode to Joy"
\\subtitle "L. van Beethoven, Op. 125"
\\tempo 120
\\tuning piano
\\ts 4 4 :4 E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | E5.2 D5 D5.2 |
E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | D5.2 C5 C5.2 |
D5 D5 E5 C5 | D5 :8 E5 F5 :4 E5 C5 | D5 :8 E5 F5 :4 E5 D5 | C5 D5 G4 r |
E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | D5.2 C5 C5.2`.trim();

// ─── Additional sample scores in alphaTex format ────────────────────────────
const PENTATONIC_SCALE_TEX = `\\title "C Major Pentatonic Scale"
\\subtitle "5-note scale: C D E G A"
\\tempo 80
\\tuning piano
\\ts 4 4 :4 C5 D5 E5 G5 | A5 G5 E5 D5 | C5 D5 E5 G5 | A5 G5 E5 C5 |
:8 C5 D5 E5 G5 A5 G5 E5 D5 | C5.1`.trim();

const BLUES_RIFF_TEX = `\\title "12-Bar Blues Riff"
\\subtitle "E Blues — classic shuffle pattern"
\\tempo 100
\\tuning piano
\\ts 4 4 :4 E4 G4 A4 B4 | E4 G4 A4 B4 | E4 G4 A4 B4 | E4 G4 A4 B4 |
A4 C5 D5 E5 | A4 C5 D5 E5 | E4 G4 A4 B4 | E4 G4 A4 B4 |
B4 D5 E5 F5 | A4 C5 D5 E5 | E4 G4 A4 B4 | B4.2 E4.2`.trim();

const BACH_INVENTION_TEX = `\\title "Two-Part Invention No. 1"
\\subtitle "J.S. Bach, BWV 772 (excerpt)"
\\tempo 112
\\tuning piano
\\ts 4 4 :16 C5 D5 E5 F5 G5 A5 B5 C6 | B5 G5 A5 F5 :8 G5 r |
:16 E5 F5 G5 A5 B5 C6 D6 E6 | D6 B5 C6 A5 :8 B5 r |
:16 C6 B5 A5 G5 F5 E5 D5 C5 | B4 C5 D5 E5 :8 F5 r |
:4 G5 F5 E5 D5 | C5.1`.trim();

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
\\tuning piano
\\ts 4 4 :4 C5 C5 G5 G5 | A5 A5 G5.2 | F5 F5 E5 E5 | D5 D5 C5.2 |
G5 G5 F5 F5 | E5 E5 D5.2 | G5 G5 F5 F5 | E5 E5 D5.2 |
C5 C5 G5 G5 | A5 A5 G5.2 | F5 F5 E5 E5 | D5 D5 C5.2`.trim(),
  },
  {
    id: "minuet",
    label: "Minuet in G",
    composer: "J.S. Bach",
    format: "alphaTex",
    tex: `\\title "Minuet in G"
\\subtitle "J.S. Bach, BWV Anh. 114"
\\tempo 132
\\tuning piano
\\ts 3 4 :4 D5 G4 A4 | B4 C5 D5 | G4.2 r | E5 C5 D5 | E5 F5 E5 | D5.2 r |
C5 E5 D5 | C5 B4 A4 | B4 C5 D5 | G4.2 r |
B4 G4 A4 | B4 C5 D5 | E5.2 r | D5 C5 B4 | C5.2 r`.trim(),
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
  // ── Real MusicXML scores from musicxml.com official example set ──────────────
  {
    id: "mozart_sonata",
    label: "Piano Sonata K. 331",
    composer: "W.A. Mozart",
    format: "musicxml",
    url: "/manus-storage/MozartPianoSonata_a3dfaad3.musicxml",
    description: "Andante grazioso theme (MusicXML 4.0 official example)",
  },
  {
    id: "mozart_trio",
    label: "Piano Trio K. 254",
    composer: "W.A. Mozart",
    format: "musicxml",
    url: "/manus-storage/MozartTrio_153c3060.musicxml",
    description: "Chamber music — piano, violin, cello (MusicXML 4.0 official example)",
  },
  {
    id: "debussy_mandoline",
    label: "Mandoline",
    composer: "Claude Debussy",
    format: "musicxml",
    url: "/manus-storage/DebuMandSample_6e43708b.musicxml",
    description: "Impressionist art song, voice & piano (MusicXML 4.0 official example)",
  },
  {
    id: "dichterliebe",
    label: "Dichterliebe Op. 48",
    composer: "Robert Schumann",
    format: "musicxml",
    url: "/manus-storage/Dichterliebe01_3ab66778.musicxml",
    description: "Im wunderschönen Monat Mai — complete song (MusicXML 4.0 official example)",
  },
  {
    id: "echigo_jishi",
    label: "Echigo-Jishi",
    composer: "Traditional Japanese",
    format: "musicxml",
    url: "/manus-storage/Echigo-Jishi_ac476fd4.musicxml",
    description: "Traditional Japanese shamisen piece (MusicXML 4.0 official example)",
  },
  {
    id: "gregorian_chant",
    label: "Gregorian Chant",
    composer: "Medieval Plainchant",
    format: "musicxml",
    url: "/manus-storage/Chant_1492e9e9.musicxml",
    description: "Medieval plainchant notation example (MusicXML 4.0 official example)",
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
  const [isLooping, setIsLooping] = useState(false);
  const [showDatabases, setShowDatabases] = useState(false);
  const [dbSearch, setDbSearch] = useState("");
  // ─── Metronome state ─────────────────────────────────────────────────────────
  const [metroBeat, setMetroBeat] = useState(0);      // increments each beat
  const [metroFlash, setMetroFlash] = useState(false); // true for ~120 ms on each beat
  const lastBeatRef = useRef(-1);                      // last beat index we fired on
  const metroTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      // ── Beat detection: fire on each new beat index ──────────────────────────
      const beat = (args as unknown as { currentBeat?: number }).currentBeat ?? Math.floor((args.currentTime / 60000) * 120);
      if (beat !== lastBeatRef.current) {
        lastBeatRef.current = beat;
        setMetroBeat((b) => b + 1);
        setMetroFlash(true);
        if (metroTimerRef.current) clearTimeout(metroTimerRef.current);
        metroTimerRef.current = setTimeout(() => setMetroFlash(false), 120);
      }
    });
    api.playerFinished.on(() => {
      setPlaybackState("stopped");
      setCurrentTime(0);
      setMetroFlash(false);
      lastBeatRef.current = -1;
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
    if (sample.format === "musicxml" && sample.url) {
      // Load MusicXML from URL — alphaTab.load() needs ArrayBuffer, not raw text
      fetch(sample.url)
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.arrayBuffer();
        })
        .then((buf) => {
          at.load(new Uint8Array(buf));
        })
        .catch((err) => {
          setLoadError(`Failed to load MusicXML: ${err.message}`);
          setIsLoading(false);
        });
    } else if (sample.tex) {
      at.tex(sample.tex);
    }
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

  // ─── MIDI Export ────────────────────────────────────────────────────────────
  const handleDownloadMidi = () => {
    if (!apiRef.current) return;
    try {
      apiRef.current.downloadMidi();
    } catch (err) {
      console.error("MIDI export failed:", err);
    }
  };

  // ─── Loop toggle ─────────────────────────────────────────────────────────────
  const handleLoopToggle = () => {
    if (!apiRef.current) return;
    const next = !isLooping;
    setIsLooping(next);
    apiRef.current.isLooping = next;
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
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="text-xs"
                      style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {s.composer}
                    </span>
                    {s.format === "musicxml" && (
                      <span
                        className="text-xs px-1 rounded"
                        style={{ background: "rgba(0,212,255,0.12)", color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px", letterSpacing: "0.05em" }}
                      >
                        MusicXML
                      </span>
                    )}
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

          {/* Score Databases */}
          <div>
            <button
              onClick={() => setShowDatabases((v) => !v)}
              className="w-full flex items-center justify-between py-1 transition-all"
            >
              <div className="flex items-center gap-2">
                <Database size={13} style={{ color: "#00d4ff" }} />
                <span
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Score Databases
                </span>
              </div>
              {showDatabases ? <ChevronUp size={13} style={{ color: "#00d4ff" }} /> : <ChevronDown size={13} style={{ color: "#8a9bb0" }} />}
            </button>
            {showDatabases && (
              <div className="mt-3 space-y-3">
                {/* Search shortcut */}
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search a database…"
                    value={dbSearch}
                    onChange={(e) => setDbSearch(e.target.value)}
                    className="w-full text-xs px-2.5 py-1.5 rounded outline-none"
                    style={{
                      background: "rgba(255,255,255,0.04)",
                      border: "1px solid rgba(255,255,255,0.1)",
                      color: "#e8f4f8",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "rgba(0,212,255,0.4)"; }}
                    onBlur={(e) => { e.currentTarget.style.borderColor = "rgba(255,255,255,0.1)"; }}
                  />
                  {dbSearch.trim() && (
                    <div className="mt-1.5 flex gap-1.5 flex-wrap">
                      {([
                        { label: "MuseScore", url: `https://musescore.com/sheetmusic?text=${encodeURIComponent(dbSearch)}`, color: "#00d4ff" },
                        { label: "IMSLP", url: `https://imslp.org/wiki/Special:Search?search=${encodeURIComponent(dbSearch)}`, color: "#00d4ff" },
                        { label: "Google", url: `https://www.google.com/search?q=${encodeURIComponent(dbSearch + " sheet music")}`, color: "#8a9bb0" },
                      ]).map((s) => (
                        <a
                          key={s.label}
                          href={s.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-all"
                          style={{ background: "rgba(255,255,255,0.05)", border: `1px solid ${s.color}40`, color: s.color, fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px" }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.1)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
                        >
                          <ExternalLink size={9} />
                          {s.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                {/* Regional sections */}
                {([
                  {
                    region: "🌐 International",
                    color: "#00d4ff",
                    bg: "rgba(0,212,255,0.06)",
                    border: "rgba(0,212,255,0.15)",
                    dbs: [
                      { name: "IMSLP",           desc: "600k+ public domain scores",   url: "https://imslp.org",                                              badges: ["PDF","MusicXML","Free"] },
                      { name: "MuseScore",        desc: "Community sheet music",        url: "https://musescore.com",                                          badges: ["PDF","MIDI","MusicXML","Free"] },
                      { name: "Mutopia Project",  desc: "Free LilyPond scores",         url: "https://www.mutopiaproject.org",                                 badges: ["PDF","MIDI","Free"] },
                      { name: "OpenScore",        desc: "High-quality MusicXML",        url: "https://openscore.musescore.com",                                badges: ["MusicXML","Free"] },
                      { name: "Kern Scores",      desc: "Academic Humdrum dataset",     url: "https://kern.humdrum.org",                                       badges: ["MusicXML","MIDI","Free"] },
                      { name: "MusicXML.com",     desc: "Official MusicXML examples",   url: "https://www.musicxml.com/music-in-musicxml/example-set/",        badges: ["MusicXML","Free"] },
                      { name: "CPDL",             desc: "Choral public domain",         url: "https://www.cpdl.org",                                           badges: ["PDF","MIDI","Free"] },
                      { name: "Free-Scores",      desc: "Free classical sheet music",   url: "https://www.free-scores.com",                                    badges: ["PDF","MIDI","Free"] },
                      { name: "8notes",           desc: "Graded sheet music library",   url: "https://www.8notes.com",                                         badges: ["PDF","MIDI","Free"] },
                      { name: "MIDI World",       desc: "MIDI file repository",         url: "https://www.midiworld.com",                                      badges: ["MIDI","Free"] },
                    ],
                  },
                  {
                    region: "🇯🇵 日本語",
                    color: "#ff4f1f",
                    bg: "rgba(255,79,31,0.05)",
                    border: "rgba(255,79,31,0.15)",
                    dbs: [
                      { name: "楽譜ネット",            desc: "国内最大 300k+ 楽譜データベース",  url: "https://www.gakufu.ne.jp/",         badges: ["PDF","Paid"] },
                      { name: "ぷりんと楽譜 (Yamaha)", desc: "ヤマハ公式 PDF/MIDI ダウンロード", url: "https://www.print-gakufu.com/",      badges: ["PDF","MIDI","Paid"] },
                      { name: "Piascore 楽譜ストア",   desc: "30万曲以上・タブレット対応",       url: "https://store.piascore.com/",       badges: ["PDF","Paid"] },
                      { name: "J-Total Music",         desc: "無料ギターコード譜・J-POP 歌詞",   url: "https://music.j-total.net/",        badges: ["PDF","Free"] },
                      { name: "PopPiano (日本語)",      desc: "無料ピアノ楽譜 PDF・アニメ/J-POP", url: "https://www.poppiano.org/jp/",      badges: ["PDF","Free"] },
                    ],
                  },
                  {
                    region: "🇹🇼🇨🇳 中文",
                    color: "#a855f7",
                    bg: "rgba(168,85,247,0.05)",
                    border: "rgba(168,85,247,0.15)",
                    dbs: [
                      { name: "中國曲譜網",             desc: "10萬+ 簡譜/五線譜/鋼琴/吉他/戲曲", url: "https://www.qupu123.com/",           badges: ["PDF","Free"] },
                      { name: "樂譜網",                 desc: "免費二胡/古箏/琵琶/鋼琴樂譜",      url: "https://www.yuepuwang.com.cn/",     badges: ["PDF","Free"] },
                      { name: "臺灣音樂館 Open Museum", desc: "台灣傳統音樂典藏・原住民族音樂",    url: "https://tmi.openmuseum.tw/objects", badges: ["PDF","Free"] },
                      { name: "PopPiano (繁體中文)",    desc: "免費鋼琴樂譜 PDF・港台流行音樂",   url: "https://www.poppiano.org/zh/",      badges: ["PDF","Free"] },
                    ],
                  },
                  {
                    region: "🇰🇷 한국어",
                    color: "#22d3ee",
                    bg: "rgba(34,211,238,0.05)",
                    border: "rgba(34,211,238,0.15)",
                    dbs: [
                      { name: "악보바다",          desc: "한국 최대 100k+ 악보 (K-pop/클래식)",  url: "https://www.akbobada.com/",     badges: ["PDF","MIDI","Paid"] },
                      { name: "DooPiano",          desc: "K-pop 피아노 편곡 전문",               url: "https://doopiano.com/",         badges: ["PDF","Paid"] },
                      { name: "Sharmony Music",    desc: "무료 K-pop 바이올린/첼로 악보",        url: "https://sharleemusic.com/",     badges: ["PDF","Free"] },
                      { name: "PopPiano (한국어)",  desc: "무료 피아노 악보 PDF · K-pop",        url: "https://www.poppiano.org/ko/", badges: ["PDF","Free"] },
                    ],
                  },
                ] as { region: string; color: string; bg: string; border: string; dbs: { name: string; desc: string; url: string; badges: string[] }[] }[]).map((section) => {
                  const BADGE_COLORS: Record<string, { bg: string; text: string }> = {
                    PDF:      { bg: "rgba(0,212,255,0.12)",   text: "#00d4ff" },
                    MIDI:     { bg: "rgba(255,79,31,0.12)",   text: "#ff7a52" },
                    MusicXML: { bg: "rgba(168,85,247,0.12)",  text: "#c084fc" },
                    Free:     { bg: "rgba(0,255,136,0.12)",   text: "#00cc6a" },
                    Paid:     { bg: "rgba(251,191,36,0.12)",  text: "#fbbf24" },
                  };
                  const q = dbSearch.trim().toLowerCase();
                  const filteredDbs = q
                    ? section.dbs.filter(
                        (db) =>
                          db.name.toLowerCase().includes(q) ||
                          db.desc.toLowerCase().includes(q) ||
                          db.badges.some((b) => b.toLowerCase().includes(q))
                      )
                    : section.dbs;
                  if (filteredDbs.length === 0) return null;
                  return (
                    <div key={section.region}>
                      <div
                        className="text-xs font-bold mb-1.5 uppercase tracking-wider"
                        style={{ color: section.color, fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px" }}
                      >
                        {section.region}
                      </div>
                      <div className="space-y-1.5">
                        {filteredDbs.map((db) => (
                          <a
                            key={db.name}
                            href={db.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start justify-between gap-2 px-2.5 py-2 rounded transition-all"
                            style={{ background: section.bg, border: `1px solid ${section.border}` }}
                            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.3)"; }}
                            onMouseLeave={(e) => { e.currentTarget.style.filter = "brightness(1)"; }}
                          >
                            <div className="min-w-0 flex-1">
                              <div
                                className="text-xs font-semibold truncate"
                                style={{ color: "#e8f4f8", fontFamily: "'DM Sans', sans-serif" }}
                              >
                                {db.name}
                              </div>
                              <div
                                className="mt-0.5 truncate"
                                style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace", fontSize: "9px" }}
                              >
                                {db.desc}
                              </div>
                              <div className="flex flex-wrap gap-1 mt-1">
                                {db.badges.map((badge) => {
                                  const bc = BADGE_COLORS[badge] ?? { bg: "rgba(255,255,255,0.08)", text: "#8a9bb0" };
                                  return (
                                    <span
                                      key={badge}
                                      style={{
                                        background: bc.bg,
                                        color: bc.text,
                                        fontFamily: "'IBM Plex Mono', monospace",
                                        fontSize: "8px",
                                        padding: "1px 5px",
                                        borderRadius: "3px",
                                        fontWeight: 600,
                                        letterSpacing: "0.04em",
                                      }}
                                    >
                                      {badge}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                            <ExternalLink size={11} className="shrink-0 mt-0.5" style={{ color: section.color, opacity: 0.7 }} />
                          </a>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
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

          {/* ── Metronome overlay flash ── */}
          {playbackState === "playing" && (
            <div
              key={metroBeat}
              style={{
                position: "absolute",
                inset: 0,
                pointerEvents: "none",
                zIndex: 10,
                background: metroFlash
                  ? "rgba(0, 212, 255, 0.07)"
                  : "transparent",
                transition: metroFlash ? "none" : "background 0.12s ease-out",
                borderRadius: "inherit",
              }}
            />
          )}
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

              {/* Metronome indicator */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
                title="Visual metronome — flashes on each beat during playback"
              >
                {/* Pendulum icon */}
                <svg
                  width="18" height="18" viewBox="0 0 18 18" fill="none"
                  style={{ opacity: playbackState === "playing" ? 1 : 0.35 }}
                >
                  <circle cx="9" cy="14" r="2.5"
                    fill={metroFlash && playbackState === "playing" ? "#00d4ff" : "#4a5568"}
                    style={{ transition: "fill 0.05s" }}
                  />
                  <line x1="9" y1="2" x2="9" y2="12"
                    stroke={metroFlash && playbackState === "playing" ? "#00d4ff" : "#4a5568"}
                    strokeWidth="1.5" strokeLinecap="round"
                    style={{
                      transformOrigin: "9px 14px",
                      transform: playbackState === "playing"
                        ? (metroBeat % 2 === 0 ? "rotate(-22deg)" : "rotate(22deg)")
                        : "rotate(0deg)",
                      transition: playbackState === "playing" ? "transform 0.12s ease-in-out" : "none",
                    }}
                  />
                </svg>
                {/* Beat dot row */}
                <div style={{ display: "flex", gap: "3px", alignItems: "center" }}>
                  {[0, 1, 2, 3].map((i) => (
                    <div
                      key={i}
                      style={{
                        width: i === 0 ? "8px" : "5px",
                        height: i === 0 ? "8px" : "5px",
                        borderRadius: "50%",
                        background:
                          playbackState === "playing" && metroFlash && (metroBeat % 4) === i
                            ? i === 0 ? "#00d4ff" : "#7c3aed"
                            : "rgba(255,255,255,0.12)",
                        transition: "background 0.05s",
                        boxShadow:
                          playbackState === "playing" && metroFlash && (metroBeat % 4) === i
                            ? i === 0
                              ? "0 0 6px rgba(0,212,255,0.8)"
                              : "0 0 4px rgba(124,58,237,0.8)"
                            : "none",
                      }}
                    />
                  ))}
                </div>
              </div>
              {/* Loop toggle */}
              <button
                onClick={handleLoopToggle}
                className="w-9 h-9 rounded flex items-center justify-center transition-all"
                style={{
                  background: isLooping ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.08)",
                  color: isLooping ? "#00d4ff" : "#8a9bb0",
                  border: isLooping ? "1px solid rgba(0,212,255,0.4)" : "1px solid transparent",
                }}
                title={isLooping ? "Loop ON — click to disable" : "Loop OFF — click to enable"}
              >
                <Repeat size={15} />
              </button>

              {/* MIDI Download */}
              <button
                onClick={handleDownloadMidi}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs transition-all"
                style={{
                  background: "rgba(255,255,255,0.08)",
                  color: "#8a9bb0",
                  border: "1px solid rgba(255,255,255,0.1)",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(124,58,237,0.25)"; e.currentTarget.style.color = "#a855f7"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; e.currentTarget.style.color = "#8a9bb0"; }}
                title="Export as MIDI file"
              >
                <Download size={13} />
                MIDI
              </button>

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
