import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { realClients, read, write, requireSuccess } from "./cloud-harness.js";
test("real cloud import binds photo tickets and complete health to owner batch with idempotent commit", async () => {
  const { A, B } = await realClients(),
    before = requireSuccess(await read(A)),
    bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=",
      "base64",
    ),
    timestamp = "2026-10-07T00:00:00.000Z";
  const metadata = {
    id: "source-photo",
    petId: "source-pet",
    kind: "photo",
    caption: "import acceptance",
    createdAt: timestamp,
    mime: "image/png",
    bytes: bytes.length,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
  const source = {
    sourceWorkspaceId: "real-acceptance-" + crypto.randomUUID(),
    snapshot: {
      version: 3,
      mode: "local",
      pets: [
        {
          id: "source-pet",
          name: "import-test",
          type: "cat",
          birthday: null,
          estimatedAgeMonths: null,
          arrivalDate: null,
          breed: "",
          sex: "",
          image: "",
          deletedAt: null,
          avatarAssetId: null,
        },
      ],
      records: [
        {
          id: "source-record",
          petId: "source-pet",
          type: "daily",
          title: "acceptance record",
          occurredDate: "2026-10-07",
          value: null,
          unit: null,
          note: "",
          createdAt: timestamp,
          updatedAt: timestamp,
          deletedAt: timestamp,
        },
      ],
      reminders: [],
      posts: [],
      activePetId: "source-pet",
      profile: { city: "深圳" },
    },
    assets: [metadata],
    selection: {
      petIds: ["source-pet"],
      recordIds: ["source-record"],
      reminderIds: [],
      assetIds: ["source-photo"],
    },
  };
  const preview = requireSuccess(
    await A.invoke({ version: 1, action: "imports.preview", payload: source }),
  );
  assert.equal(preview.revision, before.revision);
  assert.equal(preview.data.counts.assets, 1);
  const prepared = requireSuccess(
    await write(A, "imports.prepare", source, before.revision),
  );
  const staged = requireSuccess(
    await write(
      A,
      "media.prepare",
      {
        ...metadata,
        importBatchId: prepared.data.batchId,
        sourceAssetId: metadata.id,
      },
      before.revision,
    ),
  );
  const upload = await A.upload(staged.data.ticketId, bytes);
  assert.equal(upload.ok, true);
  const payload = {
      batchId: prepared.data.batchId,
      assetTickets: [
        { sourceAssetId: metadata.id, ticketId: staged.data.ticketId },
      ],
    },
    key = crypto.randomUUID();
  const other = requireSuccess(await read(B));
  assert.equal(
    (await write(B, "imports.commit", payload, other.revision)).error?.code,
    "FORBIDDEN",
  );
  const committed = requireSuccess(
      await write(A, "imports.commit", payload, before.revision, key),
    ),
    petId = committed.snapshot.pets.find(
      (p) =>
        p.name === "import-test" &&
        !before.data.pets.some((old) => old.id === p.id),
    )?.id;
  assert.ok(petId);
  assert.ok(
    committed.snapshot.records.some(
      (r) => r.petId === petId && r.deletedAt === timestamp,
    ),
  );
  const repeated = requireSuccess(
    await write(A, "imports.commit", payload, before.revision, key),
  );
  assert.equal(repeated.revision, committed.revision);
  const gallery = requireSuccess(
    await A.invoke({ version: 1, action: "media.list", payload: { petId } }),
  );
  assert.equal(gallery.data.items.length, 1);
  assert.equal(gallery.data.items[0].createdAt, timestamp);
  const deleted = requireSuccess(
    await write(
      A,
      "media.remove",
      { assetId: gallery.data.items[0].id },
      committed.revision,
    ),
  );
  await write(A, "trash.move", { kind: "pet", ids: [petId] }, deleted.revision);
});
