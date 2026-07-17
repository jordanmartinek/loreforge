import { useState } from "react";
import { Button } from "../ui/Button";

interface NotesPasteFormProps {
  onAnalyze: (text: string) => void;
}

/** The paste-in textarea + explicit "Analyze Notes" action (FR1.1/FR1.2).
 * Parsing is deliberately NOT triggered on every keystroke -- the user
 * pastes (or types) freely, then explicitly asks for analysis, so a long
 * paste doesn't cause the parser to re-run on every intermediate
 * character. */
export function NotesPasteForm({ onAnalyze }: NotesPasteFormProps) {
  const [text, setText] = useState("");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium uppercase tracking-wide text-[var(--color-text-tertiary)]">
          Paste your notes
        </label>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            "Paste free-form notes, an outline, or a chapter draft here…\n\n" +
            "Tip: a line like \"Character: Ada Voss\" or \"Location: New Geneva\" is detected with high confidence. " +
            "Ordinary prose (\"Ada Voss was born on a remote mining colony\") is also scanned for likely story elements."
          }
          rows={16}
          className="w-full rounded-md border border-[var(--color-border)] bg-[var(--color-bg-2)]
            px-3 py-2 text-sm text-[var(--color-text-primary)] placeholder:text-[var(--color-text-tertiary)]
            outline-none transition-colors focus:border-[var(--color-accent)]"
        />
      </div>

      <div className="flex items-center justify-between">
        <p className="text-xs text-[var(--color-text-tertiary)]">
          Parsing runs entirely on this device — nothing is sent anywhere.
        </p>
        <Button variant="primary" onClick={() => onAnalyze(text)} disabled={!text.trim()}>
          Analyze Notes
        </Button>
      </div>
    </div>
  );
}
