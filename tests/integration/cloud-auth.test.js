import test from "node:test";
import assert from "node:assert/strict";
import { realClients, read, requireSuccess } from "./cloud-harness.js";
test("real controlled A/B sessions enforce verified-email platform flags and anonymous isolation", async () => {
  const clients = await realClients(),
    a = await clients.A.identityFlags(),
    b = await clients.B.identityFlags(),
    anonymous = await clients.anonymous.identityFlags();
  assert.equal(a.signedIn, true);
  assert.equal(b.signedIn, true);
  assert.equal(a.emailPresent, true);
  assert.equal(b.emailPresent, true);
  assert.equal(a.emailVerified, true);
  assert.equal(b.emailVerified, true);
  assert.equal(a.isAnonymous, false);
  assert.equal(b.isAnonymous, false);
  assert.ok(a.uidHash !== b.uidHash);
  const aSnapshot = requireSuccess(await read(clients.A)),
    bSnapshot = requireSuccess(await read(clients.B));
  assert.equal(await clients.A.workspaceMatches(aSnapshot.workspaceId), true);
  assert.equal(await clients.B.workspaceMatches(bSnapshot.workspaceId), true);
  assert.equal(anonymous.signedIn, true);
  assert.equal(anonymous.isAnonymous, true);
  assert.equal((await read(clients.anonymous)).error?.code, "UNAUTHENTICATED");
  let unauth;
  try {
    unauth = await read(clients.unauthenticated);
  } catch {
    unauth = { ok: false };
  }
  assert.equal(unauth.ok, false);
});
