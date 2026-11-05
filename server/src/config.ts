/**
 * Server configuration from environment variables. Every setting has a safe
 * default: sandbox messaging, no AI, SQLite in ./data, short message-body
 * retention. See .env.example and docs/hosting.md.
 */
import type { CountryCode } from '../../src/types';

export interface GatewayCredentials {
  africastalking?: { username: string; apiKey: string; senderId?: string; voiceNumber?: string; sandbox: boolean };
  termii?: { apiKey: string; senderId: string; baseUrl: string; route: 'dnd' | 'generic' };
  whatsapp?: {
    token: string;
    phoneNumberId: string;
    apiVersion: string;
    appSecret?: string;
    verifyToken?: string;
    /** Approved utility template: body params {{1}} first name, {{2}} facility, {{3}} message */
    template: string;
    templateLanguage: string;
  };
  smtp?: { url: string; from: string };
}

export interface ServerConfig {
  port: number;
  host: string;
  /** Public base URL, used for gateway callback URLs */
  publicUrl: string;
  dbUrl: string;
  /** Allowed browser origins for the hosted front end ('*' only for development) */
  corsOrigins: string[];
  tokenDays: number;
  pinMaxAttempts: number;
  pinLockMinutes: number;
  messaging: {
    mode: 'sandbox' | 'live';
    /** Simulated receipt delays in sandbox, ms: [sent, delivered] */
    sandboxDelays: [number, number];
    /** Non-urgent messages wait until this local hour range ends, e.g. [20, 8] */
    quietHours: [number, number] | null;
    timezoneOffsetHours: number;
    defaultCountry: CountryCode;
    creds: GatewayCredentials;
  };
  ai: {
    baseUrl?: string;
    model?: string;
    apiKey?: string;
    residency: 'in_country' | 'offshore' | 'unknown';
    timeoutMs: number;
    maxPromptBytes: number;
  };
  dhis2: { url?: string; username?: string; password?: string; dataSet?: string; mappingFile?: string };
  suppressBelow: number;
  retention: {
    messageBodyDays: number;
    auditDays: number;
    sessionDays: number;
    opLogDays: number;
    /** Years after a mother's last event before her record is flagged for review */
    inactiveRecordYears: number;
    autoDeleteInactive: boolean;
  };
  bootstrapAdmin?: { phone: string; pin: string; name: string };
  trustProxy: boolean;
}

function num(v: string | undefined, d: number): number {
  const n = v == null || v === '' ? NaN : Number(v);
  return Number.isFinite(n) ? n : d;
}

function bool(v: string | undefined, d: boolean): boolean {
  if (v == null || v === '') return d;
  return /^(1|true|yes|on)$/i.test(v);
}

export function loadConfig(env: Record<string, string | undefined> = process.env): ServerConfig {
  const port = num(env.PORT, 8787);
  const quiet = env.QUIET_HOURS === 'off' ? null : (env.QUIET_HOURS ?? '20-8').split('-').map((x) => num(x, NaN));
  const creds: GatewayCredentials = {};
  if (env.AT_USERNAME && env.AT_API_KEY)
    creds.africastalking = {
      username: env.AT_USERNAME,
      apiKey: env.AT_API_KEY,
      senderId: env.AT_SENDER_ID || undefined,
      voiceNumber: env.AT_VOICE_NUMBER || undefined,
      sandbox: env.AT_USERNAME === 'sandbox' || bool(env.AT_SANDBOX, false),
    };
  if (env.TERMII_API_KEY)
    creds.termii = {
      apiKey: env.TERMII_API_KEY,
      senderId: env.TERMII_SENDER_ID ?? 'Gaskin',
      baseUrl: (env.TERMII_BASE_URL ?? 'https://api.ng.termii.com').replace(/\/+$/, ''),
      route: env.TERMII_ROUTE === 'generic' ? 'generic' : 'dnd',
    };
  if (env.WHATSAPP_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID)
    creds.whatsapp = {
      token: env.WHATSAPP_TOKEN,
      phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
      apiVersion: env.WHATSAPP_API_VERSION ?? 'v23.0',
      appSecret: env.WHATSAPP_APP_SECRET || undefined,
      verifyToken: env.WHATSAPP_VERIFY_TOKEN || undefined,
      template: env.WHATSAPP_TEMPLATE ?? 'gaskin_care_update',
      templateLanguage: env.WHATSAPP_TEMPLATE_LANGUAGE ?? 'en',
    };
  if (env.SMTP_URL) creds.smtp = { url: env.SMTP_URL, from: env.SMTP_FROM ?? 'Gaskin <no-reply@localhost>' };

  const residency = env.AI_RESIDENCY === 'in_country' || env.AI_RESIDENCY === 'offshore' ? env.AI_RESIDENCY : 'unknown';
  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    publicUrl: (env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/+$/, ''),
    dbUrl: env.DATABASE_URL ?? 'sqlite:./data/gaskin.db',
    corsOrigins: (env.CORS_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean),
    tokenDays: num(env.TOKEN_DAYS, 30),
    pinMaxAttempts: num(env.PIN_MAX_ATTEMPTS, 5),
    pinLockMinutes: num(env.PIN_LOCK_MINUTES, 15),
    messaging: {
      mode: env.MESSAGING_MODE === 'live' ? 'live' : 'sandbox',
      sandboxDelays: [num(env.SANDBOX_SENT_MS, 1500), num(env.SANDBOX_DELIVERED_MS, 4000)],
      quietHours: quiet && quiet.length === 2 && quiet.every(Number.isFinite) ? [quiet[0], quiet[1]] : null,
      timezoneOffsetHours: num(env.TZ_OFFSET_HOURS, 1),
      defaultCountry: (['NG', 'KE', 'GH'].includes(env.DEFAULT_COUNTRY ?? '') ? env.DEFAULT_COUNTRY : 'NG') as CountryCode,
      creds,
    },
    ai: {
      baseUrl: env.AI_BASE_URL?.replace(/\/+$/, '') || undefined,
      model: env.AI_MODEL || undefined,
      apiKey: env.AI_API_KEY || undefined,
      residency,
      timeoutMs: num(env.AI_TIMEOUT_MS, 60_000),
      maxPromptBytes: num(env.AI_MAX_PROMPT_BYTES, 24_000),
    },
    dhis2: {
      url: env.DHIS2_URL?.replace(/\/+$/, '') || undefined,
      username: env.DHIS2_USERNAME || undefined,
      password: env.DHIS2_PASSWORD || undefined,
      dataSet: env.DHIS2_DATASET || undefined,
      mappingFile: env.DHIS2_MAPPING_FILE || undefined,
    },
    suppressBelow: num(env.SUPPRESS_BELOW, 10),
    retention: {
      messageBodyDays: num(env.RETENTION_MESSAGE_BODY_DAYS, 90),
      auditDays: num(env.RETENTION_AUDIT_DAYS, 730),
      sessionDays: num(env.RETENTION_SESSION_DAYS, 30),
      opLogDays: num(env.RETENTION_OPLOG_DAYS, 180),
      inactiveRecordYears: num(env.RETENTION_INACTIVE_YEARS, 7),
      autoDeleteInactive: bool(env.RETENTION_AUTO_DELETE, false),
    },
    bootstrapAdmin:
      env.ADMIN_PHONE && env.ADMIN_PIN ? { phone: env.ADMIN_PHONE, pin: env.ADMIN_PIN, name: env.ADMIN_NAME ?? 'Administrator' } : undefined,
    trustProxy: bool(env.TRUST_PROXY, false),
  };
}
