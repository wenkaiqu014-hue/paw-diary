import { processImage as processDisplayImage } from "../media/process-image.js";
const failure = (code) =>
  Object.assign(new Error("errors." + (code ?? "UNAVAILABLE").toLowerCase()), {
    code: code ?? "UNAVAILABLE",
  });
async function putObject(upload, blob) {
  if (!upload?.url || upload.method !== "PUT" || !upload.headers)
    throw failure();
  let result;
  try {
    result = await fetch(upload.url, {
      method: "PUT",
      headers: upload.headers,
      body: blob,
    });
  } catch {
    throw failure();
  }
  if (!result.ok) throw failure();
}
async function digest(blob) {
  const bytes = await blob.arrayBuffer();
  return [
    ...new Uint8Array(await globalThis.crypto.subtle.digest("SHA-256", bytes)),
  ]
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}
export function createCloudMediaRepository({
  repository,
  invoke,
  processImage = processDisplayImage,
  upload = putObject,
} = {}) {
  if (!repository?.request) throw failure();
  return {
    list: (input) => repository.request("media.list", input),
    async listAll() {
      const items = [];
      let cursor;
      do {
        const result = await repository.request("media.list", {
          purpose: "archive",
          limit: 100,
          ...(cursor ? { cursor } : {}),
        });
        items.push(...result.items);
        cursor = result.nextCursor;
      } while (cursor);
      return items;
    },
    async save({
      petId,
      kind = "photo",
      blob,
      caption = "",
      baseRevision = repository.getRevision(),
      operationId = globalThis.crypto.randomUUID(),
    } = {}) {
      const image = await processImage(blob, { kind }),
        sha256 = await digest(image.blob);
      const staged = await repository.request(
        "media.prepare",
        { petId, kind, caption, mime: image.mime, bytes: image.bytes, sha256 },
        { baseRevision, operationId: operationId + ":prepare" },
      );
      await upload(staged.upload, image.blob);
      return repository.request(
        "media.confirm",
        { ticketId: staged.ticketId },
        { baseRevision, operationId: operationId + ":confirm" },
      );
    },
    async stageImport({
      batchId,
      metadata,
      blob,
      baseRevision = repository.getRevision(),
      operationId = globalThis.crypto.randomUUID(),
    } = {}) {
      if (
        !(blob instanceof Blob) ||
        blob.size !== metadata.bytes ||
        blob.type !== metadata.mime ||
        (await digest(blob)) !== metadata.sha256
      )
        throw failure("INVALID_INPUT");
      const staged = await repository.request(
        "media.prepare",
        {
          petId: metadata.petId,
          kind: metadata.kind,
          caption: metadata.caption ?? "",
          mime: metadata.mime,
          bytes: metadata.bytes,
          sha256: metadata.sha256,
          importBatchId: batchId,
          sourceAssetId: metadata.id,
        },
        { baseRevision, operationId: operationId + ":prepare" },
      );
      await upload(staged.upload, blob);
      return { sourceAssetId: metadata.id, ticketId: staged.ticketId };
    },
    remove: ({ assetId, ...options }) =>
      repository.request("media.remove", { assetId }, options),
    async read(assetId, { includeDeleted = false } = {}) {
      const result = await repository.request("media.read", {
        assetId,
        ...(includeDeleted ? { purpose: "archive" } : {}),
      });
      if (
        typeof result.base64 !== "string" ||
        result.base64.length > Math.ceil((1024 * 1024) / 3) * 4 ||
        !["image/png", "image/jpeg", "image/webp"].includes(result.mime)
      )
        throw failure("INVALID_INPUT");
      const bytes = Uint8Array.from(atob(result.base64), (c) =>
        c.charCodeAt(0),
      );
      return {
        metadata: result.metadata,
        blob: new Blob([bytes], { type: result.mime }),
      };
    },
    async resolveUrl(assetId) {
      const { blob } = await this.read(assetId);
      const url = URL.createObjectURL(blob);
      return { url, release: () => URL.revokeObjectURL(url) };
    },
  };
}
