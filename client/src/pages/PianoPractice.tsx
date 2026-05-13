/*
 * PianoPractice.tsx — Bauhaus Frequency Design
 * Virtual piano keyboard + DFT spectrum rendered as highway background
 * Design: dark navy (#0a0f1e), accent pink (#ec4899), cyan (#00d4ff)
 * Highway: one lane per piano key (C3–B5), DFT bars drawn behind the notes
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLang } from "../contexts/LanguageContext";
import * as alphaTab from "@coderline/alphatab";
import { AbcImportModal } from "@/components/AbcImportModal";
import { type ParsedDuet } from "@/lib/abcParser";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTE_NAMES    = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const BLACK_SEMIS   = new Set([1,3,6,8,10]);
// Full 88-key concert grand: A0 (MIDI 21) – C8 (MIDI 108)
const KEYBOARD_START = 21;  // A0
const KEYBOARD_END   = 108; // C8
const TOTAL_KEYS     = KEYBOARD_END - KEYBOARD_START + 1; // 88
const isBlack    = (m: number) => BLACK_SEMIS.has(m % 12);
const ALL_MIDIS  = Array.from({ length: TOTAL_KEYS }, (_, i) => KEYBOARD_START + i);
const WHITE_MIDIS = ALL_MIDIS.filter(m => !isBlack(m));
const WHITE_COUNT = WHITE_MIDIS.length; // 52
const noteFreq  = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const noteLabel = (m: number) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
// QWERTY → MIDI (mapped to C3–B4 playable range, same as before)
const KEY_MAP: Record<string, number> = {
  z:48,s:49,x:50,d:51,c:52,v:53,g:54,b:55,h:56,n:57,j:58,m:59,
  q:60,"2":61,w:62,"3":63,e:64,r:65,"5":66,t:67,"6":68,y:69,"7":70,u:71,
  i:72,"9":73,o:74,"0":75,p:76,
};
// Reverse map: MIDI number → keyboard label (uppercase for display)
const MIDI_KEY_LABEL: Record<number, string> = {};
Object.entries(KEY_MAP).forEach(([k, m]) => { MIDI_KEY_LABEL[m] = k.toUpperCase(); });
const LANE_COLORS = [
  "#ec4899","#f97316","#eab308","#22c55e",
  "#00d4ff","#a855f7","#ec4899","#f97316",
  "#eab308","#22c55e","#00d4ff","#a855f7",
];
// DFT energy per MIDI key — filled each rAF frame, read by drawPiano
const dftKeyEnergy = new Float32Array(128); // index = midi number, value 0–1
// DFT peak-hold per MIDI key — decays slowly
const dftPeakHold  = new Float32Array(128);
const PEAK_DECAY   = 0.008; // per frame

// ─── Lead-in buffer ──────────────────────────────────────────────────────────
// After the countdown the highway scrolls empty for this many beats before
// the first note reaches the hit zone, giving the player time to get ready.
const LEAD_IN_OPTIONS = [2, 4, 8] as const;
type LeadInBeats = typeof LEAD_IN_OPTIONS[number];

// ─── alphaTex for each song (for the Sheet Music practice panel) ─────────────
const SONG_ALPHATEX: Record<number, string> = {
  0: `\\title "Ode to Joy" \\tempo 100
. :4 E5 E5 F5 G5 | G5 F5 E5 D5 | C5 C5 D5 E5 | E5.2 D5.4 D5.2`,
  1: `\\title "Twinkle Twinkle" \\tempo 110
. :4 C5 C5 G5 G5 | A5 A5 G5.2 | F5 F5 E5 E5 | D5 D5 C5.2`,
  2: `\\title "Happy Birthday" \\tempo 100
. :8 C5 C5 :4 D5 C5 F5 | E5.2 :8 C5 C5 :4 D5 C5 G5 | F5.2`,
  3: `\\title "C Major Scale" \\tempo 120
. :4 C5 D5 E5 F5 | G5 A5 B5 C6.2 | B5 A5 G5 F5 | E5 D5 C5.2`,
  4: `\\title "Fur Elise" \\tempo 90
. :8 E6 Eb6 E6 Eb6 E6 B5 D6 C6 | A5.4 r8 C4 E4 A4 :4 B4 | r8 E4 Ab4 B4 :4 C5`,
  5: `\\title "Canon in D" \\tempo 80
. :4 D5 A4 B4 Gb4 | G4 D4 G4 A4 | D5 A4 B4 Gb4 | G4 Gb4 E4 Gb4`,
  6: `\\title "Moonlight Sonata" \\tempo 60
. :8 Ab3 C4 Eb4 Ab3 C4 Eb4 | Ab3 C4 Eb4 Ab3 C4 Eb4 | G3 B3 Eb4 G3 B3 Eb4 | G3 B3 Eb4 G3 B3 Eb4`,
  7: `\\title "Jingle Bells" \\tempo 130
. :8 E5 E5 :4 E5 :8 E5 E5 :4 E5 | :8 E5 G5 C5 D5 :2 E5 | :8 F5 F5 F5 F5 :4 F5 :8 E5 E5 | :4 E5 E5 :8 D5 D5 :4 E5 D5 G5`,
};

// ─── Difficulty ───────────────────────────────────────────────────────────────

const DIFFICULTIES = {
  easy:   { label:"EASY",   hitWindow:0.9, speed:2.5 },
  normal: { label:"NORMAL", hitWindow:0.65, speed:3.5 },
  hard:   { label:"HARD",   hitWindow:0.35, speed:5 },
} as const;
type Difficulty = keyof typeof DIFFICULTIES;

// ─── Songs ────────────────────────────────────────────────────────────────────

interface SongNote { midi:number; beat:number; duration:number; }
interface Song     { name:string; bpm:number; notes:SongNote[]; }

const SONGS: Song[] = [
  { name:"Ode to Joy", bpm:100, notes:[
    {midi:64,beat:0,duration:1},{midi:64,beat:1,duration:1},
    {midi:65,beat:2,duration:1},{midi:67,beat:3,duration:1},
    {midi:67,beat:4,duration:1},{midi:65,beat:5,duration:1},
    {midi:64,beat:6,duration:1},{midi:62,beat:7,duration:1},
    {midi:60,beat:8,duration:1},{midi:60,beat:9,duration:1},
    {midi:62,beat:10,duration:1},{midi:64,beat:11,duration:1},
    {midi:64,beat:12,duration:1.5},{midi:62,beat:13.5,duration:0.5},{midi:62,beat:14,duration:2},
  ]},
  { name:"Twinkle Twinkle", bpm:110, notes:[
    {midi:60,beat:0,duration:1},{midi:60,beat:1,duration:1},
    {midi:67,beat:2,duration:1},{midi:67,beat:3,duration:1},
    {midi:69,beat:4,duration:1},{midi:69,beat:5,duration:1},{midi:67,beat:6,duration:2},
    {midi:65,beat:8,duration:1},{midi:65,beat:9,duration:1},
    {midi:64,beat:10,duration:1},{midi:64,beat:11,duration:1},
    {midi:62,beat:12,duration:1},{midi:62,beat:13,duration:1},{midi:60,beat:14,duration:2},
  ]},
  { name:"Happy Birthday", bpm:100, notes:[
    {midi:60,beat:0.5,duration:0.5},{midi:60,beat:1,duration:0.5},
    {midi:62,beat:1.5,duration:1},{midi:60,beat:2.5,duration:1},
    {midi:65,beat:3.5,duration:1},{midi:64,beat:4.5,duration:2},
    {midi:60,beat:6.5,duration:0.5},{midi:60,beat:7,duration:0.5},
    {midi:62,beat:7.5,duration:1},{midi:60,beat:8.5,duration:1},
    {midi:67,beat:9.5,duration:1},{midi:65,beat:10.5,duration:2},
  ]},
  { name:"C Major Scale", bpm:120, notes:[
    {midi:60,beat:0,duration:1},{midi:62,beat:1,duration:1},{midi:64,beat:2,duration:1},
    {midi:65,beat:3,duration:1},{midi:67,beat:4,duration:1},{midi:69,beat:5,duration:1},
    {midi:71,beat:6,duration:1},{midi:72,beat:7,duration:2},
    {midi:71,beat:9,duration:1},{midi:69,beat:10,duration:1},{midi:67,beat:11,duration:1},
    {midi:65,beat:12,duration:1},{midi:64,beat:13,duration:1},{midi:62,beat:14,duration:1},
    {midi:60,beat:15,duration:2},
  ]},
  { name:"Für Elise", bpm:90, notes:[
    {midi:76,beat:0,duration:0.5},{midi:75,beat:0.5,duration:0.5},
    {midi:76,beat:1,duration:0.5},{midi:75,beat:1.5,duration:0.5},
    {midi:76,beat:2,duration:0.5},{midi:71,beat:2.5,duration:0.5},
    {midi:74,beat:3,duration:0.5},{midi:72,beat:3.5,duration:0.5},{midi:69,beat:4,duration:1},
    {midi:60,beat:5,duration:0.5},{midi:64,beat:5.5,duration:0.5},
    {midi:69,beat:6,duration:1},{midi:71,beat:7,duration:1},
    {midi:64,beat:8,duration:0.5},{midi:68,beat:8.5,duration:0.5},
    {midi:71,beat:9,duration:1},{midi:72,beat:10,duration:1},
  ]},
  { name:"Canon in D (Theme)", bpm:80, notes:[
    {midi:62,beat:0,duration:1},{midi:69,beat:1,duration:1},
    {midi:67,beat:2,duration:1},{midi:64,beat:3,duration:1},
    {midi:66,beat:4,duration:1},{midi:64,beat:5,duration:1},
    {midi:62,beat:6,duration:1},{midi:64,beat:7,duration:1},
    {midi:66,beat:8,duration:0.5},{midi:67,beat:8.5,duration:0.5},
    {midi:66,beat:9,duration:0.5},{midi:64,beat:9.5,duration:0.5},
    {midi:62,beat:10,duration:0.5},{midi:64,beat:10.5,duration:0.5},
    {midi:66,beat:11,duration:0.5},{midi:67,beat:11.5,duration:0.5},
    {midi:69,beat:12,duration:2},
  ]},
  { name:"Moonlight Sonata", bpm:60, notes:[
    {midi:52,beat:0,duration:0.33},{midi:56,beat:0.33,duration:0.33},{midi:59,beat:0.67,duration:0.33},
    {midi:52,beat:1,duration:0.33},{midi:56,beat:1.33,duration:0.33},{midi:59,beat:1.67,duration:0.33},
    {midi:52,beat:2,duration:0.33},{midi:56,beat:2.33,duration:0.33},{midi:59,beat:2.67,duration:0.33},
    {midi:52,beat:3,duration:0.33},{midi:56,beat:3.33,duration:0.33},{midi:59,beat:3.67,duration:0.33},
    {midi:51,beat:4,duration:0.33},{midi:56,beat:4.33,duration:0.33},{midi:59,beat:4.67,duration:0.33},
    {midi:51,beat:5,duration:0.33},{midi:56,beat:5.33,duration:0.33},{midi:59,beat:5.67,duration:0.33},
    {midi:51,beat:6,duration:0.33},{midi:55,beat:6.33,duration:0.33},{midi:59,beat:6.67,duration:0.33},
    {midi:51,beat:7,duration:0.33},{midi:55,beat:7.33,duration:0.33},{midi:59,beat:7.67,duration:0.33},
  ]},
  { name:"Jingle Bells", bpm:130, notes:[
    {midi:64,beat:0,duration:0.5},{midi:64,beat:0.5,duration:0.5},{midi:64,beat:1,duration:1},
    {midi:64,beat:2,duration:0.5},{midi:64,beat:2.5,duration:0.5},{midi:64,beat:3,duration:1},
    {midi:64,beat:4,duration:0.5},{midi:67,beat:4.5,duration:0.5},{midi:60,beat:5,duration:0.5},
    {midi:62,beat:5.5,duration:0.5},{midi:64,beat:6,duration:2},
    {midi:65,beat:8,duration:0.5},{midi:65,beat:8.5,duration:0.5},{midi:65,beat:9,duration:0.5},{midi:65,beat:9.5,duration:0.5},
    {midi:65,beat:10,duration:0.5},{midi:64,beat:10.5,duration:0.5},{midi:64,beat:11,duration:0.5},{midi:64,beat:11.5,duration:0.5},
    {midi:64,beat:12,duration:0.5},{midi:62,beat:12.5,duration:0.5},{midi:62,beat:13,duration:0.5},
    {midi:64,beat:13.5,duration:0.5},{midi:62,beat:14,duration:1},{midi:67,beat:15,duration:1},
  ]},
];

// ─── Duet songs ─────────────────────────────────────────────────────────────
// Each duet song has two parts: `ai` (auto-played by the computer) and
// `user` (shown on the highway for the player to hit).
interface DuetSong {
  name: string;
  bpm: number;
  ai: SongNote[];   // AI plays these automatically
  user: SongNote[]; // User plays these on the highway
}
const DUET_SONGS: DuetSong[] = [
  { name:"Ode to Joy (Duet)", bpm:100,
    // AI: left-hand accompaniment (bass/chord)
    ai:[
      {midi:48,beat:0,duration:2},{midi:52,beat:0,duration:2},{midi:55,beat:0,duration:2},
      {midi:48,beat:2,duration:2},{midi:52,beat:2,duration:2},{midi:55,beat:2,duration:2},
      {midi:45,beat:4,duration:2},{midi:48,beat:4,duration:2},{midi:52,beat:4,duration:2},
      {midi:45,beat:6,duration:2},{midi:48,beat:6,duration:2},{midi:52,beat:6,duration:2},
      {midi:48,beat:8,duration:2},{midi:52,beat:8,duration:2},{midi:55,beat:8,duration:2},
      {midi:48,beat:10,duration:2},{midi:52,beat:10,duration:2},{midi:55,beat:10,duration:2},
      {midi:48,beat:12,duration:2},{midi:52,beat:12,duration:2},{midi:55,beat:12,duration:2},
      {midi:43,beat:14,duration:2},{midi:47,beat:14,duration:2},{midi:50,beat:14,duration:2},
    ],
    // User: right-hand melody
    user:[
      {midi:64,beat:0,duration:1},{midi:64,beat:1,duration:1},
      {midi:65,beat:2,duration:1},{midi:67,beat:3,duration:1},
      {midi:67,beat:4,duration:1},{midi:65,beat:5,duration:1},
      {midi:64,beat:6,duration:1},{midi:62,beat:7,duration:1},
      {midi:60,beat:8,duration:1},{midi:60,beat:9,duration:1},
      {midi:62,beat:10,duration:1},{midi:64,beat:11,duration:1},
      {midi:64,beat:12,duration:1.5},{midi:62,beat:13.5,duration:0.5},{midi:62,beat:14,duration:2},
    ],
  },
  { name:"Twinkle Twinkle (Duet)", bpm:110,
    ai:[
      {midi:48,beat:0,duration:2},{midi:52,beat:0,duration:2},
      {midi:55,beat:2,duration:2},{midi:52,beat:2,duration:2},
      {midi:57,beat:4,duration:2},{midi:52,beat:4,duration:2},
      {midi:55,beat:6,duration:2},{midi:52,beat:6,duration:2},
      {midi:53,beat:8,duration:2},{midi:50,beat:8,duration:2},
      {midi:52,beat:10,duration:2},{midi:48,beat:10,duration:2},
      {midi:50,beat:12,duration:2},{midi:47,beat:12,duration:2},
      {midi:48,beat:14,duration:2},{midi:45,beat:14,duration:2},
    ],
    user:[
      {midi:60,beat:0,duration:1},{midi:60,beat:1,duration:1},
      {midi:67,beat:2,duration:1},{midi:67,beat:3,duration:1},
      {midi:69,beat:4,duration:1},{midi:69,beat:5,duration:1},{midi:67,beat:6,duration:2},
      {midi:65,beat:8,duration:1},{midi:65,beat:9,duration:1},
      {midi:64,beat:10,duration:1},{midi:64,beat:11,duration:1},
      {midi:62,beat:12,duration:1},{midi:62,beat:13,duration:1},{midi:60,beat:14,duration:2},
    ],
  },
  { name:"Jingle Bells (Duet)", bpm:130,
    ai:[
      {midi:48,beat:0,duration:1},{midi:52,beat:0,duration:1},{midi:55,beat:0,duration:1},
      {midi:48,beat:1,duration:1},{midi:52,beat:1,duration:1},{midi:55,beat:1,duration:1},
      {midi:48,beat:2,duration:1},{midi:52,beat:2,duration:1},{midi:55,beat:2,duration:1},
      {midi:48,beat:3,duration:1},{midi:52,beat:3,duration:1},{midi:55,beat:3,duration:1},
      {midi:43,beat:4,duration:2},{midi:47,beat:4,duration:2},{midi:50,beat:4,duration:2},
      {midi:43,beat:6,duration:2},{midi:47,beat:6,duration:2},{midi:50,beat:6,duration:2},
      {midi:41,beat:8,duration:2},{midi:45,beat:8,duration:2},{midi:48,beat:8,duration:2},
      {midi:41,beat:10,duration:2},{midi:45,beat:10,duration:2},{midi:48,beat:10,duration:2},
      {midi:43,beat:12,duration:2},{midi:47,beat:12,duration:2},{midi:50,beat:12,duration:2},
      {midi:43,beat:14,duration:2},{midi:47,beat:14,duration:2},{midi:50,beat:14,duration:2},
    ],
    user:[
      {midi:64,beat:0,duration:0.5},{midi:64,beat:0.5,duration:0.5},{midi:64,beat:1,duration:1},
      {midi:64,beat:2,duration:0.5},{midi:64,beat:2.5,duration:0.5},{midi:64,beat:3,duration:1},
      {midi:64,beat:4,duration:0.5},{midi:67,beat:4.5,duration:0.5},{midi:60,beat:5,duration:0.5},
      {midi:62,beat:5.5,duration:0.5},{midi:64,beat:6,duration:2},
      {midi:65,beat:8,duration:0.5},{midi:65,beat:8.5,duration:0.5},{midi:65,beat:9,duration:0.5},{midi:65,beat:9.5,duration:0.5},
      {midi:65,beat:10,duration:0.5},{midi:64,beat:10.5,duration:0.5},{midi:64,beat:11,duration:0.5},{midi:64,beat:11.5,duration:0.5},
      {midi:64,beat:12,duration:0.5},{midi:62,beat:12.5,duration:0.5},{midi:62,beat:13,duration:0.5},
      {midi:64,beat:13.5,duration:0.5},{midi:62,beat:14,duration:1},{midi:67,beat:15,duration:1},
    ],
  },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type GameState = "idle"|"countdown"|"playing"|"finished";

interface FallingNote {
  id:number; midi:number; beatStart:number; beatDuration:number;
  hit:boolean; missed:boolean; hitTime?:number;
}

interface KeyRect { x:number; y:number; w:number; h:number; isBlack:boolean; }

// ─── Piano layout ─────────────────────────────────────────────────────
// Build layout for a given MIDI range (viewStart–viewEnd)
function buildPianoLayout(W:number, H:number, vStart=KEYBOARD_START, vEnd=KEYBOARD_END): Map<number,KeyRect> {
  const visibleMidis = Array.from({length:vEnd-vStart+1},(_,i)=>vStart+i);
  const visibleWhites = visibleMidis.filter(m=>!isBlack(m));
  const wCount = visibleWhites.length || 1;
  const whiteW = W / wCount;
  const blackW = whiteW * 0.58;
  const blackH = H * 0.62;
  const rects  = new Map<number,KeyRect>();
  let wi = 0;
  for (const m of visibleMidis) {
    if (!isBlack(m)) { rects.set(m,{x:wi*whiteW,y:0,w:whiteW,h:H,isBlack:false}); wi++; }
  }
  for (const m of visibleMidis) {
    if (isBlack(m)) {
      const left = rects.get(m-1);
      if (left) rects.set(m,{x:left.x+left.w-blackW/2,y:0,w:blackW,h:blackH,isBlack:true});
    }
  }
  return rects;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function PianoPractice() {
  const { t } = useLang();

  // Audio
  const ctxRef      = useRef<AudioContext|null>(null);
  const analyserRef = useRef<AnalyserNode|null>(null);
  const masterRef   = useRef<GainNode|null>(null);
  const activeRef   = useRef<Map<number,{osc:OscillatorNode;gain:GainNode}>>(new Map());
  const sustainRef  = useRef(false);
  const sustainedRef= useRef<Set<number>>(new Set());
  const [audioReady,setAudioReady] = useState(false);

  // Canvases — only two now: highway (with DFT background) + piano
  const hwRef    = useRef<HTMLCanvasElement>(null);
  const pianoRef = useRef<HTMLCanvasElement>(null);
  const rafHw    = useRef(0);

  // Piano layout
  const layoutRef = useRef<Map<number,KeyRect>>(new Map());

  // Game state
  const [gameState,   setGameState]   = useState<GameState>("idle");
  const [songIdx,     setSongIdx]     = useState(0);
  const [difficulty,  setDifficulty]  = useState<Difficulty>("normal");
  const [score,       setScore]       = useState(0);
  const [combo,       setCombo]       = useState(0);
  const [maxCombo,    setMaxCombo]    = useState(0);
  const [accuracy,    setAccuracy]    = useState(100);
  const [countdown,   setCountdown]   = useState(3);
  const [midiConn,    setMidiConn]    = useState(false);
  const [pressedKeys, setPressedKeys] = useState<Set<number>>(new Set());
  const [tempoScale,  setTempoScale]  = useState(100); // 50–100%
  const tempoScaleRef = useRef(1.0);  // mutable copy for rAF closure
  // Viewport zoom: which MIDI range is visible (default: full 88 keys)
  const [viewStart, setViewStart] = useState(KEYBOARD_START); // A0
  const [viewEnd,   setViewEnd]   = useState(KEYBOARD_END);   // C8
  const viewStartRef = useRef(KEYBOARD_START);
  const viewEndRef   = useRef(KEYBOARD_END);
  const [leadIn,      setLeadIn]      = useState<LeadInBeats>(4);
  // Duet mode
  const [isDuet,      setIsDuet]      = useState(false);
  const [duetIdx,     setDuetIdx]     = useState(0);
  const isDuetRef     = useRef(false);
  const duetIdxRef    = useRef(0);
  const aiTimersRef   = useRef<ReturnType<typeof setTimeout>[]>([]);
  // ABC import modal & custom duets
  const [showAbcModal, setShowAbcModal] = useState(false);
  const [customDuets,  setCustomDuets]  = useState<DuetSong[]>([]);
  const allDuetSongs = [...DUET_SONGS, ...customDuets];

  function handleAbcImport(parsed: ParsedDuet) {
    const newDuet: DuetSong = {
      name: parsed.name,
      bpm:  parsed.bpm,
      ai:   parsed.voice2,
      user: parsed.voice1,
    };
    setCustomDuets(prev => {
      const updated = [...prev, newDuet];
      const newIdx = DUET_SONGS.length + updated.length - 1;
      setDuetIdx(newIdx);
      duetIdxRef.current = newIdx;
      return updated;
    });
  }

  // Score panel is always visible — no toggle needed
  const [sheetReady,  setSheetReady]  = useState(false);
  const leadInRef2    = useRef<LeadInBeats>(4);
  const sheetContRef  = useRef<HTMLDivElement>(null);
  const atApiRef      = useRef<alphaTab.AlphaTabApi|null>(null);
  const sheetModeRef  = useRef(true); // always on

  // Mutable refs
  const gsRef        = useRef<GameState>("idle");
  const fallingRef   = useRef<FallingNote[]>([]);
  const scoreRef     = useRef(0);
  const comboRef     = useRef(0);
  const maxComboRef  = useRef(0);
  const hitsRef      = useRef(0);
  const totalRef     = useRef(0);
  const pressedRef   = useRef<Set<number>>(new Set());
  const startTimeRef   = useRef(0);
  const leadInRef       = useRef<number>(4); // beats of lead-in remaining (mutable)
  const songRef      = useRef<Song>(SONGS[0]);
  const diffRef      = useRef<Difficulty>("normal");
  const noteIdRef    = useRef(0);
  const cdRef        = useRef(3);

  // ── Audio ─────────────────────────────────────────────────────────────────

  const initAudio = useCallback(()=>{
    if (ctxRef.current) return;
    const ctx = new (window.AudioContext||(window as unknown as{webkitAudioContext:typeof AudioContext}).webkitAudioContext)();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048; analyser.smoothingTimeConstant = 0.85;
    const master = ctx.createGain(); master.gain.value = 0.35;
    master.connect(analyser); analyser.connect(ctx.destination);
    ctxRef.current=ctx; analyserRef.current=analyser; masterRef.current=master;
    setAudioReady(true);
  },[]);

  const playNote = useCallback((midi:number)=>{
    if (!ctxRef.current||!masterRef.current) return;
    if (activeRef.current.has(midi)) return;
    const ctx=ctxRef.current, freq=noteFreq(midi);
    const osc=ctx.createOscillator(), gain=ctx.createGain();
    osc.type="triangle"; osc.frequency.value=freq;
    const now=ctx.currentTime;
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(0.7,now+0.01);
    gain.gain.exponentialRampToValueAtTime(0.4,now+0.1);
    osc.connect(gain); gain.connect(masterRef.current); osc.start(now);
    activeRef.current.set(midi,{osc,gain});
  },[]);

  const stopNote = useCallback((midi:number)=>{
    if (sustainRef.current){sustainedRef.current.add(midi);return;}
    const note=activeRef.current.get(midi);
    if (!note||!ctxRef.current) return;
    const now=ctxRef.current.currentTime;
    note.gain.gain.cancelScheduledValues(now);
    note.gain.gain.setValueAtTime(note.gain.gain.value,now);
    note.gain.gain.exponentialRampToValueAtTime(0.001,now+0.3);
    note.osc.stop(now+0.3); activeRef.current.delete(midi);
  },[]);

  // ── Piano draw ────────────────────────────────────────────────────────────

  const drawPiano = useCallback((pressed:Set<number>)=>{
    const canvas=pianoRef.current; if (!canvas) return;
    const ctx=canvas.getContext("2d"); if (!ctx) return;
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);
    const layout=layoutRef.current;
    // White keys
    layout.forEach((r,midi)=>{
      if (r.isBlack) return;
      const on=pressed.has(midi), col=LANE_COLORS[midi%12];
      const energy=dftKeyEnergy[midi]||0;
      const g=ctx.createLinearGradient(r.x,0,r.x,r.h);
      if (on){g.addColorStop(0,col+"cc");g.addColorStop(1,col+"55");}
      else   {g.addColorStop(0,"#f8f6f2");g.addColorStop(1,"#e0dcd6");}
      ctx.fillStyle=g;
      ctx.beginPath();ctx.roundRect(r.x+1,0,r.w-2,r.h-2,[0,0,4,4]);ctx.fill();
      // DFT energy glow — rises from bottom of key
      if (energy>0.02 && !on){
        const glowH=r.h*energy*0.85;
        const eg=ctx.createLinearGradient(r.x,r.h,r.x,r.h-glowH);
        eg.addColorStop(0,col+"99"); eg.addColorStop(1,col+"00");
        ctx.fillStyle=eg;
        ctx.beginPath();ctx.roundRect(r.x+1,r.h-glowH,r.w-2,glowH,[0,0,4,4]);ctx.fill();
      }
      ctx.strokeStyle=on?col:"rgba(0,0,0,0.15)"; ctx.lineWidth=on?1.5:1;
      ctx.beginPath();ctx.roundRect(r.x+1,0,r.w-2,r.h-2,[0,0,4,4]);ctx.stroke();
      if (r.w>16){
        // Note name label
        ctx.fillStyle=on?"white":"rgba(0,0,0,0.3)";
        ctx.font=`bold ${Math.min(10,r.w*0.32)}px 'IBM Plex Mono',monospace`;
        ctx.textAlign="center"; ctx.fillText(noteLabel(midi),r.x+r.w/2,r.h-5);
        // QWERTY key label
        const kl=MIDI_KEY_LABEL[midi];
        if (kl && r.w>18){
          const fontSize=Math.min(9,r.w*0.28);
          ctx.font=`${fontSize}px 'IBM Plex Mono',monospace`;
          ctx.fillStyle=on?"rgba(255,255,255,0.9)":"rgba(0,0,0,0.45)";
          // Draw a small rounded badge
          const bw=r.w*0.55, bh=fontSize+3, bx=r.x+r.w/2-bw/2, by=r.h-22;
          ctx.fillStyle=on?"rgba(0,0,0,0.3)":"rgba(0,0,0,0.08)";
          ctx.beginPath(); ctx.roundRect(bx,by,bw,bh,[2]); ctx.fill();
          ctx.fillStyle=on?"rgba(255,255,255,0.95)":"rgba(0,0,0,0.5)";
          ctx.textAlign="center"; ctx.fillText(kl,r.x+r.w/2,by+bh-2);
        }
      }
    });
    // Black keys
    layout.forEach((r,midi)=>{
      if (!r.isBlack) return;
      const on=pressed.has(midi), col=LANE_COLORS[midi%12];
      const energy=dftKeyEnergy[midi]||0;
      const g=ctx.createLinearGradient(r.x,0,r.x,r.h);
      if (on){g.addColorStop(0,col);g.addColorStop(1,col+"88");}
      else   {g.addColorStop(0,"#1a1a2e");g.addColorStop(1,"#0a0a18");}
      ctx.fillStyle=g;
      ctx.beginPath();ctx.roundRect(r.x,0,r.w,r.h,[0,0,3,3]);ctx.fill();
      // DFT energy glow on black key — glows from bottom
      if (energy>0.02 && !on){
        const glowH=r.h*energy*0.9;
        const eg=ctx.createLinearGradient(r.x,r.h,r.x,r.h-glowH);
        eg.addColorStop(0,col+"cc"); eg.addColorStop(1,col+"00");
        ctx.fillStyle=eg;
        ctx.beginPath();ctx.roundRect(r.x,r.h-glowH,r.w,glowH,[0,0,3,3]);ctx.fill();
      }
      if (on){
        ctx.strokeStyle=col;ctx.lineWidth=1.5;
        ctx.beginPath();ctx.roundRect(r.x,0,r.w,r.h,[0,0,3,3]);ctx.stroke();
      }
      // QWERTY label on black key
      const kl=MIDI_KEY_LABEL[midi];
      if (kl && r.w>10){
        const fontSize=Math.min(7,r.w*0.45);
        ctx.font=`${fontSize}px 'IBM Plex Mono',monospace`;
        ctx.fillStyle=on?"rgba(255,255,255,0.95)":"rgba(255,255,255,0.35)";
        ctx.textAlign="center";
        ctx.fillText(kl,r.x+r.w/2,r.h-4);
      }
    });
  },[]);

  // ── Highway + DFT background draw ────────────────────────────────────────
  // Layer order: 1) dark bg  2) DFT bars (per-lane, aligned to key x)
  //              3) lane dividers  4) notes  5) hit zone  6) HUD

  const drawHighway = useCallback(()=>{
    const canvas=hwRef.current;
    if (!canvas){rafHw.current=requestAnimationFrame(drawHighway);return;}
    const ctx=canvas.getContext("2d");
    if (!ctx){rafHw.current=requestAnimationFrame(drawHighway);return;}
    const W=canvas.width, H=canvas.height;
    ctx.clearRect(0,0,W,H);

    // 1. Background
      ctx.fillStyle="#0a0f1e"; ctx.fillRect(0,0,W,H);
    const layout=layoutRef.current;
    if (layout.size===0){rafHw.current=requestAnimationFrame(drawHighway);return;}
    // 1b. Octave highlight bands — alternating subtle tint every 12 semitones
    {
      let octBand=0;
      let prevX=0;
      let prevOct=-1;
      layout.forEach((r,midi)=>{
        if (r.isBlack) return;
        const oct=Math.floor(midi/12);
        if (prevOct!==-1 && oct!==prevOct){
          if (octBand%2===0) { ctx.fillStyle="rgba(255,255,255,0.018)"; ctx.fillRect(prevX,0,r.x-prevX,H); }
          octBand++; prevX=r.x;
        }
        if (prevOct===-1) prevX=r.x;
        prevOct=oct;
      });
      // fill last band
      if (octBand%2===0) { ctx.fillStyle="rgba(255,255,255,0.018)"; ctx.fillRect(prevX,0,W-prevX,H); }
    }
       // Notes rise from bottom → hit zone near top
    const HIT_Y=H*0.12;
    const TRAVEL=H-HIT_Y; // total travel distance (bottom to hit zone)
    // 2. DFT bars — rise from HIT_Y downward (toward the piano keyboard)
    //    Also populate dftKeyEnergy[] so drawPiano can glow each key
    dftKeyEnergy.fill(0);
    if (analyserRef.current && ctxRef.current) {
      const analyser=analyserRef.current;
      const bufLen=analyser.frequencyBinCount;
      const freqData=new Uint8Array(bufLen);
      analyser.getByteFrequencyData(freqData);
      const sr=ctxRef.current.sampleRate;
      layout.forEach((r, midi)=>{
        const freq=noteFreq(midi);
        const bin=Math.round(freq/(sr/2)*bufLen);
        let sum=0, cnt=0;
        for (let b=Math.max(0,bin-2); b<=Math.min(bufLen-1,bin+2); b++){
          sum+=freqData[b]; cnt++;
        }
        const v=(cnt>0?sum/cnt:0)/255;
        // Store energy for piano key glow
        if (midi>=0 && midi<128) dftKeyEnergy[midi]=v;
        if (v<0.01) return;
        const col=LANE_COLORS[midi%12];
        const x=r.x;
        const bW=r.w;
        const bH=v*TRAVEL*0.85;
        // Gradient bar from hit zone downward
        const g=ctx.createLinearGradient(x,HIT_Y,x,HIT_Y+bH);
        g.addColorStop(0,col+"88");
        g.addColorStop(0.6,col+"33");
        g.addColorStop(1,col+"00");
        ctx.fillStyle=g;
        ctx.fillRect(x,HIT_Y,bW,bH);
      });
      // Peak-hold: update and draw thin white lines
      layout.forEach((r,midi)=>{
        const v=dftKeyEnergy[midi]||0;
        if (v>dftPeakHold[midi]) dftPeakHold[midi]=v;
        else dftPeakHold[midi]=Math.max(0,dftPeakHold[midi]-PEAK_DECAY);
        const ph=dftPeakHold[midi];
        if (ph>0.04){
          const peakY=HIT_Y+ph*TRAVEL*0.85;
          ctx.strokeStyle="rgba(255,255,255,0.55)"; ctx.lineWidth=1;
          ctx.beginPath(); ctx.moveTo(r.x,peakY); ctx.lineTo(r.x+r.w,peakY); ctx.stroke();
        }
      });
    }
    // 3. Lane dividers (white key boundaries)
    ctx.strokeStyle="rgba(255,255,255,0.05)"; ctx.lineWidth=1;
    layout.forEach((r,midi)=>{
      if (r.isBlack) return;
      if (midi>KEYBOARD_START){
        ctx.beginPath();ctx.moveTo(r.x,0);ctx.lineTo(r.x,H);ctx.stroke();
      }
    });

    // 4a. Oscilloscope waveform drawn along the hit-zone line
    if (analyserRef.current) {
      const analyser=analyserRef.current;
      const bufLen=analyser.fftSize;
      const timeData=new Uint8Array(bufLen);
      analyser.getByteTimeDomainData(timeData);
      ctx.save();
      ctx.beginPath();
      const sliceW=W/bufLen;
      let x0=0;
      for (let i=0;i<bufLen;i++){
        const v=(timeData[i]/128.0)-1; // -1..1
        const y=HIT_Y+v*18; // ±18px around hit line
        if (i===0) ctx.moveTo(x0,y); else ctx.lineTo(x0,y);
        x0+=sliceW;
      }
      ctx.strokeStyle="rgba(0,212,255,0.55)";
      ctx.lineWidth=1.5;
      ctx.shadowColor="#00d4ff";
      ctx.shadowBlur=6;
      ctx.stroke();
      ctx.shadowBlur=0;
      ctx.restore();
    }
    // 4b. Hit zone glow line (near top)
    const hg=ctx.createLinearGradient(0,HIT_Y-3,0,HIT_Y+3);
    hg.addColorStop(0,"rgba(236,72,153,0)");
    hg.addColorStop(0.5,"rgba(236,72,153,0.9)");
    hg.addColorStop(1,"rgba(236,72,153,0)");
    ctx.fillStyle=hg; ctx.fillRect(0,HIT_Y-3,W,6);
    // Hit zone circles — animated longitudinal wave rippling across lanes
    const waveT=performance.now()/1000; // seconds
    const laneKeys=Array.from(layout.keys()); // sorted midi numbers
    laneKeys.forEach((midi,laneIdx)=>{
      const r=layout.get(midi)!;
      const col=LANE_COLORS[midi%12];
      const cx=r.x+r.w/2, rad=r.w*(r.isBlack?0.35:0.38);
      const on=pressedRef.current.has(midi);
      // Longitudinal wave: each lane's circle bobs vertically
      // amplitude 7px idle, 3px when pressed; wave travels left→right
      const amp=on?3:7;
      const waveFreq=0.9;   // cycles per second
      const waveLen=0.18;   // fraction of total lanes per cycle (spatial frequency)
      const phase=laneIdx*waveLen*Math.PI*2 - waveT*waveFreq*Math.PI*2;
      const dy=amp*Math.sin(phase);
      const cy=HIT_Y+dy;
      // Glow ring grows with wave peak
      const glowR=rad+(Math.abs(dy)/amp)*4;
      if (!on){
        ctx.save();
        ctx.shadowColor=col; ctx.shadowBlur=6+Math.abs(dy)*1.2;
        ctx.beginPath();ctx.arc(cx,cy,glowR,0,Math.PI*2);
        ctx.strokeStyle=`${col}44`; ctx.lineWidth=1; ctx.stroke();
        ctx.restore();
      }
      ctx.beginPath();ctx.arc(cx,cy,rad,0,Math.PI*2);
      ctx.fillStyle=on?col:`${col}28`; ctx.fill();
      ctx.strokeStyle=on?col:`${col}66`; ctx.lineWidth=on?2:1;
      if (on){ctx.shadowColor=col;ctx.shadowBlur=14;}
      ctx.stroke(); ctx.shadowBlur=0;
      if (!r.isBlack&&r.w>14){
        ctx.fillStyle=on?"white":`${col}80`;
        ctx.font=`bold ${Math.min(9,r.w*0.28)}px 'IBM Plex Mono',monospace`;
        ctx.textAlign="center"; ctx.fillText(noteLabel(midi),cx,cy-rad-2);
      }
    });

    const gs=gsRef.current;

    if (gs==="idle"){
      ctx.fillStyle="rgba(255,255,255,0.6)";
      ctx.font="bold 16px 'DM Sans',sans-serif"; ctx.textAlign="center";
      ctx.fillText("Select a song and press START",W/2,H/2);
      // DFT label
      ctx.fillStyle="rgba(0,212,255,0.35)";
      ctx.font="10px 'IBM Plex Mono',monospace"; ctx.textAlign="left";
      ctx.fillText("DFT  0–4 kHz",8,14);
      rafHw.current=requestAnimationFrame(drawHighway); return;
    }

    if (gs==="countdown"){
      ctx.fillStyle="#ec4899";
      ctx.font="bold 72px 'DM Sans',sans-serif"; ctx.textAlign="center";
      ctx.fillText(String(cdRef.current),W/2,H/2+24);
      rafHw.current=requestAnimationFrame(drawHighway); return;
    }

    if (gs==="finished"){
      ctx.fillStyle="rgba(0,0,0,0.65)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#ec4899";
      ctx.font="bold 28px 'DM Sans',sans-serif"; ctx.textAlign="center";
      ctx.fillText("FINISHED!",W/2,H/2-28);
      ctx.fillStyle="white"; ctx.font="16px 'IBM Plex Mono',monospace";
      ctx.fillText(`Score: ${scoreRef.current}`,W/2,H/2+8);
      ctx.fillText(`Max Combo: ×${maxComboRef.current}`,W/2,H/2+30);
      rafHw.current=requestAnimationFrame(drawHighway); return;
    }

    // ── Playing ──
    const now=performance.now();
    const elapsed=(now-startTimeRef.current)/1000;
    const bps=(songRef.current.bpm/60)*tempoScaleRef.current;
    // beat is offset by leadIn so notes start arriving after the buffer
    const beat=elapsed*bps - leadInRef.current;

    // alphaTab plays independently once started — no manual tick sync needed
    // (alphaTab's own player clock stays in sync with the soundfont playback)
    const diff=DIFFICULTIES[diffRef.current];
    const visBeats=diff.speed;

    // ── Lead-in overlay ──
    const leadInProgress = Math.max(0, Math.min(1, (leadInRef.current + beat) / leadInRef.current));
    if (leadInProgress < 1) {
      // Shrinking progress bar across the bottom (notes rise from bottom)
      const barH = 6;
      ctx.fillStyle = "rgba(0,0,0,0.35)";
      ctx.fillRect(0, H - barH, W, barH);
      const g2 = ctx.createLinearGradient(0, 0, W, 0);
      g2.addColorStop(0, "#00d4ff"); g2.addColorStop(1, "#ec4899");
      ctx.fillStyle = g2;
      ctx.fillRect(0, H - barH, W * leadInProgress, barH);
      // "GET READY" text
      const alpha = leadInProgress < 0.85 ? 1 : (1 - leadInProgress) / 0.15;
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "white";
      ctx.font = "bold 22px 'DM Sans',sans-serif"; ctx.textAlign = "center";
      ctx.fillText("GET READY", W / 2, H / 2 - 12);
      ctx.font = "12px 'IBM Plex Mono',monospace";
      ctx.fillStyle = "rgba(0,212,255,0.9)";
      const beatsLeft = Math.ceil(Math.max(0, -beat)); // eslint-disable-line
      ctx.fillText(beatsLeft > 0 ? `${beatsLeft} beat${beatsLeft > 1 ? "s" : ""} to first note` : "Here it comes!", W / 2, H / 2 + 12);
      ctx.globalAlpha = 1;
    }

    // Spawn notes
    for (const sn of songRef.current.notes){
      const already=fallingRef.current.some(fn=>fn.beatStart===sn.beat&&fn.midi===sn.midi);
      if (!already&&sn.beat>=beat-0.5&&sn.beat<=beat+visBeats+1){
        fallingRef.current.push({id:noteIdRef.current++,midi:sn.midi,beatStart:sn.beat,beatDuration:sn.duration,hit:false,missed:false});
      }
    }

    // Mark missed
    for (const fn of fallingRef.current){
      if (!fn.hit&&!fn.missed&&fn.beatStart+fn.beatDuration<beat-0.5){
        fn.missed=true; comboRef.current=0; setCombo(0);
      }
    }

    // Draw notes
    for (const fn of fallingRef.current){
      const r=layout.get(fn.midi); if (!r) continue;
      const col=LANE_COLORS[fn.midi%12];
      const x=r.x, w=r.w;
      const beatsFromNow=fn.beatStart-beat;
      // Notes rise from bottom: at beatsFromNow=0 → HIT_Y (top), at beatsFromNow=visBeats → H (bottom)
      const yTop=HIT_Y+(beatsFromNow/visBeats)*TRAVEL;
      const noteH=Math.max((fn.beatDuration/visBeats)*TRAVEL,10);

      if (fn.missed){
        ctx.fillStyle="rgba(80,80,100,0.35)";
        ctx.beginPath();ctx.roundRect(x+1,yTop,w-2,noteH,3);ctx.fill();
        continue;
      }
      if (fn.hit){
        const age=fn.hitTime?(now-fn.hitTime)/250:1;
        if (age<1){
          ctx.fillStyle=`${col}${Math.round((1-age)*200).toString(16).padStart(2,"0")}`;
          ctx.beginPath();ctx.roundRect(x+1,HIT_Y-8,w-2,16,3);ctx.fill();
        }
        continue;
      }

      // Note trail glow — fading streak above the note (in the direction of travel = upward)
      const trailH=Math.min(noteH*1.2,40);
      const tg=ctx.createLinearGradient(x,yTop-trailH,x,yTop);
      tg.addColorStop(0,`${col}00`); tg.addColorStop(1,`${col}44`);
      ctx.fillStyle=tg;
      ctx.fillRect(x+1,yTop-trailH,w-2,trailH);
      // Note block
      const ng=ctx.createLinearGradient(x,yTop,x,yTop+noteH);
      ng.addColorStop(0,`${col}ee`); ng.addColorStop(1,`${col}77`);
      ctx.fillStyle=ng; ctx.shadowColor=col; ctx.shadowBlur=10;
      ctx.beginPath();ctx.roundRect(x+1,yTop,w-2,noteH,4);ctx.fill();
      ctx.strokeStyle=col; ctx.lineWidth=1.5;
      ctx.beginPath();ctx.roundRect(x+1,yTop,w-2,noteH,4);ctx.stroke();
      ctx.shadowBlur=0;
    }

    // DFT label
    ctx.fillStyle="rgba(0,212,255,0.45)";
    ctx.font="bold 9px 'IBM Plex Mono',monospace"; ctx.textAlign="left";
    ctx.fillText("DFT  0–4 kHz",8,14);

    // HUD
    ctx.fillStyle="rgba(236,72,153,0.9)";
    ctx.font="bold 13px 'IBM Plex Mono',monospace"; ctx.textAlign="left";
    ctx.fillText(`${scoreRef.current}`,10,32);
    if (comboRef.current>1){
      ctx.fillStyle="#eab308"; ctx.font="bold 11px 'IBM Plex Mono',monospace";
      ctx.fillText(`×${comboRef.current} COMBO`,10,48);
    }

    // End check
    const lastBeat=Math.max(...songRef.current.notes.map(n=>n.beat+n.duration));
    if (beat>lastBeat+2){
      gsRef.current="finished"; setGameState("finished");
      setScore(scoreRef.current); setMaxCombo(maxComboRef.current);
      setAccuracy(totalRef.current>0?Math.round(hitsRef.current/totalRef.current*100):100);
    }

     // Redraw piano every frame so DFT energy glow animates continuously
    drawPiano(pressedRef.current);
    rafHw.current=requestAnimationFrame(drawHighway);
  },[drawPiano]);
  // ── Hit detection ─────────────────────────────────────────────────────────

  const checkHit=useCallback((midi:number)=>{
    if (gsRef.current!=="playing") return;
    const bps=songRef.current.bpm/60;
    const beat=((performance.now()-startTimeRef.current)/1000)*bps - leadInRef.current;
    const win=DIFFICULTIES[diffRef.current].hitWindow;
    for (const fn of fallingRef.current){
      if (fn.midi!==midi||fn.hit||fn.missed) continue;
      const d=Math.abs(fn.beatStart-beat);
      if (d<=win){
        fn.hit=true; fn.hitTime=performance.now(); hitsRef.current++;
        const pts=d<win*0.25?100:d<win*0.6?80:60; // forgiving: min 60pts
        comboRef.current++;
        if (comboRef.current>maxComboRef.current) maxComboRef.current=comboRef.current;
        scoreRef.current+=Math.round(pts*(1+comboRef.current*0.08)); // bigger combo bonus
        setScore(scoreRef.current); setCombo(comboRef.current); break;
      }
    }
  },[]);

  // ── Game controls ─────────────────────────────────────────────────────────

   const startGame=useCallback(()=>{
    initAudio();
    // Clear any previous AI timers
    aiTimersRef.current.forEach(t=>clearTimeout(t)); aiTimersRef.current=[];
    const duet=isDuetRef.current;
    const duetSong=allDuetSongs[duetIdxRef.current];
    const activeSong=duet?{name:duetSong.name,bpm:duetSong.bpm,notes:duetSong.user}:SONGS[songIdx];
    fallingRef.current=[]; scoreRef.current=0; comboRef.current=0; maxComboRef.current=0;
    hitsRef.current=0; totalRef.current=activeSong.notes.length;
    noteIdRef.current=0; songRef.current=activeSong; diffRef.current=difficulty;
    leadInRef.current=leadInRef2.current;
    setScore(0); setCombo(0); setMaxCombo(0); setAccuracy(100);
    gsRef.current="countdown"; setGameState("countdown");
    cdRef.current=3; setCountdown(3);
    let c=3;
    const iv=setInterval(()=>{
      c--;
      if (c<=0){
        clearInterval(iv);
        startTimeRef.current=performance.now();
        gsRef.current="playing"; setGameState("playing");
        // Start alphaTab playback from the beginning in sync with the highway
        if (atApiRef.current) {
          try {
            atApiRef.current.tickPosition = 0;
            atApiRef.current.play();
          } catch { /* player may not be ready yet */ }
        }
        // Schedule AI notes for duet mode
        if (duet){
          const bps=duetSong.bpm/60;
          const leadInSec=leadInRef.current/bps;
          duetSong.ai.forEach(n=>{
            const delayMs=(n.beat/bps+leadInSec)*1000;
            const durationMs=(n.duration/bps)*1000;
            const t1=setTimeout(()=>{ playNote(n.midi); },delayMs);
            const t2=setTimeout(()=>{ stopNote(n.midi); },delayMs+durationMs);
            aiTimersRef.current.push(t1,t2);
          });
        }
      }
      else{cdRef.current=c;setCountdown(c);}
    },1000);
  },[songIdx,difficulty,initAudio,playNote,stopNote]);
  const stopGame=useCallback(()=>{
    gsRef.current="idle"; setGameState("idle"); fallingRef.current=[];
    aiTimersRef.current.forEach(t=>clearTimeout(t)); aiTimersRef.current=[];
    // Stop alphaTab playback
    if (atApiRef.current) { try { atApiRef.current.stop(); } catch {} }
  },[]);

  // ── Keyboard input ────────────────────────────────────────────────────────

  const pressKey=useCallback((midi:number)=>{
    if (!ctxRef.current) initAudio();
    playNote(midi); checkHit(midi);
    pressedRef.current=new Set(Array.from(pressedRef.current).concat(midi));
    setPressedKeys(new Set(pressedRef.current));
    // Immediately redraw piano so key lights up without waiting for React state cycle
    drawPiano(pressedRef.current);
  },[initAudio,playNote,checkHit,drawPiano]);
  const releaseKey=useCallback((midi:number)=>{
    stopNote(midi);
    pressedRef.current=new Set(Array.from(pressedRef.current).filter(m=>m!==midi));
    setPressedKeys(new Set(pressedRef.current));
    // Immediately redraw piano so key un-lights without waiting for React state cycle
    drawPiano(pressedRef.current);
  },[stopNote,drawPiano]);;

  const onKeyDown=useCallback((e:KeyboardEvent)=>{
    if (e.repeat) return;
    if (e.key===" "){e.preventDefault();sustainRef.current=true;return;}
    const midi=KEY_MAP[e.key.toLowerCase()];
    if (midi!==undefined) pressKey(midi);
  },[pressKey]);

  const onKeyUp=useCallback((e:KeyboardEvent)=>{
    if (e.key===" "){
      sustainRef.current=false;
      sustainedRef.current.forEach(m=>stopNote(m));
      sustainedRef.current.clear(); return;
    }
    const midi=KEY_MAP[e.key.toLowerCase()];
    if (midi!==undefined) releaseKey(midi);
  },[releaseKey,stopNote]);

  // ── Piano mouse/touch ─────────────────────────────────────────────────────

  const midiFromPos=useCallback((cx:number,cy:number):number|null=>{
    const canvas=pianoRef.current; if (!canvas) return null;
    const rect=canvas.getBoundingClientRect();
    const x=(cx-rect.left)*(canvas.width/rect.width);
    const y=(cy-rect.top)*(canvas.height/rect.height);
    const layout=layoutRef.current;
    for (const [midi,r] of Array.from(layout.entries())){
      if (!r.isBlack) continue;
      if (x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) return midi;
    }
    for (const [midi,r] of Array.from(layout.entries())){
      if (r.isBlack) continue;
      if (x>=r.x&&x<=r.x+r.w&&y>=r.y&&y<=r.y+r.h) return midi;
    }
    return null;
  },[]);

  const onPointerDown=useCallback((e:React.PointerEvent<HTMLCanvasElement>)=>{
    const midi=midiFromPos(e.clientX,e.clientY); if (midi===null) return;
    pressKey(midi); (e.currentTarget as HTMLCanvasElement).setPointerCapture(e.pointerId);
  },[midiFromPos,pressKey]);

  const onPointerUp=useCallback((e:React.PointerEvent<HTMLCanvasElement>)=>{
    const midi=midiFromPos(e.clientX,e.clientY);
    if (midi===null){pressedRef.current.forEach(m=>stopNote(m));pressedRef.current=new Set();setPressedKeys(new Set());return;}
    releaseKey(midi);
  },[midiFromPos,releaseKey,stopNote]);

  // ── MIDI input ────────────────────────────────────────────────────────────

  useEffect(()=>{
    if (!navigator.requestMIDIAccess) return;
    navigator.requestMIDIAccess().then(access=>{
      setMidiConn(access.inputs.size>0);
      const handleMsg=(e:MIDIMessageEvent)=>{
        if (!e.data) return;
        const [status,note]=e.data, cmd=status&0xf0;
        if (note<KEYBOARD_START||note>KEYBOARD_END) return;
        if (cmd===0x90&&e.data[2]>0) pressKey(note);
        else if (cmd===0x80||(cmd===0x90&&e.data[2]===0)) releaseKey(note);
      };
      access.inputs.forEach(input=>{input.onmidimessage=handleMsg;});
      access.onstatechange=()=>{
        setMidiConn(access.inputs.size>0);
        access.inputs.forEach(input=>{input.onmidimessage=handleMsg;});
      };
    }).catch(()=>{});
  },[pressKey,releaseKey]);

  // ── Resize ────────────────────────────────────────────────────────────────

  const resize=useCallback(()=>{
    const dpr=window.devicePixelRatio||1;
    const setSize=(canvas:HTMLCanvasElement|null)=>{
      if (!canvas) return;
      const r=canvas.getBoundingClientRect();
      canvas.width=r.width*dpr; canvas.height=r.height*dpr;
      const c=canvas.getContext("2d"); if (c) c.scale(dpr,dpr);
    };
    setSize(hwRef.current); setSize(pianoRef.current);
    const p=pianoRef.current;
    if (p) layoutRef.current=buildPianoLayout(p.width/(window.devicePixelRatio||1),p.height/(window.devicePixelRatio||1),viewStartRef.current,viewEndRef.current);
  },[]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  useEffect(()=>{
    resize();
    window.addEventListener("keydown",onKeyDown);
    window.addEventListener("keyup",onKeyUp);
    const ro=new ResizeObserver(resize);
    [hwRef,pianoRef].forEach(r=>{if (r.current) ro.observe(r.current);});
    rafHw.current=requestAnimationFrame(drawHighway);
    return ()=>{
      window.removeEventListener("keydown",onKeyDown);
      window.removeEventListener("keyup",onKeyUp);
      ro.disconnect(); cancelAnimationFrame(rafHw.current);
      ctxRef.current?.close();
    };
  },[onKeyDown,onKeyUp,drawHighway,resize]);

  useEffect(()=>{ drawPiano(pressedKeys); },[pressedKeys,drawPiano]);

  // ── alphaTab sheet music panel ────────────────────────────────────────────
  useEffect(()=>{
    if (!sheetContRef.current) return;
    // Destroy previous instance
    if (atApiRef.current){try{atApiRef.current.destroy();}catch{} atApiRef.current=null;}
    setSheetReady(false);
    const settings=new alphaTab.Settings();
    settings.core.engine="html5";
    settings.core.logLevel=alphaTab.LogLevel.None;
    settings.core.fontDirectory="/font/";
    settings.display.layoutMode=alphaTab.LayoutMode.Horizontal;
    settings.display.scale=0.85;
    settings.display.staveProfile=alphaTab.StaveProfile.Score;
    settings.player.enablePlayer=true;
    settings.player.enableCursor=true;
    settings.player.enableAnimatedBeatCursor=true;
    settings.player.soundFont="/soundfont/sonivox.sf2";
    const api=new alphaTab.AlphaTabApi(sheetContRef.current,settings);
    atApiRef.current=api;
    api.renderFinished.on(()=>setSheetReady(true));
    api.error.on((err:{message?:string})=>{
      const m=err.message??"";
      if (m.includes("voices")||m.includes("BoundsLookup")||m.includes("fromJson")) return;
      console.warn("[atPractice]",m);
    });
    const tex=SONG_ALPHATEX[songIdx]??SONG_ALPHATEX[0];
    api.tex(tex);
    // Auto-play when game transitions to playing state
    api.playerReady.on(()=>{
      // Player is ready — playback will be triggered by startGame
    });
    return ()=>{try{api.destroy();}catch{} atApiRef.current=null;};
  },[songIdx]);
  // Reload sheet when song changes
  useEffect(()=>{
    if (!atApiRef.current) return;
    setSheetReady(false);
    try { atApiRef.current.stop(); } catch {}
    const tex=SONG_ALPHATEX[songIdx]??SONG_ALPHATEX[0];
    atApiRef.current.tex(tex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[songIdx]);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
    <AbcImportModal open={showAbcModal} onClose={()=>setShowAbcModal(false)} onImport={handleAbcImport}/>
    <div
      className="flex flex-col h-full"
      style={{background:"#0a0f1e",color:"white",fontFamily:"'DM Sans',sans-serif"}}
      onClick={()=>{if (!audioReady) initAudio();}}
    >
      {/* Header */}
      <div
        className="flex items-center gap-3 px-4 py-2 flex-shrink-0 flex-wrap"
        style={{borderBottom:"1px solid rgba(255,255,255,0.08)",background:"#0d1526"}}
      >
        <div className="mr-2">
          <h1 className="text-base font-bold" style={{letterSpacing:"-0.01em"}}>{t("pianoPracticeTitle")}</h1>
          <p className="text-xs" style={{color:"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace"}}>{t("pianoPracticeSubtitle")}</p>
        </div>

        {/* Duet toggle */}
        <button
          onClick={()=>{
            const next=!isDuet;
            setIsDuet(next); isDuetRef.current=next;
          }}
          disabled={gameState==="playing"||gameState==="countdown"}
          className="text-xs px-2 py-1 rounded font-bold transition-all flex items-center gap-1"
          style={{
            background:isDuet?"rgba(168,85,247,0.25)":"rgba(255,255,255,0.06)",
            border:isDuet?"1px solid rgba(168,85,247,0.6)":"1px solid rgba(255,255,255,0.1)",
            color:isDuet?"#a855f7":"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace",
          }}
        >🎹 二重奏</button>
        {/* ABC import button — only shown in duet mode */}
        {isDuet&&(
          <button
            onClick={()=>setShowAbcModal(true)}
            disabled={gameState==="playing"||gameState==="countdown"}
            className="text-xs px-2 py-1 rounded font-bold transition-all"
            style={{
              background:"rgba(0,212,255,0.12)",
              border:"1px solid rgba(0,212,255,0.35)",
              color:"#00d4ff",fontFamily:"'IBM Plex Mono',monospace",
            }}
          >+ ABC</button>
        )}
        {/* Song selector — changes based on mode */}
        {isDuet?(
          <select
            value={duetIdx} onChange={e=>{const v=Number(e.target.value);setDuetIdx(v);duetIdxRef.current=v;}}
            disabled={gameState==="playing"||gameState==="countdown"}
            className="text-xs px-2 py-1 rounded"
            style={{background:"rgba(168,85,247,0.12)",border:"1px solid rgba(168,85,247,0.3)",color:"#a855f7",fontFamily:"'IBM Plex Mono',monospace"}}
          >
            {allDuetSongs.map((s,i)=><option key={i} value={i} style={{background:"#1a2744"}}>{s.name}{i>=DUET_SONGS.length?" ✦":""}</option>)}
          </select>
        ):(
          <select
            value={songIdx} onChange={e=>setSongIdx(Number(e.target.value))}
            disabled={gameState==="playing"||gameState==="countdown"}
            className="text-xs px-2 py-1 rounded"
            style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"white",fontFamily:"'IBM Plex Mono',monospace"}}
          >
            {SONGS.map((s,i)=><option key={i} value={i} style={{background:"#1a2744"}}>{s.name}</option>)}
          </select>
        )}

        {/* Lead-in selector */}
        <div className="flex items-center gap-1">
          <span className="text-xs" style={{color:"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace"}}>LEAD</span>
          {LEAD_IN_OPTIONS.map(n=>(
            <button key={n} onClick={()=>{setLeadIn(n);leadInRef2.current=n;}}
              disabled={gameState==="playing"||gameState==="countdown"}
              className="text-xs px-1.5 py-0.5 rounded font-bold transition-all"
              style={{
                background:leadIn===n?"rgba(0,212,255,0.25)":"rgba(255,255,255,0.05)",
                border:leadIn===n?"1px solid rgba(0,212,255,0.6)":"1px solid transparent",
                color:leadIn===n?"#00d4ff":"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace",
              }}
            >{n}</button>
          ))}
        </div>

        {/* Score panel is always visible — no toggle */}

        {/* Difficulty */}
        <div className="flex gap-1">
          {(Object.keys(DIFFICULTIES) as Difficulty[]).map(d=>(
            <button key={d} onClick={()=>setDifficulty(d)}
              disabled={gameState==="playing"||gameState==="countdown"}
              className="text-xs px-2 py-1 rounded font-bold transition-all"
              style={{
                background:difficulty===d?(d==="easy"?"#22c55e":d==="normal"?"#00d4ff":"#ef4444"):"rgba(255,255,255,0.06)",
                color:difficulty===d?"white":"#8a9bb0",
                border:"1px solid transparent",fontFamily:"'IBM Plex Mono',monospace",
              }}
            >{DIFFICULTIES[d].label}</button>
          ))}
        </div>

        {/* Start/Stop */}
        {(gameState==="idle"||gameState==="finished")?(
          <button onClick={startGame} className="px-3 py-1 rounded text-xs font-bold"
            style={{background:"#ec4899",color:"white",fontFamily:"'IBM Plex Mono',monospace"}}>
            {gameState==="finished"?"PLAY AGAIN":"START"}
          </button>
        ):(
          <button onClick={stopGame} className="px-3 py-1 rounded text-xs font-bold"
            style={{background:"rgba(236,72,153,0.15)",border:"1px solid rgba(236,72,153,0.4)",color:"#ec4899",fontFamily:"'IBM Plex Mono',monospace"}}>
            STOP
          </button>
        )}

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          {midiConn&&(
            <span className="text-xs px-2 py-0.5 rounded"
              style={{background:"rgba(34,197,94,0.15)",border:"1px solid rgba(34,197,94,0.3)",color:"#22c55e",fontFamily:"'IBM Plex Mono',monospace"}}>
              MIDI ●
            </span>
          )}
          {combo>1&&(
            <span className="text-xs font-bold px-2 py-0.5 rounded"
              style={{background:"rgba(234,179,8,0.15)",border:"1px solid rgba(234,179,8,0.3)",color:"#eab308",fontFamily:"'IBM Plex Mono',monospace"}}>
              ×{combo}
            </span>
          )}
          <div className="text-right">
            <div className="text-xs" style={{color:"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace"}}>SCORE</div>
            <div className="text-lg font-bold" style={{color:"#ec4899",fontFamily:"'IBM Plex Mono',monospace",lineHeight:1}}>{score.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Sheet Music panel — always visible */}
      <div className="flex-shrink-0 relative overflow-x-auto"
        style={{height:200,borderBottom:"1px solid rgba(168,85,247,0.3)",background:"#f8f6f2"}}>
        {!sheetReady&&(
          <div className="absolute inset-0 flex items-center justify-center"
            style={{background:"#f8f6f2",zIndex:10}}>
            <span className="text-xs" style={{color:"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace"}}>Loading score…</span>
          </div>
        )}
        <div ref={sheetContRef} className="w-full h-full" style={{minWidth:"100%"}} />
        <div className="absolute top-1 left-2 text-xs font-bold px-1.5 py-0.5 rounded"
          style={{background:"rgba(168,85,247,0.15)",border:"1px solid rgba(168,85,247,0.4)",color:"#7c3aed",fontFamily:"'IBM Plex Mono',monospace",pointerEvents:"none"}}>
          🎼 {SONGS[songIdx].name} — press START to play along
        </div>
      </div>

      {/* Highway — full width, DFT baked into background */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-3 py-1 flex-shrink-0 flex items-center justify-between"
          style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(236,72,153,0.04)"}}>
          <span className="text-xs font-semibold" style={{color:"#ec4899",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"0.08em"}}>
            NOTE HIGHWAY — {SONGS[songIdx].name.toUpperCase()}
          </span>
          <div className="flex items-center gap-3">
            <span className="text-xs" style={{color:"rgba(138,155,176,0.5)",fontFamily:"'IBM Plex Mono',monospace",fontSize:9}}>
              ACC {accuracy}% · MAX ×{maxCombo} · BPM {Math.round(SONGS[songIdx].bpm*tempoScale/100)}
              {!audioReady&&" · Click to unlock audio"}
            </span>
            {/* Zoom / octave range */}
            <div className="flex items-center gap-1">
              <span className="text-xs" style={{color:"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace",fontSize:9}}>ZOOM</span>
              {[
                {label:"ALL",  s:KEYBOARD_START, e:KEYBOARD_END},
                {label:"C2–C5",s:36,  e:72},
                {label:"C3–C6",s:48,  e:84},
                {label:"C4–C7",s:60,  e:96},
              ].map(z=>(
                <button key={z.label}
                  onClick={()=>{
                    viewStartRef.current=z.s; viewEndRef.current=z.e;
                    setViewStart(z.s); setViewEnd(z.e);
                    // Rebuild layout immediately
                    const p=pianoRef.current;
                    if (p) layoutRef.current=buildPianoLayout(p.offsetWidth,p.offsetHeight,z.s,z.e);
                    const h=hwRef.current;
                    if (h) layoutRef.current=buildPianoLayout(h.offsetWidth,h.offsetHeight,z.s,z.e);
                  }}
                  className="px-1.5 py-0.5 rounded text-xs transition-all"
                  style={{
                    fontFamily:"'IBM Plex Mono',monospace",fontSize:8,
                    background:viewStart===z.s&&viewEnd===z.e?"rgba(0,212,255,0.2)":"rgba(255,255,255,0.05)",
                    border:`1px solid ${viewStart===z.s&&viewEnd===z.e?"rgba(0,212,255,0.5)":"rgba(255,255,255,0.1)"}`,
                    color:viewStart===z.s&&viewEnd===z.e?"#00d4ff":"#8a9bb0",
                  }}>
                  {z.label}
                </button>
              ))}
            </div>
            {/* Tempo slider */}
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{color:"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace",fontSize:9}}>TEMPO</span>
              <input type="range" min={50} max={100} step={5} value={tempoScale}
                disabled={gameState==="playing"||gameState==="countdown"}
                onChange={e=>{
                  const v=Number(e.target.value);
                  setTempoScale(v); tempoScaleRef.current=v/100;
                }}
                style={{width:64,accentColor:"#00d4ff",cursor:"pointer"}}
              />
              <span className="text-xs font-bold" style={{color:"#00d4ff",fontFamily:"'IBM Plex Mono',monospace",fontSize:9,minWidth:28}}>{tempoScale}%</span>
            </div>
          </div>
        </div>
        <div className="flex-1 relative min-h-0">
          <canvas ref={hwRef} className="w-full h-full" style={{display:"block"}} />
          {/* Results overlay */}
          {gameState==="finished"&&(
            <div className="absolute inset-0 flex flex-col items-center justify-center"
              style={{background:"rgba(10,15,30,0.88)",backdropFilter:"blur(4px)"}}>
              <div className="text-center px-8 py-6 rounded-xl"
                style={{background:"rgba(15,20,40,0.95)",border:"1px solid rgba(236,72,153,0.4)",boxShadow:"0 0 40px rgba(236,72,153,0.2)"}}>
                <div className="text-4xl font-black mb-1" style={{color:"#ec4899",fontFamily:"'DM Sans',sans-serif"}}>
                  {accuracy>=90?"S":accuracy>=70?"A":accuracy>=45?"B":"C"}
                </div>
                <div className="text-xs mb-1" style={{color:"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace"}}>GRADE</div>
                <div className="text-sm font-semibold mb-4" style={{color:"#00d4ff",fontFamily:"'DM Sans',sans-serif"}}>
                  {accuracy>=90?"🎹 Brilliant! Keep it up!":accuracy>=70?"🎵 Great job! You're improving!":accuracy>=45?"👍 Nice try! Practice makes perfect!":"💪 Keep going — you'll get it!"}
                </div>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-xs mb-5" style={{fontFamily:"'IBM Plex Mono',monospace"}}>
                  <span style={{color:"#8a9bb0"}}>ACCURACY</span>
                  <span className="font-bold" style={{color:"#00d4ff"}}>{accuracy}%</span>
                  <span style={{color:"#8a9bb0"}}>SCORE</span>
                  <span className="font-bold" style={{color:"#ec4899"}}>{score.toLocaleString()}</span>
                  <span style={{color:"#8a9bb0"}}>MAX COMBO</span>
                  <span className="font-bold" style={{color:"#eab308"}}>×{maxCombo}</span>
                </div>
                <button onClick={startGame}
                  className="px-6 py-2 rounded-lg text-sm font-bold transition-all hover:opacity-90"
                  style={{background:"#ec4899",color:"white",fontFamily:"'IBM Plex Mono',monospace"}}>
                  PLAY AGAIN
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Piano keyboard */}
      <div className="flex-shrink-0" style={{height:140,borderTop:"2px solid rgba(236,72,153,0.3)",background:"#0d1526"}}>
        <canvas
          ref={pianoRef} className="w-full h-full"
          style={{display:"block",cursor:"pointer"}}
          onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        />
      </div>
    </div>
    </>
  );
}
