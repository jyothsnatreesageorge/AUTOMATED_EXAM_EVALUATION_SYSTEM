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
  tls:                  { rejectUnauthorized: false },
  maxRetriesPerRequest: null,
  enableReadyCheck:     false,
};

console.log("🧩 Initializing evalQueue...");
console.log("🔗 REDIS_URL:", process.env.REDIS_URL ? "set ✅" : "undefined ❌");

const client     = new Redis(redisOpts);
const subscriber = new Redis(redisOpts);
const bclient    = new Redis(redisOpts);

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
    stalledInterval: 30_000, // ← check for stalled jobs every 30s
    maxStalledCount: 3,      // ← retry stalled jobs up to 3 times
  },
  defaultJobOptions: {
    attempts:         3,
    backoff:          { type: "exponential", delay: 5000 },
    removeOnComplete: false, // ← keep completed jobs so nothing is lost on restart
    removeOnFail:     false, // ← keep failed jobs for debugging
  },
});

evalQueue.on("error", (err) => console.error("❌ Queue connection error:", err.message));
