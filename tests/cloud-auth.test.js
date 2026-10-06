import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let resolvePrincipal, createCloudbaseAuth, createCloudRepository;
try {
  ({ resolvePrincipal } = require("../backend/identity.cjs"));
} catch {}
try {
  ({ createCloudbaseAuth } = await import("../src/auth/cloudbase-auth.js"));
} catch {}
try {
  ({ createCloudRepository } = await import("../src/data/cloud-repository.js"));
} catch {}
test("auth and repository factories exist", () => {
  assert.equal(typeof resolvePrincipal, "function");
  assert.equal(typeof createCloudbaseAuth, "function");
  assert.equal(typeof createCloudRepository, "function");
});
test("trusted platform UID is checked against admin verified-email record", async () => {
  const auth = {
    getAuthContext: async () => ({ uid: "A" }),
    getUserInfo: () => ({ uid: "A", isAnonymous: false }),
    getEndUserInfo: async (uid) => ({
      userInfo: {
        uid,
        email: "a@example.invalid",
        emailVerified: true,
        isAnonymous: false,
      },
    }),
  };
  assert.deepEqual(
    await resolvePrincipal({ uid: "forged", emailVerified: true }, { auth }),
    { userId: "A", emailVerified: true, isAnonymous: false },
  );
  auth.getUserInfo = () => ({ uid: "A", isAnonymous: true });
  assert.equal(await resolvePrincipal({}, { auth }), null);
  auth.getUserInfo = () => ({ uid: "A", isAnonymous: false });
  auth.getEndUserInfo = async () => ({
    userInfo: { uid: "A", email: "a@example.invalid", emailVerified: false },
  });
  assert.equal(await resolvePrincipal({}, { auth }), null);
});
test("email adapter keeps challenge and credentials out of returned session", async () => {
  let subscribed;
  const user = {
    id: "A",
    email: "a@example.invalid",
    email_confirmed_at: "2026-10-07T00:00:00Z",
    is_anonymous: false,
  };
  const sdk = {
    getSession: async () => ({
      data: { user, session: { access_token: "secret" } },
      error: null,
    }),
    getUser: async () => ({ data: { user }, error: null }),
    signInWithOtp: async ({ email }) => ({
      data: {
        verifyOtp: async ({ token }) => ({
          data: { user, session: { access_token: "secret" } },
          error: token === "123456" ? null : { code: "bad" },
        }),
      },
      error: null,
    }),
    signOut: async () => {},
    onAuthStateChange: (fn) => {
      subscribed = fn;
      return { data: { subscription: { unsubscribe() {} } } };
    },
  };
  const auth = createCloudbaseAuth({ app: { auth: () => sdk } });
  assert.deepEqual(await auth.getSession(), { userId: "A" });
  const challenge = await auth.requestEmailCode({ email: user.email });
  assert.equal(JSON.stringify(challenge).includes(user.email), false);
  assert.deepEqual(await auth.verifyEmailCode({ challenge, code: "123456" }), {
    userId: "A",
  });
  await assert.rejects(auth.verifyEmailCode({ challenge, code: "123456" }));
  let delivered;
  auth.subscribe((x) => {
    delivered = x;
  });
  subscribed("SIGNED_IN", { user, access_token: "secret" });
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(delivered, { userId: "A" });
  user.is_anonymous = true;
  assert.equal(await auth.getSession(), null);
});
const snapshot = () => ({
  version: 3,
  mode: "account",
  pets: [],
  records: [],
  reminders: [],
  posts: [],
  activePetId: null,
  profile: { city: "深圳" },
});
test("repository lost response retry uses same key and stale snapshot cannot replace newer cache", async () => {
  const requests = [];
  let lose = true;
  const repo = createCloudRepository({
    principal: { userId: "A" },
    storage: null,
    invoke: async (req) => {
      requests.push(req);
      if (req.action === "health.snapshot")
        return {
          ok: true,
          data: snapshot(),
          revision: 0,
          workspaceId: "cloud:" + "a".repeat(64),
        };
      if (lose) {
        lose = false;
        throw new Error("network");
      }
      const s = snapshot();
      s.pets = [
        {
          id: "P",
          name: "A",
          type: "cat",
          deletedAt: null,
          birthday: null,
          estimatedAgeMonths: null,
          arrivalDate: null,
          breed: "",
          sex: "",
          image: "",
        },
      ];
      s.activePetId = "P";
      return {
        ok: true,
        data: s.pets[0],
        snapshot: s,
        revision: 1,
        workspaceId: "cloud:" + "a".repeat(64),
      };
    },
  });
  await repo.snapshot();
  const p = await repo.savePet(
    { name: "A", type: "cat" },
    { baseRevision: 0, operationId: "stable" },
  );
  assert.equal(p.id, "P");
  assert.equal(requests[1].idempotencyKey, requests[2].idempotencyKey);
  assert.equal(repo.getRevision(), 1);
  await repo.refresh();
  assert.equal((await repo.snapshot()).pets.length, 1);
  assert.equal(repo.getWorkspaceId(), "cloud:" + "a".repeat(64));
  assert.equal(repo.replaceSnapshot, undefined);
});
test("CloudBase store uses owner-scoped documents and real SDK transaction shape", async () => {
  let createCloudbaseStore;
  try {
    ({ createCloudbaseStore } = require("../backend/cloudbase-store.cjs"));
  } catch {}
  assert.equal(typeof createCloudbaseStore, "function");
  const docs = new Map();
  const client = {
    collection(name) {
      return {
        doc(id) {
          return {
            async get() {
              return {
                data: docs.has(name + id)
                  ? [structuredClone(docs.get(name + id))]
                  : [],
              };
            },
            async set(data) {
              docs.set(name + id, structuredClone(data));
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      return fn(client);
    },
  };
  const store = createCloudbaseStore({ db: client });
  await store.transactionOwned({ userId: "A" }, async (tx) => {
    tx.workspace = { snapshot: snapshot(), revision: 1 };
    await tx.putReceipt("same", { data: { id: "A" } });
  });
  assert.equal((await store.readOwned({ userId: "A" })).revision, 1);
  assert.equal(await store.readOwned({ userId: "B" }), null);
  await store.transactionOwned({ userId: "B" }, async (tx) =>
    assert.equal(await tx.getReceipt("same"), undefined),
  );
});
test("cloud media upload confirms server-issued ticket and archives paginate", async () => {
  const { createCloudMediaRepository } = await import(
    "../src/data/cloud-media-repository.js"
  );
  const calls = [];
  const repository = {
    getRevision: () => 4,
    async request(action, payload, options) {
      calls.push({ action, payload, options });
      if (action === "media.prepare")
        return {
          ticketId: "ticket",
          upload: {
            url: "https://upload.example.invalid",
            method: "PUT",
            headers: { key: "scoped" },
          },
        };
      if (action === "media.confirm") return { id: "asset" };
      if (action === "media.list")
        return payload.cursor
          ? { items: [{ id: "b" }], nextCursor: null }
          : { items: [{ id: "a" }], nextCursor: "a" };
    },
  };
  let uploaded = false;
  const media = createCloudMediaRepository({
    repository,
    processImage: async (blob) => ({ blob, mime: blob.type, bytes: blob.size }),
    upload: async (ticket, blob) => {
      uploaded = ticket.headers.key === "scoped" && blob.size === 3;
    },
  });
  const saved = await media.save({
    petId: "P",
    kind: "photo",
    blob: new Blob(["abc"], { type: "image/png" }),
    operationId: "upload",
  });
  assert.equal(saved.id, "asset");
  assert.equal(uploaded, true);
  assert.equal(calls[0].options.operationId, "upload:prepare");
  assert.deepEqual(calls[1].payload, { ticketId: "ticket" });
  assert.equal(calls[1].options.baseRevision, 4);
  assert.deepEqual(
    (await media.listAll()).map((x) => x.id),
    ["a", "b"],
  );
});

test("SDK error replies never become an empty workspace or a false successful write", async () => {
  const { createCloudbaseStore } = require("../backend/cloudbase-store.cjs");
  let failRead = true;
  const db = {
    collection() {
      return {
        doc() {
          return {
            async get() {
              return failRead
                ? { code: "DATABASE_REQUEST_FAILED" }
                : { data: [] };
            },
            async set() {
              return { code: "DATABASE_REQUEST_FAILED" };
            },
          };
        },
      };
    },
    async runTransaction(fn) {
      return fn(db);
    },
  };
  const store = createCloudbaseStore({ db });
  await assert.rejects(
    store.readOwned({ userId: "A" }),
    (e) => e.code === "UNAVAILABLE",
  );
  failRead = false;
  await assert.rejects(
    store.transactionOwned({ userId: "A" }, (tx) => {
      tx.workspace = { snapshot: snapshot(), revision: 1 };
    }),
    (e) => e.code === "UNAVAILABLE",
  );
});
test("identity uses SDK-parsed platform context when Node getUserInfo only sees process environment", async () => {
  const auth = {
    getAuthContext: async () => ({ uid: "A" }),
    getUserInfo: () => ({ uid: "", isAnonymous: false }),
    getEndUserInfo: async () => ({
      userInfo: {
        uid: "",
        sub: "A",
        email: "a@example.invalid",
        email_verified: true,
      },
    }),
  };
  const getPlatformContext = () => ({
    TCB_UUID: "A",
    TCB_ISANONYMOUS_USER: "false",
  });
  assert.deepEqual(
    await resolvePrincipal(
      { environment: "platform context only" },
      { auth, getPlatformContext },
    ),
    { userId: "A", emailVerified: true, isAnonymous: false },
  );
  assert.equal(
    await resolvePrincipal(
      {},
      {
        auth,
        getPlatformContext: () => ({
          TCB_UUID: "A",
          TCB_ISANONYMOUS_USER: "true",
        }),
      },
    ),
    null,
  );
  assert.equal(
    await resolvePrincipal(
      {},
      { auth, getPlatformContext: () => ({ TCB_UUID: "A" }) },
    ),
    null,
  );
});
test("server storage reads private bytes through a bounded stream even when object grows after HEAD", async () => {
  const { createCloudbaseStorage } = require("../backend/storage.cjs");
  const app = {
    getFileInfo: async () => ({
      fileList: [
        {
          code: "SUCCESS",
          size: 3,
          tempFileURL: "https://private.example.invalid/object",
        },
      ],
    }),
    downloadFile: async () => {
      throw new Error("unbounded SDK download must not be used");
    },
  };
  let content = new Uint8Array([1, 2, 3]);
  const storage = createCloudbaseStorage({
    app,
    fetch: async () => new Response(content),
  });
  assert.deepEqual(await storage.read("opaque", 3), Buffer.from([1, 2, 3]));
  content = new Uint8Array(4);
  await assert.rejects(
    storage.read("opaque", 3),
    (e) => e.code === "INVALID_INPUT",
  );
});
test("cloud repository export identifier comes from the server and cannot expose supplied UID or constructor label", async () => {
  const opaque = "cloud:" + "b".repeat(64),
    invoke = async () => ({
      ok: true,
      data: snapshot(),
      revision: 0,
      workspaceId: opaque,
    });
  const first = createCloudRepository({
      principal: { userId: "sensitive-owner" },
      workspaceId: "account:sensitive-owner",
      storage: null,
      invoke,
    }),
    otherBrowser = createCloudRepository({
      principal: { userId: "sensitive-owner" },
      storage: null,
      invoke,
    });
  await first.snapshot();
  await otherBrowser.snapshot();
  assert.equal(first.getWorkspaceId(), opaque);
  assert.equal(otherBrowser.getWorkspaceId(), opaque);
  assert.equal(first.getWorkspaceId().includes("sensitive-owner"), false);
});
test("real integration clients isolate native SDK cache and do not inherit management credentials", async () => {
  const harness = await import("./integration/cloud-harness.js");
  assert.equal(typeof harness.createIsolatedClient, "function");
  const priorManagement=process.env.TENCENTCLOUD_FUJI_SECRET_ID,priorOverride=process.env.tcb_token;
  process.env.TENCENTCLOUD_FUJI_SECRET_ID='test-management-sentinel';
  process.env.tcb_token='test-sdk-token-override-sentinel';
  const first = await harness.createIsolatedClient({
      envId: "sdk-cache-isolation-probe",
      cacheOnly: true,
    }),
    second = await harness.createIsolatedClient({
      envId: "sdk-cache-isolation-probe",
      cacheOnly: true,
    });
  try {
    await first.cacheProbeSet("first");
    assert.equal(await first.cacheProbeGet(), "first");
    assert.equal(await second.cacheProbeGet(), null);
    await second.cacheProbeSet("second");
    assert.equal(await first.cacheProbeGet(), "first");
    assert.equal(await second.cacheProbeGet(), "second");
    const flags = await first.environmentFlags();
    assert.equal(flags.managementCredentialsPresent, false);
    assert.equal(flags.sdkTestTokenOverridePresent, false);
  } finally {
    await first.close();
    await second.close();
    if(priorManagement===undefined)delete process.env.TENCENTCLOUD_FUJI_SECRET_ID;else process.env.TENCENTCLOUD_FUJI_SECRET_ID=priorManagement;
    if(priorOverride===undefined)delete process.env.tcb_token;else process.env.tcb_token=priorOverride;
  }
});
