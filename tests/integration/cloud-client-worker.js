import { parentPort, workerData, threadId } from "node:worker_threads";
import fs from "node:fs/promises";
import { createHash } from "node:crypto";
import cloudbase from "@cloudbase/js-sdk";
import verifiedProfile from "../../backend/verified-profile.cjs";
import {updateSessionFile} from "../../scripts/lib/session-file.mjs";
import {withSessionCheckpoint} from "../../scripts/lib/session-checkpoint.mjs";
const {
  envId,
  publicKey,
  sessionPath,
  label,
  cacheOnly = false,
  captureLogin = false,
} = workerData;
const app = cloudbase.init({
  env: envId,
  region: "ap-shanghai",
  persistence: "none",
  debug: false,
  ...(publicKey ? { accessKey: publicKey } : {}),
});
const auth = app.auth(),
  uploads = new Map(),
  fixtureObjects = new Map();
let expectedWorkspaceId = null;
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
async function persistCurrentSession(){
  if(cacheOnly||label==="unauthenticated")return;
  const result=await auth.getSession();
  if(result?.error)throw fail("REAL_CLOUD_SESSION_READ_FAILED");
  await updateSessionFile(sessionPath,{envId,label,session:result?.data?.session});
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
  if (captureLogin) {
    if (
      typeof session?.username !== "string" ||
      typeof session?.password !== "string"
    )
      throw fail("REAL_CLOUD_LOGIN_CREDENTIALS_INCOMPLETE");
    const result = await auth.signInWithPassword({
      username: session.username,
      password: session.password,
    });
    if (
      result?.error ||
      typeof result?.data?.session?.access_token !== "string" ||
      typeof result?.data?.session?.refresh_token !== "string"
    )
      throw fail("REAL_CLOUD_PASSWORD_LOGIN_REJECTED");
    await persistCurrentSession();
    return;
  }
  if (
    typeof session?.access_token !== "string" ||
    typeof session?.refresh_token !== "string"
  )
    throw fail("REAL_CLOUD_SESSION_INCOMPLETE");
  const result = await auth.setSession({...session});
  if (result?.error) {
    const error = result.error;
    const machine = value => typeof value === 'string' && /^[A-Za-z0-9_.-]{1,100}$/.test(value) ? value : typeof value === 'number' ? value : null;
    await fs.appendFile(new URL('../../test-results/stage2/sdk-session-install-flags.jsonl',import.meta.url),JSON.stringify({label,phase:'setSession',errorCode:machine(error.code),errorType:machine(error.error),errorNumber:machine(error.errorCode??error.error_code),status:typeof error.status==='number'?error.status:null,errorFieldNames:Object.keys(error).filter(k=>/^[A-Za-z_][A-Za-z0-9_]{0,60}$/.test(k)),dataFieldNames:Object.keys(result.data??{})})+'\n',{mode:0o600});
    throw fail("REAL_CLOUD_SESSION_REJECTED");
  }
  await persistCurrentSession(); // setSession already consumed the file refresh token.
  await freshUser(); // Refresh normalized cache before actor RPCs.
  await persistCurrentSession();
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
    const session = (await auth.getSession())?.data?.session;
    const raw = await verifiedProfile.createPlatformProfileLookup({environmentId:envId,publishableKey:publicKey})(session?.access_token);
    const uid = typeof user?.id === "string" ? user.id : null;
    let serverVerified = false;
    if (uid && user?.is_anonymous === false && session?.access_token) {
      const response = (await app.callFunction({name:"paw-auth",data:{action:"auth.session",payload:{},authToken:session.access_token}})).result;
      const approval = typeof response === "string" ? JSON.parse(response) : response;
      serverVerified = approval?.ok === true && approval?.data?.principal?.userId === uid;
    }
    return {
      signedIn: !!uid,
      uidHash: uid
        ? createHash("sha256").update(`${envId}\0${uid}`).digest("hex")
        : null,
      emailPresent: typeof user?.email === "string" && !!user.email,
      emailVerified: raw?.email_verified === true || serverVerified,
      isAnonymous: user?.is_anonymous === true,
    };
  }
  if (name === "profileLookupFlags") {
    const session = (await auth.getSession())?.data?.session;
    const raw = await verifiedProfile.createPlatformProfileLookup({environmentId:envId,publishableKey:publicKey})(session?.access_token);
    return {
      profilePresent: !!raw,
      fieldNames: raw ? Object.keys(raw).filter(key=>/^[A-Za-z_][A-Za-z0-9_]{0,60}$/.test(key)) : [],
      emailPresent: typeof raw?.email === "string" && !!raw.email,
      emailVerifiedFieldPresent: !!raw && Object.hasOwn(raw,"email_verified"),
      emailVerified: raw?.email_verified === true,
      uidMatchesSdk: !!raw && (raw.sub ?? raw.uid ?? raw.id) === session?.user?.id,
      explicitlyAnonymous: raw?.is_anonymous === true || raw?.isAnonymous === true,
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
  if (name === "community") {
    const session = await auth.getSession();
    const request = {...payload,...(session?.data?.session?.access_token?{authToken:session.data.session.access_token}:{})};
    const raw = (await app.callFunction({name:"paw-community",data:request})).result;
    const result = typeof raw === "string" ? JSON.parse(raw) : raw;
    if(typeof result?.ok!=="boolean")throw fail("REAL_CLOUD_API_REPLY_INVALID");
    return result;
  }
  if (name === "invoke") {
    const session = await auth.getSession();
    const request = {
      ...payload,
      ...(expectedWorkspaceId && payload.expectedWorkspaceId === undefined
        ? { expectedWorkspaceId }
        : {}),
      ...(session?.data?.session?.access_token
        ? { authToken: session.data.session.access_token }
        : {}),
    };
    const raw = (await app.callFunction({ name: "paw-api", data: request }))
      .result;
    let result;
    try {
      result = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw fail("REAL_CLOUD_API_REPLY_INVALID");
    }
    if (typeof result?.ok !== "boolean")
      throw fail("REAL_CLOUD_API_REPLY_INVALID");
    if (
      result.ok &&
      payload.action === "health.snapshot" &&
      typeof result.workspaceId === "string"
    )
      expectedWorkspaceId = result.workspaceId;
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
  if (name === "readiness") {
    const raw = (
      await app.callFunction({ name: "paw-stage2-readiness", data: {} })
    ).result;
    let flags;
    try {
      flags = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      throw fail("REAL_CLOUD_PROBE_REPLY_INVALID");
    }
    if (!flags || typeof flags !== "object")
      throw fail("REAL_CLOUD_PROBE_REPLY_INVALID");
    return Object.fromEntries(
      Object.entries(flags).filter(
        ([key, value]) =>
          typeof value === "boolean" ||
          value === null ||
          (key === "adminFieldNames" &&
            Array.isArray(value) &&
            value.every(
              (name) =>
                typeof name === "string" &&
                /^[A-Za-z_][A-Za-z0-9_]{0,60}$/.test(name),
            )),
      ),
    );
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
  if (name === "bindFixtureObject") {
    if (typeof payload?.assetId !== "string" || !payload.assetId || typeof payload?.fileRef !== "string" ||
        !payload.fileRef.startsWith(`cloud://${envId}.`) || !payload.fileRef.includes("/")) throw fail("REAL_CLOUD_FIXTURE_MISMATCH");
    fixtureObjects.set(payload.assetId,payload.fileRef);
    return {bound:true};
  }
  if (name === "directFixtureUrls" || name === "directFixtureDownload") {
    const fileRef = fixtureObjects.get(payload?.assetId);
    if (!fileRef) throw fail("REAL_CLOUD_FIXTURE_NOT_BOUND");
    if (name === "directFixtureDownload") {
      const result = await app.downloadFile({fileID:fileRef});
      if (result?.code && result.code !== "SUCCESS") return {allowed:false,code:safeCode(result)};
      return {allowed:true};
    }
    const result = await app.getTempFileURL({fileList:[fileRef]});
    if (result?.code && result.code !== "SUCCESS") return {allowed:false,code:safeCode(result)};
    if (!Array.isArray(result?.fileList) || result.fileList.length !== 1) throw fail("REAL_CLOUD_DIRECT_PROBE_FAILED");
    const file = result.fileList[0];
    if (file?.code === "SUCCESS" && typeof file.tempFileURL === "string" && file.tempFileURL) return {allowed:true};
    if (file?.code && file.code !== "SUCCESS") return {allowed:false,code:safeCode(file)};
    throw fail("REAL_CLOUD_DIRECT_PROBE_FAILED");
  }
  if (name === "directDatabaseRead") {
    if (payload.collection !== "health_workspaces")
      throw fail("DIRECT_DB_PROBE_SCOPE_INVALID");
    const result = await app
      .database()
      .collection(payload.collection)
      .limit(1)
      .get();
    if (result?.code && result.code !== "SUCCESS") return {allowed:false,code:safeCode(result)};
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
      const data = await withSessionCheckpoint(()=>operation(message.operation, message.payload),persistCurrentSession);
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
