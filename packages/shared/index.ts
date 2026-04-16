export const PLAN_LIMITS = {
  anonymous: { searchesPerDay: 2 },
  free: { searchesPerMonth: 5 },
  pro: { searchesPerDay: Number.POSITIVE_INFINITY },
  api: { searchesPerDay: 1000 }
} as const;

export const SUPPORTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime"
];

export const AFFILIATE_DISCLOSURE =
  "We may earn a commission at no extra cost to you.";
