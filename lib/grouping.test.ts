import { describe, it, expect } from "vitest";
import {
  groupLicensePlates,
  getUniquePlateStats,
  formatGroupedPlateForDisplay,
  formatGroupedPlateForFile,
} from "./grouping";
import type { LicensePlateEntry } from "@/types/license-plate";

describe("Grouping Utilities", () => {
  const mockEntries: LicensePlateEntry[] = [
    {
      id: "1",
      licensePlate: "1234ABC",
      timestamp: Date.now(),
      confidence: "high",
      location: { latitude: 40.4168, longitude: -3.7038 },
    },
    {
      id: "2",
      licensePlate: "1234ABC",
      timestamp: Date.now() - 86400000,
      confidence: "high",
      location: "NO GPS",
    },
    {
      id: "3",
      licensePlate: "5678DEF",
      timestamp: Date.now() - 172800000,
      confidence: "medium",
      location: { latitude: 41.3851, longitude: 2.1734 },
    },
    {
      id: "4",
      licensePlate: "1234ABC",
      timestamp: Date.now() - 259200000,
      confidence: "low",
      location: "NO GPS",
    },
  ];

  describe("groupLicensePlates", () => {
    it("should group plates correctly", () => {
      const grouped = groupLicensePlates(mockEntries);
      expect(grouped.length).toBe(2);
    });

    it("should count occurrences correctly", () => {
      const grouped = groupLicensePlates(mockEntries);
      const plate1234 = grouped.find((g) => g.licensePlate === "1234ABC");
      expect(plate1234?.count).toBe(3);
    });

    it("should set correct first and last seen times", () => {
      const grouped = groupLicensePlates(mockEntries);
      const plate1234 = grouped.find((g) => g.licensePlate === "1234ABC");
      expect(plate1234?.firstSeen).toBeLessThan(plate1234?.lastSeen || 0);
    });

    it("should sort by most recent first", () => {
      const grouped = groupLicensePlates(mockEntries);
      expect(grouped[0].licensePlate).toBe("1234ABC"); // Most recent
    });

    it("should handle empty input", () => {
      const grouped = groupLicensePlates([]);
      expect(grouped.length).toBe(0);
    });
  });

  describe("getUniquePlateStats", () => {
    it("should calculate total unique plates", () => {
      const stats = getUniquePlateStats(mockEntries);
      expect(stats.totalUnique).toBe(2);
    });

    it("should calculate total detections", () => {
      const stats = getUniquePlateStats(mockEntries);
      expect(stats.totalDetections).toBe(4);
    });

    it("should calculate average detections per plate", () => {
      const stats = getUniquePlateStats(mockEntries);
      expect(stats.averageDetectionsPerPlate).toBe(2);
    });

    it("should identify most detected plate", () => {
      const stats = getUniquePlateStats(mockEntries);
      expect(stats.mostDetectedPlate?.licensePlate).toBe("1234ABC");
      expect(stats.mostDetectedPlate?.count).toBe(3);
    });

    it("should handle empty input", () => {
      const stats = getUniquePlateStats([]);
      expect(stats.totalUnique).toBe(0);
      expect(stats.totalDetections).toBe(0);
      expect(stats.averageDetectionsPerPlate).toBe(0);
    });
  });

  describe("formatGroupedPlateForDisplay", () => {
    it("should format single detection", () => {
      const grouped = groupLicensePlates(mockEntries);
      const single = grouped.find((g) => g.licensePlate === "5678DEF");
      if (single) {
        const formatted = formatGroupedPlateForDisplay(single);
        expect(formatted).toContain("5678DEF");
        expect(formatted).not.toContain("x)");
      }
    });

    it("should format multiple detections", () => {
      const grouped = groupLicensePlates(mockEntries);
      const multiple = grouped.find((g) => g.licensePlate === "1234ABC");
      if (multiple) {
        const formatted = formatGroupedPlateForDisplay(multiple);
        expect(formatted).toContain("1234ABC");
        expect(formatted).toContain("(3x)");
      }
    });
  });

  describe("formatGroupedPlateForFile", () => {
    it("should format single detection for file", () => {
      const grouped = groupLicensePlates(mockEntries);
      const single = grouped.find((g) => g.licensePlate === "5678DEF");
      if (single) {
        const formatted = formatGroupedPlateForFile(single);
        expect(formatted).toContain("5678DEF");
        expect(formatted).toContain("|");
      }
    });

    it("should format multiple detections for file", () => {
      const grouped = groupLicensePlates(mockEntries);
      const multiple = grouped.find((g) => g.licensePlate === "1234ABC");
      if (multiple) {
        const formatted = formatGroupedPlateForFile(multiple);
        expect(formatted).toContain("1234ABC");
        expect(formatted).toContain("(3 detecciones)");
        expect(formatted).toContain("1.");
        expect(formatted).toContain("2.");
        expect(formatted).toContain("3.");
      }
    });

    it("should include location information", () => {
      const grouped = groupLicensePlates(mockEntries);
      const group = grouped[0];
      const formatted = formatGroupedPlateForFile(group);
      expect(formatted).toContain("|");
    });
  });
});
