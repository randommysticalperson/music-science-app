/**
 * LanguageContext.tsx — Bauhaus Frequency Design
 * Provides EN / 繁體中文 language toggle for the entire SoundLab app.
 */
import React, { createContext, useContext, useState, ReactNode } from "react";

export type Lang = "en" | "zh";

// ─── Translation Strings ──────────────────────────────────────────────────────

export const translations = {
  en: {
    // App / Sidebar
    appName: "SoundLab",
    appVersion: "v1.0",
    modules: "MODULES",
    overview: "Overview",
    musicTheory: "Music Theory",
    signalProcessing: "Signal Processing",
    acoustics: "Acoustics",
    sequencer: "Sequencer",
    viewSource: "View Source on GitHub",
    langToggle: "繁體中文",

    // Home page
    homeTag: "Interactive Science Platform",
    homeTitle: "The Science of Sound",
    homeSubtitle: "An interactive exploration of music theory, digital signal processing, and the physics of acoustic waves — from the mathematics of harmony to the mechanics of vibration.",
    homeStart: "Start Exploring",
    homePillarsTitle: "Three Pillars of Sound Science",
    homePillar1Title: "Music Theory",
    homePillar1Desc: "Explore scales, chords, intervals, and progressions. Play an interactive piano and visualize harmony through FFT spectrum analysis.",
    homePillar2Title: "Signal Processing",
    homePillar2Desc: "Visualize waveforms, analyze frequency spectra with FFT, and explore how digital filters shape sound in real time.",
    homePillar3Title: "Acoustics",
    homePillar3Desc: "Understand sound as a mechanical wave — frequency, wavelength, the Doppler effect, resonance, and the decibel scale.",
    homeSequencerTitle: "Sequencer",
    homeSequencerDesc: "Compose step sequences, export chord progressions as soundio/sequence JSON, and visualize any sequence on a piano roll.",
    homeFactsTitle: "Key Numbers",
    homeFact1: "A4 = 440 Hz",
    homeFact1Sub: "ISO 16 tuning standard",
    homeFact2: "12-TET",
    homeFact2Sub: "Equal temperament",
    homeFact3: "343 m/s",
    homeFact3Sub: "Speed of sound at 20°C",
    homeFact4: "20 Hz – 20 kHz",
    homeFact4Sub: "Human hearing range",

    // Music Theory page
    mtTitle: "Music Theory",
    mtSubtitle: "Interactive piano · Scales · Chords · Intervals · Progressions",
    mtRootNote: "Root Note",
    mtSustain: "SUSTAIN",
    mtSustainHint: "Hold Space for sustain",
    mtFftTitle: "Frequency Spectrum",
    mtFftToggle: "Show FFT",
    mtFftHideToggle: "Hide FFT",
    mtFftLive: "LIVE",
    mtFftStatic: "STATIC",
    mtRefTable: "Frequency Reference Table",
    mtRefNote: "Note",
    mtRefInterval: "Interval",
    mtRefAbbr: "Abbr.",
    mtRefMidi: "MIDI",
    mtRefFreq: "Freq (Hz)",
    mtRefWave: "λ (cm)",
    mtRefRatio: "Ratio",
    mtRefConsonance: "Consonance",
    mtTabScales: "Scales",
    mtTabChords: "Chords",
    mtTabIntervals: "Intervals",
    mtTabProgressions: "Progressions",
    mtPlayScale: "Play Scale",
    mtPlayChord: "Play Chord",
    mtPlayInterval: "Play Interval",
    mtSendToSeq: "→ Send to Sequencer",
    mtKeyboardHint: "Keyboard: Z–M (Oct 4) · Q–U (Oct 5) · I–P (Oct 6)",

    // Signal Processing page
    spTitle: "Signal Processing",
    spSubtitle: "Waveform oscilloscope · FFT spectrum · Filter explorer",
    spOscTitle: "Oscilloscope",
    spFftTitle: "FFT Spectrum Analyzer",
    spFilterTitle: "Filter Explorer",
    spFrequency: "Frequency",
    spAmplitude: "Amplitude",
    spWaveform: "Waveform",
    spSine: "Sine",
    spSquare: "Square",
    spSawtooth: "Sawtooth",
    spTriangle: "Triangle",
    spAdditive: "Additive",
    spFilterType: "Filter Type",
    spLowpass: "Low-pass",
    spHighpass: "High-pass",
    spBandpass: "Band-pass",
    spNotch: "Notch",
    spCutoff: "Cutoff",
    spResonance: "Resonance",
    spTheoryTitle: "Signal Theory Reference",

    // Acoustics page
    acTitle: "Acoustics",
    acSubtitle: "Mechanical waves · Doppler effect · Resonance · Decibel scale",
    acWaveTitle: "Wave Simulation",
    acLongitudinal: "Longitudinal",
    acTransverse: "Transverse",
    acFrequency: "Frequency (Hz)",
    acAmplitude: "Amplitude",
    acDopplerTitle: "Doppler Effect Calculator",
    acSourceSpeed: "Source Speed (m/s)",
    acObserverSpeed: "Observer Speed (m/s)",
    acSourceFreq: "Source Frequency (Hz)",
    acApproaching: "Approaching",
    acReceding: "Receding",
    acObservedFreq: "Observed Frequency",
    acResonanceTitle: "String Resonance",
    acStringLength: "String Length (m)",
    acTension: "Tension (N)",
    acLinearDensity: "Linear Density (kg/m)",
    acFundamental: "Fundamental",
    acHarmonics: "Harmonics",
    acDbTitle: "Decibel Scale Reference",
    acSpeedTitle: "Speed of Sound in Various Media",
    acHistoryTitle: "History of Acoustics",

    // Sequencer page
    seqTitle: "Sequencer",
    seqSubtitle: "soundio/sequence format · Composer · Exporter · Visualizer",
    seqTabComposer: "Composer",
    seqTabExporter: "Progression Exporter",
    seqTabVisualizer: "Visualizer",
    seqPlay: "Play",
    seqStop: "Stop",
    seqClear: "Clear",
    seqRandomize: "Randomize",
    seqBpm: "BPM",
    seqWaveform: "Waveform",
    seqExportJson: "Export JSON",
    seqDownload: "Download",
    seqLoadDemo: "Load Demo",
    seqImportXml: "↑ Import MusicXML",
    seqPasteHint: "Paste soundio/sequence JSON",
    seqPianoRoll: "Piano Roll",
    seqEventTable: "Event Table",
    seqBeat: "Beat",
    seqType: "Type",
    seqParams: "Parameters",
    seqSpecRef: "Spec Reference",
    seqComposer: "Composer",
    seqExporter: "Progression Exporter",
    seqVisualizer: "Visualizer",
    seqComposerDesc: "Piano roll → sequence JSON",
    seqExporterDesc: "Chord progression → sequence JSON",
    seqVisualizerDesc: "Paste JSON → piano roll",
    seqSubtitleSuffix: "a minimal, interoperable structure for timed musical events aligned with the Web Audio API, MIDI 1.0, and OSC.",
  },

  zh: {
    // App / Sidebar
    appName: "聲音實驗室",
    appVersion: "v1.0",
    modules: "模組",
    overview: "總覽",
    musicTheory: "樂理",
    signalProcessing: "訊號處理",
    acoustics: "聲學",
    sequencer: "音序器",
    viewSource: "在 GitHub 上查看原始碼",
    langToggle: "English",

    // Home page
    homeTag: "互動科學平台",
    homeTitle: "聲音的科學",
    homeSubtitle: "從和聲的數學到振動的力學，互動探索樂理、數位訊號處理與聲學物理。",
    homeStart: "開始探索",
    homePillarsTitle: "聲音科學三大支柱",
    homePillar1Title: "樂理",
    homePillar1Desc: "探索音階、和弦、音程與和聲進行。彈奏互動鋼琴，並透過 FFT 頻譜分析視覺化和聲結構。",
    homePillar2Title: "訊號處理",
    homePillar2Desc: "視覺化波形、以 FFT 分析頻譜，並即時探索數位濾波器如何塑造聲音。",
    homePillar3Title: "聲學",
    homePillar3Desc: "將聲音理解為機械波——頻率、波長、都卜勒效應、共振與分貝刻度。",
    homeSequencerTitle: "音序器",
    homeSequencerDesc: "編寫步進音序、將和弦進行匯出為 soundio/sequence JSON，並在鋼琴捲軸上視覺化任何音序。",
    homeFactsTitle: "關鍵數值",
    homeFact1: "A4 = 440 Hz",
    homeFact1Sub: "ISO 16 調音標準",
    homeFact2: "十二平均律",
    homeFact2Sub: "等程律",
    homeFact3: "343 公尺/秒",
    homeFact3Sub: "20°C 時的聲速",
    homeFact4: "20 Hz – 20 kHz",
    homeFact4Sub: "人類聽覺範圍",

    // Music Theory page
    mtTitle: "樂理",
    mtSubtitle: "互動鋼琴 · 音階 · 和弦 · 音程 · 和聲進行",
    mtRootNote: "根音",
    mtSustain: "延音",
    mtSustainHint: "按住空白鍵延音",
    mtFftTitle: "頻率頻譜",
    mtFftToggle: "顯示 FFT",
    mtFftHideToggle: "隱藏 FFT",
    mtFftLive: "即時",
    mtFftStatic: "靜態",
    mtRefTable: "頻率參考表",
    mtRefNote: "音符",
    mtRefInterval: "音程",
    mtRefAbbr: "縮寫",
    mtRefMidi: "MIDI",
    mtRefFreq: "頻率 (Hz)",
    mtRefWave: "波長 (cm)",
    mtRefRatio: "比例",
    mtRefConsonance: "協和性",
    mtTabScales: "音階",
    mtTabChords: "和弦",
    mtTabIntervals: "音程",
    mtTabProgressions: "和聲進行",
    mtPlayScale: "播放音階",
    mtPlayChord: "播放和弦",
    mtPlayInterval: "播放音程",
    mtSendToSeq: "→ 傳送至音序器",
    mtKeyboardHint: "鍵盤：Z–M（第4八度）· Q–U（第5八度）· I–P（第6八度）",

    // Signal Processing page
    spTitle: "訊號處理",
    spSubtitle: "波形示波器 · FFT 頻譜 · 濾波器探索",
    spOscTitle: "示波器",
    spFftTitle: "FFT 頻譜分析儀",
    spFilterTitle: "濾波器探索",
    spFrequency: "頻率",
    spAmplitude: "振幅",
    spWaveform: "波形",
    spSine: "正弦波",
    spSquare: "方波",
    spSawtooth: "鋸齒波",
    spTriangle: "三角波",
    spAdditive: "加法合成",
    spFilterType: "濾波器類型",
    spLowpass: "低通",
    spHighpass: "高通",
    spBandpass: "帶通",
    spNotch: "陷波",
    spCutoff: "截止頻率",
    spResonance: "共振",
    spTheoryTitle: "訊號理論參考",

    // Acoustics page
    acTitle: "聲學",
    acSubtitle: "機械波 · 都卜勒效應 · 共振 · 分貝刻度",
    acWaveTitle: "波動模擬",
    acLongitudinal: "縱波",
    acTransverse: "橫波",
    acFrequency: "頻率 (Hz)",
    acAmplitude: "振幅",
    acDopplerTitle: "都卜勒效應計算機",
    acSourceSpeed: "聲源速度 (公尺/秒)",
    acObserverSpeed: "觀測者速度 (公尺/秒)",
    acSourceFreq: "聲源頻率 (Hz)",
    acApproaching: "靠近",
    acReceding: "遠離",
    acObservedFreq: "觀測頻率",
    acResonanceTitle: "弦的共振",
    acStringLength: "弦長 (公尺)",
    acTension: "張力 (牛頓)",
    acLinearDensity: "線密度 (公斤/公尺)",
    acFundamental: "基頻",
    acHarmonics: "諧波",
    acDbTitle: "分貝刻度參考",
    acSpeedTitle: "聲音在各介質中的速度",
    acHistoryTitle: "聲學發展史",

    // Sequencer page
    seqTitle: "音序器",
    seqSubtitle: "soundio/sequence 格式 · 作曲 · 匯出 · 視覺化",
    seqTabComposer: "作曲器",
    seqTabExporter: "和聲進行匯出",
    seqTabVisualizer: "視覺化",
    seqPlay: "播放",
    seqStop: "停止",
    seqClear: "清除",
    seqRandomize: "隨機",
    seqBpm: "每分鐘拍數",
    seqWaveform: "波形",
    seqExportJson: "匯出 JSON",
    seqDownload: "下載",
    seqLoadDemo: "載入範例",
    seqImportXml: "↑ 匯入 MusicXML",
    seqPasteHint: "貼上 soundio/sequence JSON",
    seqPianoRoll: "鋼琴捲軸",
    seqEventTable: "事件表",
    seqBeat: "拍",
    seqType: "類型",
    seqParams: "參數",
    seqSpecRef: "規格參考",
    seqComposer: "作曲器",
    seqExporter: "和聲進行匯出",
    seqVisualizer: "視覺化",
    seqComposerDesc: "鋼琴捲軸 → 音序 JSON",
    seqExporterDesc: "和弦進行 → 音序 JSON",
    seqVisualizerDesc: "貼上 JSON → 鋼琴捲軸",
    seqSubtitleSuffix: "一種與 Web Audio API、MIDI 1.0 及 OSC 對齊的最小化、可互通音樂事件結構。",
  },
} as const;

export type TranslationKey = keyof typeof translations.en;

// ─── Context ──────────────────────────────────────────────────────────────────

interface LanguageContextType {
  lang: Lang;
  toggleLang: () => void;
  t: (key: TranslationKey) => string;
}

const LanguageContext = createContext<LanguageContextType>({
  lang: "en",
  toggleLang: () => {},
  t: (key) => translations.en[key],
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try {
      return (localStorage.getItem("soundlab-lang") as Lang) ?? "en";
    } catch {
      return "en";
    }
  });

  const toggleLang = () => {
    setLang((prev) => {
      const next: Lang = prev === "en" ? "zh" : "en";
      try { localStorage.setItem("soundlab-lang", next); } catch {}
      return next;
    });
  };

  const t = (key: TranslationKey): string => translations[lang][key] as string;

  return (
    <LanguageContext.Provider value={{ lang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLang() {
  return useContext(LanguageContext);
}
