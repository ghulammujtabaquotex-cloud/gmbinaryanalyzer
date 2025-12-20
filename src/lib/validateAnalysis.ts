import type { AnalysisData } from "@/components/AnalysisResults";

const VALID_TRENDS = ["Uptrend", "Downtrend", "Range"] as const;
const VALID_SIGNALS = ["CALL", "PUT", "NEUTRAL"] as const;

/**
 * Sanitizes and validates AI response data to prevent XSS and ensure data integrity
 */
export function sanitizeAnalysisData(data: unknown): AnalysisData {
  if (!data || typeof data !== "object") {
    return getDefaultAnalysis();
  }

  const raw = data as Record<string, unknown>;

  return {
    pair: sanitizeString(raw.pair, 20, "Unknown"),
    trend: validateEnum(raw.trend, VALID_TRENDS, "Range"),
    signal: validateEnum(raw.signal, VALID_SIGNALS, "NEUTRAL"),
    supportZone: sanitizeString(raw.supportZone, 50, "Unable to determine"),
    resistanceZone: sanitizeString(raw.resistanceZone, 50, "Unable to determine"),
    explanation: sanitizeString(raw.explanation, 500, "Analysis could not be completed."),
  };
}

function sanitizeString(value: unknown, maxLength: number, fallback: string): string {
  if (typeof value !== "string") {
    return fallback;
  }
  // Remove any potential script tags or HTML, then truncate
  const cleaned = value
    .replace(/<[^>]*>/g, "") // Remove HTML tags
    .replace(/javascript:/gi, "") // Remove javascript: protocol
    .trim();
  return cleaned.slice(0, maxLength) || fallback;
}

function validateEnum<T extends string>(
  value: unknown,
  validValues: readonly T[],
  fallback: T
): T {
  if (typeof value === "string" && validValues.includes(value as T)) {
    return value as T;
  }
  return fallback;
}

function getDefaultAnalysis(): AnalysisData {
  return {
    pair: "Unknown",
    trend: "Range",
    signal: "NEUTRAL",
    supportZone: "Unable to determine",
    resistanceZone: "Unable to determine",
    explanation: "Analysis could not be completed. Please try again with a clearer chart image.",
  };
}
