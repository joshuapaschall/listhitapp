import { NextResponse } from "next/server";

const REQUIRED_ENVS = [
  "SITE_URL",
  "CRON_SECRET",
  "SUPABASE_URL",
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

export const GET = () => {
  const env = getEnvStatus();
  const isOk = Object.values(env).every(Boolean);
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;

  return NextResponse.json(
    {
      ok: isOk,
      commit,
      env,
    },
    {
      status: isOk ? 200 : 500,
    }
  );
};
