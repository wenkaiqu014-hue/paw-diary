"use strict";
const {
  ApiError,
  emptyWorkspace,
  requiredId,
  owned,
  hash,
  writeTransaction,
  priorReceipt,
} = require("./workspace.cjs");
const MAX_BYTES = 1024 * 1024,
  MAX_QUOTA = 50 * 1024 * 1024;
function sniffImage(buffer) {
  if (!Buffer.isBuffer(buffer)) throw new ApiError("INVALID_INPUT");
  if (
    buffer.length >= 33 &&
    buffer.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")) &&
    buffer.toString("ascii", 12, 16) === "IHDR" &&
    buffer.readUInt32BE(16) > 0 &&
    buffer.readUInt32BE(20) > 0 &&
    buffer.readUInt32BE(16) <= 1920 &&
    buffer.readUInt32BE(20) <= 1920 &&
    buffer.subarray(-8, -4).toString("ascii") === "IEND"
  )
    return "image/png";
  if (
    buffer.length > 20 &&
    buffer[0] === 255 &&
    buffer[1] === 216 &&
    buffer[buffer.length - 2] === 255 &&
    buffer[buffer.length - 1] === 217
  ) {
    let at = 2;
    while (at + 9 < buffer.length) {
      if (buffer[at] !== 255) break;
      const marker = buffer[at + 1],
        length = buffer.readUInt16BE(at + 2);
      if ([192, 193, 194].includes(marker)) {
        const h = buffer.readUInt16BE(at + 5),
          w = buffer.readUInt16BE(at + 7);
        if (w > 0 && h > 0 && w <= 1920 && h <= 1920) return "image/jpeg";
        break;
      }
      if (length < 2) break;
      at += 2 + length;
    }
  }
  if (
    buffer.length >= 30 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP" &&
    buffer.readUInt32LE(4) + 8 === buffer.length
  ) {
    const type = buffer.toString("ascii", 12, 16);
    let w, h;
    if (type === "VP8X") {
      w = 1 + buffer.readUIntLE(24, 3);
      h = 1 + buffer.readUIntLE(27, 3);
    }
    if (type === "VP8L" && buffer[20] === 47) {
      const bits = buffer.readUInt32LE(21);
      w = (bits & 16383) + 1;
      h = ((bits >>> 14) & 16383) + 1;
    }
    if (
      type === "VP8 " &&
      buffer[23] === 157 &&
      buffer[24] === 1 &&
      buffer[25] === 42
    ) {
      w = buffer.readUInt16LE(26) & 16383;
      h = buffer.readUInt16LE(28) & 16383;
    }
    if (w > 0 && h > 0 && w <= 1920 && h <= 1920) return "image/webp";
  }
  throw new ApiError("INVALID_INPUT", "errors.invalidImage");
}
function ownedAsset(asset, p, { staging = false, allowDeleted = false } = {}) {
  if (
    !asset ||
    asset.ownerId !== p.userId ||
    (!allowDeleted && asset.deletedAt) ||
    (!staging && asset.staging)
  )
    throw new ApiError("FORBIDDEN");
  return asset;
}
function publicAsset(a) {
  const {
    ownerId,
    staging,
    expiresAt,
    importBatchId,
    sourceAssetId,
    cleanupPending,
    retiredAssetId,
    deletedAt,
    ...result
  } = a;
  return result;
}
async function readTicket(deps, id) {
  return deps.store.transactionOwned(deps.principal, async (tx) =>
    ownedAsset(await tx.getMedia(requiredId(id)), deps.principal, {
      staging: true,
    }),
  );
}
async function verifyObject(storage, ticket) {
  if (!storage) throw new ApiError("UNAVAILABLE");
  const bytes = await storage.read(ticket.fileRef, MAX_BYTES);
  if (
    !Buffer.isBuffer(bytes) ||
    bytes.length !== ticket.bytes ||
    bytes.length > MAX_BYTES ||
    sniffImage(bytes) !== ticket.mime ||
    require("node:crypto").createHash("sha256").update(bytes).digest("hex") !==
      ticket.sha256
  )
    throw new ApiError("INVALID_INPUT", "errors.invalidImage");
  return bytes;
}
async function cleanupRetired(deps, assetId) {
  try {
    const current = await deps.store.transactionOwned(
      deps.principal,
      async (tx) => tx.getMedia(assetId),
    );
    if (!current?.retiredAssetId) return;
    const retired = await deps.store.transactionOwned(
      deps.principal,
      async (tx) =>
        ownedAsset(await tx.getMedia(current.retiredAssetId), deps.principal, {
          allowDeleted: true,
        }),
    );
    if (!retired.deletedAt || !retired.cleanupPending) return;
    await deps.storage.remove(retired.fileRef);
    await deps.store.transactionOwned(deps.principal, async (tx) => {
      const latest = ownedAsset(await tx.getMedia(retired.id), deps.principal, {
        allowDeleted: true,
      });
      if (latest.deletedAt) {
        latest.cleanupPending = false;
        await tx.putMedia(latest.id, latest);
      }
    });
  } catch {
    /* Revoked metadata stays hidden; quota remains held until cleanup succeeds. */
  }
}
async function markExpired(tx, deps, { assetIds, limit = 3 } = {}) {
  const { principal, clock } = deps,
    now = Date.parse(clock());
  if (!Number.isInteger(limit) || limit < 1 || limit > 3)
    throw new ApiError("INVALID_INPUT");
  let candidates;
  if (assetIds !== undefined) {
    if (!Array.isArray(assetIds) || !assetIds.length || assetIds.length > 3)
      throw new ApiError("INVALID_INPUT");
    candidates = [];
    for (const id of new Set(assetIds)) {
      const asset = ownedAsset(await tx.getMedia(requiredId(id)), principal, {
        staging: true,
        allowDeleted: true,
      });
      if (
        !asset.staging ||
        (!asset.deletedAt && Date.parse(asset.expiresAt) > now)
      )
        throw new ApiError("INVALID_INPUT");
      candidates.push(asset);
    }
  } else
    candidates = (await tx.listMedia())
      .filter(
        (asset) =>
          asset.ownerId === principal.userId &&
          asset.staging &&
          (asset.deletedAt
            ? asset.cleanupPending
            : Date.parse(asset.expiresAt) <= now),
      )
      .slice(0, limit);
  const work = [];
  for (const asset of candidates) {
    if (asset.deletedAt && !asset.cleanupPending) continue;
    asset.deletedAt = asset.deletedAt ?? clock();
    asset.cleanupPending = true;
    await tx.putMedia(asset.id, asset);
    work.push({ id: asset.id, fileRef: asset.fileRef, bytes: asset.bytes });
  }
  return work;
}
async function cleanupMarked(deps, work) {
  let cleaned = 0,
    pending = 0,
    quotaReleasedBytes = 0;
  for (const item of work) {
    try {
      const needsCleanup = await deps.store.transactionOwned(deps.principal, async (tx) => {
        const asset = ownedAsset(await tx.getMedia(item.id), deps.principal, {staging:true, allowDeleted:true});
        if (!asset.staging || !asset.deletedAt || asset.fileRef !== item.fileRef) throw new ApiError("FORBIDDEN");
        return asset.cleanupPending;
      });
      if (!needsCleanup) continue;
      await deps.storage.remove(item.fileRef);
      const released = await deps.store.transactionOwned(
        deps.principal,
        async (tx) => {
          const asset = ownedAsset(await tx.getMedia(item.id), deps.principal, {
            staging: true,
            allowDeleted: true,
          });
          if (
            !asset.staging ||
            !asset.deletedAt ||
            asset.fileRef !== item.fileRef
          )
            throw new ApiError("FORBIDDEN");
          if (!asset.cleanupPending) return 0;
          asset.cleanupPending = false;
          await tx.putMedia(asset.id, asset);
          return asset.bytes;
        },
      );
      quotaReleasedBytes += released;
      if (released > 0) cleaned++;
    } catch {
      pending++;
    }
  }
  return { cleaned, pending, quotaReleasedBytes };
}
async function handleMedia(request, deps) {
  const { principal, store, storage, clock, idFactory } = deps,
    p = request.payload,
    action = request.action;
  if (["media.prepare", "media.confirm"].includes(action)) {
    const receipt = await priorReceipt(request, deps);
    if (receipt) {
      if (action === "media.prepare") {
        const ticket = await store.transactionOwned(principal, async (tx) =>
          tx.getMedia(receipt.data.ticketId),
        );
        if (
          !ticket ||
          ticket.deletedAt ||
          (ticket.staging &&
            Date.parse(ticket.expiresAt) <= Date.parse(clock()))
        )
          throw new ApiError("INVALID_INPUT", "errors.uploadExpired");
      }
      if (action === "media.confirm")
        await cleanupRetired(deps, receipt.data.id);
      return receipt;
    }
  }
  if(action==='media.rename'){
    if(typeof p.displayName!=='string'||!p.displayName.trim()||p.displayName.trim().length>60)throw new ApiError('INVALID_INPUT');
    return writeTransaction(request,deps,async(tx,w)=>{const asset=ownedAsset(await tx.getMedia(requiredId(p.assetId)),principal);if(asset.kind!=='photo')throw new ApiError('INVALID_INPUT');const pet=owned(w.snapshot,'pets',asset.petId);if(pet.deletedAt)throw new ApiError('FORBIDDEN');asset.displayName=p.displayName.trim();await tx.putMedia(asset.id,asset);return publicAsset(asset);});
  }
  if (action === "media.cleanup") {
    const result = await writeTransaction(
      request,
      deps,
      async (tx, w) => ({
        work: await markExpired(tx, deps, p),
        cleaned: 0,
        pending: 0,
        quotaReleasedBytes: 0,
      }),
      { bump: false },
    );
    const outcome = await cleanupMarked(deps, result.data.work ?? []);
    const data = {
      ...result.data,
      cleaned: (result.data.cleaned ?? 0) + outcome.cleaned,
      pending: outcome.pending,
      quotaReleasedBytes:
        (result.data.quotaReleasedBytes ?? 0) + outcome.quotaReleasedBytes,
    };
    await store.transactionOwned(principal, async (tx) => {
      const receipt = await tx.getReceipt(request.idempotencyKey);
      if (receipt) {
        receipt.data = data;
        await tx.putReceipt(request.idempotencyKey, receipt);
      }
    });
    const { work, ...publicResult } = data;
    result.data = publicResult;
    return result;
  }
  if (action === "media.list") {
    return store.transactionOwned(principal, async (tx) => {
      const w = tx.workspace ?? emptyWorkspace(),
        archive = p.purpose === "archive";
      if (!archive) owned(w.snapshot, "pets", p.petId);
      const parent = archive
          ? null
          : w.snapshot.pets.find((x) => x.id === p.petId),
        limit = Math.max(
          1,
          Math.min(100, Number.isInteger(p.limit) ? p.limit : 20),
        );
      const all = (await tx.listMedia())
        .filter(
          (a) =>
            a.ownerId === principal.userId &&
            !a.staging &&
            !a.deletedAt &&
            (archive ||
              (a.petId === p.petId && a.kind === "photo" && !parent.deletedAt)),
        )
        .sort(
          (a, b) =>
            b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id),
        );
      const start = p.cursor ? all.findIndex((a) => a.id === p.cursor) + 1 : 0;
      if (p.cursor && start === 0) throw new ApiError("INVALID_INPUT");
      const items = all.slice(start, start + limit).map(publicAsset);
      return {
        ok: true,
        data: {
          items,
          nextCursor: start + limit < all.length ? items.at(-1).id : null,
        },
        revision: w.revision,
      };
    });
  }
  if (action === "media.read") {
    const ticket = await readTicket(deps, p.assetId);
    if (ticket.staging || ticket.deletedAt) throw new ApiError("FORBIDDEN");
    const stored = await store.readOwned(principal),
      w = stored?.snapshot ? stored : (stored?.workspace ?? emptyWorkspace()),
      parent = owned(w.snapshot, "pets", ticket.petId);
    if (parent.deletedAt && p.purpose !== "archive")
      throw new ApiError("FORBIDDEN");
    const bytes = await verifyObject(storage, ticket);
    const latest = await store.transactionOwned(principal, async (tx) => {
      const asset = ownedAsset(await tx.getMedia(ticket.id), principal);
      const workspace = tx.workspace ?? emptyWorkspace();
      const pet = owned(workspace.snapshot, "pets", asset.petId);
      if (pet.deletedAt && p.purpose !== "archive")
        throw new ApiError("FORBIDDEN");
      return { asset, revision: workspace.revision };
    });
    return {
      ok: true,
      data: {
        base64: bytes.toString("base64"),
        mime: ticket.mime,
        metadata: publicAsset(latest.asset),
      },
      revision: latest.revision,
    };
  }
  if (action === "media.prepare") {
    if (
      !storage ||
      (p.displayName!==undefined&&(p.kind!=="photo"||typeof p.displayName!=="string"||!p.displayName.trim()||p.displayName.trim().length>60)) ||
      !["avatar", "photo"].includes(p.kind) ||
      !["image/png", "image/jpeg", "image/webp"].includes(p.mime) ||
      !Number.isInteger(p.bytes) ||
      p.bytes <= 0 ||
      p.bytes > MAX_BYTES ||
      typeof p.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(p.sha256) ||
      typeof (p.caption ?? "") !== "string" ||
      (p.caption ?? "").length > 200
    )
      throw new ApiError("INVALID_INPUT");
    const expired = await store.transactionOwned(principal, async (tx) =>
      markExpired(tx, deps, { limit: 1 }),
    );
    await cleanupMarked(deps, expired);
    const ticketId = idFactory(),
      path = `private/${hash(principal.userId)}/${ticketId}`;
    return writeTransaction(
      request,
      deps,
      async (tx, w) => {
        let petId = p.petId;
        if (p.importBatchId) {
          const batch = await tx.getImport(p.importBatchId);
          if (!batch || batch.ownerId !== principal.userId || batch.committed)
            throw new ApiError("FORBIDDEN");
          const source = batch.assets?.find((a) => a.id === p.sourceAssetId);
          if (
            !source ||
            source.petId !== p.petId ||
            source.bytes !== p.bytes ||
            source.sha256 !== p.sha256 ||
            source.mime !== p.mime ||
            source.kind !== p.kind || source.displayName!==p.displayName
          )
            throw new ApiError("FORBIDDEN");
        } else {
          const parent = owned(w.snapshot, "pets", petId);
          if (parent.deletedAt) throw new ApiError("FORBIDDEN");
        }
        const total = (await tx.listMedia())
          .filter(
            (a) =>
              a.ownerId === principal.userId &&
              (!a.deletedAt || a.cleanupPending),
          )
          .reduce((n, a) => n + a.bytes, 0);
        if (total + p.bytes > MAX_QUOTA)
          throw new ApiError("INVALID_INPUT", "errors.mediaQuota");
        const upload = await storage.prepare(path);
        const ticket = {
          id: ticketId,
          ownerId: principal.userId,
          petId,
          kind: p.kind,
          ...(p.displayName!==undefined?{displayName:p.displayName.trim()}:{}),
          caption: (p.caption ?? "").trim(),
          createdAt: clock(),
          mime: p.mime,
          bytes: p.bytes,
          sha256: p.sha256,
          fileRef: upload.fileRef,
          staging: true,
          deletedAt: null,
          expiresAt: new Date(
            Date.parse(clock()) + 10 * 60 * 1000,
          ).toISOString(),
          ...(p.importBatchId
            ? { importBatchId: p.importBatchId, sourceAssetId: p.sourceAssetId }
            : {}),
        };
        await tx.putMedia(ticketId, ticket);
        return { ticketId, upload: upload.upload, expiresAt: ticket.expiresAt };
      },
      { bump: false },
    );
  }
  if (action === "media.confirm") {
    const ticket = await readTicket(deps, p.ticketId);
    if (ticket.importBatchId) throw new ApiError("FORBIDDEN");
    await verifyObject(storage, ticket);
    const result = await writeTransaction(request, deps, async (tx, w) => {
      const current = ownedAsset(await tx.getMedia(ticket.id), principal, {
        staging: true,
      });
      if (
        !current.staging ||
        Date.parse(current.expiresAt) < Date.parse(clock())
      )
        throw new ApiError("INVALID_INPUT");
      const parent = owned(w.snapshot, "pets", current.petId);
      if (parent.deletedAt) throw new ApiError("FORBIDDEN");
      current.staging = false;
      if (current.kind === "avatar") {
        const previous = parent.avatarAssetId;
        parent.avatarAssetId = current.id;
        if (previous) {
          const old = await tx.getMedia(previous);
          if (old?.ownerId === principal.userId) {
            current.retiredAssetId = previous;
            old.deletedAt = clock();
            old.cleanupPending = true;
            await tx.putMedia(previous, old);
          }
        }
      }
      await tx.putMedia(current.id, current);
      return publicAsset(current);
    });
    await cleanupRetired(deps, result.data.id);
    return result;
  }
  if (action === "media.remove") {
    const result = await writeTransaction(request, deps, async (tx, w) => {
      const asset = ownedAsset(
        await tx.getMedia(requiredId(p.assetId)),
        principal,
        { allowDeleted: true, staging: true },
      );
      if (!asset.deletedAt) {
        asset.deletedAt = clock();
        asset.cleanupPending = true;
        await tx.putMedia(asset.id, asset);
        if (!asset.staging) {
          const parent = owned(w.snapshot, "pets", asset.petId);
          if (parent.avatarAssetId === asset.id) parent.avatarAssetId = null;
        }
      }
      return {
        assetId: asset.id,
        cleanupPending: asset.cleanupPending === true,
        quotaReleased: asset.cleanupPending !== true,
      };
    });
    const asset = await store.transactionOwned(principal, async (tx) =>
      ownedAsset(await tx.getMedia(p.assetId), principal, {
        allowDeleted: true,
        staging: true,
      }),
    );
    if (asset.cleanupPending) {
      try {
        await storage.remove(asset.fileRef);
        await store.transactionOwned(principal, async (tx) => {
          const latest = ownedAsset(await tx.getMedia(asset.id), principal, {
            allowDeleted: true,
            staging: true,
          });
          latest.cleanupPending = false;
          await tx.putMedia(latest.id, latest);
          const receipt = await tx.getReceipt(request.idempotencyKey);
          if (receipt) {
            receipt.data = {
              assetId: asset.id,
              cleanupPending: false,
              quotaReleased: true,
            };
            await tx.putReceipt(request.idempotencyKey, receipt);
          }
        });
        result.data = {
          assetId: asset.id,
          cleanupPending: false,
          quotaReleased: true,
        };
      } catch {
        result.data = {
          assetId: asset.id,
          cleanupPending: true,
          quotaReleased: false,
        };
      }
    }
    return result;
  }
  throw new ApiError("INVALID_INPUT");
}
module.exports = {
  handleMedia,
  verifyObject,
  publicAsset,
  MAX_BYTES,
  MAX_QUOTA,
  sniffImage,
};
