/*
 * MusicTheory.tsx — Bauhaus Frequency Design
 * Interactive piano, scales, chords, intervals, progressions
 * Uses Web Audio API for real-time sound synthesis
 */
import { useState, useEffect, useRef, useCallback } from "react";

// ─── Music Theory Data ────────────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

const SCALES: Record<string, { intervals: number[]; description: string }> = {
  "Major": { intervals: [0,2,4,5,7,9,11], description: "The foundation of Western music. Bright, happy, stable. Built on the pattern W-W-H-W-W-W-H (whole/half steps)." },
  "Natural Minor": { intervals: [0,2,3,5,7,8,10], description: "Darker, more melancholic than major. The relative minor shares the same key signature as its major counterpart." },
  "Harmonic Minor": { intervals: [0,2,3,5,7,8,11], description: "Natural minor with raised 7th degree. Creates a distinctive augmented 2nd interval, common in classical and Middle Eastern music." },
  "Melodic Minor": { intervals: [0,2,3,5,7,9,11], description: "Raises both 6th and 7th when ascending. Used extensively in jazz and classical composition." },
  "Pentatonic Major": { intervals: [0,2,4,7,9], description: "Five-note scale found in music worldwide. Removes the 4th and 7th scale degrees, eliminating dissonance." },
  "Pentatonic Minor": { intervals: [0,3,5,7,10], description: "The backbone of blues, rock, and folk music. Highly consonant and versatile across genres." },
  "Blues": { intervals: [0,3,5,6,7,10], description: "Pentatonic minor with added ♭5 (blue note). The characteristic sound of blues and jazz improvisation." },
  "Dorian": { intervals: [0,2,3,5,7,9,10], description: "Minor scale with raised 6th. Brighter than natural minor, used in jazz, funk, and modal music (e.g., D Dorian in Miles Davis)." },
  "Phrygian": { intervals: [0,1,3,5,7,8,10], description: "Minor scale with lowered 2nd. Dark, Spanish/Flamenco character. Common in metal and flamenco." },
  "Lydian": { intervals: [0,2,4,6,7,9,11], description: "Major scale with raised 4th. Dreamy, ethereal quality. Frequently used in film scores (John Williams)." },
  "Mixolydian": { intervals: [0,2,4,5,7,9,10], description: "Major scale with lowered 7th. The sound of rock and blues. Used in 'Norwegian Wood', 'Sweet Home Chicago'." },
  "Locrian": { intervals: [0,1,3,5,6,8,10], description: "The most dissonant mode. Diminished tonic chord makes it unstable. Rarely used as a tonal center." },
  "Whole Tone": { intervals: [0,2,4,6,8,10], description: "All whole steps. No leading tone, creates ambiguity. Debussy used it extensively for impressionistic effects." },
  "Diminished": { intervals: [0,2,3,5,6,8,9,11], description: "Alternating whole and half steps. Symmetrical — repeats every minor 3rd. Used over diminished 7th chords in jazz." },
};

const CHORD_TYPES: Record<string, { intervals: number[]; symbol: string; description: string }> = {
  "Major": { intervals: [0,4,7], symbol: "", description: "Root + major 3rd + perfect 5th. Stable, bright, consonant." },
  "Minor": { intervals: [0,3,7], symbol: "m", description: "Root + minor 3rd + perfect 5th. Darker, more introspective than major." },
  "Dominant 7th": { intervals: [0,4,7,10], symbol: "7", description: "Major triad + minor 7th. Creates tension that resolves to tonic. Foundation of blues." },
  "Major 7th": { intervals: [0,4,7,11], symbol: "maj7", description: "Major triad + major 7th. Lush, jazzy, romantic sound." },
  "Minor 7th": { intervals: [0,3,7,10], symbol: "m7", description: "Minor triad + minor 7th. Smooth, melancholic. Common in jazz and R&B." },
  "Diminished": { intervals: [0,3,6], symbol: "dim", description: "Root + minor 3rd + diminished 5th. Tense, unstable, dissonant." },
  "Augmented": { intervals: [0,4,8], symbol: "aug", description: "Root + major 3rd + augmented 5th. Mysterious, unresolved tension." },
  "Suspended 2nd": { intervals: [0,2,7], symbol: "sus2", description: "Replaces 3rd with major 2nd. Open, ambiguous quality." },
  "Suspended 4th": { intervals: [0,5,7], symbol: "sus4", description: "Replaces 3rd with perfect 4th. Yearning, unresolved feeling." },
  "Add 9": { intervals: [0,4,7,14], symbol: "add9", description: "Major triad with added 9th (no 7th). Bright, modern pop sound." },
  "Minor 9th": { intervals: [0,3,7,10,14], symbol: "m9", description: "Minor 7th with added 9th. Rich, sophisticated jazz harmony." },
  "Diminished 7th": { intervals: [0,3,6,9], symbol: "dim7", description: "Fully diminished — all minor 3rds. Symmetrical, maximum tension." },
  "Half-Diminished": { intervals: [0,3,6,10], symbol: "ø7", description: "Diminished triad + minor 7th. Common as ii chord in minor keys." },
};

