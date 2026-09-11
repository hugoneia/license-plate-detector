import { describe, expect, it } from "vitest";

import {
  PARKING_TYPES,
  PARKING_TYPE_LIST,
  type ParkingTypeId,
} from "./parking-types";

import {
  getGeneralMapParkingTypes,
  getParkingType,
  getParkingTypeByCode,
  getSelectableParkingTypes,
  getStatisticParkingTypes,
  isParkingTypeId,
} from "@/lib/parking-types";

describe("PARKING_TYPES", () => {
  it("contains exactly the six supported parking types", () => {
    const ids = PARKING_TYPE_LIST.map((type) => type.id);

    expect(ids).toEqual([
      "acera",
      "doble_fila",
      "parking_movilidad",
      "otro_tipo",
      "parking_ok",
      "sin_definir",
    ]);
  });

  it("uses the expected CSV codes", () => {
    expect(PARKING_TYPES.acera.code).toBe("AC");
    expect(PARKING_TYPES.parking_movilidad.code).toBe("PM");
    expect(PARKING_TYPES.doble_fila.code).toBe("DF");
    expect(PARKING_TYPES.otro_tipo.code).toBe("OT");
    expect(PARKING_TYPES.parking_ok.code).toBe("OK");
    expect(PARKING_TYPES.sin_definir.code).toBe("SD");
  });

  it("keeps the visual order stable", () => {
    expect(PARKING_TYPES.acera.order).toBe(1);
    expect(PARKING_TYPES.parking_movilidad.order).toBe(3);
    expect(PARKING_TYPES.doble_fila.order).toBe(2);
    expect(PARKING_TYPES.otro_tipo.order).toBe(4);
    expect(PARKING_TYPES.parking_ok.order).toBe(5);
    expect(PARKING_TYPES.sin_definir.order).toBe(6);
  });

  it("only AC, PM, DF and OT are user-selectable", () => {
    const ids = getSelectableParkingTypes().map((type) => type.id);

    expect(ids).toEqual([
      "acera",
      "doble_fila",
      "parking_movilidad",
      "otro_tipo",
    ]);
  });

  it("OK and SD cannot be selected manually", () => {
    expect(PARKING_TYPES.parking_ok.selectable).toBe(false);
    expect(PARKING_TYPES.sin_definir.selectable).toBe(false);
  });

  it("AC, PM, DF and OT are visible on the general map", () => {
    const ids = getGeneralMapParkingTypes().map((type) => type.id);

    expect(ids).toEqual([
      "acera",
      "doble_fila",
      "parking_movilidad",
      "otro_tipo",
    ]);
  });

  it("OK and SD are not visible on the general map", () => {
    expect(PARKING_TYPES.parking_ok.showInGeneralMap).toBe(false);
    expect(PARKING_TYPES.sin_definir.showInGeneralMap).toBe(false);
  });

  it("only AC and DF are currently enabled for statistics", () => {
    const ids = getStatisticParkingTypes().map((type) => type.id);

    expect(ids).toEqual([
      "acera",
      "doble_fila",
      "parking_movilidad",
      "otro_tipo",
    ]);
  });

  it("maps every supported CSV code to its corresponding type", () => {
    expect(getParkingTypeByCode("AC").id).toBe("acera");
    expect(getParkingTypeByCode("PM").id).toBe("parking_movilidad");
    expect(getParkingTypeByCode("DF").id).toBe("doble_fila");
    expect(getParkingTypeByCode("OT").id).toBe("otro_tipo");
    expect(getParkingTypeByCode("OK").id).toBe("parking_ok");
    expect(getParkingTypeByCode("SD").id).toBe("sin_definir");
  });

  it("accepts CSV codes case-insensitively and ignores surrounding spaces", () => {
    expect(getParkingTypeByCode(" ac ").id).toBe("acera");
    expect(getParkingTypeByCode("pm").id).toBe("parking_movilidad");
    expect(getParkingTypeByCode(" Df ").id).toBe("doble_fila");
  });

  it("falls back to SD for an unknown CSV code", () => {
    expect(getParkingTypeByCode("XX").id).toBe("sin_definir");
    expect(getParkingTypeByCode("UNKNOWN").id).toBe("sin_definir");
    expect(getParkingTypeByCode(null).id).toBe("sin_definir");
    expect(getParkingTypeByCode(undefined).id).toBe("sin_definir");
  });

  it("returns SD when no parking type is defined", () => {
    expect(getParkingType(null).id).toBe("sin_definir");
    expect(getParkingType(undefined).id).toBe("sin_definir");
  });

  it("recognizes valid parking type ids", () => {
    const validIds: ParkingTypeId[] = [
      "acera",
      "doble_fila",
      "parking_movilidad",
      "otro_tipo",
      "parking_ok",
      "sin_definir",
    ];

    for (const id of validIds) {
      expect(isParkingTypeId(id)).toBe(true);
    }
  });

  it("rejects unknown parking type ids", () => {
    expect(isParkingTypeId("unknown")).toBe(false);
    expect(isParkingTypeId("AC")).toBe(false);
    expect(isParkingTypeId("")).toBe(false);
    expect(isParkingTypeId(null)).toBe(false);
    expect(isParkingTypeId(undefined)).toBe(false);
  });

  it("defines the expected labels", () => {
    expect(PARKING_TYPES.acera.label).toBe("En la acera");
    expect(PARKING_TYPES.parking_movilidad.label).toBe("En plaza PMR");
    expect(PARKING_TYPES.doble_fila.label).toBe("En doble fila");
    expect(PARKING_TYPES.otro_tipo.label).toBe("Otros");
    expect(PARKING_TYPES.parking_ok.label).toBe("Parking Correcto");
    expect(PARKING_TYPES.sin_definir.label).toBe("Sin definir");
  });

  it("keeps SD non-exportable", () => {
    expect(PARKING_TYPES.sin_definir.exportable).toBe(false);
  });

  it("keeps the remaining explicit parking types exportable", () => {
    expect(PARKING_TYPES.acera.exportable).toBe(true);
    expect(PARKING_TYPES.parking_movilidad.exportable).toBe(true);
    expect(PARKING_TYPES.doble_fila.exportable).toBe(true);
    expect(PARKING_TYPES.otro_tipo.exportable).toBe(true);
    expect(PARKING_TYPES.parking_ok.exportable).toBe(true);
  });
});