import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
let handleRequest;
try {
  ({ handleRequest } = require("../backend/api.cjs"));
} catch {}
const { memoryStore } = require("./helpers/cloud-memory.cjs");
const principal = (userId) => ({
  userId,
  emailVerified: true,
  isAnonymous: false,
});
export function harness() {
  const store = memoryStore();
  let n = 0;
  return {
    store,
    run: (action, payload = {}, revision, key = "op-" + ++n, user = "A") =>
      handleRequest(
        {
          version: 1,
          action,
          payload,
          expectedRevision: revision,
          idempotencyKey: key,
        },
        {
          principal: user ? principal(user) : null,
          store,
          clock: () => "2026-10-07T01:00:00.000Z",
          idFactory: () => `entity-${++n}`,
        },
      ),
  };
}
const pet = (name) => ({ name, type: "cat" });
test("cloud API is available", () =>
  assert.equal(typeof handleRequest, "function"));
test("no session and anonymous UID cannot read private workspace", async () => {
  assert.equal(
    (
      await handleRequest(
        { version: 1, action: "health.snapshot", payload: {} },
        { principal: null },
      )
    ).error.code,
    "UNAUTHENTICATED",
  );
  assert.equal(
    (
      await handleRequest(
        { version: 1, action: "health.snapshot", payload: {} },
        {
          principal: {
            userId: "anonymous",
            emailVerified: true,
            isAnonymous: true,
          },
        },
      )
    ).error.code,
    "UNAUTHENTICATED",
  );
});
test("empty account and principal-owned health actions ignore payload owner", async () => {
  const h = harness();
  const empty = await h.run("health.snapshot");
  assert.equal(empty.revision, 0);
  assert.deepEqual(empty.data.pets, []);
  const a = await h.run("pets.save", { ...pet("A"), ownerId: "B" }, 0);
  assert.equal(a.ok, true);
  assert.equal(a.snapshot.mode, "account");
  assert.equal(
    (await h.run("health.snapshot", {}, undefined, undefined, "B")).data.pets
      .length,
    0,
  );
  assert.equal(
    (
      await h.run(
        "pets.save",
        { id: a.data.id, name: "stolen", type: "cat" },
        0,
        undefined,
        "B",
      )
    ).error.code,
    "FORBIDDEN",
  );
});
test("receipt precedes CAS and reused key with changed payload is rejected", async () => {
  const h = harness();
  const a = await h.run("pets.save", pet("first"), 0, "same");
  await h.run("pets.save", pet("later"), 1);
  const retry = await h.run("pets.save", pet("first"), 0, "same");
  assert.equal(retry.data.id, a.data.id);
  assert.equal(retry.revision, 2);
  assert.equal(retry.snapshot.pets.length, 2);
  assert.equal(
    (await h.run("pets.save", pet("changed"), 0, "same")).error.code,
    "INVALID_INPUT",
  );
  assert.equal(
    (await h.run("pets.save", pet("stale"), 0)).error.code,
    "CONFLICT",
  );
});
test("V3 trash and ordering preserve full soft-deleted snapshot", async () => {
  const h = harness();
  const a = await h.run("pets.save", pet("first"), 0);
  const b = await h.run("pets.save", pet("second"), 1);
  const deleted = await h.run(
    "trash.move",
    { kind: "pet", ids: [a.data.id] },
    2,
  );
  assert.equal(deleted.snapshot.pets[0].deletedAt, "2026-10-07T01:00:00.000Z");
  const reordered = await h.run("pets.reorder", { ids: [b.data.id] }, 3);
  assert.equal(reordered.snapshot.pets[0].id, a.data.id);
  const restored = await h.run(
    "trash.restore",
    { kind: "pet", ids: [a.data.id] },
    4,
  );
  assert.equal(restored.snapshot.pets[0].deletedAt, null);
  const failed = await h.run(
    "trash.move",
    { kind: "pet", ids: [a.data.id, "missing"] },
    5,
  );
  assert.equal(failed.error.code, "FORBIDDEN");
  assert.equal((await h.run("health.snapshot")).revision, 5);
});
test("reminder completion is idempotent and cross-owner entity IDs cannot be used", async () => {
  const h = harness();
  const p = await h.run("pets.save", pet("first"), 0);
  const r = await h.run(
    "records.save",
    {
      petId: p.data.id,
      type: "daily",
      title: "care",
      occurredDate: "2026-10-07",
    },
    1,
  );
  const rem = await h.run(
    "reminders.save",
    {
      petId: p.data.id,
      title: "care",
      dueDate: "2026-10-08",
      originRecordId: r.data.id,
    },
    2,
  );
  const done = await h.run(
    "reminders.complete",
    { id: rem.data.id, input: { occurredDate: "2026-10-07" } },
    3,
  );
  assert.equal(done.ok, true);
  const again = await h.run(
    "reminders.complete",
    { id: rem.data.id, input: { occurredDate: "2026-10-07" } },
    4,
  );
  assert.equal(again.data.record.id, done.data.record.id);
  assert.equal(again.snapshot.records.length, 2);
  for (const [action, payload] of [
    ["records.save", { id: r.data.id, petId: p.data.id }],
    ["records.delete", { id: r.data.id }],
    ["reminders.complete", { id: rem.data.id, input: {} }],
    ["trash.restore", { kind: "pet", ids: [p.data.id] }],
    ["pets.reorder", { ids: [p.data.id] }],
  ])
    assert.equal(
      (await h.run(action, payload, 0, undefined, "B")).error.code,
      "FORBIDDEN",
    );
});
test("private media validates staged bytes and rejects cross-owner, trash, and public read URLs", async () => {
  const store = memoryStore();
  const objects = new Map();
  let count = 0;
  const storage = {
    async prepare(path) {
      return {
        fileRef: path,
        upload: {
          url: "https://upload.example.invalid",
          fields: { key: path },
        },
      };
    },
    async read(ref) {
      return objects.get(ref);
    },
    async remove(ref) {
      objects.delete(ref);
    },
  };
  const run = (
    action,
    payload = {},
    revision,
    key = "k" + ++count,
    user = "A",
  ) =>
    handleRequest(
      {
        version: 1,
        action,
        payload,
        expectedRevision: revision,
        idempotencyKey: key,
      },
      {
        principal: principal(user),
        store,
        storage,
        clock: () => "2026-10-07T01:00:00.000Z",
        idFactory: () => "m" + ++count,
      },
    );
  const p = await run("pets.save", pet("A"), 0);
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=",
    "base64",
  );
  const crypto = await import("node:crypto");
  const info = {
    petId: p.data.id,
    kind: "photo",
    caption: "safe",
    mime: "image/png",
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
  const stage = await run("media.prepare", info, 1);
  assert.equal(stage.ok, true);
  objects.set(stage.data.upload.fields.key, bytes);
  const asset = await run(
    "media.confirm",
    { ticketId: stage.data.ticketId },
    1,
  );
  assert.equal(asset.ok, true);
  const read = await run("media.read", { assetId: asset.data.id });
  assert.equal(read.data.base64, bytes.toString("base64"));
  assert.equal(JSON.stringify(read).includes("https://"), false);
  assert.equal(
    (
      await run(
        "media.read",
        { assetId: asset.data.id },
        undefined,
        undefined,
        "B",
      )
    ).error.code,
    "FORBIDDEN",
  );
  await run("trash.move", { kind: "pet", ids: [p.data.id] }, 2);
  assert.equal(
    (await run("media.read", { assetId: asset.data.id })).error.code,
    "FORBIDDEN",
  );
  assert.equal(
    (await run("media.read", { assetId: asset.data.id, purpose: "archive" }))
      .ok,
    true,
  );
  assert.deepEqual(
    (await run("media.list", { petId: p.data.id })).data.items,
    [],
  );
});
test("media deletion revokes reads before failed storage cleanup and retains quota", async () => {
  const store = memoryStore();
  let object,
    ref,
    n = 0;
  const storage = {
    async prepare(path) {
      ref = path;
      return {
        fileRef: path,
        upload: {
          url: "https://upload.example.invalid",
          fields: { key: path },
        },
      };
    },
    async read() {
      return object;
    },
    async remove() {
      throw new Error("cleanup offline");
    },
  };
  const run = (action, payload = {}, revision, key = "k" + ++n) =>
    handleRequest(
      {
        version: 1,
        action,
        payload,
        expectedRevision: revision,
        idempotencyKey: key,
      },
      {
        principal: principal("A"),
        store,
        storage,
        clock: () => "2026-10-07T01:00:00.000Z",
        idFactory: () => "x" + ++n,
      },
    );
  const p = await run("pets.save", pet("A"), 0);
  object = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=",
    "base64",
  );
  const crypto = await import("node:crypto");
  const stage = await run(
    "media.prepare",
    {
      petId: p.data.id,
      kind: "avatar",
      mime: "image/png",
      bytes: object.length,
      sha256: crypto.createHash("sha256").update(object).digest("hex"),
    },
    1,
  );
  const saved = await run(
    "media.confirm",
    { ticketId: stage.data.ticketId },
    1,
  );
  const removed = await run(
    "media.remove",
    { assetId: saved.data.id },
    2,
    "remove",
  );
  assert.equal(removed.ok, true);
  assert.equal(removed.data.cleanupPending, true);
  assert.equal(removed.data.quotaReleased, false);
  assert.equal(
    (await run("media.read", { assetId: saved.data.id })).error.code,
    "FORBIDDEN",
  );
  const retry = await run(
    "media.remove",
    { assetId: saved.data.id },
    2,
    "remove",
  );
  assert.equal(retry.ok, true);
  assert.equal(retry.revision, 3);
});
test("media confirmation response-loss retry remains valid after later permanent deletion", async () => {
  const store = memoryStore();
  const objects = new Map();
  let n = 0;
  const storage = {
    async prepare(path) {
      return { fileRef: path, upload: { fields: { key: path } } };
    },
    async read(ref) {
      return objects.get(ref);
    },
    async remove(ref) {
      objects.delete(ref);
    },
  };
  const run = (action, payload = {}, revision, key = "k" + ++n) =>
    handleRequest(
      {
        version: 1,
        action,
        payload,
        expectedRevision: revision,
        idempotencyKey: key,
      },
      {
        principal: principal("A"),
        store,
        storage,
        clock: () => "2026-10-07T01:00:00.000Z",
        idFactory: () => "x" + ++n,
      },
    );
  const p = await run("pets.save", pet("A"), 0),
    bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=",
      "base64",
    ),
    crypto = await import("node:crypto");
  const prepared = await run(
    "media.prepare",
    {
      petId: p.data.id,
      kind: "photo",
      mime: "image/png",
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    },
    1,
  );
  objects.set(prepared.data.upload.fields.key, bytes);
  const saved = await run(
    "media.confirm",
    { ticketId: prepared.data.ticketId },
    1,
    "confirm",
  );
  await run("media.remove", { assetId: saved.data.id }, 2);
  const retry = await run(
    "media.confirm",
    { ticketId: prepared.data.ticketId },
    1,
    "confirm",
  );
  assert.equal(retry.ok, true);
  assert.equal(retry.data.id, saved.data.id);
  assert.equal(retry.revision, 3);
});
test("revocation during object read rejects late bytes and avatar replacement cleans retired objects", async () => {
  const store = memoryStore(),
    objects = new Map();
  let n = 0,
    readHook;
  const storage = {
    async prepare(path) {
      return { fileRef: path, upload: { fields: { key: path } } };
    },
    async read(ref) {
      if (readHook) {
        const hook = readHook;
        readHook = null;
        await hook();
      }
      return objects.get(ref);
    },
    async remove(ref) {
      objects.delete(ref);
    },
  };
  const run = (action, payload = {}, revision, key = "k" + ++n) =>
    handleRequest(
      {
        version: 1,
        action,
        payload,
        expectedRevision: revision,
        idempotencyKey: key,
      },
      {
        principal: principal("A"),
        store,
        storage,
        clock: () => "2026-10-07T01:00:00.000Z",
        idFactory: () => "race" + ++n,
      },
    );
  const p = await run("pets.save", pet("A"), 0),
    bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=",
      "base64",
    ),
    crypto = await import("node:crypto"),
    sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
  const save = async (revision) => {
    const stage = await run(
      "media.prepare",
      {
        petId: p.data.id,
        kind: "avatar",
        mime: "image/png",
        bytes: bytes.length,
        sha256,
      },
      revision,
    );
    objects.set(stage.data.upload.fields.key, bytes);
    return run("media.confirm", { ticketId: stage.data.ticketId }, revision);
  };
  const first = await save(1),
    second = await save(2);
  assert.equal(objects.has(first.data.fileRef), false);
  assert.equal(second.snapshot.pets[0].avatarAssetId, second.data.id);
  readHook = () => run("trash.move", { kind: "pet", ids: [p.data.id] }, 3);
  const late = await run("media.read", { assetId: second.data.id });
  assert.equal(late.ok, false);
  assert.equal(late.error.code, "FORBIDDEN");
});
test("workspace identifier is opaque, stable for one owner and environment, and separated across owners", async () => {
  const store = memoryStore(),
    request = { version: 1, action: "health.snapshot", payload: {} },
    p = principal("sensitive-user-identifier");
  const read = (environmentId) =>
    handleRequest(request, { principal: p, store, environmentId });
  const one = await read("env-one"),
    same = await read("env-one"),
    other = await read("env-two"),
    b = await handleRequest(request, {
      principal: principal("B"),
      store,
      environmentId: "env-one",
    });
  assert.match(one.workspaceId, /^cloud:[a-f0-9]{64}$/);
  assert.equal(one.workspaceId.includes(p.userId), false);
  assert.equal(one.workspaceId, same.workspaceId);
  assert.notEqual(one.workspaceId, other.workspaceId);
  assert.notEqual(one.workspaceId, b.workspaceId);
});
test("expected workspace mismatch rejects every write before store and receipt access", async () => {
  const request = { version: 1, action: "health.snapshot", payload: {} },
    a = await handleRequest(request, {
      principal: principal("A"),
      store: memoryStore(),
      environmentId: "env-one",
    });
  const store = {
    readOwned() {
      throw new Error("store accessed");
    },
    transactionOwned() {
      throw new Error("transaction accessed");
    },
  };
  for (const action of [
    "pets.save",
    "records.save",
    "reminders.complete",
    "media.prepare",
    "media.confirm",
    "media.remove",
    "imports.prepare",
    "imports.commit",
    "health.snapshot",
  ]) {
    const result = await handleRequest(
      {
        version: 1,
        action,
        payload: {},
        expectedWorkspaceId: a.workspaceId,
        expectedRevision: 0,
        idempotencyKey: "same",
      },
      { principal: principal("B"), store, environmentId: "env-one" },
    );
    assert.equal(result.error.code, "UNAUTHENTICATED");
    assert.equal(result.error.messageKey, "errors.workspaceChanged");
  }
});
test("expired owner staging quota is reclaimed before new upload and explicit cleanup is retryable", async () => {
  const store = memoryStore();
  let n = 0,
    now = "2026-10-07T01:00:00.000Z",
    failCleanup = true,
    removalAttempts = 0;
  const storage = {
    async prepare(path) {
      return { fileRef: path, upload: { fields: { key: path } } };
    },
    async remove() {
      removalAttempts++;
      if (failCleanup) throw new Error("offline");
    },
  };
  const run = (action, payload = {}, revision, key = "k" + ++n, user = "A") =>
    handleRequest(
      {
        version: 1,
        action,
        payload,
        expectedRevision: revision,
        idempotencyKey: key,
      },
      {
        principal: principal(user),
        store,
        storage,
        clock: () => now,
        idFactory: () => `stage-${++n}`,
      },
    );
  const p = await run("pets.save", pet("A"), 0);
  const input = {
    petId: p.data.id,
    kind: "photo",
    caption: "",
    mime: "image/png",
    bytes: 1024 * 1024,
    sha256: "a".repeat(64),
  };
  let first;
  for (let i = 0; i < 50; i++) {
    const result = await run("media.prepare", input, 1);
    assert.equal(result.ok, true);
    first ??= result.data;
  }
  now = "2026-10-07T03:00:00.000Z";
  const held = await run("media.prepare", input, 1);
  assert.equal(held.ok, false);
  assert.equal(held.error.messageKey, "errors.mediaQuota");
  const foreign = await run(
    "media.cleanup",
    { assetIds: [first.ticketId] },
    0,
    undefined,
    "B",
  );
  assert.equal(foreign.error.code, "FORBIDDEN");
  failCleanup = false;
  const cleaned = await run(
    "media.cleanup",
    { assetIds: [first.ticketId] },
    1,
    "cleanup",
  );
  assert.equal(cleaned.ok, true);
  assert.equal(cleaned.data.quotaReleasedBytes, 1024 * 1024);
  assert.equal(cleaned.revision, 1);
  const removalsAfterSuccess = removalAttempts;
  const retry = await run(
    "media.cleanup",
    { assetIds: [first.ticketId] },
    1,
    "cleanup",
  );
  assert.equal(retry.data.quotaReleasedBytes, 1024 * 1024);
  assert.equal(retry.data.pending, 0);
  assert.equal(removalAttempts, removalsAfterSuccess);
  const next = await run("media.prepare", input, 1);
  assert.equal(next.ok, true);
  assert.equal(
    (await run("media.confirm", { ticketId: first.ticketId }, 1)).ok,
    false,
  );
});
