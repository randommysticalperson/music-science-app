/*
 * PianoPractice.tsx — Bauhaus Frequency Design
 * Virtual piano keyboard + DFT spectrum rendered as highway background
 * Design: dark navy (#0a0f1e), accent pink (#ec4899), cyan (#00d4ff)
 * Highway: one lane per piano key (C3–B5), DFT bars drawn behind the notes
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLang } from "../contexts/LanguageContext";

// ─── Constants ────────────────────────────────────────────────────────────────

const NOTE_NAMES    = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const BLACK_SEMIS   = new Set([1,3,6,8,10]);

const KEYBOARD_START = 48; // C3
const KEYBOARD_END   = 83; // B5
const TOTAL_KEYS     = KEYBOARD_END - KEYBOARD_START + 1; // 36

const isBlack    = (m: number) => BLACK_SEMIS.has(m % 12);
const ALL_MIDIS  = Array.from({ length: TOTAL_KEYS }, (_, i) => KEYBOARD_START + i);
const WHITE_MIDIS = ALL_MIDIS.filter(m => !isBlack(m));
const WHITE_COUNT = WHITE_MIDIS.length; // 21

const noteFreq  = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
const noteLabel = (m: number) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);

// QWERTY → MIDI
const KEY_MAP: Record<string, number> = {
  z:48,s:49,x:50,d:51,c:52,v:53,g:54,b:55,h:56,n:57,j:58,m:59,
  q:60,"2":61,w:62,"3":63,e:64,r:65,"5":66,t:67,"6":68,y:69,"7":70,u:71,
  i:72,"9":73,o:74,"0":75,p:76,
};

const LANE_COLORS = [
  "#ec4899","#f97316","#eab308","#22c55e",
  "#00d4ff","#a855f7","#ec4899","#f97316",
  "#eab308","#22c55e","#00d4ff","#a855f7",
];

// ─── Difficulty ───────────────────────────────────────────────────────────────

const DIFFICULTIES = {
  easy:   { label:"EASY",   hitWindow:0.6, speed:3 },
  normal: { label:"NORMAL", hitWindow:0.4, speed:4 },
  hard:   { label:"HARD",   hitWindow:0.2, speed:6 },
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

// ─── Types ────────────────────────────────────────────────────────────────────

type GameState = "idle"|"countdown"|"playing"|"finished";

interface FallingNote {
  id:number; midi:number; beatStart:number; beatDuration:number;
  hit:boolean; missed:boolean; hitTime?:number;
}

interface KeyRect { x:number; y:number; w:number; h:number; isBlack:boolean; }

// ─── Piano layout ─────────────────────────────────────────────────────────────

function buildPianoLayout(W:number, H:number): Map<number,KeyRect> {
  const whiteW = W / WHITE_COUNT;
  const blackW = whiteW * 0.58;
  const blackH = H * 0.62;
  const rects  = new Map<number,KeyRect>();
  let wi = 0;
  for (const m of ALL_MIDIS) {
    if (!isBlack(m)) { rects.set(m,{x:wi*whiteW,y:0,w:whiteW,h:H,isBlack:false}); wi++; }
  }
  for (const m of ALL_MIDIS) {
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

  // Mutable refs
  const gsRef        = useRef<GameState>("idle");
  const fallingRef   = useRef<FallingNote[]>([]);
  const scoreRef     = useRef(0);
  const comboRef     = useRef(0);
  const maxComboRef  = useRef(0);
  const hitsRef      = useRef(0);
  const totalRef     = useRef(0);
  const pressedRef   = useRef<Set<number>>(new Set());
  const startTimeRef = useRef(0);
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
      const g=ctx.createLinearGradient(r.x,0,r.x,r.h);
      if (on){g.addColorStop(0,col+"cc");g.addColorStop(1,col+"55");}
      else   {g.addColorStop(0,"#f8f6f2");g.addColorStop(1,"#e0dcd6");}
      ctx.fillStyle=g;
      ctx.beginPath();ctx.roundRect(r.x+1,0,r.w-2,r.h-2,[0,0,4,4]);ctx.fill();
      ctx.strokeStyle=on?col:"rgba(0,0,0,0.15)"; ctx.lineWidth=on?1.5:1;
      ctx.beginPath();ctx.roundRect(r.x+1,0,r.w-2,r.h-2,[0,0,4,4]);ctx.stroke();
      if (r.w>16){
        ctx.fillStyle=on?"white":"rgba(0,0,0,0.3)";
        ctx.font=`bold ${Math.min(10,r.w*0.32)}px 'IBM Plex Mono',monospace`;
        ctx.textAlign="center"; ctx.fillText(noteLabel(midi),r.x+r.w/2,r.h-5);
      }
    });
    // Black keys
    layout.forEach((r,midi)=>{
      if (!r.isBlack) return;
      const on=pressed.has(midi), col=LANE_COLORS[midi%12];
      const g=ctx.createLinearGradient(r.x,0,r.x,r.h);
      if (on){g.addColorStop(0,col);g.addColorStop(1,col+"88");}
      else   {g.addColorStop(0,"#1a1a2e");g.addColorStop(1,"#0a0a18");}
      ctx.fillStyle=g;
      ctx.beginPath();ctx.roundRect(r.x,0,r.w,r.h,[0,0,3,3]);ctx.fill();
      if (on){
        ctx.strokeStyle=col;ctx.lineWidth=1.5;
        ctx.beginPath();ctx.roundRect(r.x,0,r.w,r.h,[0,0,3,3]);ctx.stroke();
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

    const HIT_Y=H*0.88;

    // 2. DFT bars — drawn per-lane, each bar centred on the key's x position
    if (analyserRef.current && ctxRef.current) {
      const analyser=analyserRef.current;
      const bufLen=analyser.frequencyBinCount;
      const freqData=new Uint8Array(bufLen);
      analyser.getByteFrequencyData(freqData);
      const sr=ctxRef.current.sampleRate;

      layout.forEach((r, midi)=>{
        // Map this key's fundamental frequency to an FFT bin
        const freq=noteFreq(midi);
        const bin=Math.round(freq/(sr/2)*bufLen);
        // Average a small window of bins for stability
        let sum=0, cnt=0;
        for (let b=Math.max(0,bin-2); b<=Math.min(bufLen-1,bin+2); b++){
          sum+=freqData[b]; cnt++;
        }
        const v=(cnt>0?sum/cnt:0)/255;
        if (v<0.01) return;

        const col=LANE_COLORS[midi%12];
        const x=r.x;
        const bW=r.w;
        const bH=v*HIT_Y*0.85;

        // Gradient bar from hit zone upward
        const g=ctx.createLinearGradient(x,HIT_Y-bH,x,HIT_Y);
        g.addColorStop(0,col+"00");
        g.addColorStop(0.4,col+"33");
        g.addColorStop(1,col+"88");
        ctx.fillStyle=g;
        ctx.fillRect(x,HIT_Y-bH,bW,bH);
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

    // 4. Hit zone glow line
    const hg=ctx.createLinearGradient(0,HIT_Y-3,0,HIT_Y+3);
    hg.addColorStop(0,"rgba(236,72,153,0)");
    hg.addColorStop(0.5,"rgba(236,72,153,0.9)");
    hg.addColorStop(1,"rgba(236,72,153,0)");
    ctx.fillStyle=hg; ctx.fillRect(0,HIT_Y-3,W,6);

    // Hit zone circles
    layout.forEach((r,midi)=>{
      const col=LANE_COLORS[midi%12];
      const cx=r.x+r.w/2, rad=r.w*(r.isBlack?0.35:0.38);
      const on=pressedRef.current.has(midi);
      ctx.beginPath();ctx.arc(cx,HIT_Y,rad,0,Math.PI*2);
      ctx.fillStyle=on?col:`${col}28`; ctx.fill();
      ctx.strokeStyle=on?col:`${col}55`; ctx.lineWidth=on?2:1; ctx.stroke();
      if (!r.isBlack&&r.w>14){
        ctx.fillStyle=on?"white":`${col}80`;
        ctx.font=`bold ${Math.min(9,r.w*0.28)}px 'IBM Plex Mono',monospace`;
        ctx.textAlign="center"; ctx.fillText(noteLabel(midi),cx,HIT_Y+3.5);
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
    const bps=songRef.current.bpm/60;
    const beat=elapsed*bps;
    const diff=DIFFICULTIES[diffRef.current];
    const visBeats=diff.speed;

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
      const yTop=HIT_Y-(beatsFromNow/visBeats)*HIT_Y;
      const noteH=Math.max((fn.beatDuration/visBeats)*HIT_Y,10);

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

      const ng=ctx.createLinearGradient(x,yTop,x,yTop+noteH);
      ng.addColorStop(0,`${col}ee`); ng.addColorStop(1,`${col}77`);
      ctx.fillStyle=ng; ctx.shadowColor=col; ctx.shadowBlur=8;
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

    rafHw.current=requestAnimationFrame(drawHighway);
  },[]);

  // ── Hit detection ─────────────────────────────────────────────────────────

  const checkHit=useCallback((midi:number)=>{
    if (gsRef.current!=="playing") return;
    const bps=songRef.current.bpm/60;
    const beat=((performance.now()-startTimeRef.current)/1000)*bps;
    const win=DIFFICULTIES[diffRef.current].hitWindow;
    for (const fn of fallingRef.current){
      if (fn.midi!==midi||fn.hit||fn.missed) continue;
      const d=Math.abs(fn.beatStart-beat);
      if (d<=win){
        fn.hit=true; fn.hitTime=performance.now(); hitsRef.current++;
        const pts=d<win*0.25?100:d<win*0.6?70:40;
        comboRef.current++;
        if (comboRef.current>maxComboRef.current) maxComboRef.current=comboRef.current;
        scoreRef.current+=Math.round(pts*(1+comboRef.current*0.05));
        setScore(scoreRef.current); setCombo(comboRef.current); break;
      }
    }
  },[]);

  // ── Game controls ─────────────────────────────────────────────────────────

  const startGame=useCallback(()=>{
    initAudio();
    fallingRef.current=[]; scoreRef.current=0; comboRef.current=0; maxComboRef.current=0;
    hitsRef.current=0; totalRef.current=SONGS[songIdx].notes.length;
    noteIdRef.current=0; songRef.current=SONGS[songIdx]; diffRef.current=difficulty;
    setScore(0); setCombo(0); setMaxCombo(0); setAccuracy(100);
    gsRef.current="countdown"; setGameState("countdown");
    cdRef.current=3; setCountdown(3);
    let c=3;
    const iv=setInterval(()=>{
      c--;
      if (c<=0){clearInterval(iv);startTimeRef.current=performance.now();gsRef.current="playing";setGameState("playing");}
      else{cdRef.current=c;setCountdown(c);}
    },1000);
  },[songIdx,difficulty,initAudio]);

  const stopGame=useCallback(()=>{
    gsRef.current="idle"; setGameState("idle"); fallingRef.current=[];
  },[]);

  // ── Keyboard input ────────────────────────────────────────────────────────

  const pressKey=useCallback((midi:number)=>{
    if (!ctxRef.current) initAudio();
    playNote(midi); checkHit(midi);
    pressedRef.current=new Set(Array.from(pressedRef.current).concat(midi));
    setPressedKeys(new Set(pressedRef.current));
  },[initAudio,playNote,checkHit]);

  const releaseKey=useCallback((midi:number)=>{
    stopNote(midi);
    pressedRef.current=new Set(Array.from(pressedRef.current).filter(m=>m!==midi));
    setPressedKeys(new Set(pressedRef.current));
  },[stopNote]);

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
    if (p) layoutRef.current=buildPianoLayout(p.width/(window.devicePixelRatio||1),p.height/(window.devicePixelRatio||1));
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

  // ── Render ────────────────────────────────────────────────────────────────

  return (
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

        {/* Song */}
        <select
          value={songIdx} onChange={e=>setSongIdx(Number(e.target.value))}
          disabled={gameState==="playing"||gameState==="countdown"}
          className="text-xs px-2 py-1 rounded"
          style={{background:"rgba(255,255,255,0.08)",border:"1px solid rgba(255,255,255,0.15)",color:"white",fontFamily:"'IBM Plex Mono',monospace"}}
        >
          {SONGS.map((s,i)=><option key={i} value={i} style={{background:"#1a2744"}}>{s.name}</option>)}
        </select>

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

      {/* Highway — full width, DFT baked into background */}
      <div className="flex flex-col flex-1 min-h-0">
        <div className="px-3 py-1 flex-shrink-0 flex items-center justify-between"
          style={{borderBottom:"1px solid rgba(255,255,255,0.06)",background:"rgba(236,72,153,0.04)"}}>
          <span className="text-xs font-semibold" style={{color:"#ec4899",fontFamily:"'IBM Plex Mono',monospace",letterSpacing:"0.08em"}}>
            NOTE HIGHWAY — {SONGS[songIdx].name.toUpperCase()}
          </span>
          <span className="text-xs" style={{color:"rgba(138,155,176,0.5)",fontFamily:"'IBM Plex Mono',monospace",fontSize:9}}>
            ACC {accuracy}% · MAX ×{maxCombo} · BPM {SONGS[songIdx].bpm}
            {!audioReady&&" · Click to unlock audio"}
          </span>
        </div>
        <canvas ref={hwRef} className="flex-1 w-full" style={{display:"block"}} />
      </div>

      {/* Piano keyboard */}
      <div className="flex-shrink-0" style={{height:110,borderTop:"2px solid rgba(236,72,153,0.3)",background:"#0d1526"}}>
        <canvas
          ref={pianoRef} className="w-full h-full"
          style={{display:"block",cursor:"pointer"}}
          onPointerDown={onPointerDown} onPointerUp={onPointerUp} onPointerLeave={onPointerUp}
        />
      </div>
    </div>
  );
}
