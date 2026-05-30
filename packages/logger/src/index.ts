import { createHash } from "node:crypto";

import { loadEnv } from "@cosimi/config";
import pino from "pino";

export function createLogger(component: string) {
  const env = loadEnv();
  return pino({
    level: env.LOG_LEVEL,
    base: { app: component },
    redact: {
      // Defensive: never log these field names at any level, even by accident.
      paths: ["input", "response", "reply", "message", "body.message", "body.reply", "body.input"],
      censor: "[REDACTED]",
    },
  });
}

/**
 * Convert raw user text to a non-reversible reference for INFO+ logs.
 * Use this whenever you want to log SOMETHING about an input/response
 * (e.g. "is it the same as last time?", "how big is it?") without leaking content.
 */
export function redactInput(
  text: string | null | undefined,
): { length: number; hash: string } | null {
  if (text == null) return null;
  return {
    length: text.length,
    hash: createHash("sha256").update(text).digest("hex").slice(0, 8),
  };
}
