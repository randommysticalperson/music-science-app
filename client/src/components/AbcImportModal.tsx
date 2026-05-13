/**
 * AbcImportModal — paste a two-voice ABC notation string to create a custom duet.
 * Design: dark navy glass panel, IBM Plex Mono, cyan/purple accent.
 */
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { parseAbcDuet, ABC_EXAMPLE, type ParsedDuet } from "@/lib/abcParser";

interface AbcImportModalProps {
  open: boolean;
  onClose: () => void;
  onImport: (duet: ParsedDuet) => void;
}

export function AbcImportModal({ open, onClose, onImport }: AbcImportModalProps) {
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<ParsedDuet | null>(null);

  function handleParse() {
    setError(null);
    setPreview(null);
    try {
      if (!text.trim()) { setError("Please paste an ABC notation string."); return; }
      const duet = parseAbcDuet(text);
      if (duet.voice1.length === 0 && duet.voice2.length === 0) {
        setError("No notes found. Make sure the ABC string contains note data.");
        return;
      }
      setPreview(duet);
    } catch (e) {
      setError(`Parse error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  function handleImport() {
    if (!preview) return;
    onImport(preview);
    setText("");
    setPreview(null);
    setError(null);
    onClose();
  }

  function handleLoadExample() {
    setText(ABC_EXAMPLE);
    setError(null);
    setPreview(null);
  }

  const mono: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

  return (
    <Dialog open={open} onOpenChange={v => { if (!v) onClose(); }}>
      <DialogContent
        className="max-w-2xl"
        style={{
          background: "linear-gradient(135deg, rgba(10,18,40,0.98) 0%, rgba(15,25,55,0.98) 100%)",
          border: "1px solid rgba(0,212,255,0.25)",
          boxShadow: "0 0 40px rgba(0,212,255,0.08), 0 24px 64px rgba(0,0,0,0.6)",
          borderRadius: "12px",
          color: "#e2e8f0",
        }}
      >
        <DialogHeader>
          <DialogTitle style={{ ...mono, color: "#00d4ff", fontSize: "1rem", letterSpacing: "0.08em" }}>
            🎼 IMPORT ABC DUET
          </DialogTitle>
          <DialogDescription style={{ color: "#8a9bb0", fontSize: "0.75rem", ...mono }}>
            Paste a two-voice ABC notation string. Voice 1 = your part (highway), Voice 2 = AI accompaniment.
          </DialogDescription>
        </DialogHeader>

        {/* Textarea */}
        <div className="mt-2">
          <textarea
            value={text}
            onChange={e => { setText(e.target.value); setError(null); setPreview(null); }}
            rows={10}
            placeholder={`Paste ABC notation here…\n\nExample:\nX:1\nT:My Duet\nM:4/4\nL:1/4\nQ:100\nV:1\nE E F G | G F E D |\nV:2\nC,2 G,2 | C,2 G,2 |`}
            style={{
              width: "100%",
              background: "rgba(0,0,0,0.35)",
              border: "1px solid rgba(0,212,255,0.2)",
              borderRadius: "8px",
              color: "#e2e8f0",
              padding: "10px 12px",
              fontSize: "0.78rem",
              resize: "vertical",
              outline: "none",
              ...mono,
            }}
            onFocus={e => (e.target.style.borderColor = "rgba(0,212,255,0.55)")}
            onBlur={e => (e.target.style.borderColor = "rgba(0,212,255,0.2)")}
          />
        </div>

        {/* Error */}
        {error && (
          <div style={{
            background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.35)",
            borderRadius: "6px", padding: "8px 12px", color: "#f87171", fontSize: "0.75rem", ...mono,
          }}>
            ⚠ {error}
          </div>
        )}

        {/* Preview */}
        {preview && (
          <div style={{
            background: "rgba(0,212,255,0.06)", border: "1px solid rgba(0,212,255,0.25)",
            borderRadius: "8px", padding: "12px 14px",
          }}>
            <div style={{ color: "#00d4ff", fontSize: "0.75rem", marginBottom: "6px", ...mono }}>
              ✓ PARSED SUCCESSFULLY
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
              {[
                ["Title", preview.name],
                ["BPM", String(preview.bpm)],
                ["Voice 1 notes", String(preview.voice1.length)],
                ["Voice 2 notes", String(preview.voice2.length)],
                ["Duration", (() => {
                  const maxBeat = Math.max(
                    ...preview.voice1.map(n => n.beat + n.duration),
                    ...preview.voice2.map(n => n.beat + n.duration),
                    0
                  );
                  const secs = (maxBeat / preview.bpm) * 60;
                  return `${secs.toFixed(1)}s`;
                })()],
              ].map(([label, val]) => (
                <div key={label} style={{
                  background: "rgba(0,0,0,0.25)", borderRadius: "6px", padding: "6px 10px",
                }}>
                  <div style={{ color: "#8a9bb0", fontSize: "0.65rem", ...mono }}>{label}</div>
                  <div style={{ color: "#e2e8f0", fontSize: "0.82rem", fontWeight: 600, ...mono }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-2 mt-1 flex-wrap">
          <button
            onClick={handleLoadExample}
            style={{
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: "6px", padding: "6px 14px", color: "#8a9bb0", fontSize: "0.75rem",
              cursor: "pointer", ...mono,
            }}
          >
            Load Example
          </button>
          <button
            onClick={handleParse}
            disabled={!text.trim()}
            style={{
              background: text.trim() ? "rgba(0,212,255,0.15)" : "rgba(0,0,0,0.2)",
              border: `1px solid ${text.trim() ? "rgba(0,212,255,0.5)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "6px", padding: "6px 14px",
              color: text.trim() ? "#00d4ff" : "#4a5568",
              fontSize: "0.75rem", cursor: text.trim() ? "pointer" : "not-allowed", ...mono,
            }}
          >
            Parse
          </button>
          <button
            onClick={handleImport}
            disabled={!preview}
            style={{
              background: preview ? "rgba(168,85,247,0.2)" : "rgba(0,0,0,0.2)",
              border: `1px solid ${preview ? "rgba(168,85,247,0.6)" : "rgba(255,255,255,0.08)"}`,
              borderRadius: "6px", padding: "6px 18px",
              color: preview ? "#a855f7" : "#4a5568",
              fontSize: "0.75rem", fontWeight: 700,
              cursor: preview ? "pointer" : "not-allowed", ...mono,
            }}
          >
            🎹 Add to Duet List
          </button>
          <button
            onClick={onClose}
            style={{
              marginLeft: "auto", background: "transparent",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px",
              padding: "6px 14px", color: "#8a9bb0", fontSize: "0.75rem",
              cursor: "pointer", ...mono,
            }}
          >
            Cancel
          </button>
        </div>

        {/* ABC syntax hint */}
        <details style={{ marginTop: "4px" }}>
          <summary style={{ color: "#8a9bb0", fontSize: "0.7rem", cursor: "pointer", ...mono }}>
            ABC syntax quick reference ▸
          </summary>
          <div style={{
            background: "rgba(0,0,0,0.3)", borderRadius: "6px", padding: "10px 12px",
            marginTop: "6px", color: "#8a9bb0", fontSize: "0.68rem", lineHeight: "1.7", ...mono,
          }}>
            <b style={{ color: "#00d4ff" }}>Headers:</b> X: (index) · T: (title) · M: (meter) · L: (default length) · Q: (tempo BPM) · V: (voice)<br/>
            <b style={{ color: "#00d4ff" }}>Notes:</b> C D E F G A B (octave 4) · c d e f g a b (octave 5) · add <code>'</code> to go up, <code>,</code> to go down<br/>
            <b style={{ color: "#00d4ff" }}>Accidentals:</b> ^ (sharp) · _ (flat) · = (natural)<br/>
            <b style={{ color: "#00d4ff" }}>Durations:</b> C2 (double) · C/2 (half) · C3/4 (three-quarters) · z (rest)<br/>
            <b style={{ color: "#00d4ff" }}>Chords:</b> [CEG] (all notes sound together)<br/>
            <b style={{ color: "#00d4ff" }}>Bars:</b> | (bar line) · |: :| (repeat)<br/>
            <b style={{ color: "#00d4ff" }}>Voices:</b> V:1 (first voice) · V:2 (second voice) — each on its own line
          </div>
        </details>
      </DialogContent>
    </Dialog>
  );
}
