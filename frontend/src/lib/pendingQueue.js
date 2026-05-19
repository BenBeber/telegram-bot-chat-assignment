export function pruneExpired(queue, now, ttlMs) {
  const cutoff = now - ttlMs;
  let i = 0;
  while (i < queue.length && queue[i].sentAt < cutoff) i++;
  return queue.slice(i);
}

export function popOldest(queue) {
  if (queue.length === 0) return [null, queue];
  const [head, ...rest] = queue;
  return [head, rest];
}