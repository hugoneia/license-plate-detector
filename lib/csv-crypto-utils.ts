import Papa from 'papaparse';
import { encryptPlate, decryptPlate } from './crypto-core';
import type { ParkingLocation } from '@/types/license-plate';
import {
  getParkingType,
  getParkingTypeByCode,
} from '@/lib/parking-types';

type LicensePlateEntry = {
  id: string;
  licensePlate: string;
  timestamp: number;
  imageUri?: string;
  confidence: 'high' | 'medium' | 'low';
  location?: { latitude: number; longitude: number; accuracy?: number } | 'NO GPS';
  parkingLocation?: ParkingLocation;
};

/**
 * Exporta matrículas a CSV con cifrado opcional.
 *
 * Las matrículas pueden cifrarse, pero fecha, hora, GPS,
 * tipo de estacionamiento y confianza permanecen en texto plano.
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
    const timeStr = date.toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const gpsStr =
      entry.location === 'NO GPS'
        ? 'NO GPS'
        : entry.location
        ? `${entry.location.latitude.toFixed(6)},${entry.location.longitude.toFixed(6)}`
        : 'NO GPS';

    // El catálogo centralizado decide el código CSV.
    // null/undefined/valor inválido => SD.
    const parkingCode = getParkingType(entry.parkingLocation).code;

    let plate = entry.licensePlate;

    // Mantener exactamente el comportamiento actual de cifrado.
    if (encryptionEnabled && masterPassword) {
      plate = encryptPlate(plate, masterPassword);
    }

    return [
      plate,
      dateStr,
      timeStr,
      gpsStr,
      parkingCode,
      entry.confidence || 'high',
    ];
  });

  return Papa.unparse({
    fields: headers,
    data: rows,
  });
}

/**
 * Detecta si un CSV contiene matrículas cifradas.
 *
 * Retorna:
 * - 'plaintext' si las matrículas están en texto plano.
 * - 'encrypted' si parecen estar cifradas.
 */
export function detectCSVEncryption(
  csvContent: string
): 'plaintext' | 'encrypted' {
  const lines = csvContent.trim().split('\n');

  if (lines.length < 2) {
    return 'plaintext';
  }

  const firstDataLine = lines[1];
  const fields = Papa.parse(firstDataLine).data[0] as string[];

  if (!fields || fields.length === 0) {
    return 'plaintext';
  }

  const firstPlate = fields[0];

  if (/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(firstPlate.toUpperCase())) {
    return 'plaintext';
  }

  if (/^[A-Za-z0-9+/=]+$/.test(firstPlate) && firstPlate.length > 20) {
    return 'encrypted';
  }

  return 'plaintext';
}

/**
 * Importa CSV con matriz de compatibilidad de cifrado.
 *
 * CASO A:
 * CSV plano + App plana → importa directamente.
 *
 * CASO B:
 * CSV plano + App cifrada → cifra matrículas con contraseña de app.
 *
 * CASO C:
 * CSV cifrado + App plana → descifra con contraseña del CSV.
 *
 * CASO C2:
 * CSV cifrado + App cifrada → descifra con contraseña del CSV
 * y vuelve a cifrar con contraseña de la app.
 */
export async function importCSVWithEncryption(
  csvContent: string,
  appEncryptionEnabled: boolean,
  appMasterPassword?: string,
  csvPassword?: string
): Promise<LicensePlateEntry[]> {
  const csvType = detectCSVEncryption(csvContent);

  const parsed = Papa.parse(csvContent, {
    header: true,
    skipEmptyLines: true,
  });

  if (!parsed.data || parsed.data.length === 0) {
    throw new Error('CSV vacío o inválido');
  }

  const entries: LicensePlateEntry[] = [];

  for (const row of parsed.data as any[]) {
    try {
      let plate = row.MATRÍCULA?.trim() || '';

      if (!plate) {
        continue;
      }

      // CSV cifrado.
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

        // Si la app también usa cifrado, volver a cifrar
        // con la contraseña de la aplicación.
        if (appEncryptionEnabled && appMasterPassword) {
          plate = encryptPlate(plate, appMasterPassword);
        }
      }

      // CSV plano + aplicación cifrada.
      else if (
        csvType === 'plaintext' &&
        appEncryptionEnabled &&
        appMasterPassword
      ) {
        plate = encryptPlate(plate, appMasterPassword);
      }

      // CSV plano + aplicación plana:
      // no se modifica la matrícula.

      // Parsear GPS.
      let location: { latitude: number; longitude: number } | 'NO GPS' =
        'NO GPS';

      const gpsStr = row.GPS?.trim();

      if (gpsStr && gpsStr !== 'NO GPS') {
        const [lat, lon] = gpsStr
          .split(',')
          .map((s: string) => parseFloat(s.trim()));

        if (!isNaN(lat) && !isNaN(lon)) {
          location = {
            latitude: lat,
            longitude: lon,
          };
        }
      }

      // Parsear tipo de estacionamiento mediante el catálogo centralizado.
      //
      // AC → acera
      // PM → parking_movilidad
      // DF → doble_fila
      // OT → otro_tipo
      // OK → parking_ok
      // SD → sin_definir
      //
      // Código desconocido → SD.
      const parkingType = getParkingTypeByCode(row.LUGAR);

      const parkingLocation: ParkingLocation = parkingType.id;

      const entry: LicensePlateEntry = {
        id: `${plate}-${Date.now()}`,
        licensePlate: plate,
        timestamp: new Date(
          `${row.FECHA} ${row.HORA}`
        ).getTime(),
        location,
        confidence:
          (row.CONFIANZA as 'high' | 'medium' | 'low') || 'high',
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
 * Valida que un CSV sea compatible con la app.
 */
export function validateCSV(
  csvContent: string
): { valid: boolean; error?: string } {
  try {
    const parsed = Papa.parse(csvContent, {
      header: true,
      skipEmptyLines: true,
    });

    if (!parsed.data || parsed.data.length === 0) {
      return {
        valid: false,
        error: 'CSV vacío',
      };
    }

    const firstRow = parsed.data[0] as any;

    if (!firstRow.MATRÍCULA) {
      return {
        valid: false,
        error: 'Falta columna MATRÍCULA',
      };
    }

    return {
      valid: true,
    };
  } catch (error) {
    return {
      valid: false,
      error: `Error al parsear CSV: ${error}`,
    };
  }
}