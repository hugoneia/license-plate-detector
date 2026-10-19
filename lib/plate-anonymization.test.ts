import { describe, expect, it } from "vitest";
import {
  anonymizePlate,
  createPlateSymbolMap,
  PLATE_ANONYMIZATION_SYMBOLS,
} from "./plate-anonymization";

const DIGITS = "0123456789";
const ALLOWED_LETTERS = "BCDFGHJKLMNPRSTVWXYZ";

describe("plate anonymization", () => {
  it("maps only digits and letters allowed in current Spanish plates", () => {
    const mapping = createPlateSymbolMap(() => 0.37);

    for (const character of DIGITS + ALLOWED_LETTERS) {
      expect(PLATE_ANONYMIZATION_SYMBOLS).toContain(mapping[character]);
    }

    expect(Object.keys(mapping).sort()).toEqual(
      [...(DIGITS + ALLOWED_LETTERS)].sort()
    );
  });

  it("distributes digits in groups of 3, 3 and 4", () => {
    const mapping = createPlateSymbolMap();

    const counts = PLATE_ANONYMIZATION_SYMBOLS.map((symbol) =>
      [...DIGITS].filter((character) => mapping[character] === symbol).length
    );

    expect([...counts].sort()).toEqual([3, 3, 4]);
  });

  it("distributes allowed letters in groups of 6, 7 and 7", () => {
    const mapping = createPlateSymbolMap();

    const counts = PLATE_ANONYMIZATION_SYMBOLS.map((symbol) =>
      [...ALLOWED_LETTERS].filter((character) => mapping[character] === symbol).length
    );

    expect([...counts].sort()).toEqual([6, 7, 7]);
  });

  it("replaces mapped characters while preserving separators and excluded letters", () => {
    const mapping = createPlateSymbolMap(() => 0);

    expect(anonymizePlate("0000-XXX", mapping)).toBe(
      `${mapping["0"]}${mapping["0"]}${mapping["0"]}${mapping["0"]}-` +
      `${mapping.X}${mapping.X}${mapping.X}`
    );
    expect(anonymizePlate("BC-ÑQ", mapping)).toBe(`${mapping.B}${mapping.C}-ÑQ`);
  });

  it("uses the same symbol for repeated characters", () => {
    const mapping = createPlateSymbolMap();

    expect(anonymizePlate("B1-B1", mapping)).toBe(
      `${mapping.B}${mapping["1"]}-${mapping.B}${mapping["1"]}`
    );
  });

  it("does not modify the original string", () => {
    const original = "0000XXX";
    anonymizePlate(original, createPlateSymbolMap());
    expect(original).toBe("0000XXX");
  });

  it("preserves characters missing from the mapping", () => {
    expect(anonymizePlate("ABC-123", {})).toBe("ABC-123");
  });
});
