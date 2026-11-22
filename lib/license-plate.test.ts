import { describe, expect, it } from "vitest";
import {
  isValidSpanishPlate,
  normalizeSpanishPlate,
} from "./license-plate";

describe("license-plate", () => {
  describe("normalizeSpanishPlate", () => {
    it("convierte a mayúsculas y elimina espacios exteriores", () => {
      expect(normalizeSpanishPlate("  1234bcd  ")).toBe("1234BCD");
    });
  });

  describe("isValidSpanishPlate", () => {
    it("acepta una matrícula válida", () => {
      expect(isValidSpanishPlate("1234BCD")).toBe(true);
      expect(isValidSpanishPlate("1234XYZ")).toBe(true);
    });

    it("acepta minúsculas porque se normalizan", () => {
      expect(isValidSpanishPlate("1234bcd")).toBe(true);
    });

    it("rechaza vocales", () => {
      expect(isValidSpanishPlate("1234ABC")).toBe(false);
      expect(isValidSpanishPlate("1234AEF")).toBe(false);
      expect(isValidSpanishPlate("1234IOU")).toBe(false);
    });

    it("rechaza Q", () => {
      expect(isValidSpanishPlate("1234QBC")).toBe(false);
    });

    it("rechaza formatos con número de dígitos incorrecto", () => {
      expect(isValidSpanishPlate("123BCD")).toBe(false);
      expect(isValidSpanishPlate("12345BCD")).toBe(false);
    });

    it("rechaza formatos con letras incorrectas", () => {
      expect(isValidSpanishPlate("1234AB1")).toBe(false);
      expect(isValidSpanishPlate("1234BCD1")).toBe(false);
    });

    it("rechaza espacios internos", () => {
      expect(isValidSpanishPlate("1234 BCD")).toBe(false);
      expect(isValidSpanishPlate("1234BC D")).toBe(false);
    });

    it("rechaza cadenas vacías", () => {
      expect(isValidSpanishPlate("")).toBe(false);
    });
  });
});
