/*
 * Sequencer.tsx — SoundLab Sequencer Module
 * Bauhaus Frequency: dark navy cards, chalk bg, signal orange / electric cyan / lime green accents
 * Implements soundio/sequence JSON format: https://github.com/soundio/sequence
 *
 * Three tabs:
 *  1. Composer   — Piano roll step sequencer → soundio/sequence JSON
 *  2. Exporter   — Chord progression → soundio/sequence JSON
 *  3. Visualizer — Paste soundio/sequence JSON → piano roll timeline + playback
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Square, Download, Copy, Check, RefreshCw, Music2, FileJson, BarChart2 } from "lucide-react";
import { toast } from "sonner";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♭", "B"];
const NOTE_NAMES_FLAT = ["C", "D♭", "D", "E♭", "E", "F", "G♭", "G", "A♭", "A", "B♭", "B"];

// MIDI 60 = C4. We'll display 2 octaves: C3 (48) to B4 (71) = 24 notes
const PIANO_ROLL_NOTES: { midi: number; name: string; isBlack: boolean }[] = [];
for (let midi = 71; midi >= 48; midi--) {
  const pc = midi % 12;
  const oct = Math.floor(midi / 12) - 1;
  const blacks = [1, 3, 6, 8, 10];
  PIANO_ROLL_NOTES.push({
    midi,
    name: `${NOTE_NAMES[pc]}${oct}`,
    isBlack: blacks.includes(pc),
  });
}

const STEPS = 16; // 16 steps per bar (1/16th notes)

const CHORD_PROGRESSIONS: { name: string; chords: { root: string; hsid: string; beats: number }[] }[] = [
  {
    name: "I – IV – V – I (Major)",
    chords: [
      { root: "C", hsid: "∆", beats: 4 },
      { root: "F", hsid: "∆", beats: 4 },
      { root: "G", hsid: "7", beats: 4 },
      { root: "C", hsid: "∆", beats: 4 },
    ],
  },
  {
    name: "ii – V – I (Jazz)",
    chords: [
      { root: "D", hsid: "-7", beats: 4 },
      { root: "G", hsid: "7", beats: 4 },
      { root: "C", hsid: "∆", beats: 4 },
    ],
  },
  {
    name: "I – V – vi – IV (Pop)",
    chords: [
      { root: "C", hsid: "∆", beats: 4 },
      { root: "G", hsid: "∆", beats: 4 },
      { root: "A", hsid: "-7", beats: 4 },
      { root: "F", hsid: "∆", beats: 4 },
    ],
  },
  {
    name: "I – vi – IV – V (50s)",
    chords: [
      { root: "C", hsid: "∆", beats: 4 },
      { root: "A", hsid: "-7", beats: 4 },
      { root: "F", hsid: "∆", beats: 4 },
      { root: "G", hsid: "7", beats: 4 },
    ],
  },
  {
    name: "i – VII – VI – VII (Minor)",
    chords: [
      { root: "A", hsid: "-7", beats: 4 },
      { root: "G", hsid: "∆", beats: 4 },
      { root: "F", hsid: "∆", beats: 4 },
      { root: "G", hsid: "7", beats: 4 },
    ],
  },
  {
    name: "ii – V – I – VI (Turnaround)",
    chords: [
      { root: "D", hsid: "-7", beats: 4 },
      { root: "G", hsid: "7", beats: 4 },
      { root: "C", hsid: "∆", beats: 4 },
      { root: "A", hsid: "7", beats: 4 },
    ],
  },
];

// HSID name → interval semitones for chord playback
const HSID_INTERVALS: Record<string, number[]> = {
  "∆": [0, 4, 7],
  "7": [0, 4, 7, 10],
  "-7": [0, 3, 7, 10],
  "-": [0, 3, 7],
  "ø": [0, 3, 6, 10],
  "°": [0, 3, 6, 9],
  "+7": [0, 4, 8, 10],
  "∆7": [0, 4, 7, 11],
  "-∆": [0, 3, 7, 11],
  "7sus": [0, 5, 7, 10],
  "7♯11": [0, 4, 7, 10, 6],
  "∆♯11": [0, 4, 7, 11, 6],
};

const ROOT_TO_MIDI: Record<string, number> = {
  C: 60, "C♯": 61, D: 62, "D♯": 63, E: 64, F: 65,
  "F♯": 66, G: 67, "G♯": 68, A: 69, "A♭": 68, "B♭": 70, B: 71,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function midiToFreq(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

function getAudioCtx(): AudioContext {
  return new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
}

function playNote(ctx: AudioContext, midi: number, startTime: number, duration: number, gain = 0.5, waveform: OscillatorType = "triangle") {
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.connect(gainNode);
  gainNode.connect(ctx.destination);
  osc.type = waveform;
  osc.frequency.value = midiToFreq(midi);
  gainNode.gain.setValueAtTime(gain, startTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration * 0.9);
  osc.start(startTime);
  osc.stop(startTime + duration);
}

const WAVEFORMS: { type: OscillatorType; label: string; desc: string; color: string }[] = [
  { type: "sine",     label: "Sine",     desc: "Pure tone · single harmonic",       color: "#00d4ff" },
  { type: "triangle", label: "Triangle", desc: "Odd harmonics · soft timbre",        color: "#4ade80" },
  { type: "square",   label: "Square",   desc: "Odd harmonics · bright/hollow",      color: "#a78bfa" },
  { type: "sawtooth", label: "Sawtooth", desc: "All harmonics · rich/buzzy",         color: "#ff4f1f" },
];

function buildSequenceJSON(
  grid: boolean[][],
  bpm: number,
  timeNum: number,
  timeDen: number
): object {
  const beatsPerStep = (4 / timeDen) / (STEPS / timeNum);
  const events: unknown[] = [
    [0, "meter", timeNum, 4 / timeDen],
    [0, "rate", bpm / 60, "step"],
  ];
  PIANO_ROLL_NOTES.forEach((note, rowIdx) => {
    for (let step = 0; step < STEPS; step++) {
      if (grid[rowIdx][step]) {
        const beat = step * beatsPerStep;
        events.push([beat, "note", note.midi, 0.8, beatsPerStep]);
      }
    }
  });
  events.sort((a, b) => (a as number[])[0] - (b as number[])[0]);
  return {
    name: "SoundLab Composition",
    events,
  };
}

// ─── Tab: Composer ────────────────────────────────────────────────────────────

function ComposerTab() {
  const [grid, setGrid] = useState<boolean[][]>(() =>
    PIANO_ROLL_NOTES.map(() => Array(STEPS).fill(false))
  );
  const [bpm, setBpm] = useState(120);
  const [timeNum, setTimeNum] = useState(4);
  const [timeDen, setTimeDen] = useState(4);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [copied, setCopied] = useState(false);
  const [waveform, setWaveform] = useState<OscillatorType>("triangle");
  const ctxRef = useRef<AudioContext | null>(null);
  const schedulerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stepRef = useRef(0);
  const nextBeatTimeRef = useRef(0);
  const waveformRef = useRef<OscillatorType>("triangle");
  useEffect(() => { waveformRef.current = waveform; }, [waveform]);

  const toggleCell = useCallback((row: number, col: number) => {
    setGrid((g) => {
      const next = g.map((r) => [...r]);
      next[row][col] = !next[row][col];
      return next;
    });
  }, []);

  const clearGrid = () => setGrid(PIANO_ROLL_NOTES.map(() => Array(STEPS).fill(false)));

  const randomize = () => {
    setGrid(PIANO_ROLL_NOTES.map((_, rowIdx) =>
      Array(STEPS).fill(false).map(() => {
        // Prefer lower notes (higher row index = lower midi in our reversed list)
        const prob = rowIdx < 8 ? 0.05 : rowIdx < 16 ? 0.12 : 0.08;
        return Math.random() < prob;
      })
    ));
  };

  const secPerStep = (60 / bpm) * (4 / timeDen) / (STEPS / timeNum);

  const scheduleStep = useCallback(() => {
    if (!ctxRef.current) return;
    const ctx = ctxRef.current;
    const lookahead = 0.1;
    const scheduleAhead = 0.05;

    while (nextBeatTimeRef.current < ctx.currentTime + lookahead) {
      const step = stepRef.current;
      PIANO_ROLL_NOTES.forEach((note, rowIdx) => {
        if (grid[rowIdx][step]) {
          playNote(ctx, note.midi, nextBeatTimeRef.current, secPerStep * 0.85, 0.4, waveformRef.current);
        }
      });
      setCurrentStep(step);
      stepRef.current = (step + 1) % STEPS;
      nextBeatTimeRef.current += secPerStep;
    }
    schedulerRef.current = setTimeout(scheduleStep, scheduleAhead * 1000);
  }, [grid, secPerStep]);

  const startPlayback = useCallback(() => {
    if (isPlaying) return;
    const ctx = getAudioCtx();
    ctxRef.current = ctx;
    stepRef.current = 0;
    nextBeatTimeRef.current = ctx.currentTime + 0.05;
    setIsPlaying(true);
    scheduleStep();
  }, [isPlaying, scheduleStep]);

  const stopPlayback = useCallback(() => {
    if (schedulerRef.current) clearTimeout(schedulerRef.current);
    ctxRef.current?.close();
    ctxRef.current = null;
    setIsPlaying(false);
    setCurrentStep(-1);
    stepRef.current = 0;
  }, []);

  useEffect(() => {
    if (isPlaying) {
      if (schedulerRef.current) clearTimeout(schedulerRef.current);
      scheduleStep();
    }
  }, [grid, bpm, isPlaying, scheduleStep]);

  useEffect(() => () => { stopPlayback(); }, [stopPlayback]);

  const sequenceJSON = JSON.stringify(buildSequenceJSON(grid, bpm, timeNum, timeDen), null, 2);

  const copyJSON = () => {
    navigator.clipboard.writeText(sequenceJSON);
    setCopied(true);
    toast.success("Sequence JSON copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJSON = () => {
    const blob = new Blob([sequenceJSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "soundlab-sequence.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4 p-4 rounded-lg" style={{ background: "#1a2744" }}>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>BPM</span>
          <input
            type="number"
            min={40} max={240} value={bpm}
            onChange={(e) => setBpm(Number(e.target.value))}
            className="w-16 text-center text-sm rounded px-2 py-1 font-mono"
            style={{ background: "rgba(255,255,255,0.08)", color: "#00d4ff", border: "1px solid rgba(255,255,255,0.12)" }}
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>Time</span>
          <select
            value={`${timeNum}/${timeDen}`}
            onChange={(e) => {
              const [n, d] = e.target.value.split("/").map(Number);
              setTimeNum(n); setTimeDen(d);
            }}
            className="text-sm rounded px-2 py-1"
            style={{ background: "rgba(255,255,255,0.08)", color: "#00d4ff", border: "1px solid rgba(255,255,255,0.12)" }}
          >
            <option value="4/4">4/4</option>
            <option value="3/4">3/4</option>
            <option value="6/8">6/8</option>
            <option value="2/4">2/4</option>
          </select>
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <button
            onClick={randomize}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
          >
            <RefreshCw size={12} /> Randomize
          </button>
          <button
            onClick={clearGrid}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{ background: "rgba(255,255,255,0.06)", color: "#8a9bb0", border: "1px solid rgba(255,255,255,0.1)" }}
          >
            Clear
          </button>
          <button
            onClick={isPlaying ? stopPlayback : startPlayback}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-all"
            style={{
              background: isPlaying ? "rgba(255,79,31,0.2)" : "#ff4f1f",
              color: isPlaying ? "#ff4f1f" : "white",
              border: isPlaying ? "1px solid #ff4f1f" : "none",
            }}
          >
            {isPlaying ? <><Square size={12} /> Stop</> : <><Play size={12} /> Play</>}
          </button>
        </div>
      </div>

      {/* Waveform Selector */}
      <div className="flex flex-wrap items-center gap-2 p-3 rounded-lg" style={{ background: "rgba(26,39,68,0.06)", border: "1px solid rgba(26,39,68,0.12)" }}>
        <span className="text-xs font-semibold shrink-0" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>Waveform</span>
        {WAVEFORMS.map((w) => (
          <button
            key={w.type}
            onClick={() => setWaveform(w.type)}
            title={w.desc}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-all"
            style={{
              background: waveform === w.type ? `${w.color}22` : "transparent",
              color: waveform === w.type ? w.color : "#4a5a7a",
              border: `1px solid ${waveform === w.type ? w.color : "rgba(26,39,68,0.15)"}`,
              fontFamily: "'IBM Plex Mono', monospace",
            }}
          >
            {w.label}
          </button>
        ))}
        <span className="text-xs ml-2" style={{ color: "rgba(138,155,176,0.6)", fontFamily: "'IBM Plex Mono', monospace" }}>
          {WAVEFORMS.find((w) => w.type === waveform)?.desc}
        </span>
      </div>

      {/* Piano Roll Grid */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(26,39,68,0.2)" }}>
        <div className="overflow-x-auto">
          <div style={{ minWidth: 700 }}>
            {/* Step header */}
            <div className="flex" style={{ background: "#1a2744", paddingLeft: 80 }}>
              {Array(STEPS).fill(0).map((_, i) => (
                <div
                  key={i}
                  className="flex-1 text-center text-xs py-1 font-mono"
                  style={{
                    color: currentStep === i ? "#ff4f1f" : i % 4 === 0 ? "#00d4ff" : "#4a5a7a",
                    borderLeft: i % 4 === 0 ? "1px solid rgba(0,212,255,0.2)" : "1px solid rgba(255,255,255,0.04)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 9,
                    minWidth: 28,
                  }}
                >
                  {i % 4 === 0 ? i / 4 + 1 : "·"}
                </div>
              ))}
            </div>

            {/* Note rows */}
            {PIANO_ROLL_NOTES.map((note, rowIdx) => (
              <div
                key={note.midi}
                className="flex items-stretch"
                style={{
                  background: note.isBlack
                    ? "rgba(20,30,55,0.6)"
                    : rowIdx % 2 === 0 ? "rgba(247,245,240,0.95)" : "rgba(240,238,233,0.95)",
                  borderBottom: "1px solid rgba(26,39,68,0.08)",
                }}
              >
                {/* Note label */}
                <div
                  className="flex items-center justify-end pr-2 text-xs font-mono shrink-0"
                  style={{
                    width: 80,
                    color: note.isBlack ? "#8a9bb0" : "#1a2744",
                    background: note.isBlack ? "#1a2744" : "#e8e5de",
                    borderRight: "2px solid rgba(26,39,68,0.15)",
                    fontFamily: "'IBM Plex Mono', monospace",
                    fontSize: 10,
                  }}
                >
                  {note.name}
                </div>

                {/* Step cells */}
                {Array(STEPS).fill(0).map((_, step) => {
                  const active = grid[rowIdx][step];
                  const isCurrent = currentStep === step;
                  return (
                    <div
                      key={step}
                      onClick={() => toggleCell(rowIdx, step)}
                      className="flex-1 cursor-pointer transition-all"
                      style={{
                        minWidth: 28,
                        height: 22,
                        background: active
                          ? isCurrent ? "#ff6b3d" : "#ff4f1f"
                          : isCurrent
                            ? note.isBlack ? "rgba(0,212,255,0.15)" : "rgba(0,212,255,0.1)"
                            : "transparent",
                        borderLeft: step % 4 === 0 ? "1px solid rgba(26,39,68,0.12)" : "1px solid rgba(26,39,68,0.05)",
                        borderRadius: active ? 2 : 0,
                        margin: active ? "1px 0.5px" : 0,
                      }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* JSON Output */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(26,39,68,0.15)" }}>
        <div
          className="flex items-center justify-between px-4 py-2"
          style={{ background: "#1a2744", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
        >
          <div className="flex items-center gap-2">
            <FileJson size={13} style={{ color: "#00d4ff" }} />
            <span className="text-xs font-semibold" style={{ color: "#c8d3e0", fontFamily: "'IBM Plex Mono', monospace" }}>
              soundio/sequence JSON output
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copyJSON}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all"
              style={{ background: "rgba(0,212,255,0.1)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.2)" }}
            >
              {copied ? <Check size={11} /> : <Copy size={11} />}
              {copied ? "Copied!" : "Copy"}
            </button>
            <button
              onClick={downloadJSON}
              className="flex items-center gap-1.5 px-3 py-1 rounded text-xs transition-all"
              style={{ background: "rgba(255,79,31,0.1)", color: "#ff4f1f", border: "1px solid rgba(255,79,31,0.2)" }}
            >
              <Download size={11} /> Download
            </button>
          </div>
        </div>
        <pre
          className="p-4 text-xs overflow-auto"
          style={{
            background: "#0d1628",
            color: "#c8d3e0",
            fontFamily: "'IBM Plex Mono', monospace",
            maxHeight: 220,
            lineHeight: 1.6,
          }}
        >
          {sequenceJSON}
        </pre>
      </div>

      {/* Format reference */}
      <div className="text-xs px-1" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
        Format: <code style={{ color: "#00d4ff" }}>[beat, "note", midiPitch, dynamic, duration]</code>
        {" · "}rate = BPM/60 beats/sec
        {" · "}spec: <a href="https://github.com/soundio/sequence" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(0,212,255,0.7)" }}>soundio/sequence ↗</a>
      </div>
    </div>
  );
}

// ─── Tab: Exporter ────────────────────────────────────────────────────────────

function ExporterTab() {
  const [selectedProg, setSelectedProg] = useState(0);
  const [bpm, setBpm] = useState(120);
  const [customChords, setCustomChords] = useState<{ root: string; hsid: string; beats: number }[]>([
    { root: "C", hsid: "∆", beats: 4 },
    { root: "F", hsid: "∆", beats: 4 },
    { root: "G", hsid: "7", beats: 4 },
    { root: "C", hsid: "∆", beats: 4 },
  ]);
  const [useCustom, setUseCustom] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const chords = useCustom ? customChords : CHORD_PROGRESSIONS[selectedProg].chords;

  const buildJSON = () => {
    let beat = 0;
    const events: unknown[] = [
      [0, "meter", 4, 1],
      [0, "rate", bpm / 60, "step"],
    ];
    chords.forEach((chord) => {
      events.push([beat, "chord", chord.root, chord.hsid, chord.beats]);
      // Also add individual notes
      const rootMidi = ROOT_TO_MIDI[chord.root] ?? 60;
      const intervals = HSID_INTERVALS[chord.hsid] ?? [0, 4, 7];
      intervals.forEach((interval) => {
        events.push([beat, "note", rootMidi + interval, 0.75, chord.beats]);
      });
      beat += chord.beats;
    });
    return {
      name: useCustom ? "Custom Progression" : CHORD_PROGRESSIONS[selectedProg].name,
      events,
    };
  };

  const sequenceJSON = JSON.stringify(buildJSON(), null, 2);

  const copyJSON = () => {
    navigator.clipboard.writeText(sequenceJSON);
    setCopied(true);
    toast.success("Progression JSON copied!");
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadJSON = () => {
    const blob = new Blob([sequenceJSON], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "soundlab-progression.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const playProgression = async () => {
    if (isPlaying) {
      ctxRef.current?.close();
      ctxRef.current = null;
      setIsPlaying(false);
      return;
    }
    const ctx = getAudioCtx();
    ctxRef.current = ctx;
    setIsPlaying(true);
    const secPerBeat = 60 / bpm;
    let time = ctx.currentTime + 0.05;
    for (const chord of chords) {
      const rootMidi = ROOT_TO_MIDI[chord.root] ?? 60;
      const intervals = HSID_INTERVALS[chord.hsid] ?? [0, 4, 7];
      intervals.forEach((interval) => {
        playNote(ctx, rootMidi + interval, time, chord.beats * secPerBeat * 0.9, 0.3);
      });
      time += chord.beats * secPerBeat;
    }
    setTimeout(() => {
      ctxRef.current?.close();
      ctxRef.current = null;
      setIsPlaying(false);
    }, (time - ctx.currentTime) * 1000 + 200);
  };

  const updateCustomChord = (idx: number, field: "root" | "hsid" | "beats", value: string | number) => {
    setCustomChords((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const addChord = () => setCustomChords((prev) => [...prev, { root: "C", hsid: "∆", beats: 4 }]);
  const removeChord = (idx: number) => setCustomChords((prev) => prev.filter((_, i) => i !== idx));

  return (
    <div className="space-y-5">
      {/* Mode toggle */}
      <div className="flex gap-3">
        <button
          onClick={() => setUseCustom(false)}
          className="px-4 py-2 rounded text-sm font-medium transition-all"
          style={{
            background: !useCustom ? "#ff4f1f" : "rgba(255,79,31,0.08)",
            color: !useCustom ? "white" : "#ff4f1f",
            border: "1px solid rgba(255,79,31,0.3)",
          }}
        >
          Preset Progressions
        </button>
        <button
          onClick={() => setUseCustom(true)}
          className="px-4 py-2 rounded text-sm font-medium transition-all"
          style={{
            background: useCustom ? "#ff4f1f" : "rgba(255,79,31,0.08)",
            color: useCustom ? "white" : "#ff4f1f",
            border: "1px solid rgba(255,79,31,0.3)",
          }}
        >
          Custom Builder
        </button>
      </div>

      {!useCustom ? (
        /* Preset selector */
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {CHORD_PROGRESSIONS.map((prog, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedProg(idx)}
              className="text-left p-3 rounded-lg transition-all"
              style={{
                background: selectedProg === idx ? "rgba(255,79,31,0.1)" : "rgba(26,39,68,0.05)",
                border: `1px solid ${selectedProg === idx ? "rgba(255,79,31,0.4)" : "rgba(26,39,68,0.15)"}`,
              }}
            >
              <div className="text-sm font-semibold mb-1" style={{ color: "#1a2744", fontFamily: "'DM Sans', sans-serif" }}>
                {prog.name}
              </div>
              <div className="flex flex-wrap gap-1">
                {prog.chords.map((c, ci) => (
                  <span
                    key={ci}
                    className="px-2 py-0.5 rounded text-xs font-mono"
                    style={{ background: "#1a2744", color: "#00d4ff" }}
                  >
                    {c.root}{c.hsid}
                  </span>
                ))}
              </div>
            </button>
          ))}
        </div>
      ) : (
        /* Custom builder */
        <div className="space-y-2">
          {customChords.map((chord, idx) => (
            <div key={idx} className="flex items-center gap-3 p-3 rounded-lg" style={{ background: "rgba(26,39,68,0.06)", border: "1px solid rgba(26,39,68,0.12)" }}>
              <span className="text-xs font-mono w-5 text-center" style={{ color: "#8a9bb0" }}>{idx + 1}</span>
              <select
                value={chord.root}
                onChange={(e) => updateCustomChord(idx, "root", e.target.value)}
                className="text-sm rounded px-2 py-1"
                style={{ background: "#1a2744", color: "#00d4ff", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♭", "B♭", "B"].map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
              <select
                value={chord.hsid}
                onChange={(e) => updateCustomChord(idx, "hsid", e.target.value)}
                className="text-sm rounded px-2 py-1"
                style={{ background: "#1a2744", color: "#a78bfa", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {Object.keys(HSID_INTERVALS).map((h) => (
                  <option key={h} value={h}>{h}</option>
                ))}
              </select>
              <select
                value={chord.beats}
                onChange={(e) => updateCustomChord(idx, "beats", Number(e.target.value))}
                className="text-sm rounded px-2 py-1"
                style={{ background: "#1a2744", color: "#8a9bb0", border: "1px solid rgba(255,255,255,0.1)" }}
              >
                {[1, 2, 3, 4, 6, 8].map((b) => (
                  <option key={b} value={b}>{b} beat{b !== 1 ? "s" : ""}</option>
                ))}
              </select>
              <button
                onClick={() => removeChord(idx)}
                className="ml-auto text-xs px-2 py-1 rounded"
                style={{ color: "#ff4f1f", background: "rgba(255,79,31,0.1)" }}
              >
                ✕
              </button>
            </div>
          ))}
          <button
            onClick={addChord}
            className="w-full py-2 rounded text-xs font-medium transition-all"
            style={{ background: "rgba(0,212,255,0.06)", color: "#00d4ff", border: "1px dashed rgba(0,212,255,0.3)" }}
          >
            + Add Chord
          </button>
        </div>
      )}

      {/* BPM + Play */}
      <div className="flex items-center gap-4 p-3 rounded-lg" style={{ background: "#1a2744" }}>
        <span className="text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>BPM</span>
        <input
          type="number" min={40} max={240} value={bpm}
          onChange={(e) => setBpm(Number(e.target.value))}
          className="w-16 text-center text-sm rounded px-2 py-1 font-mono"
          style={{ background: "rgba(255,255,255,0.08)", color: "#00d4ff", border: "1px solid rgba(255,255,255,0.12)" }}
        />
        <button
          onClick={playProgression}
          className="flex items-center gap-2 px-4 py-1.5 rounded text-sm font-bold ml-auto transition-all"
          style={{
            background: isPlaying ? "rgba(255,79,31,0.2)" : "#ff4f1f",
            color: isPlaying ? "#ff4f1f" : "white",
            border: isPlaying ? "1px solid #ff4f1f" : "none",
          }}
        >
          {isPlaying ? <><Square size={13} /> Stop</> : <><Play size={13} /> Play Progression</>}
        </button>
      </div>

      {/* JSON Output */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(26,39,68,0.15)" }}>
        <div className="flex items-center justify-between px-4 py-2" style={{ background: "#1a2744" }}>
          <div className="flex items-center gap-2">
            <FileJson size={13} style={{ color: "#00d4ff" }} />
            <span className="text-xs font-semibold" style={{ color: "#c8d3e0", fontFamily: "'IBM Plex Mono', monospace" }}>
              soundio/sequence JSON
            </span>
          </div>
          <div className="flex gap-2">
            <button onClick={copyJSON} className="flex items-center gap-1.5 px-3 py-1 rounded text-xs" style={{ background: "rgba(0,212,255,0.1)", color: "#00d4ff", border: "1px solid rgba(0,212,255,0.2)" }}>
              {copied ? <Check size={11} /> : <Copy size={11} />} {copied ? "Copied!" : "Copy"}
            </button>
            <button onClick={downloadJSON} className="flex items-center gap-1.5 px-3 py-1 rounded text-xs" style={{ background: "rgba(255,79,31,0.1)", color: "#ff4f1f", border: "1px solid rgba(255,79,31,0.2)" }}>
              <Download size={11} /> Download
            </button>
          </div>
        </div>
        <pre className="p-4 text-xs overflow-auto" style={{ background: "#0d1628", color: "#c8d3e0", fontFamily: "'IBM Plex Mono', monospace", maxHeight: 240, lineHeight: 1.6 }}>
          {sequenceJSON}
        </pre>
      </div>

      {/* HSID reference */}
      <div className="rounded-lg p-4" style={{ background: "rgba(26,39,68,0.06)", border: "1px solid rgba(26,39,68,0.12)" }}>
        <div className="text-xs font-semibold mb-2" style={{ color: "#1a2744", fontFamily: "'IBM Plex Mono', monospace" }}>
          HSID Chord Symbols (soundio/sequence spec)
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
          {[
            ["∆", "Major (Ionian)"],
            ["7", "Dominant 7th (Mixolydian)"],
            ["-7", "Minor 7th (Dorian)"],
            ["-", "Minor"],
            ["ø", "Half-diminished (Locrian)"],
            ["°", "Fully diminished"],
            ["+7", "Whole tone / Aug 7th"],
            ["∆7", "Major 7th"],
            ["-∆", "Minor-Major 7th"],
            ["7sus", "Dominant 7sus4"],
            ["7♯11", "Lydian Dominant"],
            ["∆♯11", "Lydian Major 7th"],
          ].map(([sym, desc]) => (
            <div key={sym} className="flex items-center gap-2 text-xs">
              <span className="px-1.5 py-0.5 rounded font-mono shrink-0" style={{ background: "#1a2744", color: "#a78bfa", fontSize: 11 }}>{sym}</span>
              <span style={{ color: "#4a5a7a" }}>{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Tab: Visualizer ──────────────────────────────────────────────────────────

const DEMO_JSON = `{
  "name": "Dolphin Dance (excerpt)",
  "events": [
    [0,   "meter", 4, 1],
    [0,   "rate", 2, "step"],
    [2,   "note", 76, 0.8, 0.5],
    [2.5, "note", 77, 0.6, 0.5],
    [3,   "note", 79, 1, 0.5],
    [3.5, "note", 74, 1, 3.5],
    [10,  "note", 76, 1, 0.5],
    [0,   "chord", "C", "∆", 4],
    [4,   "chord", "G", "-", 4]
  ]
}`;

interface ParsedNote { beat: number; midi: number; dynamic: number; duration: number }
interface ParsedChord { beat: number; root: string; hsid: string; duration: number }
interface ParsedSequence {
  name: string;
  bpm: number;
  meter: [number, number];
  notes: ParsedNote[];
  chords: ParsedChord[];
  totalBeats: number;
}

function parseSequenceJSON(raw: string): { ok: true; seq: ParsedSequence } | { ok: false; error: string } {
  try {
    const obj = JSON.parse(raw);
    if (!obj.events || !Array.isArray(obj.events)) return { ok: false, error: "Missing 'events' array" };
    const notes: ParsedNote[] = [];
    const chords: ParsedChord[] = [];
    let bpm = 120;
    let meter: [number, number] = [4, 4];
    for (const ev of obj.events) {
      if (!Array.isArray(ev) || ev.length < 2) continue;
      const [beat, type, ...rest] = ev;
      if (type === "note") {
        const [midi, dynamic = 0.8, duration = 1] = rest;
        if (typeof midi === "number") notes.push({ beat, midi, dynamic, duration });
      } else if (type === "chord") {
        const [root, hsid, duration = 4] = rest;
        chords.push({ beat, root: String(root), hsid: String(hsid), duration });
      } else if (type === "rate") {
        bpm = Math.round(rest[0] * 60);
      } else if (type === "meter") {
        meter = [rest[0], 4 / rest[1]];
      }
    }
    const totalBeats = Math.max(
      ...notes.map((n) => n.beat + n.duration),
      ...chords.map((c) => c.beat + c.duration),
      4
    );
    return { ok: true, seq: { name: obj.name ?? "Untitled", bpm, meter, notes, chords, totalBeats } };
  } catch (e) {
    return { ok: false, error: String(e) };
  }
}

// ─── MusicXML → soundio/sequence converter ───────────────────────────────────

function musicXmlToSequenceJSON(xmlStr: string): string {
  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xmlStr, "application/xml");
    const parseError = doc.querySelector("parsererror");
    if (parseError) throw new Error("Invalid XML");

    const title = doc.querySelector("work-title, movement-title, credit-words")?.textContent?.trim() ?? "MusicXML Import";

    // Get divisions (ticks per quarter note)
    const divisionsEl = doc.querySelector("divisions");
    const divisions = divisionsEl ? parseInt(divisionsEl.textContent ?? "1") : 1;

    // Get tempo from sound element or default 120
    const soundEl = doc.querySelector("sound[tempo]");
    const bpm = soundEl ? parseFloat(soundEl.getAttribute("tempo") ?? "120") : 120;

    // Get time signature
    const beatsEl = doc.querySelector("beats");
    const beatTypeEl = doc.querySelector("beat-type");
    const timeNum = beatsEl ? parseInt(beatsEl.textContent ?? "4") : 4;
    const timeDen = beatTypeEl ? parseInt(beatTypeEl.textContent ?? "4") : 4;

    const events: unknown[] = [
      [0, "meter", timeNum, timeDen],
      [0, "rate", bpm / 60, "step"],
    ];

    // Parse notes from all measures
    const noteNameToSemitone: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
    let currentBeat = 0;
    let currentTick = 0;

    const measures = doc.querySelectorAll("measure");
    measures.forEach((measure) => {
      const noteEls = measure.querySelectorAll("note");
      noteEls.forEach((noteEl) => {
        const isRest = noteEl.querySelector("rest") !== null;
        const isChord = noteEl.querySelector("chord") !== null;
        const durationEl = noteEl.querySelector("duration");
        const durTicks = durationEl ? parseInt(durationEl.textContent ?? "0") : 0;
        const durBeats = durTicks / divisions;

        if (isChord) {
          // chord note: same start time as previous note
          currentTick -= durTicks; // rewind
        }

        if (!isRest) {
          const stepEl = noteEl.querySelector("step");
          const octaveEl = noteEl.querySelector("octave");
          const alterEl = noteEl.querySelector("alter");
          const step = stepEl?.textContent ?? "C";
          const octave = octaveEl ? parseInt(octaveEl.textContent ?? "4") : 4;
          const alter = alterEl ? parseInt(alterEl.textContent ?? "0") : 0;
          const semitone = noteNameToSemitone[step] ?? 0;
          const midi = (octave + 1) * 12 + semitone + alter;
          const beatPos = currentTick / divisions;
          const dynamic = 0.75;
          events.push([parseFloat(beatPos.toFixed(3)), "note", midi, dynamic, parseFloat(durBeats.toFixed(3))]);
        }

        currentTick += durTicks;
      });
      currentBeat = currentTick / divisions;
    });

    events.sort((a, b) => (a as number[])[0] - (b as number[])[0]);

    return JSON.stringify({ name: title, events }, null, 2);
  } catch (e) {
    throw new Error(`MusicXML parse failed: ${e}`);
  }
}

function VisualizerTab({ preloadedJSON }: { preloadedJSON?: string | null }) {
  const [jsonInput, setJsonInput] = useState(preloadedJSON ?? DEMO_JSON);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playhead, setPlayhead] = useState(0);
  const [xmlImportError, setXmlImportError] = useState("");
  const ctxRef = useRef<AudioContext | null>(null);
  const animRef = useRef<number | null>(null);
  const startTimeRef = useRef(0);
  const totalDurRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Update when preloadedJSON changes (e.g. navigated from Music Theory)
  useEffect(() => {
    if (preloadedJSON) setJsonInput(preloadedJSON);
  }, [preloadedJSON]);

  const handleMusicXmlImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const xml = ev.target?.result as string;
        const json = musicXmlToSequenceJSON(xml);
        setJsonInput(json);
        setXmlImportError("");
        toast.success(`Imported "${file.name}" as soundio/sequence JSON`);
      } catch (err) {
        setXmlImportError(String(err));
        toast.error("MusicXML import failed");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const parsed = parseSequenceJSON(jsonInput);
  const seq = parsed.ok ? parsed.seq : null;

  // Compute piano roll bounds
  const allMidi = seq ? seq.notes.map((n) => n.midi) : [60, 72];
  const minMidi = Math.max(0, Math.min(...allMidi) - 2);
  const maxMidi = Math.min(127, Math.max(...allMidi) + 2);
  const midiRange = maxMidi - minMidi + 1;

  const ROLL_HEIGHT = Math.max(120, midiRange * 14);
  const ROLL_WIDTH_PX_PER_BEAT = 60;

  const playSequence = async () => {
    if (!seq) return;
    if (isPlaying) {
      ctxRef.current?.close();
      ctxRef.current = null;
      if (animRef.current) cancelAnimationFrame(animRef.current);
      setIsPlaying(false);
      setPlayhead(0);
      return;
    }
    const ctx = getAudioCtx();
    ctxRef.current = ctx;
    setIsPlaying(true);
    const secPerBeat = 60 / seq.bpm;
    seq.notes.forEach((note) => {
      playNote(ctx, note.midi, ctx.currentTime + note.beat * secPerBeat, note.duration * secPerBeat * 0.9, note.dynamic * 0.5);
    });
    const totalSec = seq.totalBeats * secPerBeat;
    totalDurRef.current = totalSec;
    startTimeRef.current = ctx.currentTime;

    const animate = () => {
      if (!ctxRef.current) return;
      const elapsed = ctxRef.current.currentTime - startTimeRef.current;
      const progress = Math.min(elapsed / totalDurRef.current, 1);
      setPlayhead(progress);
      if (progress < 1) {
        animRef.current = requestAnimationFrame(animate);
      } else {
        setIsPlaying(false);
        setPlayhead(0);
        ctxRef.current?.close();
        ctxRef.current = null;
      }
    };
    animRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => () => {
    ctxRef.current?.close();
    if (animRef.current) cancelAnimationFrame(animRef.current);
  }, []);

  const midiToY = (midi: number) => {
    return ((maxMidi - midi) / midiRange) * ROLL_HEIGHT;
  };

  const NOTE_COLORS = ["#ff4f1f", "#ff6b3d", "#ffa07a", "#00d4ff", "#00b8d9", "#a78bfa", "#c4b5fd", "#4ade80", "#86efac"];

  return (
    <div className="space-y-5">
      {/* JSON input */}
      <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(26,39,68,0.15)" }}>
        <div className="flex flex-wrap items-center gap-2 px-4 py-2" style={{ background: "#1a2744" }}>
          <span className="text-xs font-semibold" style={{ color: "#c8d3e0", fontFamily: "'IBM Plex Mono', monospace" }}>
            Paste soundio/sequence JSON
          </span>
          <div className="flex items-center gap-2 ml-auto">
            {/* MusicXML import */}
            <input
              ref={fileInputRef}
              type="file"
              accept=".xml,.musicxml,.mxl"
              className="hidden"
              onChange={handleMusicXmlImport}
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs px-3 py-1 rounded transition-all"
              style={{ background: "rgba(74,222,128,0.1)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.3)" }}
              title="Import a .musicxml or .xml file and convert to soundio/sequence JSON"
            >
              ↑ Import MusicXML
            </button>
            <button
              onClick={() => setJsonInput(DEMO_JSON)}
              className="text-xs px-2 py-1 rounded"
              style={{ background: "rgba(167,139,250,0.15)", color: "#a78bfa", border: "1px solid rgba(167,139,250,0.3)" }}
            >
              Load Demo
            </button>
          </div>
        </div>
        <textarea
          value={jsonInput}
          onChange={(e) => setJsonInput(e.target.value)}
          rows={8}
          className="w-full p-4 text-xs resize-none outline-none"
          style={{
            background: "#0d1628",
            color: "#c8d3e0",
            fontFamily: "'IBM Plex Mono', monospace",
            lineHeight: 1.6,
          }}
          spellCheck={false}
        />
      </div>

      {/* XML import error */}
      {xmlImportError && (
        <div className="px-4 py-2 rounded text-xs" style={{ background: "rgba(74,222,128,0.08)", color: "#4ade80", border: "1px solid rgba(74,222,128,0.25)", fontFamily: "'IBM Plex Mono', monospace" }}>
          {xmlImportError}
        </div>
      )}

      {/* Parse error */}
      {!parsed.ok && (
        <div className="px-4 py-2 rounded text-xs" style={{ background: "rgba(255,79,31,0.1)", color: "#ff4f1f", border: "1px solid rgba(255,79,31,0.3)", fontFamily: "'IBM Plex Mono', monospace" }}>
          Parse error: {parsed.error}
        </div>
      )}

      {seq && (
        <>
          {/* Sequence info */}
          <div className="flex flex-wrap gap-4 p-4 rounded-lg" style={{ background: "#1a2744" }}>
            <div>
              <div className="text-xs" style={{ color: "#8a9bb0" }}>Name</div>
              <div className="text-sm font-semibold" style={{ color: "white", fontFamily: "'DM Serif Display', serif" }}>{seq.name}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "#8a9bb0" }}>BPM</div>
              <div className="text-sm font-mono" style={{ color: "#00d4ff" }}>{seq.bpm}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "#8a9bb0" }}>Meter</div>
              <div className="text-sm font-mono" style={{ color: "#00d4ff" }}>{seq.meter[0]}/{seq.meter[1]}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "#8a9bb0" }}>Notes</div>
              <div className="text-sm font-mono" style={{ color: "#ff4f1f" }}>{seq.notes.length}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "#8a9bb0" }}>Chords</div>
              <div className="text-sm font-mono" style={{ color: "#a78bfa" }}>{seq.chords.length}</div>
            </div>
            <div>
              <div className="text-xs" style={{ color: "#8a9bb0" }}>Duration</div>
              <div className="text-sm font-mono" style={{ color: "#4ade80" }}>{seq.totalBeats.toFixed(1)} beats</div>
            </div>
            <button
              onClick={playSequence}
              className="ml-auto flex items-center gap-2 px-4 py-1.5 rounded text-sm font-bold transition-all"
              style={{
                background: isPlaying ? "rgba(255,79,31,0.2)" : "#ff4f1f",
                color: isPlaying ? "#ff4f1f" : "white",
                border: isPlaying ? "1px solid #ff4f1f" : "none",
              }}
            >
              {isPlaying ? <><Square size={13} /> Stop</> : <><Play size={13} /> Play</>}
            </button>
          </div>

          {/* Piano Roll Visualization */}
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(26,39,68,0.15)" }}>
            <div className="px-4 py-2 text-xs font-semibold" style={{ background: "#1a2744", color: "#c8d3e0", fontFamily: "'IBM Plex Mono', monospace" }}>
              Piano Roll
            </div>
            <div className="overflow-x-auto" style={{ background: "#0d1628" }}>
              <div style={{ position: "relative", height: ROLL_HEIGHT + 30, minWidth: seq.totalBeats * ROLL_WIDTH_PX_PER_BEAT + 60 }}>
                {/* Beat grid lines */}
                {Array.from({ length: Math.ceil(seq.totalBeats) + 1 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: 60 + i * ROLL_WIDTH_PX_PER_BEAT,
                      top: 0,
                      bottom: 30,
                      width: 1,
                      background: i % 4 === 0 ? "rgba(0,212,255,0.2)" : "rgba(255,255,255,0.04)",
                    }}
                  />
                ))}

                {/* Beat labels */}
                {Array.from({ length: Math.ceil(seq.totalBeats / 4) + 1 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      position: "absolute",
                      left: 60 + i * 4 * ROLL_WIDTH_PX_PER_BEAT,
                      bottom: 6,
                      fontSize: 9,
                      color: "#00d4ff",
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {i * 4}
                  </div>
                ))}

                {/* MIDI row backgrounds */}
                {Array.from({ length: midiRange }, (_, i) => {
                  const midi = maxMidi - i;
                  const pc = midi % 12;
                  const isBlack = [1, 3, 6, 8, 10].includes(pc);
                  return (
                    <div
                      key={midi}
                      style={{
                        position: "absolute",
                        left: 0,
                        top: (i / midiRange) * ROLL_HEIGHT,
                        width: "100%",
                        height: ROLL_HEIGHT / midiRange,
                        background: isBlack ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.02)",
                        borderBottom: "1px solid rgba(255,255,255,0.03)",
                      }}
                    />
                  );
                })}

                {/* Note labels on left */}
                {Array.from({ length: midiRange }, (_, i) => {
                  const midi = maxMidi - i;
                  const pc = midi % 12;
                  const oct = Math.floor(midi / 12) - 1;
                  const showLabel = pc === 0; // only C notes
                  return showLabel ? (
                    <div
                      key={midi}
                      style={{
                        position: "absolute",
                        left: 2,
                        top: (i / midiRange) * ROLL_HEIGHT - 6,
                        fontSize: 8,
                        color: "#00d4ff",
                        fontFamily: "'IBM Plex Mono', monospace",
                        zIndex: 2,
                      }}
                    >
                      C{oct}
                    </div>
                  ) : null;
                })}

                {/* Chord bands */}
                {seq.chords.map((chord, ci) => (
                  <div
                    key={ci}
                    style={{
                      position: "absolute",
                      left: 60 + chord.beat * ROLL_WIDTH_PX_PER_BEAT,
                      top: 0,
                      width: chord.duration * ROLL_WIDTH_PX_PER_BEAT,
                      height: ROLL_HEIGHT,
                      background: `rgba(167,139,250,0.07)`,
                      borderLeft: "2px solid rgba(167,139,250,0.4)",
                      zIndex: 1,
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        top: 4,
                        left: 4,
                        fontSize: 10,
                        color: "#a78bfa",
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontWeight: 600,
                      }}
                    >
                      {chord.root}{chord.hsid}
                    </div>
                  </div>
                ))}

                {/* Note blocks */}
                {seq.notes.map((note, ni) => {
                  const y = midiToY(note.midi);
                  const noteH = Math.max(6, ROLL_HEIGHT / midiRange - 1);
                  const color = NOTE_COLORS[ni % NOTE_COLORS.length];
                  return (
                    <div
                      key={ni}
                      title={`MIDI ${note.midi} · beat ${note.beat} · dur ${note.duration} · dyn ${note.dynamic}`}
                      style={{
                        position: "absolute",
                        left: 60 + note.beat * ROLL_WIDTH_PX_PER_BEAT + 1,
                        top: y,
                        width: Math.max(4, note.duration * ROLL_WIDTH_PX_PER_BEAT - 2),
                        height: noteH,
                        background: color,
                        borderRadius: 2,
                        opacity: 0.85 + note.dynamic * 0.15,
                        zIndex: 3,
                      }}
                    />
                  );
                })}

                {/* Playhead */}
                {isPlaying && (
                  <div
                    style={{
                      position: "absolute",
                      left: 60 + playhead * seq.totalBeats * ROLL_WIDTH_PX_PER_BEAT,
                      top: 0,
                      bottom: 30,
                      width: 2,
                      background: "#ff4f1f",
                      zIndex: 10,
                      boxShadow: "0 0 6px rgba(255,79,31,0.8)",
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Event table */}
          <div className="rounded-lg overflow-hidden" style={{ border: "1px solid rgba(26,39,68,0.12)" }}>
            <div className="px-4 py-2 text-xs font-semibold" style={{ background: "#1a2744", color: "#c8d3e0", fontFamily: "'IBM Plex Mono', monospace" }}>
              Event Table
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                <thead>
                  <tr style={{ background: "rgba(26,39,68,0.08)" }}>
                    {["Beat", "Type", "Pitch / Root", "Dynamic / HSID", "Duration"].map((h) => (
                      <th key={h} className="px-3 py-2 text-left font-semibold" style={{ color: "#8a9bb0", borderBottom: "1px solid rgba(26,39,68,0.12)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seq.notes.map((n, i) => {
                    const pc = n.midi % 12;
                    const oct = Math.floor(n.midi / 12) - 1;
                    return (
                      <tr key={i} style={{ borderBottom: "1px solid rgba(26,39,68,0.06)" }}>
                        <td className="px-3 py-1.5" style={{ color: "#00d4ff" }}>{n.beat}</td>
                        <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(255,79,31,0.1)", color: "#ff4f1f" }}>note</span></td>
                        <td className="px-3 py-1.5" style={{ color: "#c8d3e0" }}>{NOTE_NAMES[pc]}{oct} <span style={{ color: "#4a5a7a" }}>(MIDI {n.midi})</span></td>
                        <td className="px-3 py-1.5" style={{ color: "#8a9bb0" }}>{n.dynamic}</td>
                        <td className="px-3 py-1.5" style={{ color: "#4ade80" }}>{n.duration} beat{n.duration !== 1 ? "s" : ""}</td>
                      </tr>
                    );
                  })}
                  {seq.chords.map((c, i) => (
                    <tr key={`c${i}`} style={{ borderBottom: "1px solid rgba(26,39,68,0.06)", background: "rgba(167,139,250,0.03)" }}>
                      <td className="px-3 py-1.5" style={{ color: "#00d4ff" }}>{c.beat}</td>
                      <td className="px-3 py-1.5"><span className="px-1.5 py-0.5 rounded" style={{ background: "rgba(167,139,250,0.1)", color: "#a78bfa" }}>chord</span></td>
                      <td className="px-3 py-1.5" style={{ color: "#c8d3e0" }}>{c.root}</td>
                      <td className="px-3 py-1.5" style={{ color: "#a78bfa" }}>{c.hsid}</td>
                      <td className="px-3 py-1.5" style={{ color: "#4ade80" }}>{c.duration} beats</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Main Sequencer Page ───────────────────────────────────────────────────────

const TABS = [
  { id: "composer", label: "Composer", icon: Music2, desc: "Piano roll → sequence JSON" },
  { id: "exporter", label: "Progression Exporter", icon: FileJson, desc: "Chord progression → sequence JSON" },
  { id: "visualizer", label: "Visualizer", icon: BarChart2, desc: "Paste JSON → piano roll" },
];

export default function Sequencer() {
  const [activeTab, setActiveTab] = useState("composer");
  const [preloadedJSON, setPreloadedJSON] = useState<string | null>(null);

  // Read URL params: ?tab=visualizer&seq=<encoded JSON>
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const seq = params.get("seq");
    if (tab && ["composer", "exporter", "visualizer"].includes(tab)) {
      setActiveTab(tab);
    }
    if (seq) {
      try {
        const decoded = decodeURIComponent(seq);
        setPreloadedJSON(decoded);
      } catch {
        // ignore malformed
      }
    }
  }, []);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-1">
          <span
            className="text-xs font-semibold uppercase tracking-widest px-2 py-0.5 rounded"
            style={{ background: "rgba(74,222,128,0.12)", color: "#4ade80", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            soundio/sequence
          </span>
        </div>
        <h1
          className="text-3xl font-bold mb-1"
          style={{ fontFamily: "'DM Serif Display', serif", color: "#1a2744" }}
        >
          Sequencer
        </h1>
        <p className="text-sm" style={{ color: "#4a5a7a", fontFamily: "'DM Sans', sans-serif" }}>
          Create, export, and visualize music sequences in the{" "}
          <a href="https://github.com/soundio/sequence" target="_blank" rel="noopener noreferrer" style={{ color: "#4ade80" }}>
            soundio/sequence JSON format
          </a>
          {" "}— a minimal, interoperable structure for timed musical events aligned with the Web Audio API, MIDI 1.0, and OSC.
        </p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: "rgba(26,39,68,0.06)", border: "1px solid rgba(26,39,68,0.1)" }}>
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium transition-all flex-1 justify-center"
            style={{
              background: activeTab === id ? "#1a2744" : "transparent",
              color: activeTab === id ? "white" : "#4a5a7a",
              fontFamily: "'DM Sans', sans-serif",
            }}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
          </button>
        ))}
      </div>

      {/* Tab description */}
      <div className="mb-4 text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
        {TABS.find((t) => t.id === activeTab)?.desc}
      </div>

      {/* Tab content */}
      {activeTab === "composer" && <ComposerTab />}
      {activeTab === "exporter" && <ExporterTab />}
      {activeTab === "visualizer" && <VisualizerTab preloadedJSON={preloadedJSON} />}

      {/* Spec reference footer */}
      <div
        className="mt-8 pt-4 text-xs flex flex-wrap gap-x-4 gap-y-1"
        style={{ borderTop: "1px solid rgba(26,39,68,0.1)", color: "rgba(74,90,122,0.6)", fontFamily: "'IBM Plex Mono', monospace" }}
      >
        <span>soundio/sequence spec</span>
        <span>·</span>
        <span>Event: [beat, type, ...params]</span>
        <span>·</span>
        <span>HSID = Harmonic Structure ID</span>
        <span>·</span>
        <span>rate 2 = 120 BPM</span>
        <span>·</span>
        <a href="https://github.com/soundio/sequence" target="_blank" rel="noopener noreferrer" style={{ color: "rgba(74,222,128,0.7)" }}>
          github.com/soundio/sequence ↗
        </a>
      </div>
    </div>
  );
}
