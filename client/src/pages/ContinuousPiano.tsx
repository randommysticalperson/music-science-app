/*
 * ContinuousPiano.tsx — Theremin-style Continuous Piano
 * Design: dark navy (#0a0f1e), accent cyan (#00d4ff), pink (#ec4899)
 *
 * The piano is a full-width canvas. Hovering (or touching) plays a note
 * continuously — X axis = pitch (A0–C8), Y axis = volume (top = loud).
 * The frequency glides smoothly between notes via AudioParam.linearRampToValueAtTime.
 * A real-time DFT spectrum is drawn above the keyboard.
 * Waveform selector: sine / triangle / sawtooth / square.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import { useLang } from "../contexts/LanguageContext";

// ─── Constants ────────────────────────────────────────────────────────────────
const NOTE_NAMES  = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"];
const BLACK_SEMIS = new Set([1,3,6,8,10]);
const MIDI_START  = 21;  // A0
const MIDI_END    = 108; // C8
const TOTAL_KEYS  = MIDI_END - MIDI_START + 1; // 88
const isBlack     = (m: number) => BLACK_SEMIS.has(m % 12);
const ALL_MIDIS   = Array.from({length:TOTAL_KEYS},(_,i)=>MIDI_START+i);
const WHITE_MIDIS = ALL_MIDIS.filter(m=>!isBlack(m));
const WHITE_COUNT = WHITE_MIDIS.length; // 52
const noteFreq    = (m: number) => 440 * Math.pow(2,(m-69)/12);
const noteLabel   = (m: number) => NOTE_NAMES[m%12]+(Math.floor(m/12)-1);
const LANE_COLORS = [
  "#ec4899","#f97316","#eab308","#22c55e",
  "#00d4ff","#a855f7","#ec4899","#f97316",
  "#eab308","#22c55e","#00d4ff","#a855f7",
];
type WaveType = "sine"|"triangle"|"sawtooth"|"square";
const WAVEFORMS: WaveType[] = ["sine","triangle","sawtooth","square"];

interface KeyRect { x:number; w:number; h:number; isBlack:boolean; midi:number; }

function buildLayout(W:number, H:number): KeyRect[] {
  const whiteW = W / WHITE_COUNT;
  const blackW = whiteW * 0.58;
  const blackH = H * 0.62;
  const whites: KeyRect[] = [];
  const blacks: KeyRect[] = [];
  let wi = 0;
  for (const m of ALL_MIDIS) {
    if (!isBlack(m)) {
      whites.push({x:wi*whiteW, w:whiteW, h:H, isBlack:false, midi:m});
      wi++;
    }
  }
  for (const m of ALL_MIDIS) {
    if (isBlack(m)) {
      const left = whites.find(k=>k.midi===m-1);
      if (left) blacks.push({x:left.x+left.w-blackW/2, w:blackW, h:blackH, isBlack:true, midi:m});
    }
  }
  return [...whites,...blacks];
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function ContinuousPiano() {
  const { t } = useLang();

  // Canvas refs
  const pianoRef   = useRef<HTMLCanvasElement>(null);
  const specRef    = useRef<HTMLCanvasElement>(null);
  const layoutRef  = useRef<KeyRect[]>([]);
  const rafRef     = useRef(0);

  // Audio
  const ctxRef     = useRef<AudioContext|null>(null);
  const oscRef     = useRef<OscillatorNode|null>(null);
  const gainRef    = useRef<GainNode|null>(null);
  const analyserRef= useRef<AnalyserNode|null>(null);
  const [audioReady, setAudioReady] = useState(false);
  // Microphone + dB
  const micStreamRef   = useRef<MediaStream|null>(null);
  const micAnalyserRef = useRef<AnalyserNode|null>(null);
  const [micActive,  setMicActive]  = useState(false);
  const [dbLevel,    setDbLevel]    = useState(-60);
  const [micDbLevel, setMicDbLevel] = useState(-60);

  // Interaction state
  const playingRef = useRef(false);
  const hoverMidi  = useRef<number|null>(null);
  const hoverFreq  = useRef<number>(440);
  const hoverVol   = useRef<number>(0);
  const [currentNote, setCurrentNote] = useState<string|null>(null);
  const [currentFreq, setCurrentFreq] = useState<number|null>(null);

  // Controls
  const [waveform, setWaveform] = useState<WaveType>("sine");
  const waveformRef = useRef<WaveType>("sine");
  const [glideMs, setGlideMs] = useState(40);
  const glideMsRef = useRef(40);
  const [reverb, setReverb] = useState(false);
  const reverbRef  = useRef<ConvolverNode|null>(null);
  const dryRef     = useRef<GainNode|null>(null);
  const wetRef     = useRef<GainNode|null>(null);

  // ── Audio init ─────────────────────────────────────────────────────────────
  const initAudio = useCallback(()=>{
    if (ctxRef.current) return;
    const ctx = new AudioContext();
    ctxRef.current = ctx;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;

    const master = ctx.createGain();
    master.gain.value = 0;
    gainRef.current = master;

    // Simple reverb via convolver with noise impulse
    const convolver = ctx.createConvolver();
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch=0; ch<2; ch++){
      const d = buf.getChannelData(ch);
      for (let i=0; i<len; i++) d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2);
    }
    convolver.buffer = buf;
    reverbRef.current = convolver;

    const dry = ctx.createGain(); dry.gain.value = 1;
    const wet = ctx.createGain(); wet.gain.value = 0;
    dryRef.current = dry; wetRef.current = wet;

    master.connect(dry); dry.connect(analyser);
    master.connect(convolver); convolver.connect(wet); wet.connect(analyser);
    analyser.connect(ctx.destination);

    // Create oscillator
    const osc = ctx.createOscillator();
    osc.type = waveformRef.current;
    osc.frequency.value = 440;
    osc.connect(master);
    osc.start();
    oscRef.current = osc;

    setAudioReady(true);
  },[]);

  // ── Microphone with echo cancellation ─────────────────────────────────────
  const toggleMic = useCallback(async ()=>{
    if (micActive) {
      micStreamRef.current?.getTracks().forEach(t=>t.stop());
      micStreamRef.current = null;
      micAnalyserRef.current = null;
      setMicActive(false);
      return;
    }
    if (!ctxRef.current) initAudio();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      micStreamRef.current = stream;
      const ctx = ctxRef.current!;
      const src = ctx.createMediaStreamSource(stream);
      const ma = ctx.createAnalyser();
      ma.fftSize = 2048; ma.smoothingTimeConstant = 0.8;
      src.connect(ma); // NOT to destination — prevents feedback
      micAnalyserRef.current = ma;
      setMicActive(true);
    } catch(e) { console.warn('Mic denied', e); }
  },[micActive, initAudio]);

  // ── dB polling at 10fps ────────────────────────────────────────────────────
  useEffect(()=>{
    let id: ReturnType<typeof setTimeout>;
    const poll = ()=>{
      if (analyserRef.current) {
        const buf = new Uint8Array(analyserRef.current.frequencyBinCount);
        analyserRef.current.getByteFrequencyData(buf);
        const rms = Math.sqrt(buf.reduce((s,v)=>s+v*v,0)/buf.length);
        setDbLevel(rms > 0 ? Math.max(-60,Math.min(0,20*Math.log10(rms/255))) : -60);
      }
      if (micAnalyserRef.current) {
        const buf = new Uint8Array(micAnalyserRef.current.frequencyBinCount);
        micAnalyserRef.current.getByteFrequencyData(buf);
        const rms = Math.sqrt(buf.reduce((s,v)=>s+v*v,0)/buf.length);
        setMicDbLevel(rms > 0 ? Math.max(-60,Math.min(0,20*Math.log10(rms/255))) : -60);
      }
      id = setTimeout(poll, 100);
    };
    poll();
    return ()=>clearTimeout(id);
  },[micActive]);

  // ── Pointer helpers ────────────────────────────────────────────────────────
  const getMidiFromX = useCallback((x: number): number|null => {
    const layout = layoutRef.current;
    // Check black keys first (they're on top)
    for (const k of layout) {
      if (k.isBlack && x>=k.x && x<=k.x+k.w) return k.midi;
    }
    for (const k of layout) {
      if (!k.isBlack && x>=k.x && x<=k.x+k.w) return k.midi;
    }
    return null;
  },[]);

  const startNote = useCallback((midi: number, vol: number)=>{
    if (!ctxRef.current || !oscRef.current || !gainRef.current) return;
    const ctx = ctxRef.current;
    const osc = oscRef.current;
    const gain = gainRef.current;
    const freq = noteFreq(midi);
    const now = ctx.currentTime;
    const glide = glideMsRef.current / 1000;
    osc.frequency.cancelScheduledValues(now);
    osc.frequency.linearRampToValueAtTime(freq, now + glide);
    gain.gain.cancelScheduledValues(now);
    gain.gain.linearRampToValueAtTime(vol * 0.6, now + 0.01);
    hoverFreq.current = freq;
    hoverMidi.current = midi;
    setCurrentNote(noteLabel(midi));
    setCurrentFreq(Math.round(freq*10)/10);
  },[]);

  const stopNote = useCallback(()=>{
    if (!ctxRef.current || !gainRef.current) return;
    const ctx = ctxRef.current;
    const gain = gainRef.current;
    const now = ctx.currentTime;
    gain.gain.cancelScheduledValues(now);
    gain.gain.linearRampToValueAtTime(0, now + 0.08);
    hoverMidi.current = null;
    setCurrentNote(null);
    setCurrentFreq(null);
  },[]);

  // ── Canvas pointer events ──────────────────────────────────────────────────
  const onPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>)=>{
    if (!playingRef.current) return;
    const canvas = pianoRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const vol = Math.max(0, Math.min(1, 1 - y / rect.height));
    hoverVol.current = vol;
    const midi = getMidiFromX(x * (canvas.width / (window.devicePixelRatio||1) / rect.width));
    if (midi !== null) startNote(midi, vol);
  },[getMidiFromX, startNote]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>)=>{
    initAudio();
    playingRef.current = true;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    onPointerMove(e);
  },[initAudio, onPointerMove]);

  const onPointerUp = useCallback(()=>{
    playingRef.current = false;
    stopNote();
  },[stopNote]);

  // Hover preview (no sound, just highlight)
  const onMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>)=>{
    if (playingRef.current) return;
    const canvas = pianoRef.current; if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / (window.devicePixelRatio||1) / rect.width);
    const midi = getMidiFromX(x);
    hoverMidi.current = midi;
    if (midi!==null){ setCurrentNote(noteLabel(midi)); setCurrentFreq(Math.round(noteFreq(midi)*10)/10); }
    else { setCurrentNote(null); setCurrentFreq(null); }
  },[getMidiFromX]);

  const onMouseLeave = useCallback(()=>{
    if (!playingRef.current){ hoverMidi.current=null; setCurrentNote(null); setCurrentFreq(null); }
  },[]);

  // ── Waveform change ────────────────────────────────────────────────────────
  const changeWaveform = useCallback((w: WaveType)=>{
    waveformRef.current = w;
    setWaveform(w);
    if (oscRef.current) oscRef.current.type = w;
  },[]);

  // ── Reverb toggle ──────────────────────────────────────────────────────────
  const toggleReverb = useCallback(()=>{
    setReverb(r=>{
      const next=!r;
      if (wetRef.current && dryRef.current){
        wetRef.current.gain.value = next ? 0.35 : 0;
        dryRef.current.gain.value = next ? 0.65 : 1;
      }
      return next;
    });
  },[]);

  // ── Draw piano canvas ──────────────────────────────────────────────────────
  const drawPiano = useCallback(()=>{
    const canvas = pianoRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    const layout = layoutRef.current;
    const hovered = hoverMidi.current;

    // White keys
    for (const k of layout) {
      if (k.isBlack) continue;
      const on = k.midi === hovered || (playingRef.current && k.midi === hoverMidi.current);
      const col = LANE_COLORS[k.midi%12];
      const g = ctx.createLinearGradient(k.x,0,k.x,k.h);
      if (on){ g.addColorStop(0,col+"cc"); g.addColorStop(1,col+"55"); }
      else   { g.addColorStop(0,"#f8f6f2"); g.addColorStop(1,"#e0dcd6"); }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(k.x+1,0,k.w-2,k.h-2,[0,0,5,5]); ctx.fill();
      ctx.strokeStyle = on ? col : "rgba(0,0,0,0.12)"; ctx.lineWidth = on ? 1.5 : 1;
      ctx.beginPath(); ctx.roundRect(k.x+1,0,k.w-2,k.h-2,[0,0,5,5]); ctx.stroke();
      // Label
      if (k.w > 14){
        ctx.fillStyle = on ? "white" : "rgba(0,0,0,0.28)";
        ctx.font = `bold ${Math.min(10,k.w*0.32)}px 'IBM Plex Mono',monospace`;
        ctx.textAlign = "center";
        ctx.fillText(noteLabel(k.midi), k.x+k.w/2, k.h-5);
      }
      // Volume gradient overlay (Y axis = volume)
      if (on && playingRef.current){
        const vol = hoverVol.current;
        const og = ctx.createLinearGradient(k.x,0,k.x,k.h);
        og.addColorStop(0,"rgba(255,255,255,0.3)");
        og.addColorStop(vol,"rgba(255,255,255,0.0)");
        ctx.fillStyle = og;
        ctx.beginPath(); ctx.roundRect(k.x+1,0,k.w-2,k.h-2,[0,0,5,5]); ctx.fill();
      }
    }
    // Black keys
    for (const k of layout) {
      if (!k.isBlack) continue;
      const on = k.midi === hovered || (playingRef.current && k.midi === hoverMidi.current);
      const col = LANE_COLORS[k.midi%12];
      const g = ctx.createLinearGradient(k.x,0,k.x,k.h);
      if (on){ g.addColorStop(0,col); g.addColorStop(1,col+"88"); }
      else   { g.addColorStop(0,"#1a1a2e"); g.addColorStop(1,"#0a0a18"); }
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.roundRect(k.x,0,k.w,k.h,[0,0,3,3]); ctx.fill();
      if (on){
        ctx.strokeStyle = col; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.roundRect(k.x,0,k.w,k.h,[0,0,3,3]); ctx.stroke();
      }
      if (k.w > 8){
        ctx.fillStyle = on ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.3)";
        ctx.font = `${Math.min(7,k.w*0.45)}px 'IBM Plex Mono',monospace`;
        ctx.textAlign = "center";
        ctx.fillText(noteLabel(k.midi), k.x+k.w/2, k.h-4);
      }
    }
  },[]);

  // ── Draw spectrum canvas ───────────────────────────────────────────────────
  const drawSpectrum = useCallback(()=>{
    const canvas = specRef.current; if (!canvas) return;
    const ctx = canvas.getContext("2d"); if (!ctx) return;
    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0,0,W,H);
    ctx.fillStyle = "#0a0f1e"; ctx.fillRect(0,0,W,H);

    if (!analyserRef.current || !ctxRef.current){
      // Idle: draw flat line
      ctx.strokeStyle = "rgba(0,212,255,0.2)"; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(0,H/2); ctx.lineTo(W,H/2); ctx.stroke();
      return;
    }
    const analyser = analyserRef.current;
    const sr = ctxRef.current.sampleRate;
    const bufLen = analyser.frequencyBinCount;
    const freqData = new Uint8Array(bufLen);
    analyser.getByteFrequencyData(freqData);

    // Map each piano key to a bar
    const layout = layoutRef.current;
    for (const k of layout) {
      if (k.isBlack) continue; // only white key lanes for spectrum bars
      const freq = noteFreq(k.midi);
      const bin = Math.round(freq/(sr/2)*bufLen);
      let sum=0, cnt=0;
      for (let b=Math.max(0,bin-2); b<=Math.min(bufLen-1,bin+2); b++){ sum+=freqData[b]; cnt++; }
      const v = (cnt>0?sum/cnt:0)/255;
      if (v<0.01) continue;
      const col = LANE_COLORS[k.midi%12];
      const barH = v * H * 0.9;
      const g = ctx.createLinearGradient(k.x,H,k.x,H-barH);
      g.addColorStop(0,col+"cc"); g.addColorStop(0.7,col+"44"); g.addColorStop(1,col+"00");
      ctx.fillStyle = g;
      ctx.fillRect(k.x, H-barH, k.w, barH);
    }

    // Oscilloscope waveform overlay
    const timeData = new Uint8Array(bufLen);
    analyser.getByteTimeDomainData(timeData);
    ctx.strokeStyle = "rgba(0,212,255,0.7)"; ctx.lineWidth = 1.5;
    ctx.beginPath();
    const sliceW = W / bufLen;
    for (let i=0; i<bufLen; i++){
      const y = (timeData[i]/128 - 1) * H * 0.4 + H/2;
      if (i===0) ctx.moveTo(0,y); else ctx.lineTo(i*sliceW,y);
    }
    ctx.stroke();

    // Frequency label for hovered/active note
    const midi = hoverMidi.current;
    if (midi!==null){
      const freq = noteFreq(midi);
      const binX = (freq/(sr/2)) * W;
      ctx.strokeStyle = "rgba(236,72,153,0.8)"; ctx.lineWidth = 1;
      ctx.setLineDash([3,3]);
      ctx.beginPath(); ctx.moveTo(binX,0); ctx.lineTo(binX,H); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = "#ec4899";
      ctx.font = "bold 10px 'IBM Plex Mono',monospace";
      ctx.textAlign = binX > W*0.8 ? "right" : "left";
      ctx.fillText(`${noteLabel(midi)} ${Math.round(freq)}Hz`, binX+4, 14);
    }
  },[]);

  // ── Main rAF loop ──────────────────────────────────────────────────────────
  const loop = useCallback(()=>{
    drawSpectrum();
    drawPiano();
    rafRef.current = requestAnimationFrame(loop);
  },[drawSpectrum, drawPiano]);

  // ── Resize ────────────────────────────────────────────────────────────────
  const resize = useCallback(()=>{
    const dpr = window.devicePixelRatio||1;
    const setSize = (c:HTMLCanvasElement|null)=>{
      if (!c) return;
      const r = c.getBoundingClientRect();
      c.width = r.width*dpr; c.height = r.height*dpr;
      const ctx2 = c.getContext("2d"); if (ctx2) ctx2.scale(dpr,dpr);
    };
    setSize(pianoRef.current); setSize(specRef.current);
    const p = pianoRef.current;
    if (p) layoutRef.current = buildLayout(p.width/(window.devicePixelRatio||1), p.height/(window.devicePixelRatio||1));
  },[]);

  // ── Lifecycle ─────────────────────────────────────────────────────────────
  useEffect(()=>{
    resize();
    const ro = new ResizeObserver(resize);
    [pianoRef,specRef].forEach(r=>{ if (r.current) ro.observe(r.current); });
    rafRef.current = requestAnimationFrame(loop);
    return ()=>{ ro.disconnect(); cancelAnimationFrame(rafRef.current); };
  },[resize, loop]);

  // ─── JSX ──────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full" style={{background:"#0a0f1e",fontFamily:"'IBM Plex Mono',monospace"}}>
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-2 flex items-center justify-between"
        style={{borderBottom:"1px solid rgba(0,212,255,0.15)",background:"rgba(0,212,255,0.03)"}}>
        <div>
          <h1 className="text-sm font-bold" style={{color:"#00d4ff",letterSpacing:"0.1em"}}>
            CONTINUOUS PIANO
          </h1>
          <p className="text-xs" style={{color:"#8a9bb0",fontSize:9}}>
            Hover to preview · Click &amp; drag to play · Y-axis = volume
          </p>
        </div>
        {/* Note display */}
        <div className="flex items-center gap-4">
          {currentNote ? (
            <div className="text-center">
              <div className="text-xl font-bold" style={{color:"#ec4899",lineHeight:1}}>{currentNote}</div>
              <div className="text-xs" style={{color:"#8a9bb0",fontSize:9}}>{currentFreq} Hz</div>
            </div>
          ) : (
            <div className="text-xs" style={{color:"rgba(138,155,176,0.4)"}}>—</div>
          )}
          {/* Waveform selector */}
          <div className="flex items-center gap-1">
            <span className="text-xs" style={{color:"#8a9bb0",fontSize:9}}>WAVE</span>
            {WAVEFORMS.map(w=>(
              <button key={w} onClick={()=>changeWaveform(w)}
                className="px-2 py-0.5 rounded text-xs transition-all capitalize"
                style={{
                  fontSize:9,
                  background:waveform===w?"rgba(0,212,255,0.2)":"rgba(255,255,255,0.04)",
                  border:`1px solid ${waveform===w?"rgba(0,212,255,0.5)":"rgba(255,255,255,0.08)"}`,
                  color:waveform===w?"#00d4ff":"#8a9bb0",
                }}>
                {w}
              </button>
            ))}
          </div>
          {/* Glide */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs" style={{color:"#8a9bb0",fontSize:9}}>GLIDE</span>
            <input type="range" min={0} max={300} step={10} value={glideMs}
              onChange={e=>{ const v=Number(e.target.value); setGlideMs(v); glideMsRef.current=v; }}
              style={{width:56,accentColor:"#a855f7"}}
            />
            <span className="text-xs font-bold" style={{color:"#a855f7",fontSize:9,minWidth:28}}>{glideMs}ms</span>
          </div>
          {/* Reverb */}
          <button onClick={toggleReverb}
            className="px-2 py-0.5 rounded text-xs transition-all"
            style={{
              fontSize:9,
              background:reverb?"rgba(168,85,247,0.2)":"rgba(255,255,255,0.04)",
              border:`1px solid ${reverb?"rgba(168,85,247,0.5)":"rgba(255,255,255,0.08)"}`,
              color:reverb?"#a855f7":"#8a9bb0",
            }}>
            REVERB
          </button>
          {/* Synth output dB meter */}
          {audioReady&&(
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{color:"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace",fontSize:9}}>OUT</span>
              <div className="relative rounded overflow-hidden" style={{width:64,height:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)"}}>
                <div className="absolute inset-y-0 left-0 rounded transition-all"
                  style={{
                    width:`${Math.max(0,((dbLevel+60)/60)*100)}%`,
                    background: dbLevel > -6
                      ? "linear-gradient(90deg,#22c55e,#ef4444)"
                      : dbLevel > -18
                      ? "linear-gradient(90deg,#22c55e,#eab308)"
                      : "#22c55e",
                  }}/>
              </div>
              <span className="text-xs font-mono" style={{color:"#8a9bb0",fontSize:9,minWidth:28}}>{dbLevel.toFixed(0)} dB</span>
            </div>
          )}
          {/* MIC toggle */}
          <button onClick={toggleMic}
            className="px-2 py-0.5 rounded text-xs transition-all"
            style={{
              fontSize:9,
              background:micActive?"rgba(34,197,94,0.2)":"rgba(255,255,255,0.04)",
              border:`1px solid ${micActive?"rgba(34,197,94,0.5)":"rgba(255,255,255,0.08)"}`,
              color:micActive?"#22c55e":"#8a9bb0",
              fontFamily:"'IBM Plex Mono',monospace",
            }}>
            🎤 MIC{micActive?" ●":""}
          </button>
          {/* Mic input dB meter */}
          {micActive&&(
            <div className="flex items-center gap-1.5">
              <span className="text-xs" style={{color:"#8a9bb0",fontFamily:"'IBM Plex Mono',monospace",fontSize:9}}>IN</span>
              <div className="relative rounded overflow-hidden" style={{width:64,height:8,background:"rgba(255,255,255,0.06)",border:"1px solid rgba(255,255,255,0.08)"}}>
                <div className="absolute inset-y-0 left-0 rounded transition-all"
                  style={{
                    width:`${Math.max(0,((micDbLevel+60)/60)*100)}%`,
                    background: micDbLevel > -6
                      ? "linear-gradient(90deg,#22c55e,#ef4444)"
                      : micDbLevel > -18
                      ? "linear-gradient(90deg,#22c55e,#eab308)"
                      : "#22c55e",
                  }}/>
              </div>
              <span className="text-xs font-mono" style={{color:"#8a9bb0",fontSize:9,minWidth:28}}>{micDbLevel.toFixed(0)} dB</span>
            </div>
          )}
          {!audioReady&&(
            <span className="text-xs" style={{color:"rgba(236,72,153,0.6)",fontSize:9}}>
              Click piano to unlock audio
            </span>
          )}
        </div>
      </div>

      {/* DFT Spectrum */}
      <div className="flex-shrink-0" style={{height:120,borderBottom:"1px solid rgba(0,212,255,0.1)"}}>
        <canvas ref={specRef} className="w-full h-full" style={{display:"block"}} />
      </div>

      {/* Piano keyboard — fills remaining height */}
      <div className="flex-1 min-h-0" style={{background:"#0d1526",borderTop:"2px solid rgba(0,212,255,0.2)"}}>
        <canvas
          ref={pianoRef}
          className="w-full h-full"
          style={{display:"block", cursor: playingRef.current ? "crosshair" : "pointer"}}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
          onMouseMove={onMouseMove}
          onMouseLeave={onMouseLeave}
        />
      </div>

      {/* Footer hint */}
      <div className="flex-shrink-0 px-4 py-1 flex items-center justify-between"
        style={{borderTop:"1px solid rgba(255,255,255,0.04)",background:"rgba(0,0,0,0.2)"}}>
        <span className="text-xs" style={{color:"rgba(138,155,176,0.35)",fontSize:9}}>
          88 keys · A0 (27.5 Hz) → C8 (4186 Hz) · Equal temperament · A4 = 440 Hz
        </span>
        <span className="text-xs" style={{color:"rgba(138,155,176,0.35)",fontSize:9}}>
          Drag left/right to glide · Drag up for louder
        </span>
      </div>
    </div>
  );
}
