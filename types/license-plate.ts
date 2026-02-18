export type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type LicensePlateEntry = {
  id: string;
  licensePlate: string;
  timestamp: number;
  imageUri?: string;
  confidence: "high" | "medium" | "low";
  location?: GeoLocation | "NO GPS";
};

export type GroupedLicensePlate = {
  licensePlate: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  entries: LicensePlateEntry[];
};

export type DetectionResult = {
  licensePlate: string;
  confidence: "high" | "medium" | "low";
  isValid: boolean;
  rawText: string;
  location?: GeoLocation | "NO GPS";
};

export type AlertType = "success" | "error" | "info" | "warning";

export type Alert = {
  id: string;
  type: AlertType;
  message: string;
  duration?: number;
};
