import { useEffect, useRef, useState } from "react";

/**
 * Reveals `items` in client-side batches as a sentinel element nears the viewport
 * (spec §8.3.4). `resetKey` restarts from the first batch when the view, filter,
 * sort or search changes — but not when the data is merely refreshed, so closing the
 * player never collapses the list the user had scrolled.
 */
export function useProgressiveList(items, resetKey, batchSize = 24) {
  const [count, setCount] = useState(batchSize);
  const sentinelRef = useRef(null);

  useEffect(() => {
    setCount(batchSize);
  }, [resetKey, batchSize]);

  const hasMore = count < items.length;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!hasMore || !node) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) setCount((c) => c + batchSize);
      },
      { rootMargin: "400px" }
    );
    observer.observe(node);
    // Re-observing after every batch makes the observer fire again if the sentinel is still in view.
    return () => observer.disconnect();
  }, [hasMore, count, batchSize]);

  return { visible: items.slice(0, count), hasMore, sentinelRef };
}
