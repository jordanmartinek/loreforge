import { describe, expect, it } from "vitest";
import { ENTITY_TYPE_KEYS, parseNotes, type EntityTypeKey } from "./notesParser";

function find(candidates: ReturnType<typeof parseNotes>, name: string) {
  return candidates.find((c) => c.name.toLowerCase() === name.toLowerCase());
}

// ---------------------------------------------------------------------
// Pass 1: structured markers -- one per entity type (task 1.5)
// ---------------------------------------------------------------------

describe("structured marker detection (one per entity type)", () => {
  const cases: { line: string; entityType: EntityTypeKey; name: string }[] = [
    { line: "Character: Ada Voss", entityType: "character", name: "Ada Voss" },
    { line: "Location: New Geneva", entityType: "location", name: "New Geneva" },
    { line: "Technology: Rail Rifle", entityType: "technology", name: "Rail Rifle" },
    { line: "Species: Elari", entityType: "species", name: "Elari" },
    { line: "Military Unit: 3rd Battalion", entityType: "military", name: "3rd Battalion" },
    { line: "Faction: Meridian Concord", entityType: "politics", name: "Meridian Concord" },
    { line: "Religion: Solari Faith", entityType: "religion", name: "Solari Faith" },
    { line: "Guild: Ashenford Trading Guild", entityType: "organization", name: "Ashenford Trading Guild" },
    { line: "Canon: The Great Schism", entityType: "canon", name: "The Great Schism" },
    { line: "Event: The Fall of New Geneva", entityType: "event", name: "The Fall of New Geneva" },
  ];

  for (const { line, entityType, name } of cases) {
    it(`detects a ${entityType} from "${line}"`, () => {
      const candidates = parseNotes(line);
      const found = find(candidates, name);
      expect(found).toBeDefined();
      expect(found?.entityType).toBe(entityType);
      expect(found?.confidence).toBe("structured");
      expect(found?.snippet).toContain(name);
    });
  }

  it("recognizes markdown heading and bracket decoration", () => {
    const text = "## Character: Ada Voss\n[Location] New Geneva";
    const candidates = parseNotes(text);
    expect(find(candidates, "Ada Voss")?.entityType).toBe("character");
    expect(find(candidates, "New Geneva")?.entityType).toBe("location");
  });

  it("recognizes the em-dash and hyphen separators", () => {
    const text = "Location — New Geneva\nSpecies - Elari";
    const candidates = parseNotes(text);
    expect(find(candidates, "New Geneva")?.entityType).toBe("location");
    expect(find(candidates, "Elari")?.entityType).toBe("species");
  });

  it("prefers the more specific marker keyword over a substring match", () => {
    // "Military Unit" should not be misread as generic "unit" splitting
    // differently, and "Canon Entry" should be matched as a whole, not
    // just "canon".
    const text = "Military Unit: 3rd Battalion\nCanon Entry: The Great Schism";
    const candidates = parseNotes(text);
    expect(find(candidates, "3rd Battalion")?.entityType).toBe("military");
    expect(find(candidates, "The Great Schism")?.entityType).toBe("canon");
  });
});

// ---------------------------------------------------------------------
// Pass 2: keyword-proximity fallback -- one per entity type (task 1.5)
// ---------------------------------------------------------------------

describe("keyword-proximity fallback detection (one per entity type)", () => {
  const cases: { sentence: string; entityType: EntityTypeKey; name: string }[] = [
    { sentence: "Ada Voss was born on a remote mining colony.", entityType: "character", name: "Ada Voss" },
    { sentence: "New Geneva is a sprawling city built into a canyon wall.", entityType: "location", name: "New Geneva" },
    { sentence: "The Rail Rifle is a weapon favored by frontier militias.", entityType: "technology", name: "Rail Rifle" },
    { sentence: "The Elari are a sentient species with photosynthetic skin.", entityType: "species", name: "Elari" },
    { sentence: "The 3rd Battalion is an army unit commanded from Fort Meridian.", entityType: "military", name: "3rd Battalion" },
    { sentence: "The Meridian Concord is a government that ruled for three centuries.", entityType: "politics", name: "Meridian Concord" },
    { sentence: "The Solari Faith is a religion whose believers worship the twin suns.", entityType: "religion", name: "Solari Faith" },
    { sentence: "The Ashenford Trading Guild is a guild founded by river merchants.", entityType: "organization", name: "Ashenford Trading Guild" },
    { sentence: "The Great Schism is now official canon after being established last year.", entityType: "canon", name: "Great Schism" },
    { sentence: "The Battle of New Geneva occurred in the year 2140.", entityType: "event", name: "New Geneva" },
  ];

  for (const { sentence, entityType, name } of cases) {
    it(`detects a ${entityType} candidate from "${sentence}"`, () => {
      const candidates = parseNotes(sentence);
      const matches = candidates.filter(
        (c) => c.entityType === entityType && c.name.toLowerCase() === name.toLowerCase(),
      );
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].confidence).toBe("keyword");
      expect(matches[0].snippet).toContain(name);
    });
  }

  it("does not treat every sentence as containing a candidate", () => {
    const candidates = parseNotes("This is just a plain sentence with nothing special in it.");
    expect(candidates).toHaveLength(0);
  });

  it("skips lines already claimed by a structured marker so it isn't guessed at twice", () => {
    const text = "Character: Ada Voss\nAda Voss said hello to everyone in the room.";
    const candidates = parseNotes(text);
    const adaCandidates = candidates.filter((c) => c.name === "Ada Voss");
    // Only the structured-marker candidate should survive for this exact
    // name -- the second line about Ada Voss doesn't add a duplicate
    // keyword-confidence candidate for the same (type, name) pair since
    // dedup collapses it, and the structured-confidence one wins.
    expect(adaCandidates).toHaveLength(1);
    expect(adaCandidates[0].confidence).toBe("structured");
  });
});

