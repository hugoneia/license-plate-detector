import CryptoJS from "crypto-js";

/**
 * Verifica si una cadena es una matrícula española válida en texto plano
 * o si tiene el formato Base64 habitual del cifrado AES de CryptoJS.
 */
export function isPlateEncrypted(plateText: string): boolean {
  if (!plateText || plateText.length === 0) return false;

  const spanishPlateRegex = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;
  if (spanishPlateRegex.test(plateText.toUpperCase())) {
    return false;
  }

  return /^[A-Za-z0-9+/=]+$/.test(plateText) && plateText.length > 20;
}

/** Cifra una matrícula usando AES y devuelve Base64 compatible con CryptoJS. */
export function encryptPlate(plateText: string, password: string): string {
  if (!plateText || !password) return plateText;
  if (isPlateEncrypted(plateText)) return plateText;

  try {
    return CryptoJS.AES.encrypt(plateText.toUpperCase(), password).toString();
  } catch (error) {
    console.error("Error cifrando matrícula:", error);
    return plateText;
  }
}

/** Descifra una matrícula y valida que el resultado mantenga el formato español. */
export function decryptPlate(
  encryptedText: string,
  password: string,
): string | null {
  if (!encryptedText || !password) return null;

  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedText, password).toString(
      CryptoJS.enc.Utf8,
    );

    if (
      decrypted &&
      /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(decrypted.toUpperCase())
    ) {
      return decrypted.toUpperCase();
    }

    return null;
  } catch (error) {
    console.error("Error descifrando matrícula:", error);
    return null;
  }
}
