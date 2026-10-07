"use strict";
const crypto = require("node:crypto");
class ApiError extends Error {
  constructor(code, messageKey = "errors." + code.toLowerCase(), params) {
    super(messageKey);
    this.code = code;
    this.messageKey = messageKey;
    this.params = params;
  }
}
const clone = (value) => structuredClone(value);
const emptyWorkspace = () => ({
  snapshot: {
    version: 3,
    mode: "account",
    pets: [],
    records: [],
    reminders: [],
    posts: [],
    activePetId: null,
    profile: { city: "深圳" },
  },
  revision: 0,
});
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object")
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((k) => [k, stable(value[k])]),
    );
  return value;
}
const hash = (value) =>
  crypto
    .createHash("sha256")
    .update(typeof value === "string" ? value : JSON.stringify(stable(value)))
    .digest("hex");
let domain;
function loadDomain() {
  return (domain ??= Promise.all([
    import("../src/domain/schema.js"),
    import("../src/domain/records.js"),
    import("../src/domain/reminders.js"),
    import("../src/domain/lifecycle.js"),
  ]).then(([s, r, m, l]) => ({
    ...s,
    ...r,
    ...m,
    ...l,
    finishReminder: m.completeReminder,
  })));
}
function validatePrincipal(p) {
  if (
    !p ||
    typeof p.userId !== "string" ||
    !p.userId ||
    p.emailVerified !== true ||
    p.isAnonymous !== false
  )
    throw new ApiError("UNAUTHENTICATED");
  return p;
}
function requiredId(value) {
  if (typeof value !== "string" || !value.trim() || value.length > 200)
    throw new ApiError("INVALID_INPUT");
  return value;
}
function owned(state, field, id) {
  requiredId(id);
  const entity = state[field].find((x) => x.id === id);
  if (!entity) throw new ApiError("FORBIDDEN");
  return entity;
}
function verifyReferences(state, action, p) {
  if (action === "pets.save" && p.id) owned(state, "pets", p.id);
  if (action === "records.save") {
    if (p.id) owned(state, "records", p.id);
    if (p.petId) owned(state, "pets", p.petId);
  }
  if (action === "reminders.save") {
    if (p.id) owned(state, "reminders", p.id);
    if (p.petId) owned(state, "pets", p.petId);
    for (const k of ["originRecordId", "completionRecordId"])
      if (p[k]) owned(state, "records", p[k]);
  }
  if (action === "records.delete") owned(state, "records", p.id);
  if (action === "reminders.complete") owned(state, "reminders", p.id);
  if (action === "trash.move" || action === "trash.restore") {
    const field = { pet: "pets", record: "records", reminder: "reminders" }[
      p.kind
    ];
    if (!field || !Array.isArray(p.ids) || !p.ids.length)
      throw new ApiError("INVALID_INPUT");
    for (const id of p.ids) owned(state, field, id);
    if (p.petId) owned(state, "pets", p.petId);
  }
  if (action === "pets.reorder") {
    if (!Array.isArray(p.ids)) throw new ApiError("INVALID_INPUT");
    for (const id of p.ids) owned(state, "pets", id);
  }
}
async function transformHealth(workspace, action, p, { clock, idFactory }) {
  const d = await loadDomain();
  let next = d.clone(workspace.snapshot),
    data;
  verifyReferences(next, action, p);
  const now = clock();
  switch (action) {
    case "pets.save": {
      const old = p.id ? next.pets.find((x) => x.id === p.id) : null;
      if (old?.deletedAt) throw new ApiError("INVALID_INPUT");
      if (p.deletedAt != null || p.avatarAssetId != null)
        throw new ApiError("INVALID_INPUT");
      const pet = d.normalizePet({
        birthday: null,
        estimatedAgeMonths: null,
        arrivalDate: null,
        breed: "",
        sex: "",
        image: "",
        ...old,
        ...p,
        id: old?.id ?? idFactory(),
        avatarAssetId: old?.avatarAssetId ?? null,
      });
      const today = d.todayAt(d.isoTime(now));
      if (pet.birthday > today || pet.arrivalDate > today)
        throw new ApiError("INVALID_INPUT");
      if (old) next.pets[next.pets.indexOf(old)] = pet;
      else next.pets.push(pet);
      if (!next.activePetId) next.activePetId = pet.id;
      data = pet;
      break;
    }
    case "records.save":
      next = d.applyRecord(next, p, { now, idFactory });
      data = next.records.find((r) => r.id === p.id) ?? next.records[0];
      break;
    case "records.delete":
      next = d.removeRecord(next, p.id, { now });
      data = null;
      break;
    case "reminders.save":
      next = d.applyReminder(next, p, { now, idFactory });
      data = next.reminders.find((r) => r.id === p.id) ?? next.reminders[0];
      break;
    case "reminders.complete": {
      const result = d.finishReminder(next, p.id, p.input ?? {}, {
        now,
        idFactory,
      });
      next = result.state;
      data = { reminder: result.reminder, record: result.record };
      break;
    }
    case "trash.move":
      next = d.moveToTrash(next, p, { now });
      data = next;
      break;
    case "trash.restore":
      next = d.restoreFromTrash(next, p);
      data = next;
      break;
    case "pets.reorder":
      next = d.reorderPets(next, p.ids);
      data = next;
      break;
    case "profile.save":
      next.profile.city = d.requiredText(p.city, "城市");
      if (next.profile.city.length > 60) throw new ApiError("INVALID_INPUT");
      data = next.profile;
      break;
    default:
      throw new ApiError("INVALID_INPUT");
  }
  next = d.validateSnapshot(next);
  if (Buffer.byteLength(JSON.stringify(next)) > 950 * 1024)
    throw new ApiError("INVALID_INPUT", "errors.workspaceTooLarge");
  workspace.snapshot = next;
  workspace.revision++;
  return data;
}
async function priorReceipt(request, deps) {
  const key = requiredId(request.idempotencyKey);
  if (
    !Number.isSafeInteger(request.expectedRevision) ||
    request.expectedRevision < 0
  )
    throw new ApiError("INVALID_INPUT");
  return deps.store.transactionOwned(deps.principal, async (tx) => {
    const receipt = await tx.getReceipt(key);
    if (!receipt) return null;
    if (
      receipt.payloadHash !==
      hash({ action: request.action, payload: request.payload })
    )
      throw new ApiError("INVALID_INPUT", "errors.idempotencyReused");
    const w = tx.workspace ?? emptyWorkspace();
    return {
      ok: true,
      data: clone(receipt.data),
      revision: w.revision,
      snapshot: clone(w.snapshot),
    };
  });
}
async function writeTransaction(
  request,
  deps,
  operation,
  { bump = true } = {},
) {
  const { principal, store } = deps;
  const key = requiredId(request.idempotencyKey);
  if (
    !Number.isSafeInteger(request.expectedRevision) ||
    request.expectedRevision < 0
  )
    throw new ApiError("INVALID_INPUT");
  const payloadHash = hash({
    action: request.action,
    payload: request.payload,
  });
  return store.transactionOwned(principal, async (tx) => {
    const w = tx.workspace ?? emptyWorkspace();
    const receipt = await tx.getReceipt(key);
    if (receipt) {
      if (receipt.payloadHash !== payloadHash)
        throw new ApiError("INVALID_INPUT", "errors.idempotencyReused");
      return {
        ok: true,
        data: clone(receipt.data),
        revision: w.revision,
        snapshot: clone(w.snapshot),
      };
    }
    if (w.revision !== request.expectedRevision) throw new ApiError("CONFLICT");
    const previous = w.revision;
    const data = await operation(tx, w);
    if (bump && w.revision === previous) w.revision++;
    tx.workspace = w;
    await tx.putReceipt(key, {
      payloadHash,
      data: clone(data),
      createdAt: deps.clock(),
    });
    return {
      ok: true,
      data: clone(data),
      revision: w.revision,
      snapshot: clone(w.snapshot),
    };
  });
}
module.exports = {
  ApiError,
  emptyWorkspace,
  hash,
  loadDomain,
  validatePrincipal,
  requiredId,
  owned,
  transformHealth,
  writeTransaction,
  priorReceipt,
};
