import { describe, it, expect } from "vitest";

/**
 * Función de normalización de coordenadas españolas
 * Convierte comas decimales (40,40) a puntos (40.40)
 * Mantiene la coma que separa lat,lng
 */
function normalizeCoordinates(input: string): string {
  return input.replace(/(\d),(\d)/g, '$1.$2');
}

describe("Coordinate Normalization", () => {
  it("should convert Spanish decimal commas to dots", () => {
    const input = "40,40,-3,56";
    const result = normalizeCoordinates(input);
    expect(result).toBe("40.40,-3.56");
  });

  it("should handle single decimal place", () => {
    const input = "40,4,-3,5";
    const result = normalizeCoordinates(input);
    expect(result).toBe("40.4,-3.5");
  });

  it("should handle multiple decimal places", () => {
    const input = "40,340719,-3,666870";
    const result = normalizeCoordinates(input);
    expect(result).toBe("40.340719,-3.666870");
  });

  it("should preserve already normalized coordinates", () => {
    const input = "40.340719,-3.666870";
    const result = normalizeCoordinates(input);
    expect(result).toBe("40.340719,-3.666870");
  });

  it("should handle mixed format (some normalized, some not)", () => {
    const input = "40.340719,-3,666870";
    const result = normalizeCoordinates(input);
    expect(result).toBe("40.340719,-3.666870");
  });

  it("should handle spaces around coordinates", () => {
    const input = " 40,40 , -3,56 ";
    const result = normalizeCoordinates(input);
    expect(result).toBe(" 40.40 , -3.56 ");
  });

  it("should not affect numbers without decimal separator", () => {
    const input = "40,-3";
    const result = normalizeCoordinates(input);
    expect(result).toBe("40,-3");
  });

  it("should handle negative coordinates", () => {
    const input = "-40,40,-3,56";
    const result = normalizeCoordinates(input);
    expect(result).toBe("-40.40,-3.56");
  });

  it("should handle real Google Maps Spain coordinates", () => {
    // Coordinates from Google Maps in Spain (Madrid)
    const input = "40,416729,-3,703339";
    const result = normalizeCoordinates(input);
    expect(result).toBe("40.416729,-3.703339");
  });
});
