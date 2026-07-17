import { useEffect, useState } from "react";
import { CandidateReviewList } from "../components/notes-import/CandidateReviewList";
import { ImportSummary } from "../components/notes-import/ImportSummary";
import { NotesPasteForm } from "../components/notes-import/NotesPasteForm";
import { Button } from "../components/ui/Button";
import { useImportCandidates, useImportSelectedCandidates, type ReviewCandidate } from "../hooks/useNotesImport";

type Step = "paste" | "review" | "summary";

/** Orchestrates the linear paste -> review -> confirm -> summary workflow
 * (FR1-FR5) as a single page with local view-state, rather than multiple
 * routes -- this is fundamentally one workflow, not several independent
 * destinations, mirroring the two-pane-master-detail pages' spirit of
 * keeping one page's local state simple rather than introducing routing
 * for what a `useState` step machine already expresses clearly (design
 * doc section 4). */
export function NotesImportPage() {
  const [step, setStep] = useState<Step>("paste");
  const [analyzedText, setAnalyzedText] = useState("");
  const [candidates, setCandidates] = useState<ReviewCandidate[]>([]);

  const { candidates: parsedCandidates, isLoading: isLoadingExistingData } =
    useImportCandidates(analyzedText);
  const { importSelected, isImporting, results, reset } = useImportSelectedCandidates();

  const handleAnalyze = (text: string) => {
    setAnalyzedText(text);
    setStep("review");
  };

  // parsedCandidates recomputes from analyzedText via useMemo; seed the
  // editable review state from it exactly once per "Analyze Notes" click,
  // then let further edits (name/type/include-exclude) live in local
  // `candidates` state independent of the memoized parse result. Runs in
  // an effect (not directly in the render body) so seeding the state is
  // properly sequenced with React's render cycle rather than triggering a
  // same-render setState call.
  //
  // Deliberately waits for `!isLoadingExistingData` before seeding: the
  // duplicate flag (FR3.1) depends on the existing-entity list queries,
  // which resolve asynchronously. Seeding from `parsedCandidates` while
  // those queries are still loading would snapshot every candidate's
  // `isDuplicate` as a transient false-negative (every underlying name
  // set starts empty) into this component's own `candidates` state, which
  // then never reconciles once the real data arrives -- `candidates` is
  // intentionally independent of the memoized parse result after the
  // initial seed (so in-review edits aren't clobbered), so getting the
  // *timing* of that one seed right is what matters here.
  useEffect(() => {
    if (analyzedText && !isLoadingExistingData) {
      setCandidates(parsedCandidates);
    }
    // Only re-seed when a fresh "Analyze Notes" click changes
    // analyzedText, or when the loading gate clears -- in-review edits to
    // `candidates` must not be clobbered by parsedCandidates recomputing
    // for unrelated reasons once already seeded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analyzedText, isLoadingExistingData]);

  const handleConfirmImport = async () => {
    await importSelected(candidates);
    setStep("summary");
  };

  const handleStartOver = () => {
    reset();
    setAnalyzedText("");
    setCandidates([]);
    setStep("paste");
  };

  const includedCount = candidates.filter((c) => c.included).length;

  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-6 text-sm text-[var(--color-text-secondary)]">
        Paste notes, an outline, or a chapter draft below. LoreForge scans the text for
        likely Characters, Locations, Technology, Species, Military Units, Political
        Entities, Religions, Organizations, Canon Entries, and Timeline Events, and lets
        you review every candidate before anything is created.
      </p>

      {step === "paste" && <NotesPasteForm onAnalyze={handleAnalyze} />}

      {step === "review" && (
        <div className="flex flex-col gap-6">
          {isLoadingExistingData ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">
              Checking for existing entries…
            </p>
          ) : candidates.length === 0 ? (
            <p className="text-sm text-[var(--color-text-tertiary)]">
              No likely story elements were detected in that text. Try adding a
              structured marker line (e.g. "Character: Ada Voss") or going back and
              pasting different notes.
            </p>
          ) : (
            <CandidateReviewList candidates={candidates} onChange={setCandidates} />
          )}

          <div className="flex items-center justify-between border-t border-[var(--color-border-subtle)] pt-4">
            <Button variant="secondary" onClick={() => setStep("paste")}>
              Back
            </Button>
            <Button
              variant="primary"
              onClick={handleConfirmImport}
              disabled={includedCount === 0 || isImporting}
            >
              {isImporting ? "Importing…" : `Import ${includedCount} Selected`}
            </Button>
          </div>
        </div>
      )}

      {step === "summary" && results && (
        <ImportSummary results={results} onStartOver={handleStartOver} />
      )}
    </div>
  );
}
