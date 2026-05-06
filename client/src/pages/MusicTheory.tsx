/*
 * MusicTheory.tsx — Bauhaus Frequency Design
 * Interactive piano, scales, chords, intervals, progressions
 * Uses Web Audio API for real-time sound synthesis
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useLang } from "../contexts/LanguageContext";

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

// Sustain-aware note player — routes through a shared analyser node
function playNote(
  audioCtx: AudioContext,
  frequency: number,
  duration = 1.2,
  analyser?: AnalyserNode,
  sustainRef?: React.MutableRefObject<boolean>
) {
  const osc = audioCtx.createOscillator();
  const gainNode = audioCtx.createGain();
  osc.connect(gainNode);
  if (analyser) {
    gainNode.connect(analyser);
    analyser.connect(audioCtx.destination);
  } else {
    gainNode.connect(audioCtx.destination);
  }
  osc.type = "triangle";
  osc.frequency.setValueAtTime(frequency, audioCtx.currentTime);
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.01);

  const baseDuration = duration;
  // Check sustain at the moment of scheduling
  const effectiveDuration = sustainRef?.current ? baseDuration * 3.5 : baseDuration;
  gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + effectiveDuration);
  osc.start(audioCtx.currentTime);
  osc.stop(audioCtx.currentTime + effectiveDuration);
}

// ─── Scale FFT math (DFT for visualization) ───────────────────────────────────

// Build a composite waveform from all scale/chord notes and compute its DFT
function computeScaleFFT(
  frequencies: number[],
  sampleRate = 44100,
  duration = 0.05,
  bins = 64
): { magnitudes: Float32Array; freqLabels: number[] } {
  const N = Math.floor(sampleRate * duration);
  const signal = new Float32Array(N);
  // Sum all note sinusoids
  for (const freq of frequencies) {
    for (let i = 0; i < N; i++) {
      signal[i] += (1 / frequencies.length) * Math.sin(2 * Math.PI * freq * (i / sampleRate));
    }
  }
  // DFT over first `bins` bins
  const magnitudes = new Float32Array(bins);
  const freqLabels: number[] = [];
  for (let k = 0; k < bins; k++) {
    let re = 0, im = 0;
    for (let n = 0; n < N; n++) {
      const angle = (2 * Math.PI * k * n) / N;
      re += signal[n] * Math.cos(angle);
      im -= signal[n] * Math.sin(angle);
    }
    magnitudes[k] = Math.sqrt(re * re + im * im) / N;
    freqLabels.push(Math.round((k * sampleRate) / N));
  }
  return { magnitudes, freqLabels };
}

// ─── Scale FFT Canvas Renderer ────────────────────────────────────────────────

function drawScaleSpectrum(
  canvas: HTMLCanvasElement,
  magnitudes: Float32Array,
  noteFrequencies: number[],
  noteNames: string[],
  sampleRate: number,
  totalSamples: number,
  intervalAbbrs?: string[],   // e.g. ["Root", "M3", "P5"]
  midiNotes?: number[]        // e.g. [60, 64, 67]
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const W = canvas.width;
  const H = canvas.height;

  // Background
  ctx.fillStyle = "#0d1829";
  ctx.fillRect(0, 0, W, H);

  // Horizontal grid lines
  ctx.strokeStyle = "rgba(0,212,255,0.08)";
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = (H / 4) * i;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  const bins = magnitudes.length;
  const barW = Math.max(1, W / bins - 1);
  const maxVal = Math.max(...Array.from(magnitudes), 0.0001);

  // Draw spectrum bars
  for (let i = 0; i < bins; i++) {
    const normalized = magnitudes[i] / maxVal;
    const barH = normalized * H * 0.75;  // leave headroom for labels
    const x = i * (W / bins);
    const t = i / bins;
    const r = Math.round(t * 255);
    const g = Math.round(212 - t * 130);
    const b = Math.round(255 - t * 224);
    ctx.fillStyle = `rgba(${r},${g},${b},${0.35 + normalized * 0.55})`;
    ctx.fillRect(x, H - barH, barW, barH);
  }

  // ── Note spike markers with stacked reference labels ──────────────────────
  noteFrequencies.forEach((freq, idx) => {
    const binIndex = Math.round((freq * totalSamples) / sampleRate);
    if (binIndex < 0 || binIndex >= bins) return;
    const x = binIndex * (W / bins) + barW / 2;
    const normalized = magnitudes[binIndex] / maxVal;
    const barH = normalized * H * 0.75;

    // Glowing vertical spike
    ctx.strokeStyle = "#ff4f1f";
    ctx.lineWidth = 2;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#ff4f1f";
    ctx.beginPath();
    ctx.moveTo(x, H - 14);          // stop above Hz row
    ctx.lineTo(x, H - barH - 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // Diamond marker at spike top
    const tipY = H - barH - 6;
    ctx.fillStyle = "#ff4f1f";
    ctx.beginPath();
    ctx.moveTo(x, tipY - 4);
    ctx.lineTo(x + 3, tipY);
    ctx.lineTo(x, tipY + 4);
    ctx.lineTo(x - 3, tipY);
    ctx.closePath();
    ctx.fill();

    // ── Stacked label block above bar ──
    ctx.textAlign = "center";
    let labelTop = Math.max(60, H - barH - 14);

    // Row 1: Interval abbreviation (e.g. "Root", "M3", "P5")
    if (intervalAbbrs && intervalAbbrs[idx]) {
      ctx.fillStyle = "rgba(167,139,250,0.95)";
      ctx.font = `bold 8px 'IBM Plex Mono', monospace`;
      ctx.fillText(intervalAbbrs[idx], x, labelTop - 28);
    }

    // Row 2: Note name (e.g. "C", "E", "G")
    ctx.fillStyle = "#ff4f1f";
    ctx.font = `bold 10px 'IBM Plex Mono', monospace`;
    ctx.fillText(noteNames[idx], x, labelTop - 16);

    // Row 3: MIDI number
    if (midiNotes && midiNotes[idx] !== undefined) {
      ctx.fillStyle = "rgba(0,212,255,0.7)";
      ctx.font = `8px 'IBM Plex Mono', monospace`;
      ctx.fillText(`M${midiNotes[idx]}`, x, labelTop - 6);
    }

    // Row 4: Hz value (bottom strip)
    ctx.fillStyle = "rgba(255,79,31,0.75)";
    ctx.font = `8px 'IBM Plex Mono', monospace`;
    ctx.fillText(`${freq.toFixed(1)}`, x, H - 3);
  });

  // ── Axis labels ────────────────────────────────────────────────────────────
  ctx.fillStyle = "rgba(138,155,176,0.45)";
  ctx.font = "8px 'IBM Plex Mono', monospace";
  ctx.textAlign = "left";
  ctx.fillText("Hz →", 4, H - 3);
  ctx.textAlign = "right";
  ctx.fillText(`max ${Math.round((bins * sampleRate) / totalSamples)} Hz`, W - 4, H - 3);
}

// ─── Piano Component ──────────────────────────────────────────────────────────

// ─── Standard Online Piano Keyboard Mapping ──────────────────────────────────
// Layout matches Virtual Piano / OnlinePianist standard:
//   Lower row (white keys):  A S D F G H J  | K L ; '
//   Lower row (black keys):  W E   T Y U    | O P
//   Upper row (white keys):  Z X C V B N M  | , . /
//   Upper row (black keys):  S D   G H J    | L ;
// We use TWO octaves: lower octave on Z-row, upper octave on A-row

// Each entry: { midiOffset (from C4), keyLabel, isBlack }
// Octave 1 (C4–B4): keyboard row starting at Z
// Octave 2 (C5–B5): keyboard row starting at A

const KEYBOARD_MAP: Record<string, { midiNote: number; label: string }> = {
  // ── Octave 4 (C4–B4) — bottom row ──
  z: { midiNote: 48, label: "Z" },   // C4
  s: { midiNote: 49, label: "S" },   // C#4
  x: { midiNote: 50, label: "X" },   // D4
  d: { midiNote: 51, label: "D" },   // D#4
  c: { midiNote: 52, label: "C" },   // E4
  v: { midiNote: 53, label: "V" },   // F4
  g: { midiNote: 54, label: "G" },   // F#4
  b: { midiNote: 55, label: "B" },   // G4
  h: { midiNote: 56, label: "H" },   // G#4
  n: { midiNote: 57, label: "N" },   // A4
  j: { midiNote: 58, label: "J" },   // A#4
  m: { midiNote: 59, label: "M" },   // B4
  // ── Octave 5 (C5–B5) — top row ──
  q: { midiNote: 60, label: "Q" },   // C5
  "2": { midiNote: 61, label: "2" }, // C#5
  w: { midiNote: 62, label: "W" },   // D5
  "3": { midiNote: 63, label: "3" }, // D#5
  e: { midiNote: 64, label: "E" },   // E5
  r: { midiNote: 65, label: "R" },   // F5
  "5": { midiNote: 66, label: "5" }, // F#5
  t: { midiNote: 67, label: "T" },   // G5
  "6": { midiNote: 68, label: "6" }, // G#5
  y: { midiNote: 69, label: "Y" },   // A5
  "7": { midiNote: 70, label: "7" }, // A#5
  u: { midiNote: 71, label: "U" },   // B5
  // ── Octave 6 (C6–E6) — continuation ──
  i: { midiNote: 72, label: "I" },   // C6
  "9": { midiNote: 73, label: "9" }, // C#6
  o: { midiNote: 74, label: "O" },   // D6
  "0": { midiNote: 75, label: "0" }, // D#6
  p: { midiNote: 76, label: "P" },   // E6
};

// Reverse map: midiNote → key label
const MIDI_TO_KEY: Record<number, string> = {};
Object.entries(KEYBOARD_MAP).forEach(([, v]) => {
  MIDI_TO_KEY[v.midiNote] = v.label;
});

const WHITE_KEYS = [0, 2, 4, 5, 7, 9, 11]; // C D E F G A B
const BLACK_KEYS = [1, 3, -1, 6, 8, 10, -1]; // C# D# - F# G# A# -

function Piano({
  highlightedNotes,
  rootNote,
  onNotePlay,
  pressedKeys,
}: {
  highlightedNotes: number[];
  rootNote: number;
  onNotePlay: (midiNote: number) => void;
  pressedKeys: Set<number>;
}) {
  const { t } = useLang();
  // 3 octaves: C4–B6 (covers all mapped keys)
  const startOctave = 4;
  const octaves = 3;

  return (
    <div className="relative select-none overflow-x-auto">
      {/* Keyboard hint legend */}
      <div
        className="flex items-center gap-4 mb-2 flex-wrap"
        style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 10, color: "#8a9bb0" }}
      >
        <span>⌨ {t("mtKeyboardHint")}</span>
        <span style={{ color: "rgba(138,155,176,0.5)" }}>Black keys: S D G H J (oct4) · 2 3 5 6 7 (oct5)</span>
      </div>

      <div className="relative" style={{ height: 140 }}>
        <div className="flex" style={{ height: 140 }}>
          {Array.from({ length: octaves }).map((_, oct) =>
            WHITE_KEYS.map((semitone, wIdx) => {
              const absoluteSemitone = semitone % 12;
              const isHighlighted = highlightedNotes.includes(absoluteSemitone);
              const isRoot = absoluteSemitone === rootNote % 12;
              const midiNote = (startOctave + oct) * 12 + semitone;
              const blackSemitone = BLACK_KEYS[wIdx];
              const blackMidi = blackSemitone !== -1 ? (startOctave + oct) * 12 + blackSemitone : -1;
              const isWhitePressed = pressedKeys.has(midiNote);
              const isBlackPressed = blackMidi !== -1 && pressedKeys.has(blackMidi);
              const blackHighlighted = blackSemitone !== -1 && highlightedNotes.includes(blackSemitone % 12);
              const blackIsRoot = blackSemitone !== -1 && rootNote % 12 === blackSemitone % 12;

              // Key label for white key
              const whiteLabel = MIDI_TO_KEY[midiNote];
              const blackLabel = blackMidi !== -1 ? MIDI_TO_KEY[blackMidi] : undefined;

              return (
                <div key={`${oct}-${wIdx}`} className="relative" style={{ width: 38, flexShrink: 0 }}>
                  {/* White key */}
                  <div
                    className="absolute transition-colors duration-75"
                    style={{
                      width: 36,
                      height: 130,
                      top: 0,
                      left: 1,
                      borderRadius: "0 0 4px 4px",
                      border: "1px solid #d0ccc4",
                      borderTop: isRoot
                        ? "3px solid #ff4f1f"
                        : isHighlighted
                        ? "3px solid #ffb89a"
                        : "1px solid #d0ccc4",
                      background: isWhitePressed
                        ? "#ffd0b8"
                        : isRoot
                        ? "#ffe0d0"
                        : isHighlighted
                        ? "#fff0e8"
                        : "#f8f8f6",
                      boxShadow: isWhitePressed
                        ? "inset 0 -2px 4px rgba(0,0,0,0.15)"
                        : "0 3px 6px rgba(0,0,0,0.12)",
                      zIndex: 1,
                      cursor: "pointer",
                    }}
                    onMouseDown={() => onNotePlay(midiNote)}
                  >
                    {/* Octave label */}
                    {wIdx === 0 && (
                      <div
                        className="absolute bottom-7 left-0 right-0 text-center"
                        style={{
                          color: isRoot ? "#ff4f1f" : "#c0bbb4",
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 8,
                        }}
                      >
                        C{startOctave + oct}
                      </div>
                    )}
                    {/* Keyboard hint label */}
                    {whiteLabel && (
                      <div
                        className="absolute bottom-2 left-0 right-0 text-center font-bold"
                        style={{
                          fontFamily: "'IBM Plex Mono', monospace",
                          fontSize: 9,
                          color: isWhitePressed
                            ? "#ff4f1f"
                            : oct === 0
                            ? "#ff4f1f"
                            : oct === 1
                            ? "#00d4ff"
                            : "#a78bfa",
                        }}
                      >
                        {whiteLabel}
                      </div>
                    )}
                  </div>

                  {/* Black key */}
                  {blackSemitone !== -1 && (
                    <div
                      className="absolute transition-colors duration-75"
                      style={{
                        width: 24,
                        height: 80,
                        top: 0,
                        left: 27,
                        zIndex: 2,
                        borderRadius: "0 0 3px 3px",
                        background: isBlackPressed
                          ? "#263660"
                          : blackHighlighted
                          ? blackIsRoot
                            ? "#ff4f1f"
                            : "#263660"
                          : "#1a2744",
                        boxShadow: isBlackPressed
                          ? "inset 0 -1px 3px rgba(0,0,0,0.4)"
                          : "0 4px 8px rgba(0,0,0,0.4)",
                        cursor: "pointer",
                      }}
                      onMouseDown={() => onNotePlay(blackMidi)}
                    >
                      {/* Black key label */}
                      {blackLabel && (
                        <div
                          className="absolute bottom-2 left-0 right-0 text-center font-bold"
                          style={{
                            fontFamily: "'IBM Plex Mono', monospace",
                            fontSize: 8,
                            color: isBlackPressed
                              ? "#ff4f1f"
                              : oct === 0
                              ? "rgba(255,79,31,0.7)"
                              : oct === 1
                              ? "rgba(0,212,255,0.7)"
                              : "rgba(167,139,250,0.7)",
                          }}
                        >
                          {blackLabel}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Progressions Tab (with Send to Sequencer) ────────────────────────────────

// Roman numeral → semitone offset (major key)
const ROMAN_TO_SEMITONE: Record<string, number> = {
  "I": 0, "II": 2, "III": 4, "IV": 5, "V": 7, "VI": 9, "VII": 11,
  "i": 0, "ii": 2, "iii": 4, "iv": 5, "v": 7, "vi": 9, "vii": 11,
};

// HSID symbol for major/minor chords based on roman numeral case
function romanToHsid(roman: string): string {
  if (roman === "I" || roman === "IV" || roman === "V") return "∆";
  if (roman === "ii" || roman === "iii" || roman === "vi") return "-";
  if (roman === "V") return "7";
  if (roman === "vii") return "ø";
  return roman === roman.toUpperCase() ? "∆" : "-";
}

function ProgressionsTabInner({ rootNote }: { rootNote: number }) {
  const [, setLocation] = useLocation();
  const { t } = useLang();

  const sendToSequencer = (progName: string, chords: string[]) => {
    // Build a soundio/sequence JSON for the progression
    const rootName = NOTE_NAMES[rootNote];
    const bpm = 100;
    const beatsPerChord = 4;
    const events: unknown[] = [
      [0, "meter", 4, 1],
      [0, "rate", bpm / 60, "step"],
    ];
    let beat = 0;
    chords.forEach((roman) => {
      const semitone = ROMAN_TO_SEMITONE[roman] ?? 0;
      const chordRootMidi = 60 + rootNote + semitone;
      const hsid = romanToHsid(roman);
      events.push([beat, "chord", rootName, hsid, beatsPerChord]);
      // Add individual notes
      const intervals = hsid === "∆" ? [0, 4, 7] : hsid === "-" ? [0, 3, 7] : hsid === "7" ? [0, 4, 7, 10] : [0, 3, 6];
      intervals.forEach((iv) => {
        events.push([beat, "note", chordRootMidi + iv, 0.75, beatsPerChord - 0.25]);
      });
      beat += beatsPerChord;
    });
    const seq = { name: `${rootName} ${progName}`, events };
    const encoded = encodeURIComponent(JSON.stringify(seq, null, 2));
    setLocation(`/sequencer?tab=visualizer&seq=${encoded}`);
  };

  return (
    <div className="space-y-4">
      {Object.entries(PROGRESSIONS).map(([name, prog]) => (
        <div key={name} className="module-card rounded p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-bold mb-1" style={{ color: "#1a2744", fontFamily: "'DM Serif Display', serif" }}>
                {name}
              </h3>
              <p className="text-sm leading-relaxed mb-3" style={{ color: "#4a5568" }}>
                {prog.description}
              </p>
              <div className="flex flex-wrap gap-1 mb-3">
                {prog.examples.map((ex) => (
                  <span key={ex} className="text-xs px-2 py-0.5 rounded"
                    style={{ background: "rgba(26,39,68,0.06)", color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
                    {ex}
                  </span>
                ))}
              </div>
              {/* Send to Sequencer */}
              <button
                onClick={() => sendToSequencer(name, prog.chords)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold transition-all"
                style={{
                  background: "rgba(74,222,128,0.1)",
                  color: "#4ade80",
                  border: "1px solid rgba(74,222,128,0.3)",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
                title={`Open ${NOTE_NAMES[rootNote]} ${name} in the Sequencer Visualizer`}
              >
                {t("mtSendToSeq")}
              </button>
            </div>
            <div className="flex gap-2">
              {prog.chords.map((chord, idx) => (
                <div key={idx} className="w-12 h-12 rounded flex items-center justify-center text-sm font-bold"
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
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

type Tab = "scales" | "chords" | "intervals" | "progressions";

export default function MusicTheory() {
  const [activeTab, setActiveTab] = useState<Tab>("scales");
  const [rootNote, setRootNote] = useState(0); // C
  const [selectedScale, setSelectedScale] = useState("Major");
  const [selectedChord, setSelectedChord] = useState("Major");
  const [highlightedNotes, setHighlightedNotes] = useState<number[]>([0, 2, 4, 5, 7, 9, 11]);
  const [selectedInterval, setSelectedInterval] = useState(7);
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  const [sustainActive, setSustainActive] = useState(false);
  const [showFFT, setShowFFT] = useState(true);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const heldNotesRef = useRef<Set<number>>(new Set());
  const sustainRef = useRef(false);
  const fftCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const getAudioCtx = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      // Create shared analyser
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 2048;
      analyser.connect(audioCtxRef.current.destination);
      analyserRef.current = analyser;
    }
    if (audioCtxRef.current.state === "suspended") {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  // ── Keyboard event handlers (notes + sustain pedal) ──────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      // Sustain pedal: Space
      if (e.code === "Space") {
        e.preventDefault();
        if (!e.repeat) {
          sustainRef.current = true;
          setSustainActive(true);
        }
        return;
      }
      if (e.repeat) return;
      const key = e.key.toLowerCase();
      const mapped = KEYBOARD_MAP[key];
      if (!mapped) return;
      const { midiNote } = mapped;
      if (heldNotesRef.current.has(midiNote)) return;
      heldNotesRef.current.add(midiNote);
      setPressedKeys((prev) => { const next = new Set(prev); next.add(midiNote); return next; });
      const ctx = getAudioCtx();
      playNote(ctx, noteToFrequency(midiNote), 1.2, analyserRef.current ?? undefined, sustainRef);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        sustainRef.current = false;
        setSustainActive(false);
        return;
      }
      const key = e.key.toLowerCase();
      const mapped = KEYBOARD_MAP[key];
      if (!mapped) return;
      const { midiNote } = mapped;
      heldNotesRef.current.delete(midiNote);
      setPressedKeys((prev) => { const next = new Set(prev); next.delete(midiNote); return next; });
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [getAudioCtx]);

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

  // ── Static FFT: compute from scale/chord frequencies and draw on canvas ───────────────
  const SAMPLE_RATE = 44100;
  const FFT_DURATION = 0.08; // seconds of signal to analyze
  const FFT_BINS = 80;
  const FFT_TOTAL_SAMPLES = Math.floor(SAMPLE_RATE * FFT_DURATION);

  const drawFFT = useCallback(() => {
    const canvas = fftCanvasRef.current;
    if (!canvas) return;
    canvas.width = canvas.offsetWidth || 700;
    canvas.height = 200;  // taller to fit stacked labels

    // Determine which notes to analyze
    let intervals: number[];
    let label: string;
    if (activeTab === "scales") {
      intervals = SCALES[selectedScale].intervals;
      label = `${NOTE_NAMES[rootNote]} ${selectedScale}`;
    } else if (activeTab === "chords") {
      intervals = CHORD_TYPES[selectedChord].intervals;
      label = `${NOTE_NAMES[rootNote]}${CHORD_TYPES[selectedChord].symbol}`;
    } else if (activeTab === "intervals") {
      intervals = [0, selectedInterval];
      label = `${NOTE_NAMES[rootNote]} + ${INTERVALS[selectedInterval].name}`;
    } else {
      intervals = [0, 4, 7]; // default C major
      label = "C Major";
    }

    const baseOctave = 4;
    const frequencies = intervals.map((i) => noteToFrequency(baseOctave * 12 + rootNote + i));
    const noteNames = intervals.map((i) => NOTE_NAMES[(rootNote + i) % 12]);
    const midiNotes = intervals.map((i) => baseOctave * 12 + rootNote + i);

    // Build interval abbreviation labels
    // "Root" for 0, then look up INTERVALS array for the rest
    const intervalAbbrs = intervals.map((semitones) => {
      if (semitones === 0) return "Root";
      const found = INTERVALS.find((iv) => iv.semitones === (semitones % 12));
      return found ? found.abbr : `+${semitones}`;
    });

    const { magnitudes } = computeScaleFFT(frequencies, SAMPLE_RATE, FFT_DURATION, FFT_BINS);
    drawScaleSpectrum(canvas, magnitudes, frequencies, noteNames, SAMPLE_RATE, FFT_TOTAL_SAMPLES, intervalAbbrs, midiNotes);

    // Draw title overlay
    const ctx2d = canvas.getContext("2d");
    if (ctx2d) {
      ctx2d.fillStyle = "rgba(255,255,255,0.75)";
      ctx2d.font = "bold 11px 'IBM Plex Mono', monospace";
      ctx2d.textAlign = "left";
      ctx2d.fillText(`FFT — ${label}`, 8, 14);
      // Legend
      ctx2d.font = "8px 'IBM Plex Mono', monospace";
      ctx2d.fillStyle = "rgba(167,139,250,0.8)";
      ctx2d.fillText("■ Interval", 8, 26);
      ctx2d.fillStyle = "rgba(255,79,31,0.8)";
      ctx2d.fillText("■ Note", 68, 26);
      ctx2d.fillStyle = "rgba(0,212,255,0.8)";
      ctx2d.fillText("■ MIDI", 108, 26);
      ctx2d.fillStyle = "rgba(255,79,31,0.55)";
      ctx2d.fillText("■ Hz (bottom)", 148, 26);
    }
  }, [activeTab, rootNote, selectedScale, selectedChord, selectedInterval]);

  // Redraw FFT whenever selection changes
  useEffect(() => {
    if (!showFFT) return;
    const id = setTimeout(() => drawFFT(), 20);
    return () => clearTimeout(id);
  }, [drawFFT, showFFT]);

  // Live FFT animation from AnalyserNode (when audio is playing)
  useEffect(() => {
    if (!showFFT) return;
    let rafId: number;
    const animate = () => {
      const analyser = analyserRef.current;
      const canvas = fftCanvasRef.current;
      if (analyser && canvas) {
        const bufLen = analyser.frequencyBinCount;
        const dataArray = new Uint8Array(bufLen);
        analyser.getByteFrequencyData(dataArray);
        // Check if any audio is playing (non-zero data)
        const hasAudio = dataArray.some((v) => v > 0);
        if (hasAudio) {
          canvas.width = canvas.offsetWidth || 700;
          canvas.height = 160;
          const ctx2d = canvas.getContext("2d");
          if (!ctx2d) { rafId = requestAnimationFrame(animate); return; }
          const W = canvas.width, H = canvas.height;
          ctx2d.fillStyle = "#0d1829";
          ctx2d.fillRect(0, 0, W, H);
          // Grid
          ctx2d.strokeStyle = "rgba(0,212,255,0.08)";
          ctx2d.lineWidth = 1;
          for (let i = 0; i <= 4; i++) {
            const y = (H / 4) * i;
            ctx2d.beginPath(); ctx2d.moveTo(0, y); ctx2d.lineTo(W, y); ctx2d.stroke();
          }
          // Draw live spectrum bars (first 256 bins = up to ~5.5kHz)
          const displayBins = Math.min(256, bufLen);
          const barW = W / displayBins;
          for (let i = 0; i < displayBins; i++) {
            const normalized = dataArray[i] / 255;
            const barH = normalized * H * 0.9;
            const x = i * barW;
            const t = i / displayBins;
            const r = Math.round(t * 255);
            const g = Math.round(212 - t * 130);
            const b = Math.round(255 - t * 224);
            ctx2d.fillStyle = `rgba(${r},${g},${b},${0.4 + normalized * 0.6})`;
            ctx2d.fillRect(x, H - barH, barW - 1, barH);
          }
          ctx2d.fillStyle = "rgba(0,212,255,0.8)";
          ctx2d.font = "bold 11px 'IBM Plex Mono', monospace";
          ctx2d.textAlign = "left";
          ctx2d.fillText("LIVE FFT — Real-time Spectrum", 8, 14);
        }
      }
      rafId = requestAnimationFrame(animate);
    };
    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [showFFT]);

  const playScale = () => {
    const ctx = getAudioCtx();
    const scale = SCALES[selectedScale];
    const baseOctave = 4;
    scale.intervals.forEach((interval, i) => {
      const freq = noteToFrequency(baseOctave * 12 + rootNote + interval);
      setTimeout(() => playNote(ctx, freq, sustainRef.current ? 2.5 : 0.6, analyserRef.current ?? undefined, sustainRef), i * 220);
    });
  };

  const playChord = () => {
    const ctx = getAudioCtx();
    const chord = CHORD_TYPES[selectedChord];
    const baseOctave = 4;
    chord.intervals.forEach((interval) => {
      const freq = noteToFrequency(baseOctave * 12 + rootNote + interval);
      playNote(ctx, freq, 1.5, analyserRef.current ?? undefined, sustainRef);
    });
  };

  const playInterval = () => {
    const ctx = getAudioCtx();
    const baseOctave = 4;
    playNote(ctx, noteToFrequency(baseOctave * 12 + rootNote), 0.8, analyserRef.current ?? undefined, sustainRef);
    setTimeout(() => {
      playNote(ctx, noteToFrequency(baseOctave * 12 + rootNote + selectedInterval), 0.8, analyserRef.current ?? undefined, sustainRef);
    }, 600);
    setTimeout(() => {
      playNote(ctx, noteToFrequency(baseOctave * 12 + rootNote), 1.2, analyserRef.current ?? undefined, sustainRef);
      playNote(ctx, noteToFrequency(baseOctave * 12 + rootNote + selectedInterval), 1.2, analyserRef.current ?? undefined, sustainRef);
    }, 1400);
  };

  const handlePianoNote = (midiNote: number) => {
    const ctx = getAudioCtx();
    playNote(ctx, noteToFrequency(midiNote), 1.0, analyserRef.current ?? undefined, sustainRef);
  };

  const { t } = useLang();

  const tabs: { id: Tab; label: string }[] = [
    { id: "scales", label: t("mtTabScales") },
    { id: "chords", label: t("mtTabChords") },
    { id: "intervals", label: t("mtTabIntervals") },
    { id: "progressions", label: t("mtTabProgressions") },
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
          {t("mtTitle")}
        </h1>
        <p className="text-sm mt-1" style={{ color: "#8a9bb0" }}>
          {t("mtSubtitle")}
        </p>
      </div>

      <div className="px-8 py-6">
        {/* Root note selector */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <span
            className="text-xs font-medium uppercase tracking-widest"
            style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
          >
            {t("mtRootNote")}:
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
          className="module-card rounded p-4 mb-3 overflow-x-auto"
          style={{ background: "white" }}
        >
          <div className="flex items-center justify-between mb-3">
            <div
              className="text-xs font-medium uppercase tracking-widest"
              style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              Interactive Piano — Click keys or press keyboard (Z–M · Q–U · I–P)
            </div>
            <div className="flex items-center gap-2">
              {/* Sustain indicator */}
              <div
                className="flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium transition-all"
                style={{
                  background: sustainActive ? "rgba(0,212,255,0.15)" : "rgba(138,155,176,0.1)",
                  border: `1px solid ${sustainActive ? "#00d4ff" : "rgba(138,155,176,0.3)"}`,
                  color: sustainActive ? "#00d4ff" : "#8a9bb0",
                  fontFamily: "'IBM Plex Mono', monospace",
                }}
              >
                <span
                  style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: sustainActive ? "#00d4ff" : "#8a9bb0",
                    display: "inline-block",
                    boxShadow: sustainActive ? "0 0 6px #00d4ff" : "none",
                  }}
                />
                {t("mtSustain")} {sustainActive ? "ON" : "OFF"} — SPACE
              </div>
            </div>
          </div>
          <Piano
            highlightedNotes={highlightedNotes}
            rootNote={rootNote}
            onNotePlay={handlePianoNote}
            pressedKeys={pressedKeys}
          />
        </div>

        {/* FFT Spectrum Analyzer */}
        <div
          className="module-card rounded p-4 mb-6"
          style={{ background: "#0d1829", border: "1px solid rgba(0,212,255,0.15)" }}
        >
          <div className="flex items-center justify-between mb-2">
            <div
              className="text-xs font-medium uppercase tracking-widest"
              style={{ color: "#00d4ff", fontFamily: "'IBM Plex Mono', monospace" }}
            >
              {t("mtFftTitle")}
              <span style={{ color: "rgba(0,212,255,0.5)", marginLeft: 8 }}>
                — static: scale/chord frequencies · live: updates during playback
              </span>
            </div>
            <button
              onClick={() => setShowFFT((v) => !v)}
              className="text-xs px-2 py-1 rounded transition-all"
              style={{
                background: showFFT ? "rgba(0,212,255,0.15)" : "rgba(138,155,176,0.1)",
                color: showFFT ? "#00d4ff" : "#8a9bb0",
                border: `1px solid ${showFFT ? "rgba(0,212,255,0.3)" : "rgba(138,155,176,0.2)"}`,
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              {showFFT ? t("mtFftHideToggle") : t("mtFftToggle")}
            </button>
          </div>
          {showFFT && (
            <>
              <canvas
                ref={fftCanvasRef}
                style={{ width: "100%", height: 200, display: "block", borderRadius: 4 }}
              />

              {/* ── Frequency Reference Table ── */}
              <div className="mt-3 overflow-x-auto">
                <div
                  className="text-xs font-medium uppercase tracking-widest mb-2"
                  style={{ color: "rgba(0,212,255,0.6)", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  {t("mtRefTable")}
                </div>
                <table style={{ width: "100%", borderCollapse: "collapse", fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid rgba(0,212,255,0.15)" }}>
                      {["#", t("mtRefNote"), t("mtRefInterval"), t("mtRefAbbr"), t("mtRefMidi"), t("mtRefFreq"), t("mtRefWave"), t("mtRefRatio"), t("mtRefConsonance")].map((h) => (
                        <th
                          key={h}
                          style={{
                            textAlign: "left",
                            padding: "4px 8px",
                            color: "rgba(138,155,176,0.7)",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(() => {
                      // Compute the same intervals as drawFFT
                      let intervals: number[];
                      if (activeTab === "scales") intervals = SCALES[selectedScale].intervals;
                      else if (activeTab === "chords") intervals = CHORD_TYPES[selectedChord].intervals;
                      else if (activeTab === "intervals") intervals = [0, selectedInterval];
                      else intervals = [0, 4, 7];

                      const baseOctave = 4;
                      const SPEED_OF_SOUND = 34300; // cm/s at 20°C

                      return intervals.map((semitones, idx) => {
                        const midi = baseOctave * 12 + rootNote + semitones;
                        const freq = noteToFrequency(midi);
                        const noteName = NOTE_NAMES[(rootNote + semitones) % 12];
                        const wavelength = (SPEED_OF_SOUND / freq).toFixed(1);
                        const ivData = INTERVALS.find((iv) => iv.semitones === (semitones % 12));
                        const intervalName = semitones === 0 ? "Unison (Root)" : ivData ? ivData.name : `+${semitones} st`;
                        const abbr = semitones === 0 ? "P1" : ivData ? ivData.abbr : `+${semitones}`;
                        const ratio = ivData ? ivData.ratio : "—";
                        const consonance = ivData ? ivData.consonance : "—";

                        const consonanceColor = (c: string) => {
                          if (c === "Perfect") return "#00d4ff";
                          if (c === "Imperfect") return "#a78bfa";
                          if (c === "Mild Dissonance") return "#fbbf24";
                          return "#ff4f1f";
                        };

                        return (
                          <tr
                            key={idx}
                            style={{
                              borderBottom: "1px solid rgba(255,255,255,0.04)",
                              background: idx % 2 === 0 ? "rgba(255,255,255,0.02)" : "transparent",
                            }}
                          >
                            <td style={{ padding: "5px 8px", color: "rgba(138,155,176,0.5)" }}>{idx + 1}</td>
                            <td style={{ padding: "5px 8px", color: "#ff4f1f", fontWeight: 700, fontSize: 13 }}>
                              {noteName}<span style={{ color: "rgba(138,155,176,0.5)", fontSize: 10, marginLeft: 2 }}>{4 + Math.floor((rootNote + semitones) / 12)}</span>
                            </td>
                            <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.75)" }}>{intervalName}</td>
                            <td style={{ padding: "5px 8px" }}>
                              <span
                                style={{
                                  background: "rgba(167,139,250,0.15)",
                                  color: "#a78bfa",
                                  border: "1px solid rgba(167,139,250,0.3)",
                                  borderRadius: 3,
                                  padding: "1px 5px",
                                  fontSize: 10,
                                }}
                              >
                                {abbr}
                              </span>
                            </td>
                            <td style={{ padding: "5px 8px", color: "#00d4ff" }}>{midi}</td>
                            <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.9)", fontWeight: 600 }}>
                              {freq.toFixed(2)}
                              <span style={{ color: "rgba(138,155,176,0.5)", fontSize: 9, marginLeft: 2 }}>Hz</span>
                            </td>
                            <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.55)" }}>
                              {wavelength}
                              <span style={{ color: "rgba(138,155,176,0.4)", fontSize: 9, marginLeft: 2 }}>cm</span>
                            </td>
                            <td style={{ padding: "5px 8px", color: "rgba(255,255,255,0.6)" }}>{ratio}</td>
                            <td style={{ padding: "5px 8px" }}>
                              <span style={{ color: consonanceColor(consonance), fontSize: 10 }}>{consonance}</span>
                            </td>
                          </tr>
                        );
                      });
                    })()}
                  </tbody>
                </table>
                <div
                  className="mt-2 text-xs flex flex-wrap items-center gap-x-3 gap-y-1"
                  style={{ color: "rgba(138,155,176,0.4)", fontFamily: "'IBM Plex Mono', monospace" }}
                >
                  <span>Wavelength at 343 m/s (20°C)</span>
                  <span>·</span>
                  <span>MIDI 60 = C4 = 261.63 Hz</span>
                  <span>·</span>
                  <span>A4 = MIDI 69 = 440 Hz (ISO 16)</span>
                  <span>·</span>
                  <span>f = 440×2^((n−69)/12)</span>
                  <span>·</span>
                  <a
                    href="https://github.com/randommysticalperson/music-science-app"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "rgba(0,212,255,0.6)", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 4 }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "#00d4ff"; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLAnchorElement).style.color = "rgba(0,212,255,0.6)"; }}
                  >
                    ↗ Source on GitHub
                  </a>
                </div>
              </div>
            </>
          )}
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
                    ▶ {t("mtPlayScale")}
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
                    ▶ {t("mtPlayChord")}
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
                    ▶ {t("mtPlayInterval")}
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
          <ProgressionsTabInner rootNote={rootNote} />
        )}
      </div>
    </div>
  );
}
