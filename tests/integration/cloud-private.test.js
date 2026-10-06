import test from "node:test";
import assert from "node:assert/strict";
import { realClients, read, write, requireSuccess } from "./cloud-harness.js";
import {requireDirectDenial} from "../helpers/cloud-direct-validation.js";
test("real A/B workspaces enforce ownership, CAS, receipt retry and direct database denial", async () => {
  const { A, B } = await realClients();
  let before = requireSuccess(await read(A));
  const key = crypto.randomUUID(),
    payload = { name: "stage2 acceptance", type: "cat" };
  const first = requireSuccess(
    await write(A, "pets.save", payload, before.revision, key),
  );
  const second = requireSuccess(
    await write(
      A,
      "profile.save",
      { city: first.snapshot.profile.city },
      first.revision,
    ),
  );
  const retry = requireSuccess(
    await write(A, "pets.save", payload, before.revision, key),
  );
  assert.equal(retry.data.id, first.data.id);
  assert.equal(retry.revision, second.revision);
  assert.equal(
    (
      await write(
        A,
        "pets.save",
        { ...payload, name: "stale" },
        before.revision,
      )
    ).error?.code,
    "CONFLICT",
  );
  const b = requireSuccess(await read(B));
  assert.equal(
    (await write(B, "pets.save", { id: first.data.id, ...payload }, b.revision))
      .error?.code,
    "FORBIDDEN",
  );
  for (const action of ["trash.move", "trash.restore"])
    assert.equal(
      (
        await write(
          B,
          action,
          { kind: "pet", ids: [first.data.id] },
          b.revision,
        )
      ).error?.code,
      "FORBIDDEN",
    );
  await requireDirectDenial(
    ()=>A.app.database().collection("health_workspaces").limit(1).get(),
    {kind:"database"},
  );
  const removed = requireSuccess(
    await write(
      A,
      "trash.move",
      { kind: "pet", ids: [first.data.id] },
      second.revision,
    ),
  );
  assert.ok(
    removed.snapshot.pets.find((p) => p.id === first.data.id)?.deletedAt,
  );
  const restored = requireSuccess(
    await write(
      A,
      "trash.restore",
      { kind: "pet", ids: [first.data.id] },
      removed.revision,
    ),
  );
  assert.equal(
    restored.snapshot.pets.find((p) => p.id === first.data.id)?.deletedAt,
    null,
  );
  await write(
    A,
    "trash.move",
    { kind: "pet", ids: [first.data.id] },
    restored.revision,
  );
});
