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
const MAX_BYTES = 5 * 1024 * 1024,
  MAX_QUOTA = 50 * 1024 * 1024;
function sniffImage(buffer) {
 if(!Buffer.isBuffer(buffer))throw new ApiError("INVALID_INPUT");
 if(buffer.length>=8&&buffer.subarray(0,8).equals(Buffer.from("89504e470d0a1a0a","hex")))return "image/png";
 if(buffer[0]===255&&buffer[1]===216&&buffer[2]===255)return "image/jpeg";
 if(buffer.toString("ascii",0,4)==="RIFF"&&buffer.toString("ascii",8,12)==="WEBP")return "image/webp";
 if(buffer.toString("ascii",0,5)==="%PDF-"&&/%%EOF\s*$/.test(buffer.subarray(-1024).toString("ascii")))return "application/pdf";
 throw new ApiError("INVALID_INPUT");
}
function verifyParent(snapshot,input,{allowDeleted=false}={}) {
 if(!["record","reminder"].includes(input.parentKind))throw new ApiError("INVALID_INPUT");
 const entity=owned(snapshot,input.parentKind==="record"?"records":"reminders",input.parentId),pet=owned(snapshot,"pets",input.petId);
 if(entity.petId!==pet.id||(!allowDeleted&&(entity.deletedAt||pet.deletedAt)))throw new ApiError("FORBIDDEN");
 return entity;
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
async function handleAttachments(request, deps) {
  const { principal, store, storage, clock, idFactory } = deps,
    p = request.payload,
    action = request.action;
  if (["attachments.prepare", "attachments.confirm"].includes(action)) {
    const receipt = await priorReceipt(request, deps);
    if (receipt) {
      if (action === "attachments.prepare") {
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
      if (action === "attachments.confirm")
        await cleanupRetired(deps, receipt.data.id);
      return receipt;
    }
  }
  if (action === "attachments.cleanup") {
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
  if (action === "attachments.list") {
    return store.transactionOwned(principal, async (tx) => {
      const w = tx.workspace ?? emptyWorkspace(),
        archive = p.purpose === "archive";
      if (!archive) verifyParent(w.snapshot,p);
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
            a.kind === "attachment" &&
            !a.staging &&
            !a.deletedAt &&
            (archive ||
              (a.petId === p.petId && a.kind === "attachment" && a.parentKind === p.parentKind && a.parentId === p.parentId && !parent.deletedAt)),
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
  if (action === "attachments.read") {
    const ticket = await readTicket(deps, p.assetId);
    if (ticket.staging || ticket.deletedAt || ticket.kind!=="attachment") throw new ApiError("FORBIDDEN");
    const stored = await store.readOwned(principal),
      w = stored?.snapshot ? stored : (stored?.workspace ?? emptyWorkspace()),
      parent = owned(w.snapshot, "pets", ticket.petId);
    if (parent.deletedAt && p.purpose !== "archive")
      throw new ApiError("FORBIDDEN");
    verifyParent(w.snapshot,ticket,{allowDeleted:p.purpose==="archive"});
    const bytes = await verifyObject(storage, ticket);
    const latest = await store.transactionOwned(principal, async (tx) => {
      const asset = ownedAsset(await tx.getMedia(ticket.id), principal);
      const workspace = tx.workspace ?? emptyWorkspace();
      const pet = owned(workspace.snapshot, "pets", asset.petId);
      verifyParent(workspace.snapshot,asset,{allowDeleted:p.purpose==="archive"});
      if (pet.deletedAt && p.purpose !== "archive")
        throw new ApiError("FORBIDDEN");
      return { asset, revision: workspace.revision };
    });
    return {
      ok: true,
      data: {
        ...(bytes.length>1024*1024?await storage.downloadUrl(ticket.fileRef):{base64:bytes.toString("base64")}),
        mime: ticket.mime,
        metadata: publicAsset(latest.asset),
      },
      revision: latest.revision,
    };
  }
  if (action === "attachments.prepare") {
    if (
      !storage ||
      p.kind !== "attachment" ||
      !["image/png", "image/jpeg", "image/webp", "application/pdf"].includes(p.mime) ||
      !Number.isInteger(p.bytes) ||
      p.bytes <= 0 ||
      p.bytes > MAX_BYTES ||
      typeof p.sha256 !== "string" ||
      !/^[a-f0-9]{64}$/.test(p.sha256) ||
      typeof (p.filename??"")!=="string" || (p.filename??"").length>200 ||
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
            source.kind !== p.kind || source.parentKind!==p.parentKind || source.parentId!==p.parentId || source.filename!==p.filename
          )
            throw new ApiError("FORBIDDEN");
        } else {
          const parent = owned(w.snapshot, "pets", petId);
          if (parent.deletedAt) throw new ApiError("FORBIDDEN");
          verifyParent(w.snapshot,p);
        }
        if(!p.importBatchId&&(await tx.listMedia()).filter(a=>a.ownerId===principal.userId&&a.kind==="attachment"&&!a.deletedAt&&a.parentKind===p.parentKind&&a.parentId===p.parentId).length>=3)throw new ApiError("INVALID_INPUT");
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
          parentKind:p.parentKind,parentId:p.parentId,filename:(p.filename??"").trim(),
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
  if (action === "attachments.confirm") {
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
      verifyParent(w.snapshot,current);
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
  if (action === "attachments.remove") {
    const result = await writeTransaction(request, deps, async (tx, w) => {
      const asset = ownedAsset(
        await tx.getMedia(requiredId(p.assetId)),
        principal,
        { allowDeleted: true, staging: true },
      );
      if(asset.kind!=="attachment")throw new ApiError("FORBIDDEN");
      if(!asset.staging)verifyParent(w.snapshot,asset);
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
  handleAttachments,
  verifyObject,
  publicAsset,
  MAX_BYTES,
  MAX_QUOTA,
  sniffImage,
};

async function handleRequest(request,deps={}){
 try {
 const {validatePrincipal,hash}=require('./workspace.cjs');validatePrincipal(deps.principal);
 const workspaceId='cloud:'+hash({ownerId:deps.principal.userId,environmentId:process.env.PAW_CLOUD_ENV_ID??'paw-diary-d8g3p4tlsb305221d'});
 if(request?.expectedWorkspaceId!==undefined&&request.expectedWorkspaceId!==workspaceId)throw new ApiError('UNAUTHENTICATED');
 if(request?.version!==1||(!request.action?.startsWith('attachments.')&&!request.action?.startsWith('imports.'))||!request.payload||Buffer.byteLength(JSON.stringify(request.payload))>(request.action.startsWith('imports.')?100*1024*1024:65536))throw new ApiError('INVALID_INPUT');
 const options={...deps,clock:deps.clock??(()=>new Date().toISOString()),idFactory:deps.idFactory??require('node:crypto').randomUUID};
 return {...await (request.action.startsWith('imports.')?require('./imports.cjs').handleImport(request,options):handleAttachments(request,options)),workspaceId};
 }catch(e){return {ok:false,error:{code:e instanceof ApiError?e.code:'UNAVAILABLE',messageKey:e.messageKey??'errors.unavailable'}};}
}
module.exports.handleRequest=handleRequest;
