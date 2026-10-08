import fs from "node:fs/promises";
import { Worker } from "node:worker_threads";
import { after } from "node:test";
const clients = new Set();
after(async () => {
  await Promise.all([...clients].map((client) => client.close()));
});
function workerEnvironment() {
  const allowed = [
    "PATH",
    "TZ",
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "no_proxy",
    "NODE_EXTRA_CA_CERTS",
  ];
  const environment = { TZ: "Asia/Shanghai" };
  for (const key of allowed)
    if (typeof process.env[key] === "string")
      environment[key] = process.env[key];
  return environment;
}
export async function createIsolatedClient({
  envId,
  publicKey,
  sessionPath,
  label,
  cacheOnly = false,
  captureLogin = false,
} = {}) {
  const worker = new Worker(
    new URL("./cloud-client-worker.js", import.meta.url),
    {
      workerData: {
        envId,
        publicKey,
        sessionPath,
        label,
        cacheOnly,
        captureLogin,
      },
      env: workerEnvironment(),
      stdout: true,
      stderr: true,
    },
  );
  worker.stdout.resume();
  worker.stderr.resume();
  let sequence = 0,
    closed = false;
  const pending = new Map();
  let resolveReady, rejectReady;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  worker.on("message", (message) => {
    if (Object.hasOwn(message, "ready")) {
      if (message.ready) resolveReady();
      else
        rejectReady(
          new Error(message.errorCode ?? "REAL_CLOUD_SESSION_REJECTED"),
        );
      return;
    }
    const request = pending.get(message.id);
    if (!request) return;
    clearTimeout(request.timeout);
    pending.delete(message.id);
    if (message.ok) request.resolve(message.data);
    else
      request.reject(
        Object.assign(
          new Error(message.errorCode ?? "REAL_CLOUD_OPERATION_FAILED"),
          { code: message.errorCode },
        ),
      );
    if (!pending.size) worker.unref();
  });
  worker.on("error", () => {
    const error = new Error("REAL_CLOUD_WORKER_FAILED");
    rejectReady(error);
    for (const request of pending.values()) {
      clearTimeout(request.timeout);
      request.reject(error);
    }
    pending.clear();
  });
  const readyTimeout = setTimeout(
    () => rejectReady(new Error("REAL_CLOUD_WORKER_START_TIMED_OUT")),
    30000,
  );
  try {
    await ready;
  } catch (error) {
    await worker.terminate();
    throw error;
  } finally {
    clearTimeout(readyTimeout);
  }
  const rpc = (operation, payload) => {
    if (closed) return Promise.reject(new Error("REAL_CLOUD_CLIENT_CLOSED"));
    worker.ref();
    const id = ++sequence;
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        pending.delete(id);
        worker.unref();
        reject(new Error("REAL_CLOUD_OPERATION_TIMED_OUT"));
      }, 30000);
      pending.set(id, { resolve, reject, timeout });
      worker.postMessage({ id, operation, payload });
    });
  };
  const client = {
    namedFunction: (functionName, request) => rpc("namedFunction", {functionName, request}),
    invoke: (request) => rpc("invoke", request),
    community: (request) => rpc("community", request),
    readiness: () => rpc("readiness"),
    identityFlags: () => rpc("identityFlags"),
    profileLookupFlags: () => rpc("profileLookupFlags"),
    bindFixtureObject: (input) => rpc("bindFixtureObject",input),
    directFixtureUrls: (assetId) => rpc("directFixtureUrls",{assetId}),
    directFixtureDownload: (assetId) => rpc("directFixtureDownload",{assetId}),
    workspaceMatches: (id) => rpc("workspaceMatches", id),
    upload: (ticketId, bytes) => rpc("upload", { ticketId, bytes }),
    cacheProbeSet: (value) => rpc("cacheProbeSet", value),
    cacheProbeGet: () => rpc("cacheProbeGet"),
    environmentFlags: () => rpc("environmentFlags"),
    app: {
      database: () => ({
        collection: (name) => ({
          limit: () => ({
            get: () => rpc("directDatabaseRead", { collection: name }),
          }),
        }),
      }),
      getTempFileURL: (input) => rpc("directUrls", input),
      downloadFile: (input) => rpc("directDownload", input),
    },
    async close() {
      if (closed) return;
      closed = true;
      clients.delete(client);
      for (const request of pending.values()) {
        clearTimeout(request.timeout);
        request.reject(new Error("REAL_CLOUD_CLIENT_CLOSED"));
      }
      pending.clear();
      await worker.terminate();
    },
  };
  clients.add(client);
  worker.unref();
  return client;
}
export async function realClients() {
  const sessionPath = process.env.PAW_DIARY_REAL_SESSIONS_FILE;
  if (!sessionPath)
    throw new Error(
      "REAL_CLOUD_NOT_CONFIGURED: controlled A/B and real anonymous SDK sessions required",
    );
  try {
    const information = await fs.stat(sessionPath);
    if (!information.isFile()) throw new Error("NOT_FILE");
  } catch {
    throw new Error("REAL_CLOUD_SESSION_FILE_UNREADABLE");
  }
  const envId =
    process.env.PAW_DIARY_CLOUD_ENV_ID ?? "paw-diary-d8g3p4tlsb305221d";
  const common = {
    envId,
    publicKey: process.env.PAW_DIARY_CLOUD_PUBLIC_KEY,
    sessionPath,
  };
  return {
    A: await createIsolatedClient({ ...common, label: "A" }),
    B: await createIsolatedClient({ ...common, label: "B" }),
    anonymous: await createIsolatedClient({ ...common, label: "anonymous" }),
    unauthenticated: await createIsolatedClient({
      ...common,
      label: "unauthenticated",
    }),
  };
}
export const read = (client) =>
  client.invoke({ version: 1, action: "health.snapshot", payload: {} });
export const write = (
  client,
  action,
  payload,
  revision,
  idempotencyKey = crypto.randomUUID(),
) =>
  client.invoke({
    version: 1,
    action,
    payload,
    expectedRevision: revision,
    idempotencyKey,
  });
export function requireSuccess(result) {
  if (result?.ok !== true)
    throw new Error(
      "REAL_CLOUD_OPERATION_NOT_SUCCESSFUL:" +
        String(result?.error?.code ?? "UNKNOWN"),
    );
  return result;
}
