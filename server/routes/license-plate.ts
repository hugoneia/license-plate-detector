import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { TRPCError } from "@trpc/server";
import { invokeLLM } from "../_core/llm";

// Formato de matrículas españolas:
// - Formato actual (desde 2000): 4 dígitos + 3 letras (ej: 1234 ABC)
// - Formato antiguo: 1-2 letras + 4 dígitos + 1-2 letras (ej: M 1234 AB)
const SPANISH_LICENSE_PLATE_REGEX = /^(?:[A-Z]{1,2}\s?\d{4}\s?[A-Z]{1,2}|\d{4}\s?[A-Z]{3})$/i;

export const licensePlateRouter = router({
  detect: publicProcedure
    .input(
      z.object({
        imageBase64: z.string().describe("Imagen en formato base64"),
        mimeType: z.string().optional().default("image/jpeg"),
      })
    )
    .mutation(async ({ input }) => {
      try {
        // Construir data URL para la imagen
        const imageDataUrl = `data:${input.mimeType};base64,${input.imageBase64}`;

        // Usar IA multimodal para detectar y leer la matrícula
        const prompt = `Analiza esta imagen y detecta la matrícula del vehículo. 
        
Instrucciones:
1. Busca una matrícula española en la imagen
2. Las matrículas españolas modernas tienen el formato: 4 dígitos seguidos de 3 letras (ejemplo: 1234 ABC)
3. Las matrículas antiguas pueden tener: 1-2 letras + 4 dígitos + 1-2 letras (ejemplo: M 1234 AB)
4. Extrae SOLO el texto de la matrícula, sin espacios adicionales
5. Si hay múltiples matrículas, devuelve solo la más visible/clara
6. Si no encuentras una matrícula, responde con "NO_PLATE_FOUND"

Responde ÚNICAMENTE con el texto de la matrícula detectada (ejemplo: "1234ABC" o "M1234AB"), nada más.`;

        const response = await invokeLLM({

          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "image_url", image_url: { url: imageDataUrl } },
              ],
            },
          ],
          maxTokens: 50,
        });

        const messageContent = response.choices[0]?.message?.content;
        const detectedText = typeof messageContent === "string" ? messageContent.trim() : "";

        // Verificar si se encontró una matrícula
        if (!detectedText || detectedText === "NO_PLATE_FOUND") {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "No se detectó ninguna matrícula en la imagen",
          });
        }

        // Limpiar el texto (remover espacios y convertir a mayúsculas)
        const cleanedText = detectedText.replace(/\s+/g, "").toUpperCase();

        // Validar formato de matrícula española
        const isValid = SPANISH_LICENSE_PLATE_REGEX.test(cleanedText);

        if (!isValid) {
          // Intentar formatear si tiene el número correcto de caracteres
          const formatted = formatLicensePlate(cleanedText);
          if (formatted && SPANISH_LICENSE_PLATE_REGEX.test(formatted)) {
            return {
              licensePlate: formatted,
              confidence: "medium",
              isValid: true,
              rawText: detectedText,
            };
          }

          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `El texto detectado "${cleanedText}" no coincide con el formato de matrícula española`,
          });
        }

        return {
          licensePlate: cleanedText,
          confidence: "high",
          isValid: true,
          rawText: detectedText,
        };
      } catch (error) {
        if (error instanceof TRPCError) {
          throw error;
        }

        console.error("Error en detección de matrícula:", error);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Error al procesar la imagen",
        });
      }
    }),
});

/**
 * Intenta formatear texto que podría ser una matrícula española
 */
function formatLicensePlate(text: string): string | null {
  // Remover cualquier carácter que no sea letra o número
  const cleaned = text.replace(/[^A-Z0-9]/gi, "").toUpperCase();

  // Formato moderno: 4 dígitos + 3 letras (7 caracteres)
  if (cleaned.length === 7) {
    const digits = cleaned.slice(0, 4);
    const letters = cleaned.slice(4, 7);

    if (/^\d{4}$/.test(digits) && /^[A-Z]{3}$/.test(letters)) {
      return `${digits}${letters}`;
    }
  }

  // Formato antiguo: 1-2 letras + 4 dígitos + 1-2 letras (6-8 caracteres)
  if (cleaned.length >= 6 && cleaned.length <= 8) {
    // Intentar diferentes combinaciones
    const patterns = [
      { prefix: 1, digits: 4, suffix: 1 }, // L1234L
      { prefix: 1, digits: 4, suffix: 2 }, // L1234LL
      { prefix: 2, digits: 4, suffix: 1 }, // LL1234L
      { prefix: 2, digits: 4, suffix: 2 }, // LL1234LL
    ];

    for (const pattern of patterns) {
      if (cleaned.length === pattern.prefix + pattern.digits + pattern.suffix) {
        const prefix = cleaned.slice(0, pattern.prefix);
        const digits = cleaned.slice(pattern.prefix, pattern.prefix + pattern.digits);
        const suffix = cleaned.slice(pattern.prefix + pattern.digits);

        if (/^[A-Z]+$/.test(prefix) && /^\d{4}$/.test(digits) && /^[A-Z]+$/.test(suffix)) {
          return `${prefix}${digits}${suffix}`;
        }
      }
    }
  }

  return null;
}
