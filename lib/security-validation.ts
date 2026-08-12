export function validateMasterPassword(masterPassword: string, confirmMasterPassword: string): string | null {
  if (masterPassword.length < 8) {
    return "La contraseña maestra debe tener al menos 8 caracteres";
  }

  if (masterPassword !== confirmMasterPassword) {
    return "Las contraseñas maestras no coinciden";
  }

  return null;
}
