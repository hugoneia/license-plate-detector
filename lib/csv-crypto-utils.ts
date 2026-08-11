import Papa from 'papaparse';
import { encryptPlate, decryptPlate, isPlateEncrypted } from './crypto-core';

type LicensePlateEntry = {
  id: string;
  licensePlate: string;
  timestamp: number;
  imageUri?: string;
  confidence: 'high' | 'medium' | 'low';
  location?: { latitude: number; longitude: number; accuracy?: number } | 'NO GPS';
  parkingLocation?: 'acera' | 'doble_fila' | null;
};

/**
 * Exporta matrículas a CSV con cifrado opcional
 * Si encryptionEnabled es true, cifra las matrículas manteniendo GPS y fechas en texto plano
 */
export function generateEncryptedCSV(
  entries: LicensePlateEntry[],
  encryptionEnabled: boolean,
  masterPassword?: string
): string {
  const headers = ['MATRÍCULA', 'FECHA', 'HORA', 'GPS', 'LUGAR', 'CONFIANZA'];
  
  const rows = entries.map((entry) => {
    const date = new Date(entry.timestamp);
    const dateStr = date.toLocaleDateString('es-ES');
    const timeStr = date.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    
    const gpsStr = entry.location === 'NO GPS'
      ? 'NO GPS'
      : entry.location
      ? `${entry.location.latitude.toFixed(6)},${entry.location.longitude.toFixed(6)}`
      : 'NO GPS';
    
    const parkingLabel = entry.parkingLocation === 'acera'
      ? 'AC'
      : entry.parkingLocation === 'doble_fila'
      ? 'DF'
      : 'SD';
    
    let plate = entry.licensePlate;
    
    // Cifrar matrícula si está habilitado
    if (encryptionEnabled && masterPassword) {
      plate = encryptPlate(plate, masterPassword);
    }
    
    return [
      plate,
      dateStr,
      timeStr,
      gpsStr,
      parkingLabel,
      entry.confidence || 'high',
    ];
  });
  
  // Generar CSV
  const csv = Papa.unparse({
    fields: headers,
    data: rows,
  });
  
  return csv;
}

/**
 * Importa CSV y detecta si está cifrado
 * Retorna el tipo de CSV: 'plaintext' o 'encrypted'
 */
export function detectCSVEncryption(csvContent: string): 'plaintext' | 'encrypted' {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return 'plaintext';
  
  // Saltar encabezados y leer primera matrícula
  const firstDataLine = lines[1];
  const fields = Papa.parse(firstDataLine).data[0] as string[];
  
  if (!fields || fields.length === 0) return 'plaintext';
  
  const firstPlate = fields[0];
  
  // Si es una matrícula válida en texto plano, no está cifrada
  if (/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(firstPlate.toUpperCase())) {
    return 'plaintext';
  }
  
  // Si parece Base64 y tiene longitud típica de cifrado, está cifrada
  if (/^[A-Za-z0-9+/=]+$/.test(firstPlate) && firstPlate.length > 20) {
    return 'encrypted';
  }
  
  return 'plaintext';
}

/**
 * Importa CSV con matriz de compatibilidad
 * 
 * CASO A: CSV plano + App plano → Importa directamente
 * CASO B: CSV plano + App cifrada → Cifra matrículas con contraseña de app
 * CASO C: CSV cifrado + App (plano o cifrada) → Descifra con contraseña del CSV
 */
export async function importCSVWithEncryption(
  csvContent: string,
  appEncryptionEnabled: boolean,
  appMasterPassword?: string,
  csvPassword?: string
): Promise<LicensePlateEntry[]> {
  const csvType = detectCSVEncryption(csvContent);
  const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
  
  if (!parsed.data || parsed.data.length === 0) {
    throw new Error('CSV vacío o inválido');
  }
  
  const entries: LicensePlateEntry[] = [];
  
  for (const row of parsed.data as any[]) {
    try {
      let plate = row.MATRÍCULA?.trim() || '';
      
      if (!plate) continue;
      
      // CASO C: CSV cifrado
      if (csvType === 'encrypted') {
        if (!csvPassword) {
          throw new Error('Se requiere contraseña para descifrar el CSV');
        }
        
        const decrypted = decryptPlate(plate, csvPassword);
        if (!decrypted) {
          console.warn(`No se pudo descifrar matrícula: ${plate}`);
          continue;
        }
        
        plate = decrypted;
        
        // Si la app también usa cifrado, re-cifrar con contraseña de app
        if (appEncryptionEnabled && appMasterPassword) {
          plate = encryptPlate(plate, appMasterPassword);
        }
      }
      // CASO B: CSV plano + App cifrada
      else if (csvType === 'plaintext' && appEncryptionEnabled && appMasterPassword) {
        plate = encryptPlate(plate, appMasterPassword);
      }
      // CASO A: CSV plano + App plano → No hacer nada
      
      // Parsear GPS
      let location: any = 'NO GPS';
      const gpsStr = row.GPS?.trim();
      
      if (gpsStr && gpsStr !== 'NO GPS') {
        const [lat, lon] = gpsStr.split(',').map((s: string) => parseFloat(s.trim()));
        if (!isNaN(lat) && !isNaN(lon)) {
          location = { latitude: lat, longitude: lon };
        }
      }
      
      // Parsear ubicación de estacionamiento
      let parkingLocation: 'acera' | 'doble_fila' | null = null;
      const lugarStr = row.LUGAR?.trim();
      if (lugarStr === 'AC') parkingLocation = 'acera';
      else if (lugarStr === 'DF') parkingLocation = 'doble_fila';
      
      // Crear entrada
      const entry: LicensePlateEntry = {
        id: `${plate}-${Date.now()}`,
        licensePlate: plate,
        timestamp: new Date(`${row.FECHA} ${row.HORA}`).getTime(),
        location,
        confidence: (row.CONFIANZA as 'high' | 'medium' | 'low') || 'high',
        parkingLocation,
      };
      
      entries.push(entry);
    } catch (error) {
      console.error('Error procesando fila de CSV:', error);
      continue;
    }
  }
  
  return entries;
}

/**
 * Valida que un CSV sea compatible con la app
 */
export function validateCSV(csvContent: string): { valid: boolean; error?: string } {
  try {
    const parsed = Papa.parse(csvContent, { header: true, skipEmptyLines: true });
    
    if (!parsed.data || parsed.data.length === 0) {
      return { valid: false, error: 'CSV vacío' };
    }
    
    // Verificar que al menos la primera fila tiene datos
    const firstRow = parsed.data[0] as any;
    if (!firstRow.MATRÍCULA) {
      return { valid: false, error: 'Falta columna MATRÍCULA' };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: `Error al parsear CSV: ${error}` };
  }
}
