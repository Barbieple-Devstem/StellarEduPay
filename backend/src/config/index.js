"use strict";

/**
 * Unified configuration loader.
 *
 * Multi-school note: SCHOOL_WALLET_ADDRESS is no longer required at startup.
 * Each school's Stellar address is stored in the School document in MongoDB.
 * The variable is still read here (optional) to support the migration script
 * (scripts/migrate-default-school.js) which seeds the first school from it.
 */

// ── Required variables ────────────────────────────────────────────────────────
const REQUIRED = ["MONGO_URI", "JWT_SECRET", "RECEIPT_SIGNATURE_SECRET"];

const missing = REQUIRED.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(
    `[Config] Missing required environment variables: ${missing.join(", ")}\n` +
      "Check your .env file against .env.example.",
  );
}

const PORT = parseInt(process.env.PORT || "5000", 10);
const MONGO_URI = process.env.MONGO_URI;
const RECEIPT_SIGNATURE_SECRET = process.env.RECEIPT_SIGNATURE_SECRET;
const STELLAR_NETWORK = process.env.STELLAR_NETWORK || "testnet";
const IS_TESTNET = STELLAR_NETWORK !== "mainnet";

const HORIZON_URL =
  process.env.STELLAR_HORIZON_URL ||
  process.env.HORIZON_URL ||
  "https://horizon.stellar.org";

// Comma-separated, priority-ordered list of Horizon URLs for failover.
// When set, the HorizonFailoverClient will try each URL in order.
// Falls back to HORIZON_URL (single-endpoint mode) when not set.
const STELLAR_HORIZON_URLS = process.env.STELLAR_HORIZON_URLS
  ? process.env.STELLAR_HORIZON_URLS.split(',').map((u) => u.trim()).filter(Boolean)
  : [HORIZON_URL];

// Optional — only used by the migration script to seed the default school
const SCHOOL_WALLET_ADDRESS = process.env.SCHOOL_WALLET_ADDRESS || null;
if (SCHOOL_WALLET_ADDRESS && !/^G[A-Z2-7]{55}$/.test(SCHOOL_WALLET_ADDRESS)) {
  throw new Error(`[Config] SCHOOL_WALLET_ADDRESS '${SCHOOL_WALLET_ADDRESS}' is not a valid Stellar account address (StrKey format).`);
}

const USDC_ISSUER =
  process.env.USDC_ISSUER ||
  (IS_TESTNET
    ? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5"
    : "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN");

// Validate USDC_ISSUER format (Stellar StrKey account ID)
if (USDC_ISSUER && !/^G[A-Z2-7]{55}$/.test(USDC_ISSUER)) {
  throw new Error(`[Config] USDC_ISSUER '${USDC_ISSUER}' is not a valid Stellar account address (StrKey format).`);
}

// Which asset the school accepts: 'XLM' (default) or 'USDC'
const ACCEPTED_ASSET = (process.env.ACCEPTED_ASSET || "XLM").toUpperCase();

const CONFIRMATION_THRESHOLD = parseInt(
  process.env.CONFIRMATION_THRESHOLD || "2",
  10,
);

// Finality threshold (issue #747): ledgers required beyond CONFIRMATION_THRESHOLD
// before a payment is promoted from 'confirmed' to 'finalized' — the point at
// which it is treated as practically irreversible and should never require
// manual correction. Must be >= CONFIRMATION_THRESHOLD; defaults to 5x it.
const FINALIZATION_THRESHOLD = parseInt(
  process.env.FINALIZATION_THRESHOLD || String(CONFIRMATION_THRESHOLD * 5),
  10,
);
if (FINALIZATION_THRESHOLD < CONFIRMATION_THRESHOLD) {
  throw new Error(
    "[Config] FINALIZATION_THRESHOLD must be >= CONFIRMATION_THRESHOLD.",
  );
}

const POLL_INTERVAL_MS = parseInt(process.env.POLL_INTERVAL_MS || "30000", 10);

// SYNC_INTERVAL_MS is the canonical env var for auto-sync interval.
// Falls back to POLL_INTERVAL_MS for backwards compatibility.
// Set to 0 to disable auto-sync entirely.
const _syncRaw =
  process.env.SYNC_INTERVAL_MS ?? process.env.POLL_INTERVAL_MS ?? "60000";
const SYNC_INTERVAL_MS = parseInt(_syncRaw, 10);

