const key = "scenefind-local-usage";

type UsageSnapshot = {
  used: number;
  remaining: number;
};

type StoredUsage = {
  date: string;
  used: number;
};

function currentDateKey(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getClientUsage(limit = 3): UsageSnapshot {
  const raw = localStorage.getItem(key);
  const date = currentDateKey();

  if (!raw) {
    return { used: 0, remaining: limit };
  }

  try {
    const parsed = JSON.parse(raw) as StoredUsage;
    if (parsed.date !== date) {
      return { used: 0, remaining: limit };
    }

    const used = Number(parsed.used || 0);
    return { used, remaining: Math.max(limit - used, 0) };
  } catch {
    return { used: 0, remaining: limit };
  }
}

export function incrementClientUsage(limit = 3): UsageSnapshot {
  const date = currentDateKey();
  const { used } = getClientUsage(limit);
  const nextUsed = used + 1;
  localStorage.setItem(key, JSON.stringify({ date, used: nextUsed }));
  return { used: nextUsed, remaining: Math.max(limit - nextUsed, 0) };
}
