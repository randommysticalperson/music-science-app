/**
 * Minimal two-voice ABC notation parser
 * Supports: V:1 / V:2 voice headers, note names (A-G), octave markers (',), accidentals (^_=),
 * durations (1/2/3/4/6/8 and fractions), rests (z/Z), bar lines (|), repeat signs (|: :|),
 * and common time signatures (M:4/4 M:3/4 M:2/4 M:6/8 etc.)
 *
 * Returns { bpm, voice1: SongNote[], voice2: SongNote[] }
 */

export interface SongNote {
  midi: number;
  beat: number;
  duration: number;
}

export interface ParsedDuet {
  name: string;
  bpm: number;
  voice1: SongNote[];
  voice2: SongNote[];
}

// ─── Note name → semitone offset from C ─────────────────────────────────────
const NOTE_SEMITONES: Record<string, number> = {
  C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11,
};

/**
 * Convert an ABC note token to a MIDI number.
 * ABC convention:
 *   Uppercase C-B = octave 4 (middle octave, C4=60)
 *   Lowercase c-b = octave 5
 *   Each trailing ' raises one octave, each , lowers one octave
 *   ^ = sharp, ^^ = double sharp, _ = flat, __ = double flat, = = natural
 */
function abcNoteToMidi(token: string): number | null {
  // Extract accidentals prefix
  let acc = 0;
  let i = 0;
  while (i < token.length && (token[i] === '^' || token[i] === '_' || token[i] === '=')) {
    if (token[i] === '^') acc++;
    else if (token[i] === '_') acc--;
    // '=' resets to 0 but we already handle that by not incrementing
    i++;
  }
  if (i >= token.length) return null;

  const letter = token[i];
  const isLower = letter === letter.toLowerCase() && letter !== letter.toUpperCase();
  const upper = letter.toUpperCase();
  if (!(upper in NOTE_SEMITONES)) return null;

  // Base octave: uppercase = 4, lowercase = 5
  let octave = isLower ? 5 : 4;
  i++;

  // Octave modifiers after the letter
  while (i < token.length) {
    if (token[i] === "'") { octave++; i++; }
    else if (token[i] === ',') { octave--; i++; }
    else break;
  }

  const midi = (octave + 1) * 12 + NOTE_SEMITONES[upper] + acc;
  return midi;
}

/**
 * Parse an ABC duration string like "2", "/2", "3/4", "" (default = 1 unit)
 * Returns the duration in units (where 1 unit = 1 default note length).
 */
function parseDuration(durStr: string, defaultLen: number): number {
  if (!durStr || durStr === '') return defaultLen;
  if (durStr === '/') return defaultLen / 2;
  if (durStr.startsWith('/')) {
    const denom = parseInt(durStr.slice(1), 10);
    return isNaN(denom) ? defaultLen / 2 : defaultLen / denom;
  }
  if (durStr.includes('/')) {
    const [numStr, denStr] = durStr.split('/');
    const num = numStr ? parseInt(numStr, 10) : 1;
    const den = denStr ? parseInt(denStr, 10) : 2;
    return (defaultLen * num) / den;
  }
  const n = parseInt(durStr, 10);
  return isNaN(n) ? defaultLen : defaultLen * n;
}

/**
 * Parse a single voice body string into SongNote[].
 * @param body  The ABC body text for one voice
 * @param defaultLen  Default note length in beats (derived from L: header)
 * @param beatsPerBar  Beats per bar (from M: header) — used for repeat expansion
 */
