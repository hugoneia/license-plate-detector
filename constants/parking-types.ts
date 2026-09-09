export type ParkingTypeId =
  | "parking_movilidad"
  | "doble_fila"
  | "acera"
  | "parking_ok"
  | "otro_tipo"
  | "sin_definir";

export type ParkingTypeDefinition = {
  id: ParkingTypeId;
  code: "PM" | "DF" | "AC" | "OK" | "OT" | "SD";
  label: string;
  mapLabel: string;
  color: string;

  /** Puede aparecer como opción seleccionable al registrar/editar. */
  selectable: boolean;

  /** Puede aparecer en el mapa general de todos los registros. */
  showInGeneralMap: boolean;

  /** Está preparado para aparecer como bloque de estadísticas. */
  showInStatistics: boolean;

  /** Puede aparecer como tipo explícito en la exportación CSV. */
  exportable: boolean;

  /** Orden común para selector, estadísticas, mapa, etc. */
  order: number;
};

export const PARKING_TYPES: Record<ParkingTypeId, ParkingTypeDefinition> = {
  parking_movilidad: {
    id: "parking_movilidad",
    code: "PM",
    label: "En plaza PMR",
    mapLabel: "Plaza PMR",
    color: "#0066ff",
    selectable: true,
    showInGeneralMap: true,
    showInStatistics: false,
    exportable: true,
    order: 2,
  },

  doble_fila: {
    id: "doble_fila",
    code: "DF",
    label: "En doble fila",
    mapLabel: "Doble fila",
    color: "#ff9900",
    selectable: true,
    showInGeneralMap: true,
    showInStatistics: true,
    exportable: true,
    order: 3,
  },

  acera: {
    id: "acera",
    code: "AC",
    label: "En la acera",
    mapLabel: "Acera",
    color: "#ff0000",
    selectable: true,
    showInGeneralMap: true,
    showInStatistics: true,
    exportable: true,
    order: 1,
  },

  parking_ok: {
    id: "parking_ok",
    code: "OK",
    label: "Parking Correcto",
    mapLabel: "Parking Correcto",
    color: "#00aa00",
    selectable: false,
    showInGeneralMap: false,
    showInStatistics: false,
    exportable: true,
    order: 5,
  },

  otro_tipo: {
    id: "otro_tipo",
    code: "OT",
    label: "Otros",
    mapLabel: "Otros",
    color: "#8000aa",
    selectable: true,
    showInGeneralMap: true,
    showInStatistics: false,
    exportable: true,
    order: 4,
  },

  sin_definir: {
    id: "sin_definir",
    code: "SD",
    label: "Sin definir",
    mapLabel: "Sin definir",
    color: "#808080",
    selectable: false,
    showInGeneralMap: false,
    showInStatistics: false,
    exportable: false,
    order: 6,
  },
};

export const PARKING_TYPE_LIST = Object.values(PARKING_TYPES).sort(
  (a, b) => a.order - b.order
);

export function getParkingType(
  id: ParkingTypeId | null | undefined
): ParkingTypeDefinition {
  return id ? PARKING_TYPES[id] : PARKING_TYPES.sin_definir;
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