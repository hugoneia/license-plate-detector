import { describe, expect, it } from 'vitest';

import {
  generateEncryptedCSV,
  importCSVWithEncryption,
} from './csv-crypto-utils';

describe('csv-crypto-utils parking types', () => {
  it('exports all supported parking type codes', () => {
    const timestamp = new Date('2026-08-19T12:30:00').getTime();

    const entries = [
      {
        id: '1',
        licensePlate: '1234BCD',
        timestamp,
        location: 'NO GPS' as const,
        confidence: 'high' as const,
        parkingLocation: 'acera' as const,
      },
      {
        id: '2',
        licensePlate: '1234BCF',
        timestamp,
        location: 'NO GPS' as const,
        confidence: 'high' as const,
        parkingLocation: 'parking_movilidad' as const,
      },
      {
        id: '3',
        licensePlate: '1234BCG',
        timestamp,
        location: 'NO GPS' as const,
        confidence: 'high' as const,
        parkingLocation: 'doble_fila' as const,
      },
      {
        id: '4',
        licensePlate: '1234BCH',
        timestamp,
        location: 'NO GPS' as const,
        confidence: 'high' as const,
        parkingLocation: 'otro_tipo' as const,
      },
      {
        id: '5',
        licensePlate: '1234BCJ',
        timestamp,
        location: 'NO GPS' as const,
        confidence: 'high' as const,
        parkingLocation: 'parking_ok' as const,
      },
      {
        id: '6',
        licensePlate: '1234BCK',
        timestamp,
        location: 'NO GPS' as const,
        confidence: 'high' as const,
        parkingLocation: 'sin_definir' as const,
      },
    ];

    const csv = generateEncryptedCSV(entries, false);

    expect(csv).toContain('AC');
    expect(csv).toContain('PM');
    expect(csv).toContain('DF');
    expect(csv).toContain('OT');
    expect(csv).toContain('OK');
    expect(csv).toContain('SD');
  });

  it('imports all supported parking type codes', async () => {
    const csv = [
      'MATRÍCULA,FECHA,HORA,GPS,LUGAR,CONFIANZA',
      '1234BCD,19/08/2026,12:30,NO GPS,AC,high',
      '1234BCF,19/08/2026,12:31,NO GPS,PM,high',
      '1234BCG,19/08/2026,12:32,NO GPS,DF,high',
      '1234BCH,19/08/2026,12:33,NO GPS,OT,high',
      '1234BCJ,19/08/2026,12:34,NO GPS,OK,high',
      '1234BCK,19/08/2026,12:35,NO GPS,SD,high',
    ].join('\n');

    const entries = await importCSVWithEncryption(
      csv,
      false
    );

    expect(entries.map((entry) => entry.parkingLocation)).toEqual([
      'acera',
      'parking_movilidad',
      'doble_fila',
      'otro_tipo',
      'parking_ok',
      'sin_definir',
    ]);
  });

  it('maps unknown parking codes to SD', async () => {
    const csv = [
      'MATRÍCULA,FECHA,HORA,GPS,LUGAR,CONFIANZA',
      '1234BCD,19/08/2026,12:30,NO GPS,XX,high',
    ].join('\n');

    const entries = await importCSVWithEncryption(
      csv,
      false
    );

    expect(entries).toHaveLength(1);
    expect(entries[0].parkingLocation).toBe('sin_definir');
  });

  it('keeps plaintext CSV imports unencrypted when the app is unencrypted', async () => {
    const csv = [
      'MATRÍCULA,FECHA,HORA,GPS,LUGAR,CONFIANZA',
      '1234BCD,19/08/2026,12:30,NO GPS,AC,high',
    ].join('\n');

    const entries = await importCSVWithEncryption(
      csv,
      false
    );

    expect(entries[0].licensePlate).toBe('1234BCD');
  });
});