const INTERVALS = [
  { semitones: 0, name: "Unison", abbr: "P1", ratio: "1:1", consonance: "Perfect", example: "C–C" },
  { semitones: 1, name: "Minor 2nd", abbr: "m2", ratio: "16:15", consonance: "Dissonant", example: "C–D♭" },
  { semitones: 2, name: "Major 2nd", abbr: "M2", ratio: "9:8", consonance: "Mild Dissonance", example: "C–D" },
  { semitones: 3, name: "Minor 3rd", abbr: "m3", ratio: "6:5", consonance: "Imperfect", example: "C–E♭" },
  { semitones: 4, name: "Major 3rd", abbr: "M3", ratio: "5:4", consonance: "Imperfect", example: "C–E" },
  { semitones: 5, name: "Perfect 4th", abbr: "P4", ratio: "4:3", consonance: "Perfect", example: "C–F" },
  { semitones: 6, name: "Tritone", abbr: "TT", ratio: "45:32", consonance: "Dissonant", example: "C–F#" },
  { semitones: 7, name: "Perfect 5th", abbr: "P5", ratio: "3:2", consonance: "Perfect", example: "C–G" },
  { semitones: 8, name: "Minor 6th", abbr: "m6", ratio: "8:5", consonance: "Imperfect", example: "C–A♭" },
  { semitones: 9, name: "Major 6th", abbr: "M6", ratio: "5:3", consonance: "Imperfect", example: "C–A" },
  { semitones: 10, name: "Minor 7th", abbr: "m7", ratio: "16:9", consonance: "Mild Dissonance", example: "C–B♭" },
  { semitones: 11, name: "Major 7th", abbr: "M7", ratio: "15:8", consonance: "Dissonant", example: "C–B" },
  { semitones: 12, name: "Octave", abbr: "P8", ratio: "2:1", consonance: "Perfect", example: "C–C'" },
];

const PROGRESSIONS: Record<string, { chords: string[]; description: string; examples: string[] }> = {
  "I–IV–V–I": {
    chords: ["I", "IV", "V", "I"],
    description: "The most fundamental progression in Western music. Establishes tonic, moves to subdominant, builds tension with dominant, resolves home.",
    examples: ["'Twist and Shout'", "'La Bamba'", "12-bar blues foundation"],
  },
  "I–V–vi–IV": {
    chords: ["I", "V", "vi", "IV"],
    description: "The 'Axis' progression — arguably the most popular chord progression in modern pop music. Endlessly versatile.",
    examples: ["'Let It Be'", "'No Woman No Cry'", "'With or Without You'"],
  },
  "ii–V–I": {
    chords: ["ii", "V", "I"],
    description: "The cornerstone of jazz harmony. The ii chord prepares the V, which creates maximum tension before resolving to I.",
    examples: ["'Autumn Leaves'", "'All The Things You Are'", "countless jazz standards"],
  },
  "I–vi–IV–V": {
    chords: ["I", "vi", "IV", "V"],
    description: "The '50s progression'. Nostalgic, circular feel. Dominated doo-wop and early rock and roll.",
    examples: ["'Stand By Me'", "'Earth Angel'", "'Blue Moon'"],
  },
  "vi–IV–I–V": {
    chords: ["vi", "IV", "I", "V"],
    description: "Minor-starting variant of the Axis progression. More melancholic opening that still resolves brightly.",
    examples: ["'Somebody That I Used to Know'", "'Grenade'"],
  },
  "I–IV–vi–V": {
    chords: ["I", "IV", "vi", "V"],
    description: "Variant with subdominant before the relative minor. Creates a slightly different emotional arc.",
    examples: ["'Africa' (Toto)", "'Poker Face'"],
  },
};

