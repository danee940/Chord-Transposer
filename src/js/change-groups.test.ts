import { describe, expect, it } from "vitest";

import { groupChanges, renderChangeRow } from "./change-groups";

describe("groupChanges", () => {
  it("groups changed chords by their root mapping, keeping first-seen order", () => {
    expect(
      groupChanges([
        ["Am", "Bm"],
        ["C", "D"],
        ["C/E", "D/F#"],
        ["C7", "D7"],
        ["G7", "A7"],
      ])
    ).toEqual([
      { from: "A", to: "B", members: ["Am"] },
      { from: "C", to: "D", members: ["C", "C/E", "C7"] },
      { from: "G", to: "A", members: ["G7"] },
    ]);
  });

  it("keeps enharmonic targets apart", () => {
    expect(
      groupChanges([
        ["F#", "G#"],
        ["Gb", "Ab"],
      ])
    ).toHaveLength(2);
  });
});

describe("renderChangeRow", () => {
  it("renders only the root mapping when the bare root is the sole member", () => {
    const row = renderChangeRow({ from: "C", to: "D", members: ["C"] });
    expect(row.textContent).toBe("C → D");
    expect(row.children).toHaveLength(1);
  });

  it("lists the chords beyond the bare root as muted members", () => {
    const row = renderChangeRow({ from: "C", to: "D", members: ["C", "C/E", "C7"] });
    expect(row.textContent).toBe("C → D · C/E · C7");
    expect(row.children[1]!.className).toContain("text-muted-light");
  });
});
