export type DiseaseProbability = {
  key: string;
  label: string;
  status: "AVAILABLE" | "NOT_AVAILABLE" | "NOT_CAPTURED" | "INSUFFICIENT_DATA" | "SUPPRESSED";
  probability: number | null;
  modelVersion: string;
  horizon: string;
  validationStatus: string;
  reason: string;
  purpose: string;
};

export type DiseaseProbabilitySnapshot = {
  schemaVersion: 1;
  capturedAt: string | null;
  entries: DiseaseProbability[];
};
