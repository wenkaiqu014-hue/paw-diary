import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { memoryStore } = require("./helpers/cloud-memory.cjs");
const { handleRequest } = require("../backend/api.cjs");
const source = () => ({
  version: 3,
  mode: "account",
  pets: [
    {
      id: "source-pet",
      name: "source",
      type: "cat",
      birthday: null,
      estimatedAgeMonths: null,
      arrivalDate: null,
      breed: "",
      sex: "",
      image: "",
      deletedAt: null,
      ownerId: "forged",
    },
  ],
  records: [
    {
      id: "source-record",
      petId: "source-pet",
      type: "daily",
      title: "care",
      occurredDate: "2026-10-07",
      value: null,
      unit: null,
      note: "",
      createdAt: "2026-10-07T01:00:00.000Z",
      updatedAt: "2026-10-07T01:00:00.000Z",
      deletedAt: "2026-10-07T01:00:00.000Z",
    },
  ],
  reminders: [],
  posts: [],
  activePetId: "source-pet",
  profile: { city: "北京" },
});
function setup() {
  const store = memoryStore();
  let n = 0;
  return (action, payload = {}, revision, key = "key-" + ++n, user = "A") =>
    handleRequest(
      {
        version: 1,
        action,
        payload,
        expectedRevision: revision,
        idempotencyKey: key,
      },
      {
        principal: { userId: user, emailVerified: true, isAnonymous: false },
        store,
        clock: () => "2026-10-07T01:00:00.000Z",
        idFactory: () => "new-" + ++n,
      },
    );
}
const request = () => ({
  sourceWorkspaceId: "source-workspace",
  snapshot: source(),
  selection: {
    petIds: [],
    recordIds: ["source-record"],
    reminderIds: [],
    assetIds: [],
  },
});
test("import preview requires explicit selections and returns parent closure without writing", async () => {
  const run = setup();
  const nothing = await run("imports.preview", {
    ...request(),
    selection: { petIds: [], recordIds: [], reminderIds: [], assetIds: [] },
  });
  assert.equal(nothing.ok, true);
  assert.equal(nothing.data.counts.pets, 0);
  const preview = await run("imports.preview", request());
  assert.equal(preview.ok, true);
  assert.deepEqual(preview.data.closure.petIds, ["source-pet"]);
  assert.equal((await run("health.snapshot")).revision, 0);
});
test("prepare commit assigns fresh owned IDs and retains tombstones while same batch retry cannot duplicate", async () => {
  const run = setup();
  const prepared = await run("imports.prepare", request(), 0, "prepare");
  assert.equal(prepared.ok, true);
  const result = await run(
    "imports.commit",
    { batchId: prepared.data.batchId },
    0,
    "commit",
  );
  assert.equal(result.ok, true);
  assert.equal(result.snapshot.pets.length, 1);
  assert.notEqual(result.snapshot.pets[0].id, "source-pet");
  assert.equal(result.snapshot.records[0].petId, result.snapshot.pets[0].id);
  assert.equal(
    result.snapshot.records[0].deletedAt,
    "2026-10-07T01:00:00.000Z",
  );
  assert.equal(result.snapshot.pets[0].ownerId, undefined);
  assert.equal(result.snapshot.profile.city, "深圳");
  const retry = await run(
    "imports.commit",
    { batchId: prepared.data.batchId },
    0,
    "commit",
  );
  assert.equal(retry.ok, true);
  assert.equal(retry.snapshot.pets.length, 1);
  assert.equal(
    (
      await run(
        "imports.commit",
        { batchId: prepared.data.batchId },
        0,
        "stolen",
        "B",
      )
    ).error.code,
    "FORBIDDEN",
  );
});
test("older preview conflicts with new edits and repeated old backup does not resurrect", async () => {
  const run = setup();
  const first = await run("imports.prepare", request(), 0);
  const committed = await run(
    "imports.commit",
    { batchId: first.data.batchId },
    0,
  );
  await run(
    "trash.move",
    { kind: "pet", ids: [committed.snapshot.pets[0].id] },
    1,
  );
  const preview = await run("imports.preview", request());
  assert.ok(preview.data.conflicts.length);
  const repeated = await run("imports.prepare", request(), 2);
  const again = await run(
    "imports.commit",
    { batchId: repeated.data.batchId },
    2,
  );
  assert.equal(again.snapshot.pets.length, 1);
  assert.notEqual(again.snapshot.pets[0].deletedAt, null);
  const old = await run(
    "imports.prepare",
    { ...request(), sourceWorkspaceId: "other" },
    again.revision,
  );
  await run("profile.save", { city: "杭州" }, again.revision);
  assert.equal(
    (await run("imports.commit", { batchId: old.data.batchId }, again.revision))
      .error.code,
    "CONFLICT",
  );
});
test("cloud import closes selected pet over available avatar and validates caption without truncating", async () => {
  const run = setup(),
    s = source();
  s.pets[0].avatarAssetId = "avatar";
  const metadata = {
    id: "avatar",
    petId: "source-pet",
    kind: "avatar",
    caption: "original",
    createdAt: "2026-10-07T01:00:00.000Z",
    mime: "image/png",
    bytes: 68,
    sha256: "a".repeat(64),
  };
  const input = {
    sourceWorkspaceId: "source-workspace",
    snapshot: s,
    assets: [metadata],
    selection: {
      petIds: ["source-pet"],
      recordIds: [],
      reminderIds: [],
      assetIds: [],
    },
  };
  const preview = await run("imports.preview", input);
  assert.deepEqual(preview.data.closure.assetIds, ["avatar"]);
  assert.equal(
    (
      await run("imports.preview", {
        ...input,
        assets: [{ ...metadata, caption: "x".repeat(201) }],
      })
    ).error.code,
    "INVALID_INPUT",
  );
});
test("explicit accepted import conflicts can restore owned cloud data while defaults preserve current edits", async () => {
  const run = setup(),
    input = request();
  const first = await run("imports.prepare", input, 0),
    initial = await run("imports.commit", { batchId: first.data.batchId }, 0);
  const petId = initial.snapshot.pets[0].id;
  await run("pets.save", { id: petId, name: "cloud edit", type: "cat" }, 1);
  let preview = await run("imports.preview", input);
  assert.ok(
    preview.data.conflicts.some(
      (c) => c.kind === "pet" && c.effect === "update",
    ),
  );
  await run("trash.move", { kind: "pet", ids: [petId] }, 2);
  const accepted = { ...input, acceptConflicts: ["pet:source-pet"] };
  preview = await run("imports.preview", accepted);
  assert.ok(
    preview.data.conflicts.some(
      (c) =>
        c.kind === "pet" &&
        c.effect === "restore" &&
        c.resolution === "accepted",
    ),
  );
  const prepared = await run("imports.prepare", accepted, 3);
  const restored = await run(
    "imports.commit",
    { batchId: prepared.data.batchId },
    3,
  );
  assert.equal(restored.ok, true);
  assert.equal(restored.snapshot.pets[0].id, petId);
  assert.equal(restored.snapshot.pets[0].name, "source");
  assert.equal(restored.snapshot.pets[0].deletedAt, null);
  assert.equal(
    restored.snapshot.records[0].deletedAt,
    input.snapshot.records[0].deletedAt,
  );
  assert.equal(
    (
      await run(
        "imports.prepare",
        { ...input, acceptConflicts: ["pet:unknown"] },
        4,
      )
    ).error.code,
    "INVALID_INPUT",
  );
});
test("permanently removed photo can be restored only through explicitly accepted verified owner batch", async () => {
  const store = memoryStore(),
    objects = new Map();
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
        principal: { userId: "A", emailVerified: true, isAnonymous: false },
        store,
        storage,
        clock: () => "2026-10-07T01:00:00.000Z",
        idFactory: () => "photo-" + ++n,
      },
    );
  const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=",
      "base64",
    ),
    crypto = await import("node:crypto"),
    metadata = {
      id: "source-photo",
      petId: "source-pet",
      kind: "photo",
      caption: "photo",
      createdAt: "2026-10-06T01:00:00.000Z",
      mime: "image/png",
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
  const input = {
    ...request(),
    assets: [metadata],
    selection: {
      petIds: ["source-pet"],
      recordIds: [],
      reminderIds: [],
      assetIds: ["source-photo"],
    },
  };
  const transfer = async (payload, revision) => {
    const batch = await run("imports.prepare", payload, revision);
    const ticket = await run(
      "media.prepare",
      {
        ...metadata,
        importBatchId: batch.data.batchId,
        sourceAssetId: metadata.id,
      },
      revision,
    );
    assert.equal(ticket.ok, true);
    objects.set(ticket.data.upload.fields.key, bytes);
    return run(
      "imports.commit",
      {
        batchId: batch.data.batchId,
        assetTickets: [
          { sourceAssetId: metadata.id, ticketId: ticket.data.ticketId },
        ],
      },
      revision,
    );
  };
  const first = await transfer(input, 0);
  assert.equal(first.ok, true);
  const list = await run("media.list", { petId: first.snapshot.pets[0].id });
  assert.equal(list.data.items[0].createdAt, metadata.createdAt);
  const id = list.data.items[0].id;
  await run("media.remove", { assetId: id }, 1);
  const preview = await run("imports.preview", input);
  assert.ok(
    preview.data.conflicts.some(
      (c) => c.kind === "asset" && c.effect === "restore",
    ),
  );
  const restored = await transfer(
    { ...input, acceptConflicts: ["asset:source-photo"] },
    2,
  );
  assert.equal(restored.ok, true);
  assert.equal((await run("media.read", { assetId: id })).ok, true);
  assert.equal(
    (await run("media.list", { petId: first.snapshot.pets[0].id })).data.items
      .length,
    1,
  );
});
