// Unit tests for the tokenized A2P default copy assembled by getA2pState. Every
// tenant-specific value must come from the tenant's own brand name + website —
// nothing from the owner's approved Georgia Wholesale Homes campaign is hardcoded.
const h = vi.hoisted(() => ({
  state: {
    ver: null as any,
    org: null as any,
    reg: null as any,
    saved: null as any,
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
      upsert: async (rowArg: any) => {
        if (table === "a2p_registration") {
          h.state.saved = rowArg;
          // Reflect the write so the trailing getA2pState re-read sees it.
          h.state.reg = rowArg;
        }
        return { error: null };
      },
    }),
  },
  supabase: {},
}));
vi.mock("@/lib/onboarding/service", () => ({
  upsertStepStatus: vi.fn(async () => ({})),
}));

import { getA2pState, saveA2p } from "../lib/a2p-registration/service";

describe("a2p-registration default copy (tokenized)", () => {
  beforeEach(() => {
    h.state.ver = { legal_business_name: "Acme Holdings LLC", dba_name: "", status: "ready" };
    h.state.org = { business_name: "Acme Holdings", website_url: "acme.com", phone: "+15125550100" };
    h.state.reg = null;
    h.state.saved = null;
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

  test("with no stored samples, getA2pState returns five tokenized defaults", async () => {
    const { samples } = await getA2pState("org-1");
    const all = [samples.sample1, samples.sample2, samples.sample3, samples.sample4, samples.sample5];
    for (const sample of all) {
      expect(sample.length).toBeGreaterThanOrEqual(20);
      expect(sample).toContain("Acme Holdings");
      expect(sample).toContain("STOP");
      expect(sample.toLowerCase()).not.toContain("georgia wholesale");
      expect(sample.toLowerCase()).not.toContain("georgiawholesalehomes");
    }
    expect(all.some((x) => x.includes("HELP"))).toBe(true);
  });

  test("stored samples 1 + 3 return the stored set (2, 4, 5 blank); defaults unused", async () => {
    h.state.reg = {
      sample_message_1: "Stored sample one from the tenant.",
      sample_message_3: "Stored sample three from the tenant.",
    };
    const { samples } = await getA2pState("org-1");
    expect(samples.sample1).toBe("Stored sample one from the tenant.");
    expect(samples.sample3).toBe("Stored sample three from the tenant.");
    expect(samples.sample2).toBe("");
    expect(samples.sample4).toBe("");
    expect(samples.sample5).toBe("");
  });

  test("saveA2p persists samples 3–5 and stays draft when 1 or 2 is empty", async () => {
    const res = await saveA2p("org-1", {
      sample_message_1: "",
      sample_message_2: "",
      sample_message_3: "Third sample provided by the tenant.",
    });
    expect(res.ok).toBe(true);
    expect(h.state.saved.sample_message_3).toBe("Third sample provided by the tenant.");
    expect(res.state?.status).toBe("draft");
  });

  test("saveA2p marks ready when samples 1 and 2 are both present, still persisting 5", async () => {
    const res = await saveA2p("org-1", {
      sample_message_1: "First sample from the tenant here.",
      sample_message_2: "Second sample from the tenant here.",
      sample_message_5: "Fifth optional sample from the tenant.",
    });
    expect(res.ok).toBe(true);
    expect(res.state?.status).toBe("ready");
    expect(h.state.saved.sample_message_5).toBe("Fifth optional sample from the tenant.");
  });
});
