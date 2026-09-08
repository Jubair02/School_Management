/**
 * EduSphere — fixed-window rate limiting for unauthenticated endpoints.
 * SERVER ONLY.
 *
 * State lives in the process, which on a serverless platform means per running
 * instance: an attacker spread across many cold starts sees a higher effective
 * ceiling than the numbers below suggest. It still removes the case that
 * matters most — thousands of guesses per minute down a single warm connection
 * — and costs no external dependency. If you need a hard, globally accurate
 * limit, back `hit()` with Vercel KV / Upstash Redis; every call site stays as
 * it is.
 */
import type { NextRequest } from "next/server";
import { ApiError } from "@/lib/api-utils";

interface Bucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, Bucket>();

/** Drop expired buckets so the map cannot grow without bound. */
function prune(now: number): void {
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

let lastPrune = 0;
const PRUNE_INTERVAL_MS = 60_000;

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the window resets (0 when not limited). */
  retryAfter: number;
}

/** Count one hit against `key`; returns whether it is within `limit` per `windowMs`. */
export function hit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (now - lastPrune > PRUNE_INTERVAL_MS) {
    lastPrune = now;
    prune(now);
  }

  const existing = buckets.get(key);
  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  existing.count += 1;
  if (existing.count > limit) {
    return { ok: false, retryAfter: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)) };
  }
  return { ok: true, retryAfter: 0 };
}

/**
 * Best-effort client IP. Behind Vercel the left-most `x-forwarded-for` entry is
 * set by the platform. Requests with no forwarding header share the "unknown"
 * bucket, which is the conservative outcome — they get limited together.
 */
export function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}

export interface LimitRule {
  /** Namespace, so separate endpoints never share a bucket. */
  scope: string;
  limit: number;
  windowMs: number;
  /** Extra key material, e.g. the submitted email. Lower-cased by the caller. */
  subject?: string;
}

/**
 * Enforce one or more rules, throwing 429 on the first breach.
 *
 * Pair a per-IP+subject rule with a wider per-IP rule: the first stops one
 * account being hammered, the second stops one host spraying many accounts.
 */
export function enforceRateLimit(req: NextRequest, rules: LimitRule[]): void {
  const ip = clientIp(req);

  for (const rule of rules) {
    const key = rule.subject
      ? `${rule.scope}:${ip}:${rule.subject}`
      : `${rule.scope}:${ip}`;
    const result = hit(key, rule.limit, rule.windowMs);
    if (!result.ok) {
      throw new ApiError(429, "Too many attempts. Please wait a moment and try again.", {
        "Retry-After": String(result.retryAfter),
      });
    }
  }
}

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
