import {
  TELNYX_API_URL,
  TELNYX_DEBUG,
  getCallControlAppId,
  getSipCredentialConnectionId,
  getTelnyxApiKey,
} from "@/lib/voice-env";

export type FromNumber = {
  e164: string;
  source: "purchased" | "verified";
  assignedToApp: boolean;
  assignedToSip: boolean;
  assignedToOrigin: boolean;
  verified: boolean;
};

type VoiceNumber = {
  id: string;
  type: string;
  attributes: {
    phone_number: string;
    connection_id?: string;
    call_control_application_id?: string;
    application_id?: string;
    application_ids?: string[];
  };
};

type TelnyxResponse<T> = {
  data?: T[];
  meta?: { page?: { next_page_url?: string | null } };
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

  let url: string | null = `${TELNYX_API_URL}/phone_numbers/voice?page[size]=100`;
  const out: FromNumber[] = [];

  while (url) {
    try {
      const res = await fetch(url, { headers });
      const json = (await res.json().catch(() => ({}))) as TelnyxResponse<VoiceNumber>;
      const data = Array.isArray(json?.data) ? json.data : [];

      for (const row of data) {
        const attrs: VoiceNumber["attributes"] = row?.attributes || ({} as VoiceNumber["attributes"]);
        const pn = normalizeNumber(attrs.phone_number);
        if (!pn) continue;

        const cc =
          attrs.call_control_application_id ||
          attrs.application_id ||
          (Array.isArray(attrs.application_ids) &&
            attrs.application_ids.find((candidate) => candidate === appId)) ||
          null;

        const assignedToApp = Boolean(
          appId &&
            (cc === appId ||
              (Array.isArray(attrs.application_ids) && attrs.application_ids.includes(appId))),
        );
        const assignedToSip = Boolean(sipId && attrs.connection_id === sipId);
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

      url = json?.meta?.page?.next_page_url || json?.links?.next || "";
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
    console.log("[numbers.voice] sample", items.slice(0, 3));
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
