import {
  SecretsManagerClient,
  GetSecretValueCommand,
  PutSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const client      = new SecretsManagerClient({ region: process.env.AWS_REGION });
const SECRET_ID   = "sage/gemini-keys";
const DAILY_LIMIT = 1500;
const MAX_ERRORS  = 10; // was 3 — too aggressive

let cachedKeys     = null;
let cacheExpiry    = 0;
let saveInProgress = false;
let pendingUpdates = [];

/* ── Load keys (force = bypass cache) ───────────────────────────────────── */
async function loadKeys(force = false) {
  if (!force && cachedKeys && Date.now() < cacheExpiry) return cachedKeys;
  const res   = await client.send(new GetSecretValueCommand({ SecretId: SECRET_ID }));
  cachedKeys  = JSON.parse(res.SecretString);
  cacheExpiry = Date.now() + 60_000;
  return cachedKeys;
}

/* ── Save keys ───────────────────────────────────────────────────────────── */
async function saveKeys(keys) {
  cachedKeys  = keys;
  cacheExpiry = Date.now() + 60_000;
  await client.send(
    new PutSecretValueCommand({
      SecretId:     SECRET_ID,
      SecretString: JSON.stringify(keys),
    })
  );
}

/* ── Serialize all mutations — prevents race conditions ──────────────────── */
async function mutateKeys(updateFn) {
  return new Promise((resolve, reject) => {
    pendingUpdates.push({ updateFn, resolve, reject });
    if (!saveInProgress) drainQueue();
  });
}

async function drainQueue() {
  if (saveInProgress || pendingUpdates.length === 0) return;
  saveInProgress = true;
  while (pendingUpdates.length > 0) {
    const { updateFn, resolve, reject } = pendingUpdates.shift();
    try {
      const keys = await loadKeys(true); // always fresh read before mutating
      updateFn(keys);
      await saveKeys(keys);
      resolve();
    } catch (err) {
      reject(err);
    }
  }
  saveInProgress = false;
}

/* ── Reset key counters if it's a new day ────────────────────────────────── */
function resetIfNewDay(k) {
  const now       = new Date();
  const lastReset = new Date(k.lastReset || 0);
  const sameDay   =
    now.getFullYear() === lastReset.getFullYear() &&
    now.getMonth()    === lastReset.getMonth()    &&
    now.getDate()     === lastReset.getDate();
  if (!sameDay) {
    k.usedToday  = 0;
    k.errorCount = 0;
    k.lastReset  = now.toISOString();
  }
  return k;
}

/* ── Get the least-recently-used available key ───────────────────────────── */
export async function getNextApiKey() {
  const keys      = await loadKeys();
  const available = keys
    .map(resetIfNewDay)
    .filter((k) => k.active !== false)
    .filter((k) => k.usedToday < DAILY_LIMIT && (k.errorCount || 0) < MAX_ERRORS)
    .sort((a, b) => new Date(a.lastUsed || 0) - new Date(b.lastUsed || 0));

  if (!available.length)
    throw new Error(
      "All Gemini API keys have hit their daily limit. Add more keys or try tomorrow."
    );

  console.log(
    `🔑 Using key: ${available[0].label} | usedToday: ${available[0].usedToday} | errorCount: ${available[0].errorCount}`
  );

  return available[0];
}

/* ── Mark key as successfully used ──────────────────────────────────────── */
export async function markKeyUsed(label) {
  await mutateKeys((keys) => {
    const k = keys.find((x) => x.label === label);
    if (!k) return;
    k.usedToday  = (k.usedToday  || 0) + 1;
    k.errorCount = 0; // reset errors on success
    k.lastUsed   = new Date().toISOString();
  });
}

/* ── Mark key as failed — only call for quota/auth errors ────────────────── */
export async function markKeyFailed(label) {
  await mutateKeys((keys) => {
    const k = keys.find((x) => x.label === label);
    if (!k) return;
    k.errorCount = (k.errorCount || 0) + 1;
    k.lastUsed   = new Date().toISOString();
    console.warn(
      `⚠️  Key ${label} errorCount is now ${k.errorCount}/${MAX_ERRORS}`
    );
  });
}

/* ── Admin helpers ───────────────────────────────────────────────────────── */
export async function getKeyPoolStatus() {
  const keys = await loadKeys(true);
  return keys.map(({ label, active, usedToday, lastUsed, errorCount }) => ({
    label,
    active:     active !== false,
    usedToday:  usedToday  || 0,
    remaining:  Math.max(0, DAILY_LIMIT - (usedToday || 0)),
    lastUsed,
    errorCount: errorCount || 0,
  }));
}

export async function addKey(label, keyValue) {
  await mutateKeys((keys) => {
    if (keys.find((k) => k.label === label))
      throw new Error("A key with this label already exists");
    keys.push({
      label,
      key:        keyValue,
      active:     true,
      usedToday:  0,
      errorCount: 0,
      lastUsed:   null,
      lastReset:  new Date().toISOString(),
    });
  });
}

export async function removeKey(label) {
  await mutateKeys((keys) => {
    const idx = keys.findIndex((k) => k.label === label);
    if (idx !== -1) keys.splice(idx, 1);
  });
}

export async function toggleKey(label) {
  let newState;
  await mutateKeys((keys) => {
    const k = keys.find((x) => x.label === label);
    if (!k) throw new Error("Key not found");
    k.active = !k.active;
    newState = k.active;
  });
  return newState;
}

/* ── Reset all keys (emergency use) ─────────────────────────────────────── */
export async function resetAllKeys() {
  await mutateKeys((keys) => {
    keys.forEach((k) => {
      k.usedToday  = 0;
      k.errorCount = 0;
      k.lastReset  = new Date().toISOString();
    });
  });
  console.log("✅ All keys reset");
}