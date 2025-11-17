import { describe, beforeEach, test, expect, jest } from "@jest/globals";
import { NextRequest } from "next/server";
import { POST } from "../app/api/telnyx/reject-call/route";

const fetchMock = jest.fn();
// @ts-ignore
global.fetch = fetchMock;

describe("reject call route", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    process.env.TELNYX_API_KEY = "KEY";
  });

  test("requires callControlId", async () => {
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify({}) });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  test("posts to Telnyx", async () => {
    fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => "{}" });
    const req = new NextRequest("http://test", { method: "POST", body: JSON.stringify({ callControlId: "C1" }) });
    const res = await POST(req);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.telnyx.com/v2/calls/C1/actions/reject",
      expect.objectContaining({ method: "POST" })
    );
    expect(res.status).toBe(200);
  });
});
