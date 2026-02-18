export type LicensePlateEntry = {
  id: string;
  licensePlate: string;
  timestamp: number;
  imageUri?: string;
  confidence: "high" | "medium" | "low";
};

export type DetectionResult = {
  licensePlate: string;
  confidence: "high" | "medium" | "low";
  isValid: boolean;
  rawText: string;
};
