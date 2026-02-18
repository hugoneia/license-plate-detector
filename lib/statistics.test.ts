import { describe, it, expect } from "vitest";
import {
  calculateStatistics,
  getLast30DaysStats,
  getLast12MonthsStats,
  formatDateForDisplay,
  formatMonthForDisplay,
} from "./statistics";
import type { LicensePlateEntry } from "@/types/license-plate";

describe("Statistics Utilities", () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterday = today - 24 * 60 * 60 * 1000;
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
  const lastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1).getTime();

  const mockEntries: LicensePlateEntry[] = [
    {
      id: "1",
      licensePlate: "1234ABC",
      timestamp: today,
      confidence: "high",
    },
    {
      id: "2",
      licensePlate: "5678DEF",
      timestamp: today,
      confidence: "high",
    },
    {
      id: "3",
      licensePlate: "9012GHI",
      timestamp: yesterday,
      confidence: "medium",
    },
    {
      id: "4",
      licensePlate: "3456JKL",
      timestamp: lastMonth,
      confidence: "low",
    },
    {
      id: "5",
      licensePlate: "7890MNO",
      timestamp: lastYear,
      confidence: "high",
    },
  ];

  describe("calculateStatistics", () => {
    it("should calculate total count correctly", () => {
      const stats = calculateStatistics(mockEntries);
      expect(stats.total).toBe(5);
    });

    it("should calculate today count correctly", () => {
      const stats = calculateStatistics(mockEntries);
      expect(stats.today).toBe(2);
    });

    it("should calculate this month count correctly", () => {
      const stats = calculateStatistics(mockEntries);
      expect(stats.thisMonth).toBeGreaterThanOrEqual(2); // At least today's entries
    });

    it("should calculate this year count correctly", () => {
      const stats = calculateStatistics(mockEntries);
      expect(stats.thisYear).toBeGreaterThanOrEqual(3); // At least today + yesterday + this month
    });

    it("should return empty arrays for empty input", () => {
      const stats = calculateStatistics([]);
      expect(stats.total).toBe(0);
      expect(stats.today).toBe(0);
      expect(stats.thisMonth).toBe(0);
      expect(stats.thisYear).toBe(0);
      expect(stats.dailyStats).toEqual([]);
      expect(stats.monthlyStats).toEqual([]);
    });

    it("should include daily stats", () => {
      const stats = calculateStatistics(mockEntries);
      expect(stats.dailyStats.length).toBeGreaterThan(0);
      expect(stats.dailyStats[0]).toHaveProperty("date");
      expect(stats.dailyStats[0]).toHaveProperty("count");
      expect(stats.dailyStats[0]).toHaveProperty("timestamp");
    });

    it("should include monthly stats", () => {
      const stats = calculateStatistics(mockEntries);
      expect(stats.monthlyStats.length).toBeGreaterThan(0);
      expect(stats.monthlyStats[0]).toHaveProperty("month");
      expect(stats.monthlyStats[0]).toHaveProperty("count");
      expect(stats.monthlyStats[0]).toHaveProperty("year");
    });
  });

  describe("getLast30DaysStats", () => {
    it("should return 31 days of data (30 days + today)", () => {
      const stats = getLast30DaysStats(mockEntries);
      expect(stats.length).toBe(31);
    });

    it("should include all days even with zero count", () => {
      const stats = getLast30DaysStats(mockEntries);
      const hasZeroCount = stats.some((s) => s.count === 0);
      expect(hasZeroCount).toBe(true);
    });

    it("should have correct structure", () => {
      const stats = getLast30DaysStats(mockEntries);
      stats.forEach((stat) => {
        expect(stat).toHaveProperty("date");
        expect(stat).toHaveProperty("count");
        expect(stat).toHaveProperty("timestamp");
        expect(stat.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    it("should be sorted by date", () => {
      const stats = getLast30DaysStats(mockEntries);
      for (let i = 1; i < stats.length; i++) {
        expect(stats[i].timestamp).toBeGreaterThanOrEqual(stats[i - 1].timestamp);
      }
    });
  });

  describe("getLast12MonthsStats", () => {
    it("should return 13 months of data (12 months + current month)", () => {
      const stats = getLast12MonthsStats(mockEntries);
      expect(stats.length).toBe(13);
    });

    it("should include all months even with zero count", () => {
      const stats = getLast12MonthsStats(mockEntries);
      const hasZeroCount = stats.some((s) => s.count === 0);
      expect(hasZeroCount).toBe(true);
    });

    it("should have correct structure", () => {
      const stats = getLast12MonthsStats(mockEntries);
      stats.forEach((stat) => {
        expect(stat).toHaveProperty("month");
        expect(stat).toHaveProperty("count");
        expect(stat).toHaveProperty("year");
        expect(stat.month).toMatch(/^\d{4}-\d{2}$/);
      });
    });

    it("should be sorted by month", () => {
      const stats = getLast12MonthsStats(mockEntries);
      for (let i = 1; i < stats.length; i++) {
        expect(stats[i].month >= stats[i - 1].month).toBe(true);
      }
    });
  });

  describe("formatDateForDisplay", () => {
    it("should format date correctly", () => {
      const formatted = formatDateForDisplay("2026-02-18");
      expect(formatted).toContain("18");
      expect(formatted).toMatch(/\d{1,2}/); // Contains day
    });

    it("should handle different dates", () => {
      const formatted1 = formatDateForDisplay("2026-01-01");
      const formatted2 = formatDateForDisplay("2026-12-31");
      expect(formatted1).not.toBe(formatted2);
    });
  });

  describe("formatMonthForDisplay", () => {
    it("should format month correctly", () => {
      const formatted = formatMonthForDisplay("2026-02");
      expect(formatted).toContain("2026");
    });

    it("should handle different months", () => {
      const formatted1 = formatMonthForDisplay("2026-01");
      const formatted2 = formatMonthForDisplay("2026-12");
      expect(formatted1).not.toBe(formatted2);
    });
  });
});
