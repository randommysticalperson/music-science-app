/*
 * PianoPractice.tsx — Bauhaus Frequency Design
 * Virtual piano keyboard + real-time DFT spectrum + falling-note highway game
 * Design: dark navy (#0a0f1e) background, accent pink (#ec4899), cyan (#00d4ff)
 * Layout: top DFT spectrum canvas | middle falling-note highway canvas | bottom piano keyboard
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLang } from "../contexts/LanguageContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const BLACK_OFFSETS = [1, 3, 6, 8, 10]; // semitone positions that are black keys

// Keyboard spans C3 (MIDI 48) to B5 (MIDI 83) = 3 octaves = 36 keys
const KEYBOARD_START_MIDI = 48; // C3
const KEYBOARD_END_MIDI = 83;   // B5
const TOTAL_KEYS = KEYBOARD_END_MIDI - KEYBOARD_START_MIDI + 1;

// Count white keys
function isBlackKey(midi: number) {
  return BLACK_OFFSETS.includes(midi % 12);
}
const WHITE_KEY_MIDIS = Array.from({ length: TOTAL_KEYS }, (_, i) => KEYBOARD_START_MIDI + i)
  .filter((m) => !isBlackKey(m));
const WHITE_KEY_COUNT = WHITE_KEY_MIDIS.length;

// Note frequency (equal temperament, A4 = 440 Hz)
const noteFreq = (midi: number) => 440 * Math.pow(2, (midi - 69) / 12);

// Note label: e.g. "C4", "F#5"
const noteLabel = (midi: number) => NOTE_NAMES[midi % 12] + Math.floor(midi / 12 - 1);

// Keyboard key → MIDI mapping (QWERTY)
const KEY_MAP: Record<string, number> = {
  // Octave 3 (C3–B3): Z row
  z: 48, s: 49, x: 50, d: 51, c: 52, v: 53, g: 54, b: 55, h: 56, n: 57, j: 58, m: 59,
  // Octave 4 (C4–B4): Q row
  q: 60, "2": 61, w: 62, "3": 63, e: 64, r: 65, "5": 66, t: 67, "6": 68, y: 69, "7": 70, u: 71,
  // Octave 5 (C5–B5): I row
  i: 72, "9": 73, o: 74, "0": 75, p: 76,
};

// ─── Song Patterns ────────────────────────────────────────────────────────────

interface SongNote {
  midi: number;
  beat: number;    // beat index (0-based)
  duration: number; // in beats
}

interface Song {
  name: string;
  bpm: number;
  notes: SongNote[];
}

const SONGS: Song[] = [
  {
    name: "Ode to Joy",
    bpm: 100,
    notes: [
      { midi: 64, beat: 0, duration: 1 }, { midi: 64, beat: 1, duration: 1 },
      { midi: 65, beat: 2, duration: 1 }, { midi: 67, beat: 3, duration: 1 },
      { midi: 67, beat: 4, duration: 1 }, { midi: 65, beat: 5, duration: 1 },
      { midi: 64, beat: 6, duration: 1 }, { midi: 62, beat: 7, duration: 1 },
      { midi: 60, beat: 8, duration: 1 }, { midi: 60, beat: 9, duration: 1 },
      { midi: 62, beat: 10, duration: 1 }, { midi: 64, beat: 11, duration: 1 },
      { midi: 64, beat: 12, duration: 1.5 }, { midi: 62, beat: 13.5, duration: 0.5 },
      { midi: 62, beat: 14, duration: 2 },
    ],
  },
  {
    name: "Twinkle Twinkle",
    bpm: 110,
    notes: [
      { midi: 60, beat: 0, duration: 1 }, { midi: 60, beat: 1, duration: 1 },
      { midi: 67, beat: 2, duration: 1 }, { midi: 67, beat: 3, duration: 1 },
      { midi: 69, beat: 4, duration: 1 }, { midi: 69, beat: 5, duration: 1 },
      { midi: 67, beat: 6, duration: 2 },
      { midi: 65, beat: 8, duration: 1 }, { midi: 65, beat: 9, duration: 1 },
      { midi: 64, beat: 10, duration: 1 }, { midi: 64, beat: 11, duration: 1 },
      { midi: 62, beat: 12, duration: 1 }, { midi: 62, beat: 13, duration: 1 },
      { midi: 60, beat: 14, duration: 2 },
    ],
  },
  {
    name: "Happy Birthday",
    bpm: 100,
    notes: [
      { midi: 60, beat: 0.5, duration: 0.5 }, { midi: 60, beat: 1, duration: 0.5 },
      { midi: 62, beat: 1.5, duration: 1 }, { midi: 60, beat: 2.5, duration: 1 },
      { midi: 65, beat: 3.5, duration: 1 }, { midi: 64, beat: 4.5, duration: 2 },
      { midi: 60, beat: 6.5, duration: 0.5 }, { midi: 60, beat: 7, duration: 0.5 },
      { midi: 62, beat: 7.5, duration: 1 }, { midi: 60, beat: 8.5, duration: 1 },
      { midi: 67, beat: 9.5, duration: 1 }, { midi: 65, beat: 10.5, duration: 2 },
    ],
  },
  {
    name: "C Major Scale",
    bpm: 120,
    notes: [
      { midi: 60, beat: 0, duration: 1 }, { midi: 62, beat: 1, duration: 1 },
      { midi: 64, beat: 2, duration: 1 }, { midi: 65, beat: 3, duration: 1 },
      { midi: 67, beat: 4, duration: 1 }, { midi: 69, beat: 5, duration: 1 },
      { midi: 71, beat: 6, duration: 1 }, { midi: 72, beat: 7, duration: 2 },
      { midi: 71, beat: 9, duration: 1 }, { midi: 69, beat: 10, duration: 1 },
      { midi: 67, beat: 11, duration: 1 }, { midi: 65, beat: 12, duration: 1 },
      { midi: 64, beat: 13, duration: 1 }, { midi: 62, beat: 14, duration: 1 },
      { midi: 60, beat: 15, duration: 2 },
    ],
  },
  {
    name: "Für Elise (Theme)",
    bpm: 90,
    notes: [
      { midi: 76, beat: 0, duration: 0.5 }, { midi: 75, beat: 0.5, duration: 0.5 },
      { midi: 76, beat: 1, duration: 0.5 }, { midi: 75, beat: 1.5, duration: 0.5 },
      { midi: 76, beat: 2, duration: 0.5 }, { midi: 71, beat: 2.5, duration: 0.5 },
      { midi: 74, beat: 3, duration: 0.5 }, { midi: 72, beat: 3.5, duration: 0.5 },
      { midi: 69, beat: 4, duration: 1 },
      { midi: 60, beat: 5, duration: 0.5 }, { midi: 64, beat: 5.5, duration: 0.5 },
      { midi: 69, beat: 6, duration: 1 },
      { midi: 71, beat: 7, duration: 1 },
      { midi: 64, beat: 8, duration: 0.5 }, { midi: 68, beat: 8.5, duration: 0.5 },
      { midi: 71, beat: 9, duration: 1 },
      { midi: 72, beat: 10, duration: 1 },
    ],
  },
];

// ─── Audio Engine ─────────────────────────────────────────────────────────────

interface ActiveNote {
  oscillator: OscillatorNode;
  gainNode: GainNode;
}

// ─── Game Types ───────────────────────────────────────────────────────────────

type GameState = "idle" | "countdown" | "playing" | "finished";

interface FallingNote {
  id: number;
  midi: number;
  beatStart: number;
  beatDuration: number;
  hit: boolean;
  missed: boolean;
  hitTime?: number; // for flash effect
}

// ─── Accent colours per key lane ─────────────────────────────────────────────
const LANE_COLORS = [
  "#ec4899", "#f97316", "#eab308", "#22c55e",
  "#00d4ff", "#a855f7", "#ec4899", "#f97316",
  "#eab308", "#22c55e", "#00d4ff", "#a855f7",
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PianoPractice() {
  const { t } = useLang();

  // ── Audio refs ──
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const activeNotesRef = useRef<Map<number, ActiveNote>>(new Map());
  const sustainRef = useRef(false);
  const sustainedNotesRef = useRef<Set<number>>(new Set());

  // ── Canvas refs ──
  const dftCanvasRef = useRef<HTMLCanvasElement>(null);
  const highwayCanvasRef = useRef<HTMLCanvasElement>(null);
  const pianoCanvasRef = useRef<HTMLCanvasElement>(null);
  const rafDftRef = useRef<number>(0);
  const rafHighwayRef = useRef<number>(0);

  // ── Game state ──
  const [gameState, setGameState] = useState<GameState>("idle");
  const [selectedSong, setSelectedSong] = useState(0);
  const [score, setScore] = useState(0);
  const [combo, setCombo] = useState(0);
  const [maxCombo, setMaxCombo] = useState(0);
  const [countdown, setCountdown] = useState(3);
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  const [accuracy, setAccuracy] = useState(100);

  // Mutable refs for game loop (avoid stale closures)
  const gameStateRef = useRef<GameState>("idle");
  const fallingNotesRef = useRef<FallingNote[]>([]);
  const scoreRef = useRef(0);
  const comboRef = useRef(0);
  const maxComboRef = useRef(0);
  const totalHitsRef = useRef(0);
  const totalNotesRef = useRef(0);
  const pressedKeysRef = useRef<Set<number>>(new Set());
  const gameStartTimeRef = useRef(0);
  const songRef = useRef<Song>(SONGS[0]);
  const noteIdRef = useRef(0);

  // ── Piano key dimensions (computed from canvas width) ──
  const pianoLayoutRef = useRef<{
    whiteW: number;
    whiteH: number;
    blackW: number;
    blackH: number;
    keyRects: Map<number, { x: number; y: number; w: number; h: number; isBlack: boolean }>;
  } | null>(null);

  // ─── Audio init ──────────────────────────────────────────────────────────────

  const initAudio = useCallback(() => {
    if (audioCtxRef.current) return;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.8;
    const master = ctx.createGain();
    master.gain.value = 0.4;
    master.connect(analyser);
    analyser.connect(ctx.destination);
    audioCtxRef.current = ctx;
    analyserRef.current = analyser;
    masterGainRef.current = master;
  }, []);

  const playNote = useCallback((midi: number) => {
    initAudio();
    const ctx = audioCtxRef.current!;
    const master = masterGainRef.current!;
    if (activeNotesRef.current.has(midi)) return;

    const freq = noteFreq(midi);
    const osc = ctx.createOscillator();
    const gainNode = ctx.createGain();

    // Piano-like timbre: fundamental + harmonics
    osc.type = "triangle";
    osc.frequency.value = freq;

    // ADSR envelope
    const now = ctx.currentTime;
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.7, now + 0.01);   // attack
    gainNode.gain.exponentialRampToValueAtTime(0.4, now + 0.1); // decay
    gainNode.gain.setValueAtTime(0.4, now + 0.1);              // sustain

    osc.connect(gainNode);
    gainNode.connect(master);
    osc.start(now);

    activeNotesRef.current.set(midi, { oscillator: osc, gainNode });
  }, [initAudio]);

  const stopNote = useCallback((midi: number) => {
    if (sustainRef.current) {
      sustainedNotesRef.current.add(midi);
      return;
    }
    const note = activeNotesRef.current.get(midi);
    if (!note) return;
    const ctx = audioCtxRef.current!;
    const now = ctx.currentTime;
    note.gainNode.gain.cancelScheduledValues(now);
    note.gainNode.gain.setValueAtTime(note.gainNode.gain.value, now);
    note.gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.3); // release
    note.oscillator.stop(now + 0.3);
    activeNotesRef.current.delete(midi);
  }, []);

  // ─── Piano canvas layout ──────────────────────────────────────────────────────

  const computePianoLayout = useCallback((canvas: HTMLCanvasElement) => {
    const W = canvas.width;
    const H = canvas.height;
    const whiteW = W / WHITE_KEY_COUNT;
    const whiteH = H;
    const blackW = whiteW * 0.6;
    const blackH = H * 0.62;

    const keyRects = new Map<number, { x: number; y: number; w: number; h: number; isBlack: boolean }>();

    // White keys first
    let whiteIdx = 0;
    for (let midi = KEYBOARD_START_MIDI; midi <= KEYBOARD_END_MIDI; midi++) {
      if (!isBlackKey(midi)) {
        keyRects.set(midi, { x: whiteIdx * whiteW, y: 0, w: whiteW, h: whiteH, isBlack: false });
        whiteIdx++;
      }
    }

    // Black keys: positioned between white keys
    for (let midi = KEYBOARD_START_MIDI; midi <= KEYBOARD_END_MIDI; midi++) {
      if (isBlackKey(midi)) {
        // Find the white key to the left
        const leftWhite = keyRects.get(midi - 1);
        if (leftWhite) {
          const x = leftWhite.x + leftWhite.w - blackW / 2;
          keyRects.set(midi, { x, y: 0, w: blackW, h: blackH, isBlack: true });
        }
      }
    }

    pianoLayoutRef.current = { whiteW, whiteH, blackW, blackH, keyRects };
    return pianoLayoutRef.current;
  }, []);

  const drawPiano = useCallback((canvas: HTMLCanvasElement, pressed: Set<number>) => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const layout = pianoLayoutRef.current || computePianoLayout(canvas);
    const { keyRects } = layout;
    const W = canvas.width;
    const H = canvas.height;

    ctx.clearRect(0, 0, W, H);

    // Draw white keys first
    Array.from(keyRects.entries()).forEach(([midi, rect]) => {
      if (rect.isBlack) return;
      const isPressed = pressed.has(midi);
      const noteColor = LANE_COLORS[midi % 12];

      // Key body
      const grad = ctx.createLinearGradient(rect.x, 0, rect.x, rect.h);
      if (isPressed) {
        grad.addColorStop(0, noteColor + "cc");
        grad.addColorStop(1, noteColor + "66");
      } else {
        grad.addColorStop(0, "#f8f6f2");
        grad.addColorStop(1, "#e8e4de");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(rect.x + 1, rect.y, rect.w - 2, rect.h - 2, [0, 0, 4, 4]);
      ctx.fill();

      // Border
      ctx.strokeStyle = isPressed ? noteColor : "rgba(0,0,0,0.15)";
      ctx.lineWidth = isPressed ? 1.5 : 1;
      ctx.beginPath();
      ctx.roundRect(rect.x + 1, rect.y, rect.w - 2, rect.h - 2, [0, 0, 4, 4]);
      ctx.stroke();

      // Note label on bottom
      if (rect.w > 18) {
        ctx.fillStyle = isPressed ? "white" : "rgba(0,0,0,0.35)";
        ctx.font = `bold ${Math.min(11, rect.w * 0.35)}px 'IBM Plex Mono', monospace`;
        ctx.textAlign = "center";
        const label = noteLabel(midi);
        ctx.fillText(label, rect.x + rect.w / 2, rect.h - 6);
      }
    });

    // Draw black keys on top
    Array.from(keyRects.entries()).forEach(([midi, rect]) => {
      if (!rect.isBlack) return;
      const isPressed = pressed.has(midi);
      const noteColor = LANE_COLORS[midi % 12];

      const grad = ctx.createLinearGradient(rect.x, 0, rect.x, rect.h);
      if (isPressed) {
        grad.addColorStop(0, noteColor);
        grad.addColorStop(1, noteColor + "88");
      } else {
        grad.addColorStop(0, "#1a1a2e");
        grad.addColorStop(1, "#0a0a18");
      }
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.roundRect(rect.x, rect.y, rect.w, rect.h, [0, 0, 3, 3]);
      ctx.fill();

      if (isPressed) {
        ctx.strokeStyle = noteColor;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.roundRect(rect.x, rect.y, rect.w, rect.h, [0, 0, 3, 3]);
        ctx.stroke();
      }
    });
  }, [computePianoLayout]);

  // ─── DFT Spectrum Visualizer ──────────────────────────────────────────────────

  const drawDFT = useCallback(() => {
    const canvas = dftCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const analyser = analyserRef.current;

    const W = canvas.width;
    const H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    // Background
    ctx.fillStyle = "#0a0f1e";
    ctx.fillRect(0, 0, W, H);

    // Grid lines
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.moveTo(0, (H / 4) * i);
      ctx.lineTo(W, (H / 4) * i);
      ctx.stroke();
    }

    if (!analyser) {
      // Flat line when no audio
      ctx.strokeStyle = "rgba(0,212,255,0.3)";
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, H / 2);
      ctx.lineTo(W, H / 2);
      ctx.stroke();

      // Label
      ctx.fillStyle = "rgba(138,155,176,0.5)";
      ctx.font = "11px 'IBM Plex Mono', monospace";
      ctx.textAlign = "left";
      ctx.fillText("DFT SPECTRUM — play a note to activate", 12, 16);
      rafDftRef.current = requestAnimationFrame(drawDFT);
      return;
    }

    const bufLen = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(freqData);

    // We only visualize 0–4000 Hz (piano range)
    const sampleRate = audioCtxRef.current?.sampleRate ?? 44100;
    const maxBin = Math.floor((4000 / (sampleRate / 2)) * bufLen);
    const binCount = Math.min(maxBin, bufLen);

    // Draw spectrum bars
    const barW = W / binCount;
    for (let i = 0; i < binCount; i++) {
      const v = freqData[i] / 255;
      const barH = v * H * 0.9;
      const x = i * barW;

      // Color: gradient from cyan (low) to pink (high)
      const hue = 180 + v * 120; // 180 (cyan) → 300 (magenta)
      ctx.fillStyle = `hsla(${hue}, 100%, 60%, ${0.3 + v * 0.7})`;
      ctx.fillRect(x, H - barH, barW - 0.5, barH);
    }

    // Overlay line
    ctx.strokeStyle = "rgba(0,212,255,0.6)";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < binCount; i++) {
      const v = freqData[i] / 255;
      const x = (i / binCount) * W;
      const y = H - v * H * 0.9;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();

    // Frequency axis labels
    const freqLabels = [110, 220, 440, 880, 1760, 3520];
    ctx.fillStyle = "rgba(138,155,176,0.6)";
    ctx.font = "9px 'IBM Plex Mono', monospace";
    ctx.textAlign = "center";
    for (const f of freqLabels) {
      if (f > 4000) continue;
      const x = (f / 4000) * W;
      ctx.fillText(f >= 1000 ? `${f / 1000}k` : `${f}`, x, H - 3);
    }

    // Title
    ctx.fillStyle = "rgba(0,212,255,0.7)";
    ctx.font = "bold 10px 'IBM Plex Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText("DISCRETE FOURIER TRANSFORM  0 – 4 kHz", 10, 14);

    rafDftRef.current = requestAnimationFrame(drawDFT);
  }, []);

  // ─── Highway Game Engine ──────────────────────────────────────────────────────

  // Highway: notes fall from top to a hit-zone at the bottom
  // Each lane corresponds to a MIDI note in the song
  // Speed: notes travel the full canvas height in HIGHWAY_BEATS beats of visible window

  const HIGHWAY_VISIBLE_BEATS = 4; // how many beats are visible at once
  const HIT_ZONE_FRACTION = 0.85;  // hit zone is at 85% down the canvas

  const drawHighway = useCallback(() => {
    const canvas = highwayCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = canvas.width;
    const H = canvas.height;
    const song = songRef.current;
    const state = gameStateRef.current;

    ctx.clearRect(0, 0, W, H);

    // Background
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, "#0a0f1e");
    bgGrad.addColorStop(1, "#0f1830");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Get unique MIDI notes in song for lane assignment
    const uniqueMidis = Array.from(new Set(song.notes.map((n) => n.midi))).sort((a, b) => a - b);
    const laneCount = uniqueMidis.length;
    const laneW = W / laneCount;

    // Lane backgrounds + vertical dividers
    for (let i = 0; i < laneCount; i++) {
      const midi = uniqueMidis[i];
      const color = LANE_COLORS[midi % 12];
      // Subtle lane tint
      ctx.fillStyle = `${color}08`;
      ctx.fillRect(i * laneW, 0, laneW, H);
      // Divider
      if (i > 0) {
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(i * laneW, 0);
        ctx.lineTo(i * laneW, H);
        ctx.stroke();
      }
    }

    // Hit zone line
    const hitY = H * HIT_ZONE_FRACTION;
    const hitGrad = ctx.createLinearGradient(0, hitY - 2, 0, hitY + 2);
    hitGrad.addColorStop(0, "rgba(236,72,153,0)");
    hitGrad.addColorStop(0.5, "rgba(236,72,153,0.8)");
    hitGrad.addColorStop(1, "rgba(236,72,153,0)");
    ctx.fillStyle = hitGrad;
    ctx.fillRect(0, hitY - 2, W, 4);

    // Hit zone key indicators
    for (let i = 0; i < laneCount; i++) {
      const midi = uniqueMidis[i];
      const color = LANE_COLORS[midi % 12];
      const isPressed = pressedKeysRef.current.has(midi);
      const x = i * laneW + laneW / 2;

      ctx.beginPath();
      ctx.arc(x, hitY, laneW * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = isPressed ? color : `${color}30`;
      ctx.fill();
      ctx.strokeStyle = isPressed ? color : `${color}60`;
      ctx.lineWidth = isPressed ? 2 : 1;
      ctx.stroke();

      // Note label
      ctx.fillStyle = isPressed ? "white" : `${color}90`;
      ctx.font = `bold ${Math.min(11, laneW * 0.25)}px 'IBM Plex Mono', monospace`;
      ctx.textAlign = "center";
      ctx.fillText(noteLabel(midi), x, hitY + 4);
    }

    if (state === "idle" || state === "countdown") {
      // Show song title and instructions
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = "bold 18px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      if (state === "countdown") {
        ctx.fillStyle = "#ec4899";
        ctx.font = "bold 64px 'DM Sans', sans-serif";
        ctx.fillText(String(countdown), W / 2, H / 2);
      } else {
        ctx.fillText("Select a song and press START", W / 2, H / 2);
      }
      rafHighwayRef.current = requestAnimationFrame(drawHighway);
      return;
    }

    if (state === "finished") {
      ctx.fillStyle = "#ec4899";
      ctx.font = "bold 28px 'DM Sans', sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("FINISHED!", W / 2, H / 2 - 30);
      ctx.fillStyle = "white";
      ctx.font = "18px 'IBM Plex Mono', monospace";
      ctx.fillText(`Score: ${scoreRef.current}`, W / 2, H / 2 + 10);
      ctx.fillText(`Max Combo: ${maxComboRef.current}`, W / 2, H / 2 + 36);
      rafHighwayRef.current = requestAnimationFrame(drawHighway);
      return;
    }

    // ── Playing state ──
    const now = performance.now();
    const elapsed = (now - gameStartTimeRef.current) / 1000; // seconds
    const bps = song.bpm / 60;
    const currentBeat = elapsed * bps;

    // Spawn new falling notes
    for (const sn of song.notes) {
      const existing = fallingNotesRef.current.find((fn) => fn.beatStart === sn.beat && fn.midi === sn.midi);
      if (!existing) {
        // Spawn when the note's beat is within the visible window ahead
        if (sn.beat >= currentBeat - 0.5 && sn.beat <= currentBeat + HIGHWAY_VISIBLE_BEATS + 1) {
          fallingNotesRef.current.push({
            id: noteIdRef.current++,
            midi: sn.midi,
            beatStart: sn.beat,
            beatDuration: sn.duration,
            hit: false,
            missed: false,
          });
        }
      }
    }

    // Mark missed notes
    for (const fn of fallingNotesRef.current) {
      if (!fn.hit && !fn.missed && fn.beatStart + fn.beatDuration < currentBeat - 0.5) {
        fn.missed = true;
        comboRef.current = 0;
        setCombo(0);
      }
    }

    // Draw falling notes
    for (const fn of fallingNotesRef.current) {
      const laneIdx = uniqueMidis.indexOf(fn.midi);
      if (laneIdx < 0) continue;

      const beatFromNow = fn.beatStart - currentBeat;
      // y: at beatFromNow=HIGHWAY_VISIBLE_BEATS → top (0), at beatFromNow=0 → hitY
      const yTop = hitY - (beatFromNow / HIGHWAY_VISIBLE_BEATS) * hitY;
      const notePixelH = (fn.beatDuration / HIGHWAY_VISIBLE_BEATS) * hitY;
      const x = laneIdx * laneW + laneW * 0.1;
      const w = laneW * 0.8;

      if (fn.missed) {
        // Missed: grey
        ctx.fillStyle = "rgba(100,100,120,0.4)";
        ctx.beginPath();
        ctx.roundRect(x, yTop, w, Math.max(notePixelH, 12), 4);
        ctx.fill();
        continue;
      }

      if (fn.hit) {
        // Hit flash effect
        const elapsed2 = fn.hitTime ? (now - fn.hitTime) / 300 : 1;
        if (elapsed2 < 1) {
          const alpha = 1 - elapsed2;
          const color = LANE_COLORS[fn.midi % 12];
          ctx.fillStyle = `${color}${Math.round(alpha * 255).toString(16).padStart(2, "0")}`;
          ctx.beginPath();
          ctx.roundRect(x, hitY - 10, w, 20, 4);
          ctx.fill();
        }
        continue;
      }

      // Active note
      const color = LANE_COLORS[fn.midi % 12];
      const noteGrad = ctx.createLinearGradient(x, yTop, x, yTop + notePixelH);
      noteGrad.addColorStop(0, `${color}dd`);
      noteGrad.addColorStop(1, `${color}88`);
      ctx.fillStyle = noteGrad;
      ctx.beginPath();
      ctx.roundRect(x, yTop, w, Math.max(notePixelH, 14), 6);
      ctx.fill();

      // Glow
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.roundRect(x, yTop, w, Math.max(notePixelH, 14), 6);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Score overlay
    ctx.fillStyle = "rgba(236,72,153,0.9)";
    ctx.font = "bold 14px 'IBM Plex Mono', monospace";
    ctx.textAlign = "left";
    ctx.fillText(`${scoreRef.current}`, 10, 22);
    if (comboRef.current > 1) {
      ctx.fillStyle = "#eab308";
      ctx.font = "bold 12px 'IBM Plex Mono', monospace";
      ctx.fillText(`×${comboRef.current} COMBO`, 10, 40);
    }

    // Check if song finished
    const lastBeat = Math.max(...song.notes.map((n) => n.beat + n.duration));
    if (currentBeat > lastBeat + 2) {
      gameStateRef.current = "finished";
      setGameState("finished");
      setScore(scoreRef.current);
      setMaxCombo(maxComboRef.current);
      const hits = totalHitsRef.current;
      const total = totalNotesRef.current;
      setAccuracy(total > 0 ? Math.round((hits / total) * 100) : 100);
    }

    rafHighwayRef.current = requestAnimationFrame(drawHighway);
  }, [countdown]);

  // ─── Hit detection ────────────────────────────────────────────────────────────

  const checkHit = useCallback((midi: number) => {
    if (gameStateRef.current !== "playing") return;
    const song = songRef.current;
    const bps = song.bpm / 60;
    const elapsed = (performance.now() - gameStartTimeRef.current) / 1000;
    const currentBeat = elapsed * bps;
    const HIT_WINDOW = 0.4; // beats

    for (const fn of fallingNotesRef.current) {
      if (fn.midi !== midi || fn.hit || fn.missed) continue;
      const diff = Math.abs(fn.beatStart - currentBeat);
      if (diff <= HIT_WINDOW) {
        fn.hit = true;
        fn.hitTime = performance.now();
        totalHitsRef.current++;

        // Score: perfect < 0.1, good < 0.25, ok < 0.4
        let pts = diff < 0.1 ? 100 : diff < 0.25 ? 70 : 40;
        comboRef.current++;
        if (comboRef.current > maxComboRef.current) maxComboRef.current = comboRef.current;
        pts = Math.round(pts * (1 + comboRef.current * 0.05));
        scoreRef.current += pts;
        setScore(scoreRef.current);
        setCombo(comboRef.current);
        break;
      }
    }
  }, []);

  // ─── Game controls ────────────────────────────────────────────────────────────

  const startGame = useCallback(() => {
    initAudio();
    fallingNotesRef.current = [];
    scoreRef.current = 0;
    comboRef.current = 0;
    maxComboRef.current = 0;
    totalHitsRef.current = 0;
    totalNotesRef.current = SONGS[selectedSong].notes.length;
    noteIdRef.current = 0;
    songRef.current = SONGS[selectedSong];
    setScore(0);
    setCombo(0);
    setMaxCombo(0);
    setAccuracy(100);
    gameStateRef.current = "countdown";
    setGameState("countdown");

    let count = 3;
    setCountdown(count);
    const interval = setInterval(() => {
      count--;
      if (count <= 0) {
        clearInterval(interval);
        gameStartTimeRef.current = performance.now();
        gameStateRef.current = "playing";
        setGameState("playing");
      } else {
        setCountdown(count);
      }
    }, 1000);
  }, [selectedSong, initAudio]);

  const stopGame = useCallback(() => {
    gameStateRef.current = "idle";
    setGameState("idle");
    fallingNotesRef.current = [];
  }, []);

  // ─── Key input ────────────────────────────────────────────────────────────────

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.repeat) return;
    if (e.key === " ") { e.preventDefault(); sustainRef.current = true; return; }
    const midi = KEY_MAP[e.key.toLowerCase()];
    if (midi === undefined) return;
    playNote(midi);
    checkHit(midi);
    pressedKeysRef.current = new Set(Array.from(pressedKeysRef.current).concat(midi));
    setPressedKeys(new Set(pressedKeysRef.current));
  }, [playNote, checkHit]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.key === " ") {
      sustainRef.current = false;
      sustainedNotesRef.current.forEach((m) => stopNote(m));
      sustainedNotesRef.current.clear();
      return;
    }
    const midi = KEY_MAP[e.key.toLowerCase()];
    if (midi === undefined) return;
    stopNote(midi);
    pressedKeysRef.current = new Set(Array.from(pressedKeysRef.current).filter((m) => m !== midi));
    setPressedKeys(new Set(pressedKeysRef.current));
  }, [stopNote]);

  // ─── Piano mouse/touch input ──────────────────────────────────────────────────

  const getMidiFromCanvasPos = useCallback((canvas: HTMLCanvasElement, clientX: number, clientY: number): number | null => {
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (canvas.width / rect.width);
    const y = (clientY - rect.top) * (canvas.height / rect.height);
    const layout = pianoLayoutRef.current;
    if (!layout) return null;

    // Check black keys first (they're on top)
    const entries = Array.from(layout.keyRects.entries());
    for (const [midi, kr] of entries) {
      if (!kr.isBlack) continue;
      if (x >= kr.x && x <= kr.x + kr.w && y >= kr.y && y <= kr.y + kr.h) return midi;
    }
    // Then white keys
    for (const [midi, kr] of entries) {
      if (kr.isBlack) continue;
      if (x >= kr.x && x <= kr.x + kr.w && y >= kr.y && y <= kr.y + kr.h) return midi;
    }
    return null;
  }, []);

  const pianoPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = pianoCanvasRef.current;
    if (!canvas) return;
    const midi = getMidiFromCanvasPos(canvas, e.clientX, e.clientY);
    if (midi === null) return;
    initAudio();
    playNote(midi);
    checkHit(midi);
    pressedKeysRef.current = new Set(Array.from(pressedKeysRef.current).concat(midi));
    setPressedKeys(new Set(pressedKeysRef.current));
    canvas.setPointerCapture(e.pointerId);
  }, [getMidiFromCanvasPos, initAudio, playNote, checkHit]);

  const pianoPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = pianoCanvasRef.current;
    if (!canvas) return;
    const midi = getMidiFromCanvasPos(canvas, e.clientX, e.clientY);
    if (midi === null) {
      // Release all
      pressedKeysRef.current.forEach((m) => stopNote(m));
      pressedKeysRef.current = new Set();
      setPressedKeys(new Set());
      return;
    }
    stopNote(midi);
    pressedKeysRef.current = new Set(Array.from(pressedKeysRef.current).filter((m) => m !== midi));
    setPressedKeys(new Set(pressedKeysRef.current));
  }, [getMidiFromCanvasPos, stopNote]);

  // ─── Resize handler ───────────────────────────────────────────────────────────

  const resizeCanvases = useCallback(() => {
    const piano = pianoCanvasRef.current;
    const dft = dftCanvasRef.current;
    const highway = highwayCanvasRef.current;
    if (!piano || !dft || !highway) return;

    const dpr = window.devicePixelRatio || 1;

    // DFT canvas
    const dftRect = dft.getBoundingClientRect();
    dft.width = dftRect.width * dpr;
    dft.height = dftRect.height * dpr;
    const dftCtx = dft.getContext("2d");
    if (dftCtx) dftCtx.scale(dpr, dpr);

    // Highway canvas
    const hwRect = highway.getBoundingClientRect();
    highway.width = hwRect.width * dpr;
    highway.height = hwRect.height * dpr;
    const hwCtx = highway.getContext("2d");
    if (hwCtx) hwCtx.scale(dpr, dpr);

    // Piano canvas
    const pianoRect = piano.getBoundingClientRect();
    piano.width = pianoRect.width * dpr;
    piano.height = pianoRect.height * dpr;
    const pianoCtx = piano.getContext("2d");
    if (pianoCtx) pianoCtx.scale(dpr, dpr);

    // Recompute layout
    computePianoLayout(piano);
  }, [computePianoLayout]);

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  useEffect(() => {
    resizeCanvases();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    const ro = new ResizeObserver(resizeCanvases);
    if (pianoCanvasRef.current) ro.observe(pianoCanvasRef.current);
    if (dftCanvasRef.current) ro.observe(dftCanvasRef.current);
    if (highwayCanvasRef.current) ro.observe(highwayCanvasRef.current);

    rafDftRef.current = requestAnimationFrame(drawDFT);
    rafHighwayRef.current = requestAnimationFrame(drawHighway);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      ro.disconnect();
      cancelAnimationFrame(rafDftRef.current);
      cancelAnimationFrame(rafHighwayRef.current);
      audioCtxRef.current?.close();
    };
  }, [handleKeyDown, handleKeyUp, drawDFT, drawHighway, resizeCanvases]);

  // Redraw piano when pressed keys change
  useEffect(() => {
    const canvas = pianoCanvasRef.current;
    if (!canvas) return;
    drawPiano(canvas, pressedKeys);
  }, [pressedKeys, drawPiano]);

  // ─── Render ───────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex flex-col h-full"
      style={{ background: "#0a0f1e", color: "white", fontFamily: "'DM Sans', sans-serif" }}
    >
      {/* ── Header ── */}
      <div
        className="flex items-center justify-between px-6 py-3 flex-shrink-0"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.08)", background: "#0d1526" }}
      >
        <div>
          <h1
            className="text-lg font-bold"
            style={{ fontFamily: "'DM Sans', sans-serif", color: "white", letterSpacing: "-0.01em" }}
          >
            {t("pianoPracticeTitle")}
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>
            {t("pianoPracticeSubtitle")}
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          {/* Song selector */}
          <select
            value={selectedSong}
            onChange={(e) => setSelectedSong(Number(e.target.value))}
            disabled={gameState === "playing" || gameState === "countdown"}
            className="text-xs px-3 py-1.5 rounded"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: "1px solid rgba(255,255,255,0.15)",
              color: "white",
              fontFamily: "'IBM Plex Mono', monospace",
              cursor: "pointer",
            }}
          >
            {SONGS.map((s, i) => (
              <option key={i} value={i} style={{ background: "#1a2744" }}>{s.name}</option>
            ))}
          </select>

          {/* Start / Stop */}
          {gameState === "idle" || gameState === "finished" ? (
            <button
              onClick={startGame}
              className="px-4 py-1.5 rounded text-xs font-bold transition-all"
              style={{
                background: "#ec4899",
                color: "white",
                fontFamily: "'IBM Plex Mono', monospace",
                letterSpacing: "0.05em",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = "#db2777")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "#ec4899")}
            >
              {gameState === "finished" ? "PLAY AGAIN" : "START"}
            </button>
          ) : (
            <button
              onClick={stopGame}
              className="px-4 py-1.5 rounded text-xs font-bold transition-all"
              style={{
                background: "rgba(236,72,153,0.2)",
                border: "1px solid rgba(236,72,153,0.4)",
                color: "#ec4899",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              STOP
            </button>
          )}

          {/* Score display */}
          <div className="text-right" style={{ minWidth: 80 }}>
            <div className="text-xs" style={{ color: "#8a9bb0", fontFamily: "'IBM Plex Mono', monospace" }}>SCORE</div>
            <div className="text-lg font-bold" style={{ color: "#ec4899", fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1 }}>
              {score.toLocaleString()}
            </div>
          </div>

          {/* Combo */}
          {combo > 1 && (
            <div
              className="px-2 py-1 rounded text-xs font-bold"
              style={{
                background: "rgba(234,179,8,0.15)",
                border: "1px solid rgba(234,179,8,0.3)",
                color: "#eab308",
                fontFamily: "'IBM Plex Mono', monospace",
              }}
            >
              ×{combo}
            </div>
          )}
        </div>
      </div>

      {/* ── Main area: DFT + Highway side by side ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: DFT spectrum */}
        <div
          className="flex flex-col min-h-0"
          style={{ width: "28%", borderRight: "1px solid rgba(255,255,255,0.06)", flexShrink: 0, overflow: "hidden" }}
        >
          <div
            className="px-3 py-1.5 text-xs font-semibold flex-shrink-0"
            style={{
              color: "#00d4ff",
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: "0.08em",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(0,212,255,0.04)",
            }}
          >
            DFT SPECTRUM
          </div>
          <canvas
            ref={dftCanvasRef}
            className="w-full"
            style={{ display: "block", flex: "1 1 0", minHeight: 0 }}
          />

          {/* Stats panel below DFT */}
          <div
            className="flex-shrink-0 px-4 py-3 space-y-2"
            style={{ borderTop: "1px solid rgba(255,255,255,0.06)", background: "#0d1526" }}
          >
            <div className="flex justify-between text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              <span style={{ color: "#8a9bb0" }}>ACCURACY</span>
              <span style={{ color: accuracy >= 90 ? "#22c55e" : accuracy >= 70 ? "#eab308" : "#ef4444" }}>
                {accuracy}%
              </span>
            </div>
            <div className="flex justify-between text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              <span style={{ color: "#8a9bb0" }}>MAX COMBO</span>
              <span style={{ color: "#eab308" }}>×{maxCombo}</span>
            </div>
            <div className="flex justify-between text-xs" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
              <span style={{ color: "#8a9bb0" }}>SONG BPM</span>
              <span style={{ color: "#00d4ff" }}>{SONGS[selectedSong].bpm}</span>
            </div>
          </div>

          {/* Keyboard hint */}
          <div
            className="flex-shrink-0 px-3 py-2 text-xs"
            style={{
              borderTop: "1px solid rgba(255,255,255,0.06)",
              color: "rgba(138,155,176,0.6)",
              fontFamily: "'IBM Plex Mono', monospace",
              lineHeight: 1.6,
              fontSize: 10,
            }}
          >
            <div style={{ color: "rgba(236,72,153,0.7)", marginBottom: 4, fontWeight: "bold" }}>KEYBOARD MAP</div>
            <div>Z–M · Oct 3 (C3–B3)</div>
            <div>Q–U · Oct 4 (C4–B4)</div>
            <div>I–P · Oct 5 (C5–B5)</div>
            <div style={{ marginTop: 4 }}>SPACE · Sustain pedal</div>
          </div>
        </div>

        {/* Right: Note highway */}
        <div className="flex flex-col flex-1 min-w-0">
          <div
            className="px-3 py-1.5 text-xs font-semibold flex-shrink-0"
            style={{
              color: "#ec4899",
              fontFamily: "'IBM Plex Mono', monospace",
              letterSpacing: "0.08em",
              borderBottom: "1px solid rgba(255,255,255,0.06)",
              background: "rgba(236,72,153,0.04)",
            }}
          >
            NOTE HIGHWAY — {SONGS[selectedSong].name.toUpperCase()}
          </div>
          <canvas
            ref={highwayCanvasRef}
            className="flex-1 w-full"
            style={{ display: "block" }}
          />
        </div>
      </div>

      {/* ── Piano keyboard ── */}
      <div
        className="flex-shrink-0"
        style={{
          height: 120,
          borderTop: "2px solid rgba(236,72,153,0.3)",
          background: "#0d1526",
        }}
      >
        <canvas
          ref={pianoCanvasRef}
          className="w-full h-full"
          style={{ display: "block", cursor: "pointer" }}
          onPointerDown={pianoPointerDown}
          onPointerUp={pianoPointerUp}
          onPointerLeave={pianoPointerUp}
        />
      </div>
    </div>
  );
}
