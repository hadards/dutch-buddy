const DAILY_LIMIT = 50;
const counts = new Map<string, { day: string; count: number }>();

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

// ponytail: in-memory, resets on redeploy/restart — fine for a family-scale daily cap, add persistence if that ever matters
export function checkAndIncrement(id: string): boolean {
  const entry = counts.get(id);
  const day = today();
  if (!entry || entry.day !== day) {
    counts.set(id, { day, count: 1 });
    return true;
  }
  if (entry.count >= DAILY_LIMIT) return false;
  entry.count++;
  return true;
}

export const dailyLimit = DAILY_LIMIT;
