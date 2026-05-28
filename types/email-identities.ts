export type DomainStatus = "verified" | "failed" | "pending";

export type EmailDomain = {
  id: string;
  org_id: string;
  domain: string;
  ses_region: string;
  dkim_tokens: string[];
  dkim_status: string;
  verified_for_sending: boolean;
  mail_from_domain: string | null;
  mail_from_status: string | null;
  status: DomainStatus;
  last_checked_at: string | null;
  created_at: string;
  updated_at: string;
};

export type EmailSender = {
  id: string;
  org_id: string;
  domain_id: string;
  from_email: string;
  from_name: string | null;
  reply_to: string | null;
  is_default: boolean;
  created_at: string;
};

export type DnsRecord = {
  type: "CNAME" | "MX" | "TXT";
  name: string;
  value: string;
  priority?: number;
  recommended?: boolean;
};
