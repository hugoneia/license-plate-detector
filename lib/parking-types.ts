import {
  PARKING_TYPES,
  PARKING_TYPE_LIST,
  type ParkingTypeDefinition,
  type ParkingTypeId,
} from "@/constants/parking-types";

export function getParkingType(
  id: ParkingTypeId | null | undefined
): ParkingTypeDefinition {
  return id ? PARKING_TYPES[id] : PARKING_TYPES.sin_definir;
}

export function getParkingTypeCode(
  id: ParkingTypeId | null | undefined
): string {
  return getParkingType(id).code;
}

export function getParkingTypeLabel(
  id: ParkingTypeId | null | undefined
): string {
  return getParkingType(id).label;
}

export function getParkingTypeMapLabel(
  id: ParkingTypeId | null | undefined
): string {
  return getParkingType(id).mapLabel;
}

export function getParkingTypeColor(
  id: ParkingTypeId | null | undefined
): string {
  return getParkingType(id).color;
}

export function getParkingTypeByCode(
  code: string | null | undefined
): ParkingTypeDefinition {
  const normalizedCode = code?.trim().toUpperCase();

  return (
    PARKING_TYPE_LIST.find((type) => type.code === normalizedCode) ??
    PARKING_TYPES.sin_definir
  );
}

export function getSelectableParkingTypes(): ParkingTypeDefinition[] {
  return PARKING_TYPE_LIST.filter((type) => type.selectable);
}

export function getStatisticParkingTypes(): ParkingTypeDefinition[] {
  return PARKING_TYPE_LIST.filter((type) => type.showInStatistics);
}

export function getGeneralMapParkingTypes(): ParkingTypeDefinition[] {
  return PARKING_TYPE_LIST.filter((type) => type.showInGeneralMap);
}

export function isParkingTypeId(
  value: string | null | undefined
): value is ParkingTypeId {
  return !!value && value in PARKING_TYPES;
}