// ─── Audio Engine ─────────────────────────────────────────────────────────────

function noteToFrequency(midiNote: number): number {
  return 440 * Math.pow(2, (midiNote - 69) / 12);
}

function playNote(audioCtx: AudioContext, frequency: number, duration = 1.2) {
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  gainNode.connect(audioCtx.destination);
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + duration);
}

// ─── Piano Component ──────────────────────────────────────────────────────────

const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const BLACK_KEYS = [1, 3, -1, 6, 8, 10, -1]; // C# D# - F# G# A# -

function Piano({
  highlightedNotes,
  rootNote,
  onNotePlay,
}: {
  highlightedNotes: number[];
  rootNote: number;
  onNotePlay: (semitone: number) => void;
}) {
  const octaves = 2;
  const startOctave = 4;

  return (
    <div className="relative select-none" style={{ height: 120 }}>
      <div className="flex" style={{ height: 120 }}>
        {Array.from({ length: octaves }).map((_, oct) =>
          WHITE_KEYS.map((semitone, wIdx) => {
            const absoluteSemitone = semitone % 12;
            const isHighlighted = highlightedNotes.includes(absoluteSemitone);
            const isRoot = absoluteSemitone === rootNote % 12;
            const midiNote = (startOctave + oct) * 12 + semitone;
            const blackOffset = BLACK_KEYS[wIdx];

            return (
              <div key={`${oct}-${wIdx}`} className="relative" style={{ width: 36, flexShrink: 0 }}>
                {/* White key */}
                <div
                  className="piano-key-white absolute"
                  style={{
                    width: 34,
                    height: 110,
                    top: 0,
                    left: 1,
                    background: isRoot
                      ? "#ffe0d0"
                      : isHighlighted
                      ? "#fff0e8"
                      : "#f8f8f6",
                    borderTop: isRoot
                      ? "3px solid #ff4f1f"
                      : isHighlighted
                      ? "3px solid #ffb89a"
                      : "none",
                    zIndex: 1,
                    cursor: "pointer",
                  }}
                  onMouseDown={() => onNotePlay(midiNote)}
                >
                  {wIdx === 0 && (
                    <div
                      className="absolute bottom-2 left-0 right-0 text-center text-xs"
                      style={{
                        color: isRoot ? "#ff4f1f" : "#8a9bb0",
                        fontFamily: "'IBM Plex Mono', monospace",
                        fontSize: 9,
                      }}
                    >
                      C{startOctave + oct}
                    </div>
                  )}
                </div>

                {/* Black key */}
                {blackOffset !== -1 && (
                  <div
                    className="piano-key-black absolute"
                    style={{
                      width: 22,
                      height: 70,
                      top: 0,
                      left: 25,
                      zIndex: 2,
                      background: highlightedNotes.includes(blackOffset % 12)
                        ? rootNote % 12 === blackOffset % 12
                          ? "#ff4f1f"
                          : "#263660"
                        : "#1a2744",
                      cursor: "pointer",
                    }}
                    onMouseDown={() => onNotePlay((startOctave + oct) * 12 + blackOffset)}
                  />
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "scales" | "chords" | "intervals" | "progressions";

export default function MusicTheory() {
  const [activeTab, setActiveTab] = useState<Tab>("scales");
  const [rootNote, setRootNote] = useState(0); // C
  const [selectedScale, setSelectedScale] = useState("Major");
  const [selectedChord, setSelectedChord] = useState("Major");
  const [highlightedNotes, setHighlightedNotes] = useState<number[]>([0, 2, 4, 5, 7, 9, 11]);
  const [selectedInterval, setSelectedInterval] = useState(7);
  const audioCtxRef = useRef<AudioContext | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // Update highlighted notes when scale/chord/root changes
  useEffect(() => {
    if (activeTab === "scales") {
      const scale = SCALES[selectedScale];
      setHighlightedNotes(scale.intervals.map((i) => (rootNote + i) % 12));
    } else if (activeTab === "chords") {
      const chord = CHORD_TYPES[selectedChord];
      setHighlightedNotes(chord.intervals.map((i) => (rootNote + i) % 12));
    } else if (activeTab === "intervals") {
      setHighlightedNotes([rootNote % 12, (rootNote + selectedInterval) % 12]);
    } else {
      setHighlightedNotes([]);
    }
  }, [activeTab, rootNote, selectedScale, selectedChord, selectedInterval]);

  const playScale = () => {
    const ctx = getAudioCtx();
    const scale = SCALES[selectedScale];
    const baseOctave = 4;
    scale.intervals.forEach((interval, i) => {
      const freq = noteToFrequency(baseOctave * 12 + rootNote + interval);
      setTimeout(() => playNote(ctx, freq, 0.6), i * 220);
    });
  };

  const playChord = () => {
    const ctx = getAudioCtx();
    const chord = CHORD_TYPES[selectedChord];
    const baseOctave = 4;
    chord.intervals.forEach((interval) => {
      const freq = noteToFrequency(baseOctave * 12 + rootNote + interval);
      playNote(ctx, freq, 1.5);
    });
  };

  const playInterval = () => {
    const ctx = getAudioCtx();
    const baseOctave = 4;
    playNote(ctx, noteToFrequency(baseOctave * 12 + rootNote), 0.8);
    setTimeout(() => {
      playNote(ctx, noteToFrequency(baseOctave * 12 + rootNote + selectedInterval), 0.8);
    }, 600);
    setTimeout(() => {
      playNote(ctx, noteToFrequency(baseOctave * 12 + rootNote), 1.2);
      playNote(ctx, noteToFrequency(baseOctave * 12 + rootNote + selectedInterval), 1.2);
    }, 1400);
  };

  const handlePianoNote = (midiNote: number) => {
    const ctx = getAudioCtx();
    playNote(ctx, noteToFrequency(midiNote), 1.0);
  };

  const tabs: { id: Tab; label: string }[] = [
    { id: "scales", label: "Scales" },
    { id: "chords", label: "Chords" },
    { id: "intervals", label: "Intervals" },
    { id: "progressions", label: "Progressions" },
  ];

  const consonanceColor = (c: string) => {
    if (c === "Perfect") return "#00d4ff";
    if (c === "Imperfect") return "#a78bfa";
    if (c === "Mild Dissonance") return "#fbbf24";
    return "#ff4f1f";
  };

  return (
    <div className="min-h-screen">
      {/* Page header */}
      <div
        className="px-8 py-6"
        style={{
          background: "#1a2744",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div className="flex items-center gap-3 mb-1">
          <span
            className="text-xs font-medium"
            style={{ color: "#ff4f1f", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            MODULE 01
          </span>
        </div>
        <h1
          className="text-3xl font-bold text-white"
          style={{ fontFamily: "'DM Serif Display', serif" }}
        >
          Music Theory
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8a9bb0" }}>
          Scales · Chords · Intervals · Chord Progressions
        </p>
      </div>

      <div className="px-8 py-6">
        {/* Root note selector */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span
            className="text-xs font-medium uppercase tracking-widest"
            style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Root Note:
          </span>
          <div className="flex flex-wrap gap-1.5">
            {NOTE_NAMES.map((note, i) => (
              <button
                key={note}
                onClick={() => setRootNote(i)}
                className="px-3 py-1 rounded text-xs font-medium transition-all"
                style={{
                  background: rootNote === i ? "#ff4f1f" : "white",
                  color: rootNote === i ? "white" : "#1a2744",
                  border: `1px solid ${rootNote === i ? "#ff4f1f" : "#e8e4dc"}`,
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                {note}
              </button>
            ))}
          </div>
        </div>

        {/* Interactive Piano */}
        <div
          className="module-card rounded p-4 mb-6 overflow-x-auto"
          style={{ background: "white" }}
        >
          <div
            className="text-xs font-medium mb-3 uppercase tracking-widest"
            style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            Interactive Piano — Click to play
          </div>
          <Piano
            highlightedNotes={highlightedNotes}
            rootNote={rootNote}
            onNotePlay={handlePianoNote}
          />
        </div>

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

        {/* ── SCALES TAB ── */}
        {activeTab === "scales" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Scale selector */}
            <div className="module-card rounded p-4">
              <div
                className="text-xs font-medium mb-3 uppercase tracking-widest"
                style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
              >
                Scale Type
              </div>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {Object.keys(SCALES).map((name) => (
                  <button
                    key={name}
                    onClick={() => setSelectedScale(name)}
                    className="w-full text-left px-3 py-2 rounded text-sm transition-all"
                    style={{
                      background: selectedScale === name ? "rgba(255,79,31,0.1)" : "transparent",
                      color: selectedScale === name ? "#ff4f1f" : "#1a2744",
                      borderLeft: selectedScale === name ? "3px solid #ff4f1f" : "3px solid transparent",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            {/* Scale info */}
            <div className="lg:col-span-2 space-y-4">
              <div className="module-card rounded p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2
                      className="text-xl font-bold"
                      style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                    >
                      {NOTE_NAMES[rootNote]} {selectedScale}
                    </h2>
                    <div
                      className="text-xs mt-1"
                      style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {SCALES[selectedScale].intervals.length} notes ·{" "}
                      {SCALES[selectedScale].intervals.map((i) => NOTE_NAMES[(rootNote + i) % 12]).join(" – ")}
                    </div>
                  </div>
                  <button
                    onClick={playScale}
                    className="px-4 py-2 rounded text-sm font-medium transition-all hover:opacity-90"
                    style={{
                      background: "#ff4f1f",
                      color: "white",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    ▶ Play Scale
                  </button>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#4a5568" }}>
                  {SCALES[selectedScale].description}
                </p>
              </div>

              {/* Interval pattern */}
              <div className="module-card rounded p-5">
                <div
                  className="text-xs font-medium mb-3 uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Interval Pattern
                </div>
                <div className="flex flex-wrap gap-2">
                  {SCALES[selectedScale].intervals.map((interval, idx, arr) => {
                    const step = idx < arr.length - 1 ? arr[idx + 1] - interval : 12 - interval;
                    return (
                      <div key={idx} className="flex items-center gap-1">
                        <div
                          className="w-10 h-10 rounded flex items-center justify-center text-sm font-bold"
                          style={{
                            background: "rgba(255,79,31,0.1)",
                            color: "#ff4f1f",
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          {NOTE_NAMES[(rootNote + interval) % 12]}
                        </div>
                        {idx < arr.length - 1 && (
                          <div
                            className="text-xs px-1"
                            style={{
                              color: step === 2 ? "#00d4ff" : "#fbbf24",
                              fontFamily: "'IBM Plex Mono', monospace",
                            }}
                          >
                            {step === 2 ? "W" : "H"}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── CHORDS TAB ── */}
        {activeTab === "chords" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="module-card rounded p-4">
              <div
                className="text-xs font-medium mb-3 uppercase tracking-widest"
                style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
              >
                Chord Type
              </div>
              <div className="space-y-1 max-h-80 overflow-y-auto">
                {Object.keys(CHORD_TYPES).map((name) => (
                  <button
                    key={name}
                    onClick={() => setSelectedChord(name)}
                    className="w-full text-left px-3 py-2 rounded text-sm transition-all flex items-center justify-between"
                    style={{
                      background: selectedChord === name ? "rgba(255,79,31,0.1)" : "transparent",
                      color: selectedChord === name ? "#ff4f1f" : "#1a2744",
                      borderLeft: selectedChord === name ? "3px solid #ff4f1f" : "3px solid transparent",
                      fontFamily: "'DM Sans', sans-serif",
                    }}
                  >
                    <span>{name}</span>
                    <span
                      className="text-xs"
                      style={{
                        color: "#8a9bb0",
                        fontFamily: "'IBM Plex Mono', monospace",
                      }}
                    >
                      {NOTE_NAMES[rootNote]}{CHORD_TYPES[name].symbol}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="lg:col-span-2 space-y-4">
              <div className="module-card rounded p-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2
                      className="text-xl font-bold"
                      style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                    >
                      {NOTE_NAMES[rootNote]}{CHORD_TYPES[selectedChord].symbol}
                      <span className="text-base ml-2 font-normal" style={{ color: "#8a9bb0" }}>
                        ({selectedChord})
                      </span>
                    </h2>
                    <div
                      className="text-xs mt-1"
                      style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {CHORD_TYPES[selectedChord].intervals
                        .map((i) => NOTE_NAMES[(rootNote + i) % 12])
                        .join(" + ")}
                    </div>
                  </div>
                  <button
                    onClick={playChord}
                    className="px-4 py-2 rounded text-sm font-medium transition-all hover:opacity-90"
                    style={{ background: "#ff4f1f", color: "white", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    ▶ Play Chord
                  </button>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: "#4a5568" }}>
                  {CHORD_TYPES[selectedChord].description}
                </p>
              </div>

              {/* Chord tones */}
              <div className="module-card rounded p-5">
                <div
                  className="text-xs font-medium mb-3 uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Chord Tones
                </div>
                <div className="flex flex-wrap gap-3">
                  {CHORD_TYPES[selectedChord].intervals.map((interval, idx) => {
                    const labels = ["Root", "3rd", "5th", "7th", "9th", "11th", "13th"];
                    return (
                      <div
                        key={idx}
                        className="flex flex-col items-center gap-1"
                      >
                        <div
                          className="w-12 h-12 rounded flex items-center justify-center text-sm font-bold"
                          style={{
                            background: idx === 0 ? "#ff4f1f" : "rgba(255,79,31,0.1)",
                            color: idx === 0 ? "white" : "#ff4f1f",
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          {NOTE_NAMES[(rootNote + interval) % 12]}
                        </div>
                        <div className="text-xs" style={{ color: "#8a9bb0" }}>
                          {labels[idx]}
                        </div>
                        <div
                          className="text-xs"
                          style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          +{interval}st
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── INTERVALS TAB ── */}
        {activeTab === "intervals" && (
          <div className="space-y-6">
            {/* Selected interval detail */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="module-card rounded p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h2
                      className="text-xl font-bold"
                      style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                    >
                      {INTERVALS[selectedInterval].name}
                    </h2>
                    <div
                      className="text-xs mt-1"
                      style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                    >
                      {INTERVALS[selectedInterval].semitones} semitones · Ratio {INTERVALS[selectedInterval].ratio}
                    </div>
                  </div>
                  <button
                    onClick={playInterval}
                    className="px-4 py-2 rounded text-sm font-medium transition-all hover:opacity-90"
                    style={{ background: "#ff4f1f", color: "white", fontFamily: "'DM Sans', sans-serif" }}
                  >
                    ▶ Play
                  </button>
                </div>
                <div className="flex gap-3 mb-4">
                  <div
                    className="px-3 py-1 rounded text-xs font-medium"
                    style={{
                      background: `${consonanceColor(INTERVALS[selectedInterval].consonance)}20`,
                      color: consonanceColor(INTERVALS[selectedInterval].consonance),
                      border: `1px solid ${consonanceColor(INTERVALS[selectedInterval].consonance)}40`,
                      fontFamily: "'IBM Plex Mono', monospace",
                    }}
                  >
                    {INTERVALS[selectedInterval].consonance}
                  </div>
                  <div className="freq-badge">{INTERVALS[selectedInterval].abbr}</div>
                </div>
                <div
                  className="text-sm"
                  style={{ color: "#4a5568" }}
                >
                  Example: {NOTE_NAMES[rootNote]}–{NOTE_NAMES[(rootNote + selectedInterval) % 12]}
                </div>
              </div>

              {/* Frequency ratio visualization */}
              <div className="module-card rounded p-5">
                <div
                  className="text-xs font-medium mb-3 uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  Frequency Ratio
                </div>
                <div className="flex items-end gap-4 h-24">
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-12 rounded-t"
                      style={{ height: 80, background: "#ff4f1f" }}
                    />
                    <div className="text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {NOTE_NAMES[rootNote]}
                    </div>
                    <div className="text-xs" style={{ color: "#ff4f1f", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {(440 * Math.pow(2, (rootNote - 9) / 12)).toFixed(1)} Hz
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <div
                      className="w-12 rounded-t"
                      style={{
                        height: Math.min(80, 80 * (440 * Math.pow(2, (rootNote + selectedInterval - 9) / 12)) / (440 * Math.pow(2, (rootNote - 9) / 12))),
                        background: "#00d4ff",
                      }}
                    />
                    <div className="text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {NOTE_NAMES[(rootNote + selectedInterval) % 12]}
                    </div>
                    <div className="text-xs" style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}>
                      {(440 * Math.pow(2, (rootNote + selectedInterval - 9) / 12)).toFixed(1)} Hz
                    </div>
                  </div>
                  <div
                    className="text-2xl font-bold ml-2"
                    style={{ color: "#1a2744", fontFamily: "'IBM Plex Mono', monospace" }}
                  >
                    {INTERVALS[selectedInterval].ratio}
                  </div>
                </div>
              </div>
            </div>

            {/* All intervals table */}
            <div className="module-card rounded overflow-hidden">
              <div
                className="px-5 py-3"
                style={{ borderBottom: "1px solid #e8e4dc" }}
              >
                <div
                  className="text-xs font-medium uppercase tracking-widest"
                  style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  All Intervals — Click to Select
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr style={{ background: "#f7f5f0" }}>
                      {["Semitones", "Name", "Abbr", "Ratio", "Consonance", "Example"].map((h) => (
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
                    {INTERVALS.map((interval) => (
                      <tr
                        key={interval.semitones}
                        onClick={() => setSelectedInterval(interval.semitones)}
                        className="transition-colors cursor-pointer"
                        style={{
                          background: selectedInterval === interval.semitones ? "rgba(255,79,31,0.06)" : "white",
                          borderLeft: selectedInterval === interval.semitones ? "3px solid #ff4f1f" : "3px solid transparent",
                        }}
                      >
                        <td
                          className="px-4 py-2.5 font-bold"
                          style={{ color: "#ff4f1f", fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          {interval.semitones}
                        </td>
                        <td className="px-4 py-2.5 font-medium" style={{ color: "#1a2744" }}>
                          {interval.name}
                        </td>
                        <td
                          className="px-4 py-2.5"
                          style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          {interval.abbr}
                        </td>
                        <td
                          className="px-4 py-2.5"
                          style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          {interval.ratio}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className="px-2 py-0.5 rounded text-xs"
                            style={{
                              background: `${consonanceColor(interval.consonance)}15`,
                              color: consonanceColor(interval.consonance),
                              fontFamily: "'IBM Plex Mono', monospace",
                            }}
                          >
                            {interval.consonance}
                          </span>
                        </td>
                        <td
                          className="px-4 py-2.5"
                          style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
                        >
                          {interval.example}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── PROGRESSIONS TAB ── */}
        {activeTab === "progressions" && (
          <div className="space-y-4">
            {Object.entries(PROGRESSIONS).map(([name, prog]) => (
              <div key={name} className="module-card rounded p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <h3
                      className="text-lg font-bold mb-1"
                      style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}
                    >
                      {name}
                    </h3>
                    <p className="text-sm leading-relaxed mb-3" style={{ color: "#4a5568" }}>
                      {prog.description}
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {prog.examples.map((ex) => (
                        <span
                          key={ex}
                          className="text-xs px-2 py-0.5 rounded"
                          style={{
                            background: "rgba(26,39,68,0.06)",
                            color: "#8a9bb0",
                            fontFamily: "'IBM Plex Mono', monospace",
                          }}
                        >
                          {ex}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {prog.chords.map((chord, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-12 rounded flex items-center justify-center text-sm font-bold"
                        style={{
                          background: idx === 0 || chord === "I" ? "#ff4f1f" : "rgba(255,79,31,0.1)",
                          color: idx === 0 || chord === "I" ? "white" : "#ff4f1f",
                          fontFamily: "'IBM Plex Mono', monospace",
                        }}
                      >
                        {chord}
                      </div>
                    ))}
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