// How long a per-school sync lock is held before auto-expiring. Acts as the
// crash-safety net for the distributed lock around each poll cycle: must
// comfortably exceed the time it takes to poll a single school, but stay short
// enough that a dead worker's lock frees up reasonably quickly. Default: 60s.
const SYNC_LOCK_TTL_MS = parseInt(process.env.SYNC_LOCK_TTL_MS || "60000", 10);

// ── Retry Service ─────────────────────────────────────────────────────────────
const RETRY_INTERVAL_MS = parseInt(
  process.env.RETRY_INTERVAL_MS || "60000",
  10,
);
const RETRY_MAX_ATTEMPTS = parseInt(process.env.RETRY_MAX_ATTEMPTS || "10", 10);

// ── Payment Limits ────────────────────────────────────────────────────────────
const MIN_PAYMENT_AMOUNT = parseFloat(process.env.MIN_PAYMENT_AMOUNT || "0.01");
const MAX_PAYMENT_AMOUNT = parseFloat(
  process.env.MAX_PAYMENT_AMOUNT || "100000",
);

// ── Concurrent Payment Processor ─────────────────────────────────────────────
const MAX_QUEUE_DEPTH = parseInt(process.env.MAX_QUEUE_DEPTH || "1000", 10);
const QUEUE_BACKPRESSURE_HIGH_WATER = parseInt(
  process.env.QUEUE_BACKPRESSURE_HIGH_WATER || String(Math.ceil(MAX_QUEUE_DEPTH * 0.8)),
  10,
);
const QUEUE_BACKPRESSURE_LOW_WATER = parseInt(
  process.env.QUEUE_BACKPRESSURE_LOW_WATER || String(Math.floor(MAX_QUEUE_DEPTH * 0.5)),
  10,
);

if (MIN_PAYMENT_AMOUNT < 0) {
  throw new Error("[Config] MIN_PAYMENT_AMOUNT must be a positive number");
}
if (MAX_PAYMENT_AMOUNT <= MIN_PAYMENT_AMOUNT) {
  throw new Error(
    "[Config] MAX_PAYMENT_AMOUNT must be greater than MIN_PAYMENT_AMOUNT",
  );
}

// ── Body Size Limit ───────────────────────────────────────────────────────────
// Global JSON body size limit (default: 10kb). Bulk import uses 1mb regardless.
const MAX_BODY_SIZE = process.env.MAX_BODY_SIZE || '10kb';

// ── Bulk Import Limits ────────────────────────────────────────────────────────
// Maximum number of student rows accepted by a single bulk import, shared by
// both the CSV and JSON import paths so the two stay aligned (issue #1612).
const CSV_MAX_ROWS = parseInt(process.env.CSV_MAX_ROWS || "10000", 10);

// Body size limit for the JSON bulk import endpoint. Must be large enough to
// carry CSV_MAX_ROWS student records in a single JSON payload, so it is derived
// from CSV_MAX_ROWS rather than the global MAX_BODY_SIZE (default: 10kb).
// ~1 KB per student record is a generous upper bound; the floor keeps small
// CSV_MAX_ROWS overrides from shrinking the limit below the previous 1mb.
const BULK_IMPORT_BODY_SIZE =
  process.env.BULK_IMPORT_BODY_SIZE ||
  `${Math.max(1, Math.ceil((CSV_MAX_ROWS * 1024) / (1024 * 1024)))}mb`;

// ── Timeouts ──────────────────────────────────────────────────────────────────
const REQUEST_TIMEOUT_MS = parseInt(
  process.env.REQUEST_TIMEOUT_MS || "30000",
  10,
);
const STELLAR_TIMEOUT_MS = parseInt(
  process.env.STELLAR_TIMEOUT_MS || "10000",
  10,
);

// ── Proxy Configuration ────────────────────────────────────────────────────────
const TRUSTED_PROXY_HOPS = parseInt(process.env.TRUSTED_PROXY_HOPS || '1', 10);
if (isNaN(TRUSTED_PROXY_HOPS) || TRUSTED_PROXY_HOPS < 0) {
  throw new Error(`[Config] TRUSTED_PROXY_HOPS must be a non-negative integer, got: ${process.env.TRUSTED_PROXY_HOPS}`);
}

// ── Auth ──────────────────────────────────────────────────────────────────────
// Secret used to sign/verify admin JWTs. Must be at least 32 characters.
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_SECRET_MIN_LENGTH = 32;
if (JWT_SECRET.length < JWT_SECRET_MIN_LENGTH) {
  throw new Error(
    `[Config] JWT_SECRET is too short (${JWT_SECRET.length} chars; minimum ${JWT_SECRET_MIN_LENGTH}). ` +
    "Generate a strong secret with: node -e \"console.log(require('crypto').randomBytes(64).toString('hex'))\""
  );
}
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "8h";

