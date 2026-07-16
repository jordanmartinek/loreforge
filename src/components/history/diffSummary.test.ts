import { describe, expect, it } from "vitest";
import { computeDiffSummary } from "./diffSummary";

describe("computeDiffSummary", () => {
  it("returns an empty list when nothing changed", () => {
    const snapshot = JSON.stringify({ name: "Ada", biography: "A pilot." });
    expect(computeDiffSummary(snapshot, snapshot)).toEqual([]);
  });

  it("detects a changed field", () => {
    const before = JSON.stringify({ name: "Ada", biography: "A pilot." });
    const after = JSON.stringify({ name: "Ada", biography: "A void-tech engineer." });
    const diff = computeDiffSummary(before, after);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toEqual({
      field: "biography",
      before: "A pilot.",
      after: "A void-tech engineer.",
    });
  });

  it("detects multiple changed fields, sorted by field name", () => {
    const before = JSON.stringify({ status: "draft", name: "Old Name" });
    const after = JSON.stringify({ status: "approved", name: "New Name" });
    const diff = computeDiffSummary(before, after);
    expect(diff.map((d) => d.field)).toEqual(["name", "status"]);
  });

  it("excludes timestamp and id fields from the diff", () => {
    const before = JSON.stringify({ id: "a", created_at: "t1", updated_at: "t1", name: "X" });
    const after = JSON.stringify({ id: "a", created_at: "t1", updated_at: "t2", name: "Y" });
    const diff = computeDiffSummary(before, after);
    expect(diff).toHaveLength(1);
    expect(diff[0].field).toBe("name");
  });

  it("handles a create action (before is null)", () => {
    const after = JSON.stringify({ name: "Brand New" });
    const diff = computeDiffSummary(null, after);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toEqual({ field: "name", before: "(empty)", after: "Brand New" });
  });

  it("handles a delete action (after is null)", () => {
    const before = JSON.stringify({ name: "Gone" });
    const diff = computeDiffSummary(before, null);
    expect(diff).toHaveLength(1);
    expect(diff[0]).toEqual({ field: "name", before: "Gone", after: "(empty)" });
  });

  it("formats array fields as a comma-joined string", () => {
    const before = JSON.stringify({ layers: ["wars"] });
    const after = JSON.stringify({ layers: ["wars", "military"] });
    const diff = computeDiffSummary(before, after);
    expect(diff[0].after).toBe("wars, military");
  });

  it("formats empty strings and empty arrays as (empty)", () => {
    const before = JSON.stringify({ notes: "" });
    const after = JSON.stringify({ notes: "Something" });
    const diff = computeDiffSummary(before, after);
    expect(diff[0].before).toBe("(empty)");
  });
});
