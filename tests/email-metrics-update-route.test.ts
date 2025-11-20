import { describe, expect, test } from "@jest/globals";
import { NextRequest } from "next/server";
import { updateEmailMetricsMock } from "@/services/email-metrics-service";
import { POST } from "../app/api/email-metrics/update/route";

describe("email-metrics update route", () => {
  test("requires userId", async () => {
    const req = new NextRequest("http://test", { method: "POST" });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("calls updateEmailMetrics and returns counts", async () => {
    updateEmailMetricsMock.mockResolvedValue({ unsubscribed: 1, bounces: 2, opens: 3 });
    const req = new NextRequest("http://test", {
      method: "POST",
      body: JSON.stringify({ userId: "u1" }),
    });
    const res = await POST(req);
    expect(updateEmailMetricsMock).toHaveBeenCalledWith("u1");
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({ unsubscribed: 1, bounces: 2, opens: 3 });
  });
});