// ── Fee Reminders ─────────────────────────────────────────────────────────────
// How often the scheduler checks for unpaid fees (default: 1 hour).
// Schools are only processed during their configured send window, so a shorter
// interval ensures every school gets picked up at the right local time.
const REMINDER_INTERVAL_MS = parseInt(
  process.env.REMINDER_INTERVAL_MS || String(60 * 60 * 1000),
  10,
);
// Minimum hours between reminders for the same student (default: 48 hours)
const REMINDER_COOLDOWN_HOURS = parseInt(
  process.env.REMINDER_COOLDOWN_HOURS || "48",
  10,
);
// Maximum reminders to send per student before stopping (default: 5)
const REMINDER_MAX_COUNT = parseInt(process.env.REMINDER_MAX_COUNT || "5", 10);

// ── Student PII Data Retention ────────────────────────────────────────────────
// Number of days to retain student PII (name, date of birth, parent name, etc.)
// after soft-delete before automatic anonymization (default: 90 days, ~3 months).
// After the retention window, sensitive fields are cleared to reduce breach exposure.
const STUDENT_PII_RETENTION_DAYS = parseInt(
  process.env.STUDENT_PII_RETENTION_DAYS || "90",
  10,
);

// SMTP settings for nodemailer
const SMTP_HOST = process.env.SMTP_HOST || null;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || "587", 10);
const SMTP_SECURE = process.env.SMTP_SECURE === "true";
const SMTP_USER = process.env.SMTP_USER || null;
const SMTP_PASS = process.env.SMTP_PASS || null;
const SMTP_FROM = process.env.SMTP_FROM || "no-reply@schoolpay.local";

// ── JSON Depth Guard ──────────────────────────────────────────────────────────
// Maximum nesting depth and array length accepted by the global jsonDepthGuard
// middleware. These stay strict for all routes; known bulk endpoints opt out of
// the array-length cap via a route-level override (issue #1612).
const JSON_MAX_DEPTH = parseInt(process.env.JSON_MAX_DEPTH || "10", 10);
const JSON_MAX_ARRAY_LENGTH = parseInt(
  process.env.JSON_MAX_ARRAY_LENGTH || "100",
  10,
);

// ── Audit Log ─────────────────────────────────────────────────────────────────
const AUDIT_LOG_RETENTION_DAYS = parseInt(
  process.env.AUDIT_LOG_RETENTION_DAYS || "365",
  10,
);

module.exports = {
  PORT,
  MONGO_URI,
  RECEIPT_SIGNATURE_SECRET,
  STELLAR_NETWORK,
  IS_TESTNET,
  HORIZON_URL,
  STELLAR_HORIZON_URLS,
  SCHOOL_WALLET_ADDRESS,
  USDC_ISSUER,
  ACCEPTED_ASSET,
  CONFIRMATION_THRESHOLD,
  FINALIZATION_THRESHOLD,
  POLL_INTERVAL_MS,
  SYNC_INTERVAL_MS,
  SYNC_LOCK_TTL_MS,
  RETRY_INTERVAL_MS,
  RETRY_MAX_ATTEMPTS,
  MIN_PAYMENT_AMOUNT,
  MAX_PAYMENT_AMOUNT,
  MAX_QUEUE_DEPTH,
  QUEUE_BACKPRESSURE_HIGH_WATER,
  QUEUE_BACKPRESSURE_LOW_WATER,
  MAX_BODY_SIZE,
  CSV_MAX_ROWS,
  BULK_IMPORT_BODY_SIZE,
  REQUEST_TIMEOUT_MS,
  STELLAR_TIMEOUT_MS,
  TRUSTED_PROXY_HOPS,
  JWT_SECRET,
  JWT_EXPIRES_IN,
  REMINDER_INTERVAL_MS,
  REMINDER_COOLDOWN_HOURS,
  REMINDER_MAX_COUNT,
  STUDENT_PII_RETENTION_DAYS,
  SMTP_HOST,
  SMTP_PORT,
  SMTP_SECURE,
  SMTP_USER,
  SMTP_PASS,
  SMTP_FROM,
  JSON_MAX_DEPTH,
  JSON_MAX_ARRAY_LENGTH,
  AUDIT_LOG_RETENTION_DAYS,
};
