// utils/evalQueue.js
import "dotenv/config";
import Bull  from "bull";
import Redis from "ioredis";

const redisUrl  = new URL(process.env.REDIS_URL);
const redisOpts = {
  host:                 redisUrl.hostname,
  port:                 parseInt(redisUrl.port) || 6379,
  password:             decodeURIComponent(redisUrl.password),
  username:             redisUrl.username || "default",
  // ✅ Only use TLS if URL scheme is rediss://
  tls:                  redisUrl.protocol === "rediss:" ? { rejectUnauthorized: false } : undefined,
  maxRetriesPerRequest: null,
  enableReadyCheck:     false,
  retryStrategy(times) {
    if (times > 5) {
      console.error("❌ Redis retry limit reached — giving up.");
      return null;
    }
    const delay = Math.min(times * 2000, 30_000);
    console.warn(`⚠️  Redis retry #${times} in ${delay}ms…`);
    return delay;
  },
  reconnectOnError(err) {
    if (err.message.includes("max requests limit exceeded")) {
      console.error("❌ Upstash quota exceeded — reconnection suppressed.");
      return false;
    }
    return true;
  },
};

console.log("🧩 Initializing evalQueue...");
console.log("🔗 REDIS_URL:", process.env.REDIS_URL ? "set ✅" : "undefined ❌");

// ── Shared Redis client factory with error guards ─────────────────────────
function makeRedis(tag) {
  const r = new Redis(redisOpts);
  r.on("error", (err) => console.error(`❌ Redis [${tag}] error:`, err.message));
  r.on("reconnecting", (ms) => console.warn(`🔄 Redis [${tag}] reconnecting in ${ms}ms`));
  return r;
}

const client     = makeRedis("client");
const subscriber = makeRedis("subscriber");
const bclient    = makeRedis("bclient");

export const evalQueue = new Bull("evaluation", {
  createClient: (type) => {
    switch (type) {
      case "client":     return client;
      case "subscriber": return subscriber;
      case "bclient":    return bclient;
      default:           return client;
    }
  },
  settings: {
    stalledInterval: 30_000,
    maxStalledCount: 3,
  },
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: "exponential", delay: 5000 },
    removeOnComplete: false,
    removeOnFail:     false,
  },
});

evalQueue.on("error", (err) => console.error("❌ Queue error:", err.message));
