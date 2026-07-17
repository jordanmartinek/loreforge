// Phase 11: Notes Import — heuristic, fully local, pattern-based parser.
// Pure function: same input text always produces the same candidate list,
// with zero network calls and zero randomness (NFR2/NFR3, FR2.5). See
// design-phase-11-notes-import.md section 1 for the full design rationale,
// including why this is heuristic rather than LLM-based (this app has been
// strictly offline-first through every prior phase) and why confidence is
// a two-tier label rather than a numeric score (section 3).

export type EntityTypeKey =
  | "character"
  | "location"
  | "technology"
  | "species"
  | "military"
  | "politics"
  | "religion"
  | "organization"
  | "canon"
  | "event";

export const ENTITY_TYPE_KEYS: EntityTypeKey[] = [
  "character",
  "location",
  "technology",
  "species",
  "military",
  "politics",
  "religion",
  "organization",
  "canon",
  "event",
];

export const ENTITY_TYPE_LABELS: Record<EntityTypeKey, string> = {
  character: "Character",
  location: "Location",
  technology: "Technology",
  species: "Species",
  military: "Military Unit",
  politics: "Political Entity",
  religion: "Religion",
  organization: "Organization",
  canon: "Canon Entry",
  event: "Event",
};

export type ConfidenceTier = "structured" | "keyword";

export interface ImportCandidate {
  /** Stable within one parse run only -- used for React keys and to apply
   * in-review edits back to the right candidate (design doc section 1.1). */
  id: string;
  entityType: EntityTypeKey;
  name: string;
  confidence: ConfidenceTier;
  /** The source line/sentence this candidate was extracted from, so the
   * user can judge a low-confidence guess against the original text
   * (FR2.4). */
  snippet: string;
  /** Best-effort guess at the entity type's classification/category field
   * (e.g. TECHNOLOGY_CATEGORIES), scoped to that type's fixed vocabulary.
   * Left undefined when no keyword match is found -- the per-type create
   * API already defaults an unset classification to "other" (section
   * 1.3), so an undefined guess here is not a gap this parser needs to
   * fill. */
  classification?: string;
}

// ---------------------------------------------------------------------
// Pass 1: structured markers (design doc section 1.2)
// ---------------------------------------------------------------------

const STRUCTURED_MARKER_KEYWORDS: Record<EntityTypeKey, string[]> = {
  character: ["character"],
  location: ["location", "place"],
  technology: ["technology", "tech"],
  species: ["species", "race"],
  military: ["military unit", "unit", "military"],
  politics: ["political entity", "faction", "government"],
  religion: ["religion", "faith"],
  organization: ["organization", "org", "guild"],
  canon: ["canon entry", "canon"],
  event: ["event"],
};

// Longer/more-specific keywords must be tried before shorter ones that are
// substrings of them (e.g. "military unit" before "unit", "canon entry"
// before "canon") so a line like "Military Unit: 3rd Battalion" is
// classified by the more specific marker, not accidentally split. Building
// one ordered list of (keyword, entityType) pairs up front, sorted longest
// first, keeps this correct regardless of the object literal's own key
// order above.
const ORDERED_MARKERS: { keyword: string; entityType: EntityTypeKey }[] = ENTITY_TYPE_KEYS.flatMap(
  (entityType) =>
    STRUCTURED_MARKER_KEYWORDS[entityType].map((keyword) => ({ keyword, entityType })),
).sort((a, b) => b.keyword.length - a.keyword.length);

