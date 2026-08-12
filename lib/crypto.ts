import "react-native-get-random-values";
import CryptoJS from "crypto-js";
import * as SecureStore from "expo-secure-store";

export {
  decryptPlate,
  encryptPlate,
  isPlateEncrypted,
} from "./crypto-core";

const SECURE_KEYS = {
  MASTER_PASSWORD: "lpd_master_password",
  BIOMETRIC_ENABLED: "lpd_biometric_enabled",
  PIN_CODE: "lpd_pin_code",
  LOCK_ENABLED: "lpd_lock_enabled",
  ENCRYPTION_ENABLED: "lpd_encryption_enabled",
};

export async function saveMasterPassword(password: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(SECURE_KEYS.MASTER_PASSWORD, password);
  } catch (error) {
    console.error("Error guardando contraseña maestra:", error);
    throw error;
  }
}

export async function getMasterPassword(): Promise<string | null> {
  try {
    const password = await SecureStore.getItemAsync(SECURE_KEYS.MASTER_PASSWORD);
    return password || null;
  } catch (error) {
    console.error("Error recuperando contraseña maestra:", error);
    return null;
  }
}

export async function deleteMasterPassword(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.MASTER_PASSWORD);
  } catch (error) {
    console.error("Error eliminando contraseña maestra:", error);
  }
}

export async function savePinCode(pin: string): Promise<void> {
  try {
    const encryptedPin = CryptoJS.AES.encrypt(pin, "lpd_pin_salt").toString();
    await SecureStore.setItemAsync(SECURE_KEYS.PIN_CODE, encryptedPin);
  } catch (error) {
    console.error("Error guardando PIN:", error);
    throw error;
  }
}

export async function verifyPinCode(pin: string): Promise<boolean> {
  try {
    const encryptedPin = await SecureStore.getItemAsync(SECURE_KEYS.PIN_CODE);
    if (!encryptedPin) return false;

    const decrypted = CryptoJS.AES.decrypt(
      encryptedPin,
      "lpd_pin_salt",
    ).toString(CryptoJS.enc.Utf8);
    return decrypted === pin;
  } catch (error) {
    console.error("Error verificando PIN:", error);
    return false;
  }
}

export async function deletePinCode(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(SECURE_KEYS.PIN_CODE);
  } catch (error) {
    console.error("Error eliminando PIN:", error);
  }
}

export async function setLockEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      SECURE_KEYS.LOCK_ENABLED,
      enabled ? "true" : "false",
    );
  } catch (error) {
    console.error("Error guardando estado de bloqueo:", error);
  }
}

export async function isLockEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(SECURE_KEYS.LOCK_ENABLED);
    return value === "true";
  } catch (error) {
    console.error("Error obteniendo estado del bloqueo:", error);
    return false;
  }
}

export async function setBiometricEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      SECURE_KEYS.BIOMETRIC_ENABLED,
      enabled ? "true" : "false",
    );
  } catch (error) {
    console.error("Error guardando estado de biometría:", error);
  }
}

export async function isBiometricEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(SECURE_KEYS.BIOMETRIC_ENABLED);
    return value === "true";
  } catch (error) {
    console.error("Error obteniendo estado de biometría:", error);
    return false;
  }
}

export async function setEncryptionEnabled(enabled: boolean): Promise<void> {
  try {
    await SecureStore.setItemAsync(
      SECURE_KEYS.ENCRYPTION_ENABLED,
      enabled ? "true" : "false",
    );
  } catch (error) {
    console.error("Error guardando estado de cifrado:", error);
  }
}

export async function isEncryptionEnabled(): Promise<boolean> {
  try {
    const value = await SecureStore.getItemAsync(SECURE_KEYS.ENCRYPTION_ENABLED);
    return value === "true";
  } catch (error) {
    console.error("Error obteniendo estado de cifrado:", error);
    return false;
  }
}
