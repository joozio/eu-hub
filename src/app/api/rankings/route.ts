import { NextResponse } from 'next/server';
import { fetchAllRankings, RankingsData } from '@/services/eurostat-rankings';

// In-memory cache with 6-hour TTL
let cache: { data: RankingsData; timestamp: number } | null = null;
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

export async function GET() {
  const now = Date.now();

  // Return cached data if fresh
  if (cache && (now - cache.timestamp) < CACHE_TTL) {
    return NextResponse.json(cache.data);
  }

  try {
    const data = await fetchAllRankings();
    cache = { data, timestamp: now };
    return NextResponse.json(data);
  } catch (error) {
    console.error('Rankings API error:', error);

    // Serve stale cache if available
    if (cache) {
      return NextResponse.json(cache.data);
    }

    return NextResponse.json(
      { error: 'Failed to fetch rankings data' },
      { status: 500 }
    );
  }
}
