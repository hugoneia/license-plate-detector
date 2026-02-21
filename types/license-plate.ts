export type GeoLocation = {
  latitude: number;
  longitude: number;
  accuracy?: number;
};

export type ParkingLocation = "acera" | "doble_fila" | null;

export type LicensePlateEntry = {
  id: string;
  licensePlate: string;
  timestamp: number;
  imageUri?: string;
  confidence: "high" | "medium" | "low";
  location?: GeoLocation | "NO GPS";
  parkingLocation?: ParkingLocation;
};

export type GroupedLicensePlate = {
  licensePlate: string;
  count: number;
  firstSeen: number;
  lastSeen: number;
  entries: LicensePlateEntry[];
  parkingLocation?: ParkingLocation;
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
