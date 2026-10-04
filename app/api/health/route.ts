import { NextResponse } from "next/server";

import { hasValidCronToken } from "@/lib/cron-auth";

const REQUIRED_ENVS = [
  "SITE_URL",
  "CRON_SECRET",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "AWS_SES_REGION",
  "AWS_SES_FROM_EMAIL",
  "AWS_SES_CONFIGURATION_SET",
] as const;

type RequiredEnv = (typeof REQUIRED_ENVS)[number];

type EnvStatus = Record<RequiredEnv, boolean>;

const getEnvStatus = (): EnvStatus => {
  return REQUIRED_ENVS.reduce<EnvStatus>((acc, key) => {
    acc[key] = Boolean(process.env[key]);
    return acc;
  }, {} as EnvStatus);
};

export const GET = (req: Request) => {
  const env = getEnvStatus();
  const isOk = Object.values(env).every(Boolean);
  const status = isOk ? 200 : 500;

  // Unauthenticated callers get liveness only. The env map and build sha tell an
  // attacker which integrations are wired up, so they need the cron token.
  if (!hasValidCronToken(req)) {
    return NextResponse.json({ ok: isOk }, { status });
  }

  return NextResponse.json(
    {
      ok: isOk,
      commit: process.env.VERCEL_GIT_COMMIT_SHA ?? null,
      env,
    },
    { status }
  );
};
