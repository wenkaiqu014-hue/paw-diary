"use strict";
const {
  ApiError,
  emptyWorkspace,
  requiredId,
  hash,
  loadDomain,
  writeTransaction,
  priorReceipt,
} = require("./workspace.cjs");
const { verifyObject, publicAsset } = require("./photos.cjs");
const mappingKey = (source, kind, id) => hash({ source, kind, id });
async function canonicalSource(payload) {
  const d = await loadDomain();
  const sourceWorkspaceId = requiredId(payload.sourceWorkspaceId);
  const snapshot = d.validateSnapshot(payload.snapshot);
  snapshot.posts = [];
  const assets = (payload.assets ?? []).map((a) => {
    if (
      !a ||
      !["avatar", "photo"].includes(a.kind) ||
      !snapshot.pets.some((p) => p.id === a.petId) ||
      !["image/png", "image/jpeg", "image/webp"].includes(a.mime) ||
      !Number.isInteger(a.bytes) ||
      a.bytes <= 0 ||
      a.bytes > 1024 * 1024 ||
      typeof (a.caption ?? "") !== "string" ||
      (a.caption ?? "").length > 200 ||
      !/^[a-f0-9]{64}$/.test(a.sha256 ?? "")
    )
      throw new ApiError("INVALID_INPUT");
    return {
      id: requiredId(a.id),
      petId: a.petId,
      kind: a.kind,
      caption: a.caption ?? "",
      createdAt: d.isoTime(a.createdAt),
      mime: a.mime,
      bytes: a.bytes,
      sha256: a.sha256,
    };
  });
  if (new Set(assets.map((a) => a.id)).size !== assets.length)
    throw new ApiError("INVALID_INPUT");
  const selection = payload.selection ?? {},
    sets = {
      petIds: new Set(),
      recordIds: new Set(),
      reminderIds: new Set(),
      assetIds: new Set(),
    };
  for (const [key, field] of Object.entries({
    petIds: "pets",
    recordIds: "records",
    reminderIds: "reminders",
    assetIds: "assets",
  })) {
    const all = field === "assets" ? assets : snapshot[field];
    if (
      !Array.isArray(selection[key] ?? []) ||
      (selection[key] ?? []).some((id) => !all.some((x) => x.id === id))
    )
      throw new ApiError("INVALID_INPUT");
    for (const id of selection[key] ?? []) sets[key].add(id);
  }
  for (const id of sets.reminderIds) {
    const reminder = snapshot.reminders.find((x) => x.id === id);
    sets.petIds.add(reminder.petId);
    for (const key of ["originRecordId", "completionRecordId"])
      if (reminder[key] && snapshot.records.some((r) => r.id === reminder[key]))
        sets.recordIds.add(reminder[key]);
  }
  for (const id of sets.recordIds)
    sets.petIds.add(snapshot.records.find((x) => x.id === id).petId);
  for (const id of sets.assetIds)
    sets.petIds.add(assets.find((x) => x.id === id).petId);
  for (const id of sets.petIds) {
    const avatar = snapshot.pets.find((x) => x.id === id).avatarAssetId;
    if (
      avatar &&
      assets.some(
        (a) => a.id === avatar && a.kind === "avatar" && a.petId === id,
      )
    )
      sets.assetIds.add(avatar);
  }
  const closure = Object.fromEntries(
    Object.entries(sets).map(([key, set]) => [key, [...set]]),
  );
  const acceptConflicts = payload.acceptConflicts ?? [];
  if (
    !Array.isArray(acceptConflicts) ||
    acceptConflicts.some(
      (value) =>
        typeof value !== "string" ||
        !Object.entries({
          pet: "petIds",
          record: "recordIds",
          reminder: "reminderIds",
          asset: "assetIds",
        }).some(([kind, key]) =>
          closure[key].some((id) => value === `${kind}:${id}`),
        ),
    )
  )
    throw new ApiError("INVALID_INPUT");
  return {
    sourceWorkspaceId,
    snapshot,
    assets,
    selection,
    closure,
    acceptConflicts,
    copyCity: payload.copyCity === true,
  };
}
async function translatedItem(tx, source, kind, item, targetId) {
  const target = async (type, id) =>
    id
      ? ((await tx.getMapping(mappingKey(source.sourceWorkspaceId, type, id)))
          ?.targetId ?? `pending:${type}:${id}`)
      : null;
  const candidate = { ...item, id: targetId };
  if (kind === "pet")
    candidate.avatarAssetId = item.avatarAssetId
      ? await target("asset", item.avatarAssetId)
      : null;
  else candidate.petId = await target("pet", item.petId);
  if (kind === "reminder") {
    candidate.originRecordId = await target("record", item.originRecordId);
    candidate.completionRecordId = await target(
      "record",
      item.completionRecordId,
    );
  }
  return candidate;
}
async function previewInTransaction(tx, source, w) {
  const conflicts = [],
    duplicates = [];
  for (const [kind, field, key] of [
    ["pet", "pets", "petIds"],
    ["record", "records", "recordIds"],
    ["reminder", "reminders", "reminderIds"],
    ["asset", "assets", "assetIds"],
  ])
    for (const id of source.closure[key]) {
      const item = (
          field === "assets" ? source.assets : source.snapshot[field]
        ).find((x) => x.id === id),
        mapping = await tx.getMapping(
          mappingKey(source.sourceWorkspaceId, kind, id),
        );
      if (mapping) {
        duplicates.push({ kind, sourceId: id, targetId: mapping.targetId });
        const current =
          kind === "asset"
            ? await tx.getMedia(mapping.targetId)
            : w.snapshot[field].find((x) => x.id === mapping.targetId);
        const incoming = await translatedItem(
          tx,
          source,
          kind,
          item,
          mapping.targetId,
        );
        const comparableCurrent =
          kind === "asset" && current
            ? Object.fromEntries(
                Object.keys(incoming).map((key) => [key, current[key]]),
              )
            : current;
        const lifecycleChanged =
          kind === "asset"
            ? !!current?.deletedAt
            : current?.deletedAt !== item.deletedAt;
        if (
          mapping.sourceHash !== hash(item) ||
          !current ||
          lifecycleChanged ||
          hash(comparableCurrent ?? null) !== hash(incoming)
        )
          conflicts.push({
            kind,
            sourceId: id,
            targetId: mapping.targetId,
            reason: lifecycleChanged ? "lifecycleChanged" : "sourceChanged",
            effect: lifecycleChanged
              ? kind === "asset" || item.deletedAt === null
                ? "restore"
                : "trash"
              : "update",
            current:
              kind === "asset" && current ? publicAsset(current) : current,
            incoming,
            resolution: source.acceptConflicts.includes(`${kind}:${id}`)
              ? "accepted"
              : "keepCloud",
          });
      }
    }
  return {
    sourceWorkspaceId: source.sourceWorkspaceId,
    selection: source.selection,
    closure: source.closure,
    counts: {
      pets: source.closure.petIds.length,
      records: source.closure.recordIds.length,
      reminders: source.closure.reminderIds.length,
      assets: source.closure.assetIds.length,
    },
    conflicts,
    duplicates,
    revision: w.revision,
  };
}
async function handleImport(request, deps) {
  const { store, principal, clock, idFactory, storage } = deps,
    p = request.payload;
  if (["imports.prepare", "imports.commit"].includes(request.action)) {
    const receipt = await priorReceipt(request, deps);
    if (receipt) return receipt;
  }
  if (request.action === "imports.preview") {
    const source = await canonicalSource(p);
    return store.transactionOwned(principal, async (tx) => {
      const w = tx.workspace ?? emptyWorkspace();
      return {
        ok: true,
        data: await previewInTransaction(tx, source, w),
        revision: w.revision,
      };
    });
  }
  if (request.action === "imports.prepare") {
    const source = await canonicalSource(p);
    if (!Object.values(source.closure).some((ids) => ids.length))
      throw new ApiError("INVALID_INPUT");
    if (Buffer.byteLength(JSON.stringify(source)) > 900 * 1024)
      throw new ApiError("INVALID_INPUT", "errors.workspaceTooLarge");
    return writeTransaction(
      request,
      deps,
      async (tx, w) => {
        const preview = await previewInTransaction(tx, source, w),
          batchId = idFactory();
        await tx.putImport(batchId, {
          ...source,
          id: batchId,
          ownerId: principal.userId,
          baseRevision: w.revision,
          createdAt: clock(),
          expiresAt: new Date(
            Date.parse(clock()) + 60 * 60 * 1000,
          ).toISOString(),
          committed: false,
        });
        return { batchId, preview };
      },
      { bump: false },
    );
  }
  if (request.action === "imports.commit") {
    const batch = await store.transactionOwned(
      principal,
      async (tx) => await tx.getImport(requiredId(p.batchId)),
    );
    if (!batch || batch.ownerId !== principal.userId)
      throw new ApiError("FORBIDDEN");
    const tickets = new Map();
    for (const item of p.assetTickets ?? []) {
      if (!item || tickets.has(item.sourceAssetId))
        throw new ApiError("INVALID_INPUT");
      const ticket = await store.transactionOwned(principal, async (tx) =>
        tx.getMedia(requiredId(item.ticketId)),
      );
      if (
        !ticket ||
        ticket.ownerId !== principal.userId ||
        ticket.importBatchId !== batch.id ||
        ticket.sourceAssetId !== item.sourceAssetId ||
        (!ticket.staging && !batch.committed)
      )
        throw new ApiError("FORBIDDEN");
      if (!batch.committed) await verifyObject(storage, ticket);
      tickets.set(item.sourceAssetId, ticket);
    }
    return writeTransaction(
      request,
      deps,
      async (tx, w) => {
        const current = await tx.getImport(batch.id);
        if (!current || current.ownerId !== principal.userId)
          throw new ApiError("FORBIDDEN");
        if (current.committed) return current.result;
        if (current.baseRevision !== w.revision) throw new ApiError("CONFLICT");
        if (Date.parse(current.expiresAt) < Date.parse(clock()))
          throw new ApiError("INVALID_INPUT");
        const d = await loadDomain(),
          next = d.clone(w.snapshot),
          ids = {
            pet: new Map(),
            record: new Map(),
            reminder: new Map(),
            asset: new Map(),
          },
          newItems = { pet: [], record: [], reminder: [], asset: [] };
        for (const [kind, field, key] of [
          ["pet", "pets", "petIds"],
          ["record", "records", "recordIds"],
          ["reminder", "reminders", "reminderIds"],
          ["asset", "assets", "assetIds"],
        ])
          for (const sourceId of current.closure[key]) {
            const item = (
                field === "assets" ? current.assets : current.snapshot[field]
              ).find((x) => x.id === sourceId),
              key = mappingKey(current.sourceWorkspaceId, kind, sourceId),
              existing = await tx.getMapping(key);
            if (existing) {
              ids[kind].set(sourceId, existing.targetId);
              continue;
            }
            const targetId =
              kind === "asset"
                ? (tickets.get(sourceId)?.id ?? null)
                : idFactory();
            if (!targetId)
              throw new ApiError("INVALID_INPUT", "errors.missingAsset");
            ids[kind].set(sourceId, targetId);
            newItems[kind].push(item);
            await tx.putMapping(key, {
              targetId,
              sourceHash: hash(item),
              createdAt: clock(),
            });
          }
        for (const item of newItems.pet)
          next.pets.push({
            ...item,
            id: ids.pet.get(item.id),
            avatarAssetId: ids.asset.get(item.avatarAssetId) ?? null,
          });
        for (const item of newItems.record)
          next.records.push({
            ...item,
            id: ids.record.get(item.id),
            petId: ids.pet.get(item.petId),
          });
        for (const item of newItems.reminder)
          next.reminders.push({
            ...item,
            id: ids.reminder.get(item.id),
            petId: ids.pet.get(item.petId),
            originRecordId: ids.record.get(item.originRecordId) ?? null,
            completionRecordId: ids.record.get(item.completionRecordId) ?? null,
          });
        for (const item of newItems.asset) {
          const prepared = tickets.get(item.id),
            ticket = await tx.getMedia(prepared.id);
          if (
            !ticket ||
            ticket.ownerId !== principal.userId ||
            ticket.importBatchId !== current.id ||
            ticket.sourceAssetId !== item.id ||
            Date.parse(ticket.expiresAt) < Date.parse(clock()) ||
            ticket.sha256 !== item.sha256 ||
            ticket.bytes !== item.bytes
          )
            throw new ApiError("FORBIDDEN");
          ticket.staging = false;
          ticket.createdAt = item.createdAt;
          ticket.caption = item.caption;
          ticket.petId = ids.pet.get(item.petId);
          delete ticket.importBatchId;
          delete ticket.sourceAssetId;
          await tx.putMedia(ticket.id, ticket);
        }
        for (const item of current.assets) {
          if (
            !(current.acceptConflicts ?? []).includes(`asset:${item.id}`) ||
            newItems.asset.some((value) => value.id === item.id)
          )
            continue;
          const targetId = ids.asset.get(item.id),
            existing = await tx.getMedia(targetId);
          if (
            !existing ||
            existing.ownerId !== principal.userId ||
            existing.petId !== ids.pet.get(item.petId)
          )
            throw new ApiError("FORBIDDEN");
          if (existing.deletedAt) {
            if (existing.cleanupPending)
              throw new ApiError("INVALID_INPUT", "errors.cleanupPending");
            const prepared = tickets.get(item.id),
              ticket = prepared ? await tx.getMedia(prepared.id) : null;
            if (
              !ticket ||
              ticket.ownerId !== principal.userId ||
              !ticket.staging ||
              ticket.importBatchId !== current.id ||
              ticket.sourceAssetId !== item.id ||
              Date.parse(ticket.expiresAt) < Date.parse(clock())
            )
              throw new ApiError("INVALID_INPUT", "errors.missingAsset");
            const restored = {
              ...ticket,
              id: targetId,
              petId: existing.petId,
              createdAt: item.createdAt,
              caption: item.caption,
              staging: false,
              deletedAt: null,
              cleanupPending: false,
            };
            delete restored.importBatchId;
            delete restored.sourceAssetId;
            await tx.putMedia(targetId, restored);
            ticket.deletedAt = clock();
            ticket.cleanupPending = false;
            await tx.putMedia(ticket.id, ticket);
          } else {
            if (
              existing.bytes !== item.bytes ||
              existing.sha256 !== item.sha256 ||
              existing.mime !== item.mime ||
              existing.kind !== item.kind
            )
              throw new ApiError("INVALID_INPUT", "errors.assetBytesChanged");
            existing.caption = item.caption;
            existing.createdAt = item.createdAt;
            await tx.putMedia(targetId, existing);
          }
          await tx.putMapping(
            mappingKey(current.sourceWorkspaceId, "asset", item.id),
            { targetId, sourceHash: hash(item), createdAt: clock() },
          );
        }
        for (const [kind, field] of [
          ["pet", "pets"],
          ["record", "records"],
          ["reminder", "reminders"],
        ]) {
          for (const item of current.snapshot[field]) {
            if (!(current.acceptConflicts ?? []).includes(`${kind}:${item.id}`))
              continue;
            const targetId = ids[kind].get(item.id),
              index = next[field].findIndex((value) => value.id === targetId);
            if (index < 0) throw new ApiError("FORBIDDEN");
            const candidate = { ...item, id: targetId };
            if (kind === "pet")
              candidate.avatarAssetId =
                ids.asset.get(item.avatarAssetId) ?? null;
            else {
              candidate.petId = ids.pet.get(item.petId);
              if (candidate.petId !== next[field][index].petId)
                throw new ApiError("FORBIDDEN");
              if (
                candidate.deletedAt === null &&
                next.pets.find((pet) => pet.id === candidate.petId)
                  ?.deletedAt !== null
              )
                throw new ApiError(
                  "INVALID_INPUT",
                  "errors.restoreParentFirst",
                );
            }
            if (kind === "reminder") {
              candidate.originRecordId =
                ids.record.get(item.originRecordId) ?? null;
              candidate.completionRecordId =
                ids.record.get(item.completionRecordId) ?? null;
            }
            if (
              kind === "record" &&
              candidate.deletedAt !== null &&
              next[field][index].deletedAt === null
            )
              for (const reminder of next.reminders)
                if (
                  reminder.originRecordId === targetId &&
                  reminder.status === "pending"
                )
                  reminder.status = "cancelled";
            next[field][index] = candidate;
            await tx.putMapping(
              mappingKey(current.sourceWorkspaceId, kind, item.id),
              { targetId, sourceHash: hash(item), createdAt: clock() },
            );
          }
        }
        if (
          !next.pets.some(
            (pet) => pet.id === next.activePetId && pet.deletedAt === null,
          )
        )
          next.activePetId = next.pets.find((x) => !x.deletedAt)?.id ?? null;
        if (current.copyCity) next.profile.city = current.snapshot.profile.city;
        w.snapshot = d.validateSnapshot(next);
        if (Buffer.byteLength(JSON.stringify(w.snapshot)) > 950 * 1024)
          throw new ApiError("INVALID_INPUT", "errors.workspaceTooLarge");
        w.revision++;
        current.committed = true;
        current.result = {
          batchId: current.id,
          counts: Object.fromEntries(
            Object.entries(newItems).map(([k, v]) => [k, v.length]),
          ),
          duplicates:
            Object.values(ids).reduce((n, map) => n + map.size, 0) -
            Object.values(newItems).reduce((n, v) => n + v.length, 0),
        };
        await tx.putImport(current.id, current);
        return current.result;
      },
      { bump: false },
    );
  }
  throw new ApiError("INVALID_INPUT");
}
module.exports = { handleImport, canonicalSource, mappingKey };
