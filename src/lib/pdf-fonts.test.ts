import { describe, expect, it } from "vitest";
import { layoutName } from "./pdf-fonts";

// 1 char = 1 unit wide at 10pt, scaling with size.
const measure = (s: string, pt: number) => (s.length * pt) / 10;

describe("layoutName", () => {
  it("keeps a short name on one line at full size", () => {
    expect(layoutName(measure, "Rahim", 20, 10, 7, 2)).toEqual({ pt: 10, lines: ["Rahim"] });
  });
  it("shrinks before wrapping", () => {
    const r = layoutName(measure, "Rahim Uddin Ahmed", 13, 10, 7, 2);
    expect(r.lines).toHaveLength(1);
    expect(r.pt).toBeLessThan(10);
  });
  it("wraps on spaces instead of cutting the name", () => {
    const r = layoutName(measure, "Mohammad Abdullah Al Mamun Chowdhury", 20, 10, 7, 2);
    expect(r.lines.join(" ")).toBe("Mohammad Abdullah Al Mamun Chowdhury");
    expect(r.lines).toHaveLength(2);
  });
});
