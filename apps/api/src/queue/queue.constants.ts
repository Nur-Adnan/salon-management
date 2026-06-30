export const SAMPLE_QUEUE = 'sample';

// BullMQ wants a ConnectionOptions object, not a URL string. Parse the URL once.
export function redisConnectionFromUrl(url: string) {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    ...(u.username ? { username: u.username } : {}),
    ...(u.password ? { password: u.password } : {}),
    // BullMQ requirement for its blocking connections.
    maxRetriesPerRequest: null,
  };
}