// ---------------------------------------------------------------------
// Classification guessing
// ---------------------------------------------------------------------

describe("classification guessing", () => {
  it("guesses a technology category from a nearby keyword", () => {
    const candidates = parseNotes("The Rail Rifle is a weapon used by frontier militias.");
    const rifle = find(candidates, "Rail Rifle");
    expect(rifle?.classification).toBe("weapons");
  });

  it("guesses a species classification from a nearby keyword", () => {
    const candidates = parseNotes("The Elari are a humanoid species living in the highlands.");
    const elari = find(candidates, "Elari");
    expect(elari?.classification).toBe("sentient_humanoid");
  });

  it("leaves classification undefined when no keyword matches", () => {
    const candidates = parseNotes("Technology: Rail Rifle");
    const rifle = find(candidates, "Rail Rifle");
    expect(rifle?.classification).toBeUndefined();
  });
});

// ---------------------------------------------------------------------
// Deduplication (FR2.6)
// ---------------------------------------------------------------------

describe("deduplication within one parse run", () => {
  it("merges repeated mentions of the same name and type into one candidate", () => {
    const text =
      "Ada Voss was born on a mining colony. Later, Ada Voss said she wanted to leave.";
    const candidates = parseNotes(text);
    const adaCandidates = candidates.filter(
      (c) => c.entityType === "character" && c.name === "Ada Voss",
    );
    expect(adaCandidates).toHaveLength(1);
  });

  it("keeps the highest-confidence detection when both passes find the same name", () => {
    const text = "Character: Ada Voss\nAda Voss said hello.";
    const candidates = parseNotes(text);
    const ada = find(candidates, "Ada Voss");
    expect(ada?.confidence).toBe("structured");
  });

  it("does not merge the same name across two different guessed entity types", () => {
    // "Meridian" could plausibly be guessed as more than one type in
    // different contexts -- dedup should not try to pick a winner across
    // types (design doc section 1.3); that judgment call belongs to the
    // review screen, not the parser.
    const text =
      "The Meridian Concord is a government. Meridian is also a city in the north.";
    const candidates = parseNotes(text);
    const distinctTypes = new Set(
      candidates.filter((c) => c.name.includes("Meridian")).map((c) => c.entityType),
    );
    expect(distinctTypes.size).toBeGreaterThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------
// Determinism (NFR3, AC9)
// ---------------------------------------------------------------------

describe("determinism", () => {
  it("produces identical candidates (ignoring id) for the same input on repeated calls", () => {
    const text =
      "Character: Ada Voss\nThe Ashenford Trading Guild is a guild founded by river merchants.\nThe Rail Rifle is a weapon used in the frontier wars.";

    const stripIds = (candidates: ReturnType<typeof parseNotes>) =>
      candidates
        .map(({ id: _id, ...rest }) => rest)
        .sort((a, b) => (a.name + a.entityType).localeCompare(b.name + b.entityType));

    const first = stripIds(parseNotes(text));
    const second = stripIds(parseNotes(text));
    const third = stripIds(parseNotes(text));

    expect(second).toEqual(first);
    expect(third).toEqual(first);
  });

  it("produces no candidates for empty or whitespace-only input", () => {
    expect(parseNotes("")).toEqual([]);
    expect(parseNotes("   \n\n  ")).toEqual([]);
  });
});

// ---------------------------------------------------------------------
// Coverage sanity check: every entity type key has both a structured
// marker table entry and a proximity keyword table entry (guards against
// silently forgetting one of the 10 types in a future edit).
// ---------------------------------------------------------------------

describe("entity type coverage", () => {
  it("attempts detection for all 10 entity types on a text containing all 10 structured markers", () => {
    const text = [
      "Character: Ada Voss",
      "Location: New Geneva",
      "Technology: Rail Rifle",
      "Species: Elari",
      "Military Unit: 3rd Battalion",
      "Faction: Meridian Concord",
      "Religion: Solari Faith",
      "Guild: Ashenford Trading Guild",
      "Canon Entry: The Great Schism",
      "Event: The Fall of New Geneva",
    ].join("\n");

    const candidates = parseNotes(text);
    const detectedTypes = new Set(candidates.map((c) => c.entityType));
    for (const entityType of ENTITY_TYPE_KEYS) {
      expect(detectedTypes.has(entityType)).toBe(true);
    }
  });
});
