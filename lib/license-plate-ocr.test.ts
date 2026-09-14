import { describe, expect, it } from "vitest";
import type { TextRecognitionResult } from "@react-native-ml-kit/text-recognition";
import { extractSpanishPlateFromOcr } from "./license-plate-ocr";

function ocr(
  text: string,
  blocks: TextRecognitionResult["blocks"] = []
): TextRecognitionResult {
  return {
    text,
    blocks,
  };
}

describe("license-plate-ocr", () => {
  it("detecta una matrícula válida en el texto completo", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("Vehículo detectado: 1234BCD")
    );

    expect(result).not.toBeNull();
    expect(result?.plate).toBe("1234BCD");
    expect(result?.exact).toBe(true);
    expect(result?.corrections).toBe(0);
  });

  it("detecta una matrícula aunque haya espacios o guiones", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("1234 BCD")
    );

    expect(result?.plate).toBe("1234BCD");
  });

  it("busca matrículas dentro de una línea con texto adicional", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("MATRICULA 1234BCD VEHICULO")
    );

    expect(result?.plate).toBe("1234BCD");
  });

  it("utiliza las líneas de ML Kit", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("", [
        {
          text: "Vehículo",
          lines: [
            {
              text: "1234BCD",
              elements: [{ text: "1234BCD" }],
              recognizedLanguages: [],
            },
          ],
          recognizedLanguages: [],
        },
      ])
    );

    expect(result?.plate).toBe("1234BCD");
    expect(result?.source).toBe("line");
  });

  it("utiliza los elementos de ML Kit", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("", [
        {
          text: "1234 BCD",
          lines: [
            {
              text: "1234 BCD",
              elements: [
                { text: "1234" },
                { text: "BCD" },
              ],
              recognizedLanguages: [],
            },
          ],
          recognizedLanguages: [],
        },
      ])
    );

    expect(result?.plate).toBe("1234BCD");
  });

  it("corrige O a 0 únicamente en las posiciones numéricas", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("123OBCD")
    );

    expect(result?.plate).toBe("1230BCD");
    expect(result?.corrections).toBe(1);
    expect(result?.exact).toBe(false);
  });

  it("corrige Q a 0 únicamente en las posiciones numéricas", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("12Q4BCD")
    );

    expect(result?.plate).toBe("1204BCD");
    expect(result?.corrections).toBe(1);
  });

  it("no convierte O en letra porque O está prohibida", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("1234OCD")
    );

    expect(result).toBeNull();
  });

  it("no acepta una matrícula con vocal", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("1234ABC")
    );

    expect(result).toBeNull();
  });

  it("no acepta una matrícula con Q en la parte de letras", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("1234QBC")
    );

    expect(result).toBeNull();
  });

  it("prioriza una coincidencia exacta sobre una corregida", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("123OBCD y también 5678XYZ")
    );

    expect(result?.plate).toBe("5678XYZ");
    expect(result?.exact).toBe(true);
    expect(result?.corrections).toBe(0);
  });

  it("devuelve null cuando no hay candidato válido", () => {
    const result = extractSpanishPlateFromOcr(
      ocr("No hay ninguna matrícula aquí")
    );

    expect(result).toBeNull();
  });
});
