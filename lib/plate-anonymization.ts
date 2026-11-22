export const PLATE_ANONYMIZATION_SYMBOLS = ["░", "▒", "▓"] as const;

const DIGITS = "0123456789";
const ALLOWED_LETTERS = "BCDFGHJKLMNPRSTVWXYZ";

export type PlateSymbolMap = Record<string, string>;

function shuffledCharacters(
  characters: string,
  random: () => number
): string[] {
  const result = [...characters];

  for (let i = result.length - 1; i > 0; i--) {
    const value = random();
    const safeValue = Number.isFinite(value)
      ? Math.max(0, Math.min(0.999999999, value))
      : 0;
    const j = Math.floor(safeValue * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }

  return result;
}

function assignGroups(
  characters: string,
  groupSizes: readonly number[],
  mapping: PlateSymbolMap,
  random: () => number
): void {
  const shuffled = shuffledCharacters(characters, random);
  let offset = 0;

  groupSizes.forEach((size, index) => {
    const symbol = PLATE_ANONYMIZATION_SYMBOLS[index];

    for (const character of shuffled.slice(offset, offset + size)) {
      mapping[character] = symbol;
    }

    offset += size;
  });
}

export function createPlateSymbolMap(
  random: () => number = Math.random
): PlateSymbolMap {
  const mapping: PlateSymbolMap = {};

  assignGroups(DIGITS, [3, 3, 4], mapping, random);
  assignGroups(ALLOWED_LETTERS, [6, 7, 7], mapping, random);

  return mapping;
}

export function anonymizePlate(
  licensePlate: string,
  mapping: PlateSymbolMap
): string {
  return licensePlate.replace(/[A-Z0-9]/gi, (character) => {
    return mapping[character.toUpperCase()] ?? character;
  });
}
