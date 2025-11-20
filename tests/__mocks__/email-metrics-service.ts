import { jest } from "@jest/globals";

export const updateEmailMetricsMock = jest.fn();

export function updateEmailMetrics(...args: any[]) {
  return updateEmailMetricsMock(...args);
}