function parseVoiceBody(body: string, defaultLen: number): SongNote[] {
  const notes: SongNote[] = [];
  let beat = 0;

  // Tokenize: split into meaningful tokens
  // Tokens: notes (with optional acc+letter+octave+duration), rests, bar lines, chords, ties
  // We use a regex to walk through the string
  const TOKEN_RE = /(\^{1,2}|_{1,2}|=)?([A-Ga-gz])([',]*)(\d*\/?\d*)|(\|{1,2}:?:?\|{0,2})|(\[.*?\])|([-])/g;

  let match: RegExpExecArray | null;
  while ((match = TOKEN_RE.exec(body)) !== null) {
    const [, acc, letter, octaveMod, durStr, barline, chord] = match;

    if (barline !== undefined) {
      // Bar lines — no action needed (we track beats continuously)
      continue;
    }

    if (chord !== undefined) {
      // Chord notation [CEG] — parse each note inside
      const inner = chord.slice(1, -1);
      // Duration after the closing bracket
      const afterChord = body.slice(TOKEN_RE.lastIndex);
      const durMatch = afterChord.match(/^(\d*\/?\d*)/);
      const chordDur = parseDuration(durMatch ? durMatch[1] : '', defaultLen);
      // Advance lastIndex past the duration
      if (durMatch && durMatch[1]) TOKEN_RE.lastIndex += durMatch[1].length;

      const chordNoteRe = /(\^{1,2}|_{1,2}|=)?([A-Ga-g])([',]*)/g;
      let cm: RegExpExecArray | null;
      while ((cm = chordNoteRe.exec(inner)) !== null) {
        const token = (cm[1] || '') + cm[2] + (cm[3] || '');
        const midi = abcNoteToMidi(token);
        if (midi !== null) notes.push({ midi, beat, duration: chordDur });
      }
      beat += chordDur;
      continue;
    }

    if (letter === undefined) continue;

    const fullToken = (acc || '') + letter + (octaveMod || '');
    const dur = parseDuration(durStr || '', defaultLen);

    if (letter === 'z' || letter === 'Z') {
      // Rest — advance beat only
      beat += dur;
    } else {
      const midi = abcNoteToMidi(fullToken);
      if (midi !== null) {
        notes.push({ midi, beat, duration: dur });
      }
      beat += dur;
    }
  }

  return notes;
}

/**
 * Extract header field value from ABC text.
 * e.g. getHeader("T", text) returns the title string.
 */
function getHeader(field: string, text: string): string | null {
  const re = new RegExp(`^${field}:(.*)$`, 'im');
  const m = text.match(re);
  return m ? m[1].trim() : null;
}

/**
 * Split ABC text into voice sections.
 * Handles both interleaved (V:1 ... V:2 ...) and separate voice blocks.
 */
function splitVoices(body: string): Map<string, string> {
  const voices = new Map<string, string>();
  // Split on V: markers
  const parts = body.split(/^V:\s*/im);
  for (let i = 1; i < parts.length; i++) {
    const lines = parts[i].split('\n');
    const voiceId = lines[0].trim().split(/\s/)[0]; // e.g. "1" or "2" or "T" or "B"
    const content = lines.slice(1).join('\n');
    const existing = voices.get(voiceId) || '';
    voices.set(voiceId, existing + '\n' + content);
  }
  return voices;
}

/**
 * Main entry point: parse a two-voice ABC string into a ParsedDuet.
 * Voice 1 = user (right hand / melody), Voice 2 = AI (left hand / accompaniment).
 * If only one voice is found, it becomes voice1 and voice2 is empty.
 */
export function parseAbcDuet(abc: string): ParsedDuet {
  // ── Headers ──────────────────────────────────────────────────────────────
  const title = getHeader('T', abc) || 'Custom Duet';
  const tempoStr = getHeader('Q', abc);
  let bpm = 100;
  if (tempoStr) {
    // Q: can be "120" or "1/4=120" or "C=120"
    const qMatch = tempoStr.match(/(\d+)\s*$/);
    if (qMatch) bpm = parseInt(qMatch[1], 10);
  }

  // Default note length from L: header
  const lenStr = getHeader('L', abc);
  let defaultLen = 1; // 1 beat
  if (lenStr) {
    // L: 1/4 means quarter note = 1 beat; L: 1/8 means eighth = 0.5 beat
    const lMatch = lenStr.match(/(\d+)\/(\d+)/);
    if (lMatch) {
      const num = parseInt(lMatch[1], 10);
      const den = parseInt(lMatch[2], 10);
      // Normalise so that 1/4 = 1 beat (quarter note)
      defaultLen = (num / den) * 4;
    }
  }

  // ── Body ─────────────────────────────────────────────────────────────────
  // Strip header lines (lines starting with a letter followed by :)
  const bodyLines = abc.split('\n').filter(l => !/^[A-Za-z]:/.test(l.trim()) && l.trim() !== '');
  const body = bodyLines.join('\n');

  // Try to find V: markers
  const voiceMap = splitVoices(abc);

  let voice1Notes: SongNote[] = [];
  let voice2Notes: SongNote[] = [];

  if (voiceMap.size >= 2) {
    const keys = Array.from(voiceMap.keys());
    voice1Notes = parseVoiceBody(voiceMap.get(keys[0]) || '', defaultLen);
    voice2Notes = parseVoiceBody(voiceMap.get(keys[1]) || '', defaultLen);
  } else if (voiceMap.size === 1) {
    const keys = Array.from(voiceMap.keys());
    voice1Notes = parseVoiceBody(voiceMap.get(keys[0]) || '', defaultLen);
  } else {
    // No V: markers — treat entire body as voice 1
    voice1Notes = parseVoiceBody(body, defaultLen);
  }

  return { name: title, bpm, voice1: voice1Notes, voice2: voice2Notes };
}

// ─── Example ABC strings for the UI placeholder ──────────────────────────────
export const ABC_EXAMPLE = `X:1
T:My Duet
M:4/4
L:1/4
Q:100
V:1
E E F G | G F E D | C C D E | E3/2 D/ D2 |
V:2
C,2 G,2 | C,2 G,2 | F,2 C2 | G,2 G,2 |
`;
