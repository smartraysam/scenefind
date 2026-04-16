import { createClient } from "redis";
import { config } from "../config.js";

const memoryStore = new Map<string, number>();

export const redisClient = config.redisUrl ? createClient({ url: config.redisUrl }) : null;

if (redisClient) {
  redisClient.on("error", () => {
    // Swallow Redis errors and fallback to memory counters.
  });
  redisClient.connect().catch(() => {
    // Best-effort redis connection.
  });
}

function getPeriodSuffix(period: "day" | "month"): string {
  const now = new Date();
  if (period === "month") {
    return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
  }
  return now.toISOString().slice(0, 10);
}

export async function incrementUsage(userKey: string, period: "day" | "month"): Promise<number> {
  const key = `${userKey}:${period}:${getPeriodSuffix(period)}`;

  if (redisClient?.isOpen) {
    const count = await redisClient.incr(key);
    const ttl = period === "month" ? 31 * 24 * 60 * 60 : 24 * 60 * 60;
    await redisClient.expire(key, ttl);
    return count;
  }

  const next = (memoryStore.get(key) || 0) + 1;
  memoryStore.set(key, next);
  return next;
}

export async function getUsage(userKey: string, period: "day" | "month"): Promise<number> {
  const key = `${userKey}:${period}:${getPeriodSuffix(period)}`;

  if (redisClient?.isOpen) {
    const count = await redisClient.get(key);
    return Number(count || 0);
  }

  return memoryStore.get(key) || 0;
}

export function getInMemorySnapshot(): Record<string, number> {
  return Object.fromEntries(memoryStore.entries());
}
