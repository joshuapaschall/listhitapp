import {
  TELNYX_API_URL,
  TELNYX_DEBUG,
  getCallControlAppId,
  getSipCredentialConnectionId,
  getTelnyxApiKey,
} from "@/lib/voice-env";
import { createLogger } from "@/lib/logger";

const log = createLogger("telnyx-numbers");

export type FromNumber = {
  e164: string;
  source: "purchased" | "verified";
  assignedToApp: boolean;
  assignedToSip: boolean;
  assignedToOrigin: boolean;
  verified: boolean;
};

type VoiceNumber = {
  id?: string;
  phone_number?: string;
  connection_id?: string;
  status?: string;
};

type TelnyxResponse<T> = {
  data?: T[];
  meta?: { next_page_url?: string | null; page?: { next_page_url?: string | null } };
  links?: { next?: string | null };
};

type TelnyxVerifiedResponse = {
  data?: Array<{ phone_number?: string | null }>;
  meta?: { page?: { next_page_url?: string | null } };
  links?: { next?: string | null };
};

function normalizeNumber(value: string | null | undefined): string {
  const trimmed = (value || "").replace(/[^\d+]/g, "");
  if (!/^\+?[1-9]\d{6,15}$/.test(trimmed)) {
    return "";
  }
  return trimmed.startsWith("+") ? trimmed : `+${trimmed}`;
}

export async function listPurchasedNumbersForOrigin(): Promise<FromNumber[]> {
  const apiKey = getTelnyxApiKey();
  if (!apiKey) {
    return [];
  }

  const appId = getCallControlAppId();
  const sipId = getSipCredentialConnectionId();
  const headers = { Authorization: `Bearer ${apiKey}` };

  let url: string | null = `${TELNYX_API_URL}/phone_numbers?page[number]=1&page[size]=100`;
  const out: FromNumber[] = [];

  while (url) {
    try {
      const res = await fetch(url, { headers });
      const json = (await res.json().catch(() => ({}))) as TelnyxResponse<VoiceNumber>;
      const data = Array.isArray(json?.data) ? json.data : [];

      for (const row of data) {
        // Telnyx /phone_numbers returns FLAT objects (phone_number + connection_id
        // at the TOP LEVEL, no  nested wrapper). Reading nested fields was the
        // bug that skipped every number and returned an empty list.
        const pn = normalizeNumber(row?.phone_number);
        if (!pn) continue;

        const connectionId = row?.connection_id || null;
        const assignedToApp = Boolean(appId && connectionId && connectionId === appId);
        const assignedToSip = Boolean(sipId && connectionId && connectionId === sipId);
        const assignedToOrigin = assignedToApp || assignedToSip;

        out.push({
          e164: pn,
          source: "purchased",
          assignedToApp,
          assignedToSip,
          assignedToOrigin,
          verified: false,
        });
      }

      url = json?.meta?.next_page_url || json?.meta?.page?.next_page_url || json?.links?.next || "";
    } catch (error) {
      console.warn("[numbers.voice] failed to fetch purchased numbers", { url, error });
      break;
    }
  }

  let vurl: string | null = `${TELNYX_API_URL}/verified_numbers?page[size]=100`;
  const verifiedMap: Record<string, true> = {};

  while (vurl) {
    try {
      const res = await fetch(vurl, { headers });
      const json = (await res.json().catch(() => ({}))) as TelnyxVerifiedResponse;
      const data = Array.isArray(json?.data) ? json.data : [];
      for (const row of data) {
        const num = normalizeNumber(row?.phone_number || "");
        if (num) verifiedMap[num] = true;
      }
      vurl = json?.meta?.page?.next_page_url || json?.links?.next || "";
    } catch (error) {
      console.warn("[numbers.voice] failed to fetch verified numbers", { url: vurl, error });
      break;
    }
  }

  const byE164 = new Map<string, FromNumber>();
  for (const item of out) {
    byE164.set(item.e164, { ...item });
  }

  for (const num of Object.keys(verifiedMap)) {
    if (byE164.has(num)) {
      const existing = byE164.get(num)!;
      existing.verified = true;
      byE164.set(num, existing);
    } else {
      byE164.set(num, {
        e164: num,
        source: "verified",
        assignedToApp: false,
        assignedToSip: false,
        assignedToOrigin: false,
        verified: true,
      });
    }
  }

  const items = Array.from(byE164.values()).sort((a, b) => a.e164.localeCompare(b.e164));
  if (TELNYX_DEBUG) {
    log("[numbers.voice] sample", items.slice(0, 3));
  }
  return items;
}

export function isDialableFrom(x: { assignedToApp: boolean; verified: boolean }) {
  return !!(x.assignedToApp || x.verified);
}

export async function getFromNumberStatus(number: string) {
  const input = normalizeNumber(number);
  if (!input) {
    return {
      input,
      purchasedFound: false,
      assignedToApp: false,
      assignedToSip: false,
      assignedToOrigin: false,
      verifiedCallerId: false,
    };
  }

  if (!getTelnyxApiKey()) {
    return {
      input,
      purchasedFound: false,
      assignedToApp: false,
      assignedToSip: false,
      assignedToOrigin: false,
      verifiedCallerId: false,
    };
  }

  const inventory = await listPurchasedNumbersForOrigin();
  const match = inventory.find((item) => item.e164 === input);
  const purchasedFound = match ? match.source === "purchased" : false;
  const assignedToApp = Boolean(match?.assignedToApp);
  const assignedToSip = Boolean(match?.assignedToSip);
  const assignedToOrigin = Boolean(match?.assignedToOrigin);
  const verifiedCallerId = Boolean(match?.verified);

  return {
    input,
    purchasedFound,
    assignedToApp,
    assignedToSip,
    assignedToOrigin,
    verifiedCallerId,
  };
}
