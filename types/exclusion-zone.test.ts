import { describe, it, expect } from "vitest";
import {
  calculateHaversineDistance,
  isWithinExclusionZone,
  isInAnyExclusionZone,
  type ExclusionZone,
} from "./exclusion-zone";

describe("Exclusion Zone Functions", () => {
  describe("calculateHaversineDistance", () => {
    it("should calculate distance between two points in Madrid", () => {
      // Puerta del Sol (40.4168, -3.7038)
      // Plaza Mayor (40.4155, -3.7077)
      // Distancia aproximada: 400-500 metros
      const distance = calculateHaversineDistance(40.4168, -3.7038, 40.4155, -3.7077);
      expect(distance).toBeGreaterThan(300);
      expect(distance).toBeLessThan(600);
    });

    it("should return 0 for same coordinates", () => {
      const distance = calculateHaversineDistance(40.4168, -3.7038, 40.4168, -3.7038);
      expect(distance).toBeLessThan(1); // Casi 0, permitiendo errores de precisión
    });

    it("should calculate distance between Barcelona and Madrid", () => {
      // Barcelona: 41.3851, 2.1734
      // Madrid: 40.4168, -3.7038
      // Distancia aproximada: 560 km
      const distance = calculateHaversineDistance(41.3851, 2.1734, 40.4168, -3.7038);
      expect(distance).toBeGreaterThan(500000); // Más de 500 km
      expect(distance).toBeLessThan(600000); // Menos de 600 km
    });
  });

  describe("isWithinExclusionZone", () => {
    const testZone: ExclusionZone = {
      id: "zone-1",
      name: "Centro Madrid",
      latitude: 40.4168,
      longitude: -3.7038,
      radiusMeters: 500,
      enabled: true,
      createdAt: Date.now(),
    };

    it("should detect point within zone", () => {
      // Punto muy cercano (dentro de 500m)
      const result = isWithinExclusionZone(40.4168, -3.7038, testZone);
      expect(result).toBe(true);
    });

    it("should detect point outside zone", () => {
      // Punto a más de 500m
      const result = isWithinExclusionZone(40.4, -3.7, testZone);
      expect(result).toBe(false);
    });

    it("should return false if zone is disabled", () => {
      const disabledZone = { ...testZone, enabled: false };
      const result = isWithinExclusionZone(40.4168, -3.7038, disabledZone);
      expect(result).toBe(false);
    });

    it("should detect point at zone boundary", () => {
      // Usar un punto dentro del radio: 40.4168 + 0.004 aprox 450m
      const result = isWithinExclusionZone(40.4208, -3.7038, testZone);
      expect(result).toBe(true); // Dentro del radio de 500m
    });
  });

  describe("isInAnyExclusionZone", () => {
    const zones: ExclusionZone[] = [
      {
        id: "zone-1",
        name: "Centro",
        latitude: 40.4168,
        longitude: -3.7038,
        radiusMeters: 500,
        enabled: true,
        createdAt: Date.now(),
      },
      {
        id: "zone-2",
        name: "Retiro",
        latitude: 40.4117,
        longitude: -3.6817,
        radiusMeters: 300,
        enabled: true,
        createdAt: Date.now(),
      },
    ];

    it("should detect point in first zone", () => {
      const result = isInAnyExclusionZone(40.4168, -3.7038, zones);
      expect(result).toBe(true);
    });

    it("should detect point in second zone", () => {
      const result = isInAnyExclusionZone(40.4117, -3.6817, zones);
      expect(result).toBe(true);
    });

    it("should return false if point is outside all zones", () => {
      const result = isInAnyExclusionZone(40.3, -3.5, zones);
      expect(result).toBe(false);
    });

    it("should return false if all zones are disabled", () => {
      const disabledZones = zones.map((z) => ({ ...z, enabled: false }));
      const result = isInAnyExclusionZone(40.4168, -3.7038, disabledZones);
      expect(result).toBe(false);
    });

    it("should handle empty zones array", () => {
      const result = isInAnyExclusionZone(40.4168, -3.7038, []);
      expect(result).toBe(false);
    });
  });
});
