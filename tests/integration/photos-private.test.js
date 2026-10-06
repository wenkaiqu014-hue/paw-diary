import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { realClients, read, write, requireSuccess } from "./cloud-harness.js";
import {bindConfirmedFixture,requireDirectDenial} from "../helpers/cloud-direct-validation.js";
test("real private storage upload/read/delete and A/B/anonymous/direct-object access denial", async () => {
  const { A, B, anonymous } = await realClients();
  const before = requireSuccess(await read(A)),
    pet = requireSuccess(
      await write(
        A,
        "pets.save",
        { name: "stage2 photo acceptance", type: "cat" },
        before.revision,
      ),
    );
  const bytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jU1kAAAAASUVORK5CYII=",
    "base64",
  );
  const staged = requireSuccess(
    await write(
      A,
      "media.prepare",
      {
        petId: pet.data.id,
        kind: "photo",
        caption: "acceptance",
        mime: "image/png",
        bytes: bytes.length,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      },
      pet.revision,
    ),
  );
  const upload = await A.upload(staged.data.ticketId, bytes);
  assert.equal(upload.ok, true);
  const saved = requireSuccess(
    await write(
      A,
      "media.confirm",
      { ticketId: staged.data.ticketId },
      pet.revision,
    ),
  );
  try {
    const request = {
      version: 1,
      action: "media.read",
      payload: { assetId: saved.data.id },
    };
    const content = requireSuccess(await A.invoke(request));
    assert.equal(content.data.base64, bytes.toString("base64"));
    assert.equal(content.data.url, undefined);
    assert.equal(content.data.readURL, undefined);
    assert.equal((await B.invoke(request)).error?.code, "FORBIDDEN");
    assert.equal(
      (await anonymous.invoke(request)).error?.code,
      "UNAUTHENTICATED",
    );
    const identity = await A.identityFlags();
    await bindConfirmedFixture({
      envId:process.env.PAW_DIARY_CLOUD_ENV_ID ?? "paw-diary-d8g3p4tlsb305221d",
      assetId:saved.data.id,petId:pet.data.id,
      sha256:createHash("sha256").update(bytes).digest("hex"),bytes:bytes.length,
      ownerUidHash:identity.uidHash,actors:[A,B,anonymous],
    });
    // The actual object already returned matching business bytes above; all direct reads are real caller SDKs.
    for (const actor of [A,B,anonymous]) {
      await requireDirectDenial(()=>actor.directFixtureUrls(saved.data.id),{kind:"storage"});
      await requireDirectDenial(()=>actor.directFixtureDownload(saved.data.id),{kind:"storage"});
    }
  } finally {
  const deleted = requireSuccess(
    await write(A, "media.remove", { assetId: saved.data.id }, saved.revision),
  );
  assert.equal(deleted.data.cleanupPending, false);
  assert.equal((await A.invoke(request)).error?.code, "FORBIDDEN");
  await write(
    A,
    "trash.move",
    { kind: "pet", ids: [pet.data.id] },
    deleted.revision,
  );
  }
});

function pngChunk(type, body) {
  const label = Buffer.from(type),
    data = Buffer.concat([label, body]);
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++)
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4),
    checksum = Buffer.alloc(4);
  length.writeUInt32BE(body.length);
  checksum.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, label, body, checksum]);
}

test("real private byte response supports a validated image near the 1MiB limit within configured runtime", async () => {
  const { randomBytes } = await import("node:crypto"),
    { deflateSync } = await import("node:zlib"),
    width = 510,
    height = 510,
    header = Buffer.alloc(13),
    scanlines = Buffer.alloc(height * (width * 4 + 1));
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  for (let row = 0; row < height; row++)
    randomBytes(width * 4).copy(scanlines, row * (width * 4 + 1) + 1);
  const bytes = Buffer.concat([
    Buffer.from("89504e470d0a1a0a", "hex"),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(scanlines)),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
  assert.ok(bytes.length > 1000 * 1024 && bytes.length <= 1024 * 1024);
  const { A } = await realClients(),
    before = requireSuccess(await read(A)),
    pet = requireSuccess(
      await write(
        A,
        "pets.save",
        { name: "stage2 size acceptance", type: "cat" },
        before.revision,
      ),
    ),
    sha256 = createHash("sha256").update(bytes).digest("hex");
  const prepared = requireSuccess(
    await write(
      A,
      "media.prepare",
      {
        petId: pet.data.id,
        kind: "photo",
        caption: "near limit",
        mime: "image/png",
        bytes: bytes.length,
        sha256,
      },
      pet.revision,
    ),
  );
  const uploaded = await A.upload(prepared.data.ticketId, bytes);
  assert.equal(uploaded.ok, true);
  const confirmed = requireSuccess(
    await write(
      A,
      "media.confirm",
      { ticketId: prepared.data.ticketId },
      pet.revision,
    ),
  );
  const content = requireSuccess(
    await A.invoke({
      version: 1,
      action: "media.read",
      payload: { assetId: confirmed.data.id },
    }),
  );
  assert.equal(
    createHash("sha256")
      .update(Buffer.from(content.data.base64, "base64"))
      .digest("hex"),
    sha256,
  );
  const deleted = requireSuccess(
    await write(
      A,
      "media.remove",
      { assetId: confirmed.data.id },
      confirmed.revision,
    ),
  );
  await write(
    A,
    "trash.move",
    { kind: "pet", ids: [pet.data.id] },
    deleted.revision,
  );
});