// Matches lines like:
//   "Character: Ada Voss"
//   "Character - Ada Voss"
//   "## Character: Ada Voss"
//   "[Location] New Geneva"
//   "Location — New Geneva"
// Leading markdown heading markers (#, ##, ...) and bracket/asterisk
// decoration are stripped before matching; the marker keyword itself is
// matched case-insensitively.
function tryMatchStructuredMarker(
  rawLine: string,
): { entityType: EntityTypeKey; name: string } | null {
  const line = rawLine.trim().replace(/^#+\s*/, "");
  if (!line) return null;

  for (const { keyword, entityType } of ORDERED_MARKERS) {
    // "[Location] New Geneva" style.
    const bracketPattern = new RegExp(`^\\[\\s*${escapeRegExp(keyword)}\\s*\\]\\s*(.+)$`, "i");
    const bracketMatch = line.match(bracketPattern);
    if (bracketMatch) {
      const name = cleanCandidateName(bracketMatch[1]);
      if (name) return { entityType, name };
    }

    // "Location: New Geneva" / "Location - New Geneva" / "Location — New Geneva" style.
    const separatorPattern = new RegExp(`^${escapeRegExp(keyword)}\\s*[:\\-—]\\s*(.+)$`, "i");
    const separatorMatch = line.match(separatorPattern);
    if (separatorMatch) {
      const name = cleanCandidateName(separatorMatch[1]);
      if (name) return { entityType, name };
    }
  }

  return null;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function cleanCandidateName(raw: string): string {
  return raw
    .trim()
    .replace(/^[*_"'`]+/, "")
    .replace(/[*_"'`.,;]+$/, "")
    .trim();
}

// ---------------------------------------------------------------------
// Pass 2: keyword-proximity fallback (design doc section 1.3)
// ---------------------------------------------------------------------

const PROXIMITY_KEYWORDS: Record<EntityTypeKey, string[]> = {
  character: ["he", "she", "they", "said", "character", "protagonist", "was born", "named"],
  location: ["city", "planet", "station", "building", "located", "region", "world", "colony"],
  technology: ["technology", "device", "weapon", "ship", "drive", "invented", "powered by"],
  species: ["species", "race", "alien", "creature", "sentient", "breed"],
  military: ["battalion", "fleet", "army", "navy", "unit", "squadron", "soldiers", "commanded"],
  politics: ["government", "party", "faction", "alliance", "ruled", "elected", "senate"],
  religion: ["religion", "faith", "cult", "worship", "deity", "temple", "believers"],
  organization: ["guild", "corporation", "syndicate", "society", "company", "founded"],
  canon: ["canon", "established", "official", "retconned"],
  event: ["battle", "war", "treaty", "founding", "occurred", "happened", "year"],
};

// Best-effort classification guessing, scoped to each type's own fixed
// vocabulary constants (mirrors TECHNOLOGY_CATEGORIES, SPECIES_
// CLASSIFICATIONS, etc. in lib/types.ts). Deliberately duplicated here in
// string-literal form rather than imported, so this parser module has no
// dependency on lib/types.ts's const arrays drifting independently of this
// file -- see notesParser.test.ts for a cross-check test that keeps them in
// sync in practice.
const CLASSIFICATION_KEYWORDS: Partial<Record<EntityTypeKey, Record<string, string[]>>> = {
  technology: {
    ships: ["ship", "starship", "vessel"],
    weapons: ["weapon", "rifle", "cannon", "gun"],
    power_systems: ["reactor", "power system", "generator"],
    communications: ["comm", "communication", "radio"],
    medical: ["medical", "medicine", "healing"],
    artificial_intelligence: ["ai", "artificial intelligence", "android"],
    void_technology: ["void", "warp", "hyperspace"],
    military_doctrine: ["doctrine", "tactics"],
  },
  species: {
    sentient_humanoid: ["humanoid"],
    sentient_non_humanoid: ["non-humanoid", "alien species"],
    non_sentient_fauna: ["fauna", "animal", "creature"],
    non_sentient_flora: ["flora", "plant"],
    synthetic: ["synthetic", "artificial species", "android species"],
    hybrid: ["hybrid"],
  },
  military: {
    army: ["army"],
    navy: ["navy", "fleet"],
    air_force: ["air force"],
    space_force: ["space force"],
    marines: ["marines"],
    special_forces: ["special forces", "commando"],
    militia: ["militia"],
  },
  politics: {
    government: ["government"],
    political_party: ["party"],
    faction: ["faction"],
    alliance: ["alliance"],
    guild: ["guild"],
  },
  religion: {
    organized_religion: ["organized religion", "church"],
    folk_tradition: ["folk tradition", "folk religion"],
    cult: ["cult"],
    philosophy: ["philosophy"],
    pantheon_cult: ["pantheon"],
  },
  organization: {
    guild: ["guild"],
    corporation: ["corporation", "company"],
    syndicate: ["syndicate"],
    secret_society: ["secret society"],
    trade_association: ["trade association"],
    criminal_enterprise: ["criminal", "smuggling ring"],
  },
};

// Sequences of 1-4 Titlecase words, optionally preceded by an ordinal
// number ("3rd", "1st") to support the common "3rd Battalion" / "1st
// Fleet" military/organization naming convention. A single-word match is
// only accepted mid-sentence (not sentence-initial) to avoid treating
// every ordinary sentence-initial word as a candidate; a multi-word
// Titlecase run is accepted anywhere, since "The Ashenford Trading Guild"
// is a much stronger signal than any single capitalized word -- though a
// leading filler word like "The" is stripped back out afterward (see
// stripLeadingFillerWords below), since it's common English grammar, not
// part of the proper noun itself.
const PROPER_NOUN_PATTERN =
  /\b(?:\d+(?:st|nd|rd|th)\s+)?(?:[A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3}|[A-Z][a-z]+)\b/g;

// Leading words that are common English sentence-starters/fillers rather
// than part of a proper noun, even when capitalized (e.g. "The Rail
// Rifle" -> "Rail Rifle"). Reuses the same word list as the
// sentence-initial gate below, since both problems are "a capitalized
// filler word looks like part of a name" -- just applied at different
// positions within a multi-word match.
function stripLeadingFillerWords(text: string): string {
  const words = text.split(/\s+/);
  while (words.length > 1 && SENTENCE_INITIAL_STOPWORDS.has(words[0].toLowerCase())) {
    words.shift();
  }
  return words.join(" ");
}

const SENTENCE_INITIAL_STOPWORDS = new Set([
  "the",
  "a",
  "an",
  "this",
  "that",
  "these",
  "those",
  "it",
  "he",
  "she",
  "they",
  "we",
  "i",
  "in",
  "on",
  "at",
  "as",
  "when",
  "while",
  "after",
  "before",
]);

interface ProperNounMatch {
  text: string;
  sentence: string;
  isSentenceInitial: boolean;
}

function findProperNouns(sentence: string): ProperNounMatch[] {
  const matches: ProperNounMatch[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(PROPER_NOUN_PATTERN);

  while ((match = pattern.exec(sentence)) !== null) {
    const rawText = match[0];
    const isSentenceInitial = match.index === 0 || /^\s*$/.test(sentence.slice(0, match.index));

    // A multi-word match starting with a common sentence-initial filler
    // word ("The Rail Rifle", "The Elari") has that filler stripped back
    // out before it's treated as a candidate name -- it's ordinary English
    // grammar, not part of the proper noun.
    const text = stripLeadingFillerWords(rawText);
    if (!text) continue;

    const isMultiWord = text.includes(" ");

    if (!isMultiWord && isSentenceInitial) {
      // A lone sentence-initial capitalized word is too weak a signal on
      // its own (it's just as likely an ordinary sentence start) unless
      // it's a word we wouldn't expect to start a sentence naturally --
      // skip common sentence-initial words, keep the rest as low-signal
      // matches (still gated by needing a nearby keyword below).
      if (SENTENCE_INITIAL_STOPWORDS.has(text.toLowerCase())) continue;
    }

    matches.push({ text, sentence, isSentenceInitial });
  }

  return matches;
}

function splitIntoSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Whole-word/whole-phrase keyword matching. Using plain substring
 * `.includes()` here would be a real bug, not just an edge case: short
 * keywords like "he" or "a" match as substrings *inside* unrelated words
 * ("t-he" inside "The", "a" inside almost anything), producing false
 * positives on nearly every sentence. A `\b`-anchored regex per keyword
 * avoids this; keywords containing spaces (multi-word phrases like "was
 * born") still match correctly since `\b` anchors on the phrase's outer
 * edges, not on the internal space. */
function sentenceContainsKeyword(sentence: string, keywords: string[]): boolean {
  return keywords.some((kw) => new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i").test(sentence));
}

/** Guesses a classification from `sentence`'s surrounding context,
 * deliberately excluding `candidateName` itself from the search text
 * first -- otherwise a name that happens to contain a category keyword as
 * a substring (e.g. "Rail Rifle" containing "rifle", one of the
 * `weapons` keywords) would be "classified" from its own name rather than
 * from genuine surrounding context, which isn't the keyword-proximity
 * signal this function is meant to capture. */
function guessClassification(
  sentence: string,
  candidateName: string,
  entityType: EntityTypeKey,
): string | undefined {
  const table = CLASSIFICATION_KEYWORDS[entityType];
  if (!table) return undefined;
  const withoutName = sentence.split(candidateName).join(" ");
  // Whole-word matching here too (see sentenceContainsKeyword's comment) --
  // otherwise short keywords like "ai" (artificial_intelligence) would
  // false-positive as a substring of ordinary words like "said" or
  // "captain".
  for (const [classification, keywords] of Object.entries(table)) {
    if (keywords.some((kw) => new RegExp(`\\b${escapeRegExp(kw)}\\b`, "i").test(withoutName))) {
      return classification;
    }
  }
  return undefined;
}

function runKeywordProximityPass(text: string): ImportCandidate[] {
  const candidates: ImportCandidate[] = [];
  const sentences = splitIntoSentences(text);

  for (const sentence of sentences) {
    const properNouns = findProperNouns(sentence);
    if (properNouns.length === 0) continue;

    for (const entityType of ENTITY_TYPE_KEYS) {
      const keywords = PROXIMITY_KEYWORDS[entityType];
      if (!sentenceContainsKeyword(sentence, keywords)) continue;

      for (const noun of properNouns) {
        candidates.push({
          id: makeCandidateId(),
          entityType,
          name: noun.text,
          confidence: "keyword",
          snippet: sentence,
          classification: guessClassification(sentence, noun.text, entityType),
        });
      }
    }
  }

  return candidates;
}

// ---------------------------------------------------------------------
// Structured-marker pass driver
// ---------------------------------------------------------------------

function runStructuredMarkerPass(text: string): { candidates: ImportCandidate[]; matchedLines: Set<string> } {
  const candidates: ImportCandidate[] = [];
  const matchedLines = new Set<string>();

  for (const rawLine of text.split("\n")) {
    const match = tryMatchStructuredMarker(rawLine);
    if (!match) continue;
    matchedLines.add(rawLine);
    candidates.push({
      id: makeCandidateId(),
      entityType: match.entityType,
      name: match.name,
      confidence: "structured",
      snippet: rawLine.trim(),
      classification: guessClassification(rawLine, match.name, match.entityType),
    });
  }

  return { candidates, matchedLines };
}

// ---------------------------------------------------------------------
// Deduplication (design doc section 1.4)
// ---------------------------------------------------------------------

function dedupeCandidates(candidates: ImportCandidate[]): ImportCandidate[] {
  const byKey = new Map<string, ImportCandidate>();

  for (const candidate of candidates) {
    const key = `${candidate.entityType}::${candidate.name.toLowerCase()}`;
    const existing = byKey.get(key);
    if (!existing) {
      byKey.set(key, candidate);
      continue;
    }
    // structured beats keyword; otherwise keep the first-encountered
    // (FR2.6) -- do nothing, existing already holds the first one.
    if (existing.confidence === "keyword" && candidate.confidence === "structured") {
      byKey.set(key, { ...candidate, classification: existing.classification ?? candidate.classification });
    } else if (existing.confidence === candidate.confidence && !existing.classification && candidate.classification) {
      // Same confidence tier, and a later duplicate happened to guess a
      // classification the first one didn't -- keep the first one's
      // snippet/id but adopt the classification guess rather than losing
      // it silently.
      byKey.set(key, { ...existing, classification: candidate.classification });
    }
  }

  return Array.from(byKey.values());
}

let candidateCounter = 0;
function makeCandidateId(): string {
  candidateCounter += 1;
  return `candidate-${candidateCounter}`;
}

// ---------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------

/** Parses free-form pasted text into a deduplicated list of import
 * candidates across all 10 entity types. Pure and deterministic (NFR2/
 * NFR3/FR2.5): calling this twice with the same `text` always returns
 * candidates with the same (entityType, name, confidence, snippet,
 * classification) content -- only the `id` field's numeric suffix is not
 * guaranteed stable across two separate calls, since `id` only needs to
 * be stable *within* one parse run (see the `ImportCandidate.id` doc
 * comment). */
export function parseNotes(text: string): ImportCandidate[] {
  if (!text.trim()) return [];

  const { candidates: structuredCandidates, matchedLines } = runStructuredMarkerPass(text);

  // Pass 2 runs over the whole text, but lines that already matched a
  // structured marker are excluded first -- an explicit marker is
  // unambiguous, so there's no reason to also guess at it via keyword
  // proximity (design doc section 1.2).
  const remainingText = text
    .split("\n")
    .filter((line) => !matchedLines.has(line))
    .join("\n");
  const keywordCandidates = runKeywordProximityPass(remainingText);

  return dedupeCandidates([...structuredCandidates, ...keywordCandidates]);
}
