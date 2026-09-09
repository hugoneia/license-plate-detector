import { describe, expect, it } from "vitest";

import {
PARKING_TYPE_LIST,
getParkingType,
getParkingTypeByCode,
} from "@/constants/parking-types";

describe("parking types usage contract", () => {
it("keeps the selectable parking types in catalog order", () => {
const selectable = PARKING_TYPE_LIST
.filter((type) => type.selectable)
.map((type) => type.id);

expect(selectable).toEqual([
  "acera",
  "parking_movilidad",
  "doble_fila",
  "otro_tipo",
]);

});

it("does not allow OK or SD to be selected manually", () => {
expect(
PARKING_TYPE_LIST.find((type) => type.id === "parking_ok")?.selectable
).toBe(false);

expect(
  PARKING_TYPE_LIST.find((type) => type.id === "sin_definir")?.selectable
).toBe(false);

});

it("keeps only AC and DF enabled for statistics", () => {
const statisticsTypes = PARKING_TYPE_LIST
.filter((type) => type.showInStatistics)
.map((type) => type.id);

expect(statisticsTypes).toEqual([
  "acera",
  "doble_fila",
]);

});

it("keeps AC, PM, DF and OT visible on the general map", () => {
const mapTypes = PARKING_TYPE_LIST
.filter((type) => type.showInGeneralMap)
.map((type) => type.id);

expect(mapTypes).toEqual([
  "acera",
  "parking_movilidad",
  "doble_fila",
  "otro_tipo",
]);

});

it("resolves every supported CSV code through the central catalog", () => {
expect(getParkingTypeByCode("AC").id).toBe("acera");
expect(getParkingTypeByCode("PM").id).toBe("parking_movilidad");
expect(getParkingTypeByCode("DF").id).toBe("doble_fila");
expect(getParkingTypeByCode("OT").id).toBe("otro_tipo");
expect(getParkingTypeByCode("OK").id).toBe("parking_ok");
expect(getParkingTypeByCode("SD").id).toBe("sin_definir");
});

it("returns SD for an unknown parking code", () => {
expect(getParkingTypeByCode("XX").id).toBe("sin_definir");
expect(getParkingTypeByCode("UNKNOWN").id).toBe("sin_definir");
});

it("uses the catalog definition for labels and codes", () => {
for (const type of PARKING_TYPE_LIST) {
const resolved = getParkingType(type.id);

  expect(resolved.id).toBe(type.id);
  expect(resolved.code).toBe(type.code);
  expect(resolved.label).toBe(type.label);
}

});

it("keeps SD non-exportable", () => {
expect(
PARKING_TYPE_LIST.find((type) => type.id === "sin_definir")
?.exportable
).toBe(false);
});

it("keeps all explicit parking types exportable", () => {
const exportable = PARKING_TYPE_LIST
.filter((type) => type.exportable)
.map((type) => type.id);

expect(exportable).toEqual([
  "acera",
  "parking_movilidad",
  "doble_fila",
  "otro_tipo",
  "parking_ok",
]);

});
});