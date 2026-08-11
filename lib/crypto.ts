import CryptoJS from 'crypto-js';
import * as SecureStore from 'expo-secure-store';

// Constantes para almacenamiento seguro
const SECURE_KEYS = {
  MASTER_PASSWORD: 'lpd_master_password',
  BIOMETRIC_ENABLED: 'lpd_biometric_enabled',
  PIN_CODE: 'lpd_pin_code',
  LOCK_ENABLED: 'lpd_lock_enabled',
  ENCRYPTION_ENABLED: 'lpd_encryption_enabled',
};

/**
 * Verifica si una cadena es una matrícula española válida en texto plano
 * Retorna false si es texto plano válido, true si parece ser cifrado
 */
export function isPlateEncrypted(plateText: string): boolean {
  if (!plateText || plateText.length === 0) return false;
  
  // Regex para matrícula española: 4 dígitos + 3 consonantes
  const spanishPlateRegex = /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/;
  
  // Si cumple con el patrón de matrícula, NO está cifrada
  if (spanishPlateRegex.test(plateText.toUpperCase())) {
    return false;
  }
  
  // Si parece Base64 y tiene longitud típica de cifrado AES, probablemente esté cifrada
  try {
    // Base64 válido solo contiene caracteres específicos
    if (/^[A-Za-z0-9+/=]+$/.test(plateText) && plateText.length > 20) {
      return true;
    }
  } catch (e) {
    // Ignorar errores de validación
  }
  
  return false;
}

/**
 * Cifra una matrícula usando AES con CryptoJS
 * Retorna la matrícula cifrada en Base64
 */
export function encryptPlate(plateText: string, password: string): string {
  if (!plateText || !password) return plateText;
  
  // Si ya está cifrada, no la procesa
  if (isPlateEncrypted(plateText)) {
    return plateText;
  }
  
  try {
    // Usar CryptoJS para cifrado AES
    const encrypted = CryptoJS.AES.encrypt(plateText.toUpperCase(), password).toString();
    return encrypted;
  } catch (error) {
    console.error('Error cifrando matrícula:', error);
    return plateText;
  }
}

/**
 * Descifra una matrícula usando AES con CryptoJS
 * Retorna la matrícula descifrada o null si falla
 */
export function decryptPlate(encryptedText: string, password: string): string | null {
  if (!encryptedText || !password) return null;
  
  try {
    const decrypted = CryptoJS.AES.decrypt(encryptedText, password).toString(CryptoJS.enc.Utf8);
    
    // Validar que el resultado descifrado es una matrícula válida
    if (decrypted && /^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(decrypted.toUpperCase())) {
      return decrypted.toUpperCase();
    }
    
    return null;
  } catch (error) {
    console.error('Error descifrando matrícula:', error);
    return null;
  }
}

/**
 * Guarda la contraseña maestra de forma segura en SecureStore
 */
export async function saveMasterPassword(password: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.MASTER_PASSWORD, password);
  } catch (error) {
    console.error('Error guardando contraseña maestra:', error);
    throw error;
  }
}

/**
 * Recupera la contraseña maestra desde SecureStore
 */
export async function getMasterPassword(): Promise<string | null> {
  try {
    const password = await SecureStore.getItemAsync(SECURE_KEYS.MASTER_PASSWORD);
    return password || null;
  } catch (error) {
    console.error('Error recuperando contraseña maestra:', error);
    return null;
  }
}

/**
 * Elimina la contraseña maestra
 */
export async function deleteMasterPassword(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MASTER_PASSWORD);
  } catch (error) {
    console.error('Error eliminando contraseña maestra:', error);
  }
}

/**
 * Guarda el PIN de acceso de forma segura
 */
export async function savePinCode(pin: string): Promise<void> {
  try {
    // Cifrar el PIN antes de guardarlo
    const encryptedPin = CryptoJS.AES.encrypt(pin, 'lpd_pin_salt').toString();
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_CODE, encryptedPin);
  } catch (error) {
    console.error('Error guardando PIN:', error);
    throw error;
  }
}

/**
 * Verifica si el PIN es correcto
 */
export async function verifyPinCode(pin: string): Promise<boolean> {
  try {
    const encryptedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN_CODE);
    if (!encryptedPin) return false;
    
    const decrypted = CryptoJS.AES.decrypt(encryptedPin, 'lpd_pin_salt').toString(CryptoJS.enc.Utf8);
    return decrypted === pin;
  } catch (error) {
    console.error('Error verificando PIN:', error);
    return false;
  }
}

/**
 * Elimina el PIN guardado
 */
export async function deletePinCode(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_CODE);
  } catch (error) {
    console.error('Error eliminando PIN:', error);
  }
}

/**
 * Guarda el estado de activación del bloqueo
 */
export async function setLockEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.LOCK_ENABLED, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error guardando estado de bloqueo:', error);
  }
}

/**
 * Obtiene el estado de activación del bloqueo
 */
export async function isLockEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(SECURE_KEYS.LOCK_ENABLED);
    return value === 'true';
  } catch (error) {
    console.error('Error obteniendo estado de bloqueo:', error);
    return false;
  }
}

/**
 * Guarda el estado de activación de biometría
 */
export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error guardando estado de biometría:', error);
  }
}

/**
 * Obtiene el estado de activación de biometría
 */
export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED);
    return value === 'true';
  } catch (error) {
    console.error('Error obteniendo estado de biometría:', error);
    return false;
  }
}

/**
 * Guarda el estado de activación del cifrado LOPD
 */
export async function setEncryptionEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.ENCRYPTION_ENABLED, enabled ? 'true' : 'false');
  } catch (error) {
    console.error('Error guardando estado de cifrado:', error);
  }
}

/**
 * Obtiene el estado de activación del cifrado LOPD
 */
export async function isEncryptionEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(SECURE_KEYS.ENCRYPTION_ENABLED);
    return value === 'true';
  } catch (error) {
    console.error('Error obteniendo estado de cifrado:', error);
    return false;
  }
}
