import { parentPort, workerData, threadId } from "node:worker_threads";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import cloudbase from "@cloudbase/js-sdk";
const { envId, publicKey, sessionPath, label, cacheOnly = false, captureLogin=false } = workerData;
const app = cloudbase.init({
  env: envId,
  region: "ap-shanghai",
  persistence: "none",
  debug: false,
  ...(publicKey ? { accessKey: publicKey } : {}),
});
const auth = app.auth(),
  uploads = new Map();
const fail = (code) => Object.assign(new Error(code), { code });
const safeCode = (error) =>
  typeof error?.code === "string" && /^[A-Za-z0-9_.-]{1,100}$/.test(error.code)
    ? error.code
    : "REAL_CLOUD_OPERATION_FAILED";
async function freshUser() {
  const result = await auth.getUser(true);
  if (result?.error) throw fail("REAL_CLOUD_USER_READ_FAILED");
  return result?.data?.user ?? null;
}
async function initialize() {
  if (cacheOnly || label === "unauthenticated") return;
  let document;
  try {
    document = JSON.parse(await fs.readFile(sessionPath, "utf8"));
  } catch {
    throw fail("REAL_CLOUD_SESSION_FILE_UNREADABLE");
  }
  if (document.envId !== envId) throw fail("REAL_CLOUD_SESSION_ENV_MISMATCH");
  const session = document[label];
  if(captureLogin){
    if(typeof session?.username!=='string'||typeof session?.password!=='string')throw fail('REAL_CLOUD_LOGIN_CREDENTIALS_INCOMPLETE');
    const result=await auth.signInWithPassword({username:session.username,password:session.password});
    if(result?.error||typeof result?.data?.session?.access_token!=='string'||typeof result?.data?.session?.refresh_token!=='string')throw fail('REAL_CLOUD_PASSWORD_LOGIN_REJECTED');
    const latest=JSON.parse(await fs.readFile(sessionPath,'utf8'));
    latest[label]={...latest[label],access_token:result.data.session.access_token,refresh_token:result.data.session.refresh_token};
    await fs.writeFile(sessionPath,JSON.stringify(latest),{mode:0o600});await fs.chmod(sessionPath,0o600);
    return;
  }
  if (
    typeof session?.access_token !== "string" ||
    typeof session?.refresh_token !== "string"
  )
    throw fail("REAL_CLOUD_SESSION_INCOMPLETE");
  const result = await auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });
  if (result?.error) throw fail("REAL_CLOUD_SESSION_REJECTED");
}
async function operation(name, payload) {
  if (name === "cacheProbeSet") {
    auth.cache.storage.setItem("paw-diary:test-cache-sentinel", payload);
    return true;
  }
  if (name === "cacheProbeGet")
    return auth.cache.storage.getItem("paw-diary:test-cache-sentinel") ?? null;
  if (name === "environmentFlags")
    return {
      threadId,
      managementCredentialsPresent: Object.keys(process.env).some((key) =>
        /^(TENCENTCLOUD_|MINIMAX_)/.test(key),
      ),
      sdkTestTokenOverridePresent: Object.hasOwn(process.env, "tcb_token"),
    };
  if (cacheOnly) throw fail("CACHE_ONLY_CLIENT_CANNOT_CALL_CLOUD");
  if (name === "identityFlags") {
    const user = await freshUser();
    const uid = typeof user?.id === "string" ? user.id : null;
    return {
      signedIn: !!uid,
      uidHash: uid
        ? createHash("sha256").update(`${envId}\0${uid}`).digest("hex")
        : null,
      emailPresent: typeof user?.email === "string" && !!user.email,
      emailVerified:
        typeof user?.email_confirmed_at === "string" &&
        Number.isFinite(Date.parse(user.email_confirmed_at)),
      isAnonymous: user?.is_anonymous === true,
    };
  }
  if (name === "workspaceMatches") {
    const user = await freshUser();
    if (typeof user?.id !== "string") return false;
    return (
      payload ===
      `cloud:${createHash("sha256")
        .update(JSON.stringify({ environmentId: envId, ownerId: user.id }))
        .digest("hex")}`
    );
  }
  if (name === "invoke") {
    const raw = (await app.callFunction({ name: "paw-api", data: payload })).result;
    let result;
    try {result=typeof raw==='string'?JSON.parse(raw):raw;} catch {throw fail('REAL_CLOUD_API_REPLY_INVALID');}
    if(typeof result?.ok!=='boolean')throw fail('REAL_CLOUD_API_REPLY_INVALID');
    if (
      payload.action === "media.prepare" &&
      result?.ok &&
      result.data?.upload
    ) {
      uploads.set(result.data.ticketId, result.data.upload);
      return {
        ...result,
        data: { ...result.data, upload: { transport: "worker-owned" } },
      };
    }
    return result;
  }
  if(name==='readiness') {
    const raw=(await app.callFunction({name:'paw-stage2-readiness',data:{}})).result;
    let flags;try{flags=typeof raw==='string'?JSON.parse(raw):raw;}catch{throw fail('REAL_CLOUD_PROBE_REPLY_INVALID');}
    if(!flags||typeof flags!=='object')throw fail('REAL_CLOUD_PROBE_REPLY_INVALID');
    return Object.fromEntries(Object.entries(flags).filter(([key,value])=>typeof value==='boolean'||value===null||key==='adminFieldNames'&&Array.isArray(value)&&value.every(name=>typeof name==='string'&&/^[A-Za-z_][A-Za-z0-9_]{0,60}$/.test(name))));
  }
  if (name === "upload") {
    const upload = uploads.get(payload.ticketId);
    if (!upload) throw fail("REAL_CLOUD_UPLOAD_TICKET_MISSING");
    const result = await fetch(upload.url, {
      method: "PUT",
      headers: upload.headers,
      body: Buffer.from(payload.bytes),
    });
    return { ok: result.ok, status: result.status };
  }
  if (name === "directDatabaseRead") {
    if (payload.collection !== "health_workspaces")
      throw fail("DIRECT_DB_PROBE_SCOPE_INVALID");
    const result = await app
      .database()
      .collection(payload.collection)
      .limit(1)
      .get();
    if (result?.code) throw fail(safeCode(result));
    return { data: [], allowed: true };
  }
  if (name === "directUrls") {
    const result = await app.getTempFileURL(payload);
    return {
      fileList: (result?.fileList ?? []).map((item) => ({
        code: item.code,
        ...(item.code === "SUCCESS" && typeof item.tempFileURL === "string"
          ? { tempFileURL: "[redacted]" }
          : {}),
      })),
    };
  }
  if (name === "directDownload") {
    const result = await app.downloadFile(payload);
    if (result?.code) throw fail(safeCode(result));
    return { allowed: true };
  }
  throw fail("REAL_CLOUD_OPERATION_UNSUPPORTED");
}
let queue = Promise.resolve();
parentPort.on("message", (message) => {
  const run = queue.then(async () => {
    try {
      const data = await operation(message.operation, message.payload);
      parentPort.postMessage({ id: message.id, ok: true, data });
    } catch (error) {
      parentPort.postMessage({
        id: message.id,
        ok: false,
        errorCode: safeCode(error),
      });
    }
  });
  queue = run.catch(() => {});
});
try {
  await initialize();
  parentPort.postMessage({ ready: true });
} catch (error) {
  parentPort.postMessage({ ready: false, errorCode: safeCode(error) });
}
