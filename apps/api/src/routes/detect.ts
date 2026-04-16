import express from "express";
import { AFFILIATE_DISCLOSURE, PLAN_LIMITS, SUPPORTED_MEDIA_TYPES } from "@scenefind/shared";
import { openai } from "../lib/openai.js";
import { enrichWithTmdb } from "../lib/tmdb.js";
import { extractJsonObject } from "../utils/extractJson.js";
import { getUsage, incrementUsage } from "../lib/storage.js";
import { logDetectionEvent } from "../lib/postgres.js";

const router = express.Router();

type UserContext = {
  kind: "anonymous" | "free" | "unverified" | "pro" | "api";
  userKey: string;
};

type DetectResult = {
  found: boolean;
  title?: string;
  year?: string;
  genre?: string;
  director?: string;
  confidence?: string;
  description?: string;
  streaming?: Array<{ platform: string; color?: string; affiliate_url?: string }>;
  imdb_url?: string;
  tmdb_id?: number;
  reasoning?: string;
  [key: string]: unknown;
};

const PROVIDER_AFFILIATE_LINKS: Record<string, string> = {
  Netflix: "https://www.netflix.com",
  "Amazon Prime Video": "https://www.amazon.com",
  "Amazon Prime": "https://www.amazon.com",
  "Apple TV Plus": "https://tv.apple.com",
  Hulu: "https://www.hulu.com",
  Disney: "https://www.disneyplus.com"
};

function getUserContext(req: express.Request): UserContext {
  const userId = req.header("x-user-id") || null;
  const plan = (req.header("x-user-plan") || "free").toLowerCase();
  const verified = (req.header("x-user-email-verified") || "false") === "true";

  if (!userId) {
    return { kind: "anonymous", userKey: req.ip || "anon" };
  }

  if (plan === "pro") {
    return { kind: "pro", userKey: `user:${userId}` };
  }

  if (plan === "api") {
    return { kind: "api", userKey: `user:${userId}` };
  }

  return { kind: verified ? "free" : "unverified", userKey: `user:${userId}` };
}

async function enforceUsageLimit(req: express.Request, res: express.Response, next: express.NextFunction) {
  const context = getUserContext(req);
  res.locals.userContext = context;

  if (context.kind === "pro") {
    next();
    return;
  }

  if (context.kind === "unverified") {
    res.status(403).json({
      error: "Email verification required before using free monthly searches."
    });
    return;
  }

  const isApi = context.kind === "api";
  const period: "day" | "month" = context.kind === "free" ? "month" : "day";
  const key = context.userKey;
  const limit = isApi
    ? PLAN_LIMITS.api.searchesPerDay
    : context.kind === "free"
      ? PLAN_LIMITS.free.searchesPerMonth
      : PLAN_LIMITS.anonymous.searchesPerDay;

  const current = await getUsage(key, period);
  if (current >= limit) {
    res.status(429).json({
      error: "Usage limit reached",
      current,
      limit,
      period
    });
    return;
  }

  res.locals.limitInfo = { key, period, limit };
  next();
}

function normalizeStreaming(
  result: DetectResult,
  tmdbProviders: Array<{ platform: string; color: string }> = []
): Array<{ platform: string; color: string; affiliate_url: string }> {
  if (Array.isArray(result.streaming) && result.streaming.length > 0) {
    return result.streaming.map((item) => ({
      platform: item.platform,
      color: item.color || "#101820",
      affiliate_url: PROVIDER_AFFILIATE_LINKS[item.platform] || item.affiliate_url || ""
    }));
  }

  return tmdbProviders.map((provider) => ({
    platform: provider.platform,
    color: provider.color,
    affiliate_url: PROVIDER_AFFILIATE_LINKS[provider.platform] || ""
  }));
}

router.post("/", enforceUsageLimit, async (req, res) => {
  try {
    const { base64Image, mediaType } = (req.body || {}) as { base64Image?: string; mediaType?: string };

    if (!base64Image || !mediaType) {
      return res.status(400).json({ error: "base64Image and mediaType are required" });
    }

    if (!SUPPORTED_MEDIA_TYPES.includes(mediaType)) {
      return res.status(400).json({
        error: "Unsupported media type",
        supported: SUPPORTED_MEDIA_TYPES
      });
    }

    if (!openai) {
      return res.status(500).json({ error: "OPENAI_API_KEY is not configured" });
    }

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      max_tokens: 1000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mediaType};base64,${base64Image}`
              }
            },
            {
              type: "text",
              text: `You are a movie identification expert. Analyze this image and identify the movie or TV show.\nRespond ONLY with a JSON object (no markdown, no backticks):\n{\n  "found": true,\n  "title": "Movie Title",\n  "year": "2020",\n  "genre": "Action, Thriller",\n  "director": "Director Name",\n  "confidence": "High",\n  "description": "2-sentence plot summary.",\n  "streaming": [\n    { "platform": "Netflix", "color": "#E50914", "affiliate_url": "https://netflix.com/..." },\n    { "platform": "Amazon Prime", "color": "#00A8E0", "affiliate_url": "https://amazon.com/..." }\n  ],\n  "imdb_url": "https://www.imdb.com/title/ttXXXXXXX",\n  "tmdb_id": 12345,\n  "reasoning": "Brief note on visual cues used"\n}\nIf the movie cannot be identified, return: { "found": false }`
            }
          ]
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content || "{}";
    const result = extractJsonObject<DetectResult>(content);

    const tmdbData = result.found
      ? await enrichWithTmdb({
          tmdbId: result.tmdb_id,
          title: result.title,
          year: result.year
        })
      : null;

    const finalPayload = {
      ...result,
      title: tmdbData?.title || result.title,
      year: tmdbData?.year || result.year,
      tmdb_id: tmdbData?.tmdb_id || result.tmdb_id,
      poster_url: tmdbData?.poster_url || null,
      rating: tmdbData?.rating || null,
      cast: tmdbData?.cast || [],
      streaming: normalizeStreaming(result, tmdbData?.providers || []),
      affiliate_disclosure: AFFILIATE_DISCLOSURE
    };

    const { key, period, limit } = res.locals.limitInfo as { key: string; period: "day" | "month"; limit: number };
    const used = await incrementUsage(key, period);

    const userContext = res.locals.userContext as UserContext;
    await logDetectionEvent({
      userId: userContext.userKey,
      plan: userContext.kind,
      mediaType,
      found: Boolean(finalPayload.found),
      title: (finalPayload.title as string) || null,
      confidence: (finalPayload.confidence as string) || null
    }).catch(() => {});

    res.json({
      ...finalPayload,
      usage: {
        period,
        used,
        remaining: Number.isFinite(limit) ? Math.max(limit - used, 0) : null,
        limit
      }
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Unknown error";
    res.status(500).json({ error: "Detection failed", detail });
  }
});

export default router;
