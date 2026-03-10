import { describe, expect, it } from "vitest";
import { generateSlug } from "../../server/utils/slug";

describe("generateSlug edge cases", () => {
  it("handles unicode characters by stripping them", () => {
    // The combining acute accent (U+0301) after 'e' is stripped as non-alphanumeric,
    // but the base 'e' character itself remains since it's a valid ASCII letter.
    const result = generateSlug("cafe\u0301 project");
    expect(result).toBe("cafe-project");
  });

  it("handles all-special-characters string", () => {
    const result = generateSlug("@#$%^&*");
    expect(result).toBe("");
  });

  it("handles string that exceeds max length", () => {
    const input = "a".repeat(100);
    const result = generateSlug(input);
    expect(result.length).toBeLessThanOrEqual(50);
  });

  it("does not produce trailing hyphen after truncation at word boundary", () => {
    // Input is 51 chars: 49 a's + "-b". Truncation to 50 leaves "aaa...a-",
    // and the trailing-hyphen removal trims it.
    const input = `${"a".repeat(49)}-b`;
    const result = generateSlug(input);
    expect(result).not.toMatch(/-$/);
  });
});
