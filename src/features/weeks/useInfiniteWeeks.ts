import { useCallback, useEffect, useRef, useState } from 'react';

const CHUNK = 4;

interface WeekRange {
  first: number;
  /** Last week currently shown. */
  last: number;
}

/**
 * Which weeks of a plan the list shows. It starts around `startWeek`, can grow forward without limit
 * (up to `lastWeek` for plans with an end date) and backwards down to week 1.
 */
export function useInfiniteWeeks(startWeek: number, lastWeek: number | null) {
  const [range, setRange] = useState<WeekRange>({ first: startWeek, last: startWeek + CHUNK });
  const [loading, setLoading] = useState(false);
  const sentinel = useRef<HTMLDivElement | null>(null);

  const cap = useCallback((week: number) => (lastWeek === null ? week : Math.min(week, lastWeek)), [lastWeek]);
  const last = cap(range.last);
  const hasMore = lastWeek === null || last < lastWeek;

  const loadMore = useCallback(() => {
    setLoading(true);
    // Let the skeleton paint before the next weeks are computed.
    setTimeout(() => {
      setRange((current) => ({ ...current, last: current.last + CHUNK }));
      setLoading(false);
    }, 0);
  }, []);

  const loadEarlier = useCallback(() => setRange((current) => ({ ...current, first: Math.max(1, current.first - CHUNK) })), []);

  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasMore || loading || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) loadMore();
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loading, loadMore, last]);

  return { first: range.first, last, hasMore, loading, sentinel, loadMore, loadEarlier };
}
