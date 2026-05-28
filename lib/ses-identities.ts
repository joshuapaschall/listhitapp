import {
  CreateEmailIdentityCommand,
  DeleteEmailIdentityCommand,
  GetEmailIdentityCommand,
  PutEmailIdentityMailFromAttributesCommand,
  SESv2ServiceException,
  SESv2Client,
} from "@aws-sdk/client-sesv2";

import { createLogger } from "@/lib/logger";
import { DnsRecord } from "@/types/email-identities";

const log = createLogger("ses-identities");

export function createSesClient() {
  const region = process.env.AWS_SES_REGION;
  const accessKeyId = process.env.AWS_SES_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SES_SECRET_ACCESS_KEY;

  return new SESv2Client({
    region: region || undefined,
    credentials: accessKeyId && secretAccessKey ? { accessKeyId, secretAccessKey } : undefined,
  });
}

function normalize(value: string | undefined | null) {
  return (value || "pending").toLowerCase();
}

export async function createDomainIdentity(domain: string) {
  const ses = createSesClient();
  let response;
  try {
    response = await ses.send(new CreateEmailIdentityCommand({ EmailIdentity: domain, DkimSigningAttributes: { NextSigningKeyLength: "RSA_2048_BIT" } }));
  } catch (error) {
    if (error instanceof SESv2ServiceException && error.name === "AlreadyExistsException") {
      response = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: domain }));
    } else {
      throw error;
    }
  }
  await ses.send(new PutEmailIdentityMailFromAttributesCommand({ EmailIdentity: domain, MailFromDomain: `bounce.${domain}`, BehaviorOnMxFailure: "USE_DEFAULT_VALUE" }));
  const status = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: domain }));
  return {
    dkimTokens: status.DkimAttributes?.Tokens ?? response?.DkimAttributes?.Tokens ?? [],
    dkimStatus: normalize(status.DkimAttributes?.Status),
    mailFromDomain: status.MailFromAttributes?.MailFromDomain ?? `bounce.${domain}`,
    mailFromStatus: normalize(status.MailFromAttributes?.MailFromDomainStatus),
    verifiedForSending: Boolean(status.VerifiedForSendingStatus),
  };
}

export async function getDomainIdentityStatus(domain: string) {
  const ses = createSesClient();
  const status = await ses.send(new GetEmailIdentityCommand({ EmailIdentity: domain }));
  return {
    verifiedForSending: Boolean(status.VerifiedForSendingStatus),
    dkimStatus: normalize(status.DkimAttributes?.Status),
    dkimTokens: status.DkimAttributes?.Tokens ?? [],
    mailFromDomain: status.MailFromAttributes?.MailFromDomain ?? `bounce.${domain}`,
    mailFromStatus: normalize(status.MailFromAttributes?.MailFromDomainStatus),
  };
}

export async function deleteDomainIdentity(domain: string) {
  const ses = createSesClient();
  try {
    await ses.send(new DeleteEmailIdentityCommand({ EmailIdentity: domain }));
  } catch (error) {
    if (error instanceof SESv2ServiceException && error.name === "NotFoundException") return;
    log("error", "deleteDomainIdentity failed", { domain, error: (error as Error)?.message });
    throw error;
  }
}

export function buildDnsRecords(domain: string, dkimTokens: string[], region: string): DnsRecord[] {
  const records: DnsRecord[] = dkimTokens.map((token) => ({ type: "CNAME", name: `${token}._domainkey.${domain}`, value: `${token}.dkim.amazonses.com` }));
  records.push({ type: "MX", name: `bounce.${domain}`, value: `feedback-smtp.${region}.amazonses.com`, priority: 10 });
  records.push({ type: "TXT", name: `bounce.${domain}`, value: "v=spf1 include:amazonses.com ~all" });
  records.push({ type: "TXT", name: `_dmarc.${domain}`, value: "v=DMARC1; p=none;", recommended: true });
  return records;
}

export function deriveDomainStatus(dkimStatus: string, verifiedForSending: boolean): "verified" | "failed" | "pending" {
  if (verifiedForSending && dkimStatus === "success") return "verified";
  if (dkimStatus === "failed") return "failed";
  return "pending";
}
