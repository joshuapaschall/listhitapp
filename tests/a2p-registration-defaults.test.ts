// Unit tests for the tokenized A2P default copy assembled by getA2pState. Every
// tenant-specific value must come from the tenant's own brand name + website —
// nothing from the owner's approved Georgia Wholesale Homes campaign is hardcoded.
const h = vi.hoisted(() => ({
  state: {
    ver: null as any,
    org: null as any,
    reg: null as any,
  },
}));

vi.mock("@/lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            if (table === "business_verification") return { data: h.state.ver, error: null };
            if (table === "organizations") return { data: h.state.org, error: null };
            if (table === "a2p_registration") return { data: h.state.reg, error: null };
            return { data: null, error: null };
          },
        }),
      }),
    }),
  },
  supabase: {},
}));
vi.mock("@/lib/onboarding/service", () => ({
  upsertStepStatus: vi.fn(async () => ({})),
}));

import { getA2pState } from "../lib/a2p-registration/service";

describe("a2p-registration default copy (tokenized)", () => {
  beforeEach(() => {
    h.state.ver = { legal_business_name: "Acme Holdings LLC", dba_name: "", status: "ready" };
    h.state.org = { business_name: "Acme Holdings", website_url: "acme.com", phone: "+15125550100" };
    h.state.reg = null;
  });

  test("description contains the brand token + website and never the owner's tenant data", async () => {
    const state = await getA2pState("org-1");
    const desc = state.program.campaignDescription;
    expect(desc).toContain("Acme Holdings");
    expect(desc).toContain("acme.com");
    expect(desc.toLowerCase()).not.toContain("georgia wholesale");
    expect(desc.toLowerCase()).not.toContain("georgiawholesalehomes");
  });

  test("description reads naturally when no website is set (no 'at .', no 'undefined')", async () => {
    h.state.org = { business_name: "Acme Holdings", website_url: "" };
    const state = await getA2pState("org-1");
    const desc = state.program.campaignDescription;
    expect(desc).not.toContain("at .");
    expect(desc).not.toContain("undefined");
    expect(desc).toContain("Acme Holdings");
  });

  test("default samples: brand-token prefix, STOP + HELP, and >= 20 chars", async () => {
    const { samples } = await getA2pState("org-1");
    expect(samples.sample1.startsWith("Acme Holdings")).toBe(true);
    expect(samples.sample2.startsWith("Acme Holdings")).toBe(true);
    expect(samples.sample1).toContain("STOP");
    expect(samples.sample2).toContain("HELP");
    expect(samples.sample2).toContain("STOP");
    expect(samples.sample1.length).toBeGreaterThanOrEqual(20);
    expect(samples.sample2.length).toBeGreaterThanOrEqual(20);
  });

  test("a tenant's stored samples win over the defaults (precedence preserved)", async () => {
    h.state.reg = {
      sample_message_1: "Custom saved sample one from the tenant.",
      sample_message_2: "Custom saved sample two from the tenant.",
    };
    const { samples } = await getA2pState("org-1");
    expect(samples.sample1).toBe("Custom saved sample one from the tenant.");
    expect(samples.sample2).toBe("Custom saved sample two from the tenant.");
  });
});
