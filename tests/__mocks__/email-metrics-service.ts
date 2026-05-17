import { vi } from "vitest";

export const updateEmailMetricsMock = vi.fn();

export function updateEmailMetrics(...args: any[]) {
  return updateEmailMetricsMock(...args);
}
