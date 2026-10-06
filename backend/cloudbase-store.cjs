"use strict";
const { ApiError, hash } = require("./workspace.cjs");
const collections = {
  workspace: "health_workspaces",
  receipt: "health_receipts",
  media: "media_assets",
  import: "import_batches",
  mapping: "import_maps",
};
const docId = (owner, kind, key) => hash(`${owner}\0${kind}\0${key}`);
function checkResult(result) {
  if (result?.code)
    throw new ApiError(
      result.code === "DATABASE_TRANSACTION_CONFLICT"
        ? "CONFLICT"
        : "UNAVAILABLE",
    );
  return result;
}
function createCloudbaseStore({ db } = {}) {
  if (!db || typeof db.runTransaction !== "function")
    throw new ApiError("UNAVAILABLE");
  async function read(client, owner, kind, key) {
    const result = await client
      .collection(collections[kind])
      .doc(docId(owner, kind, key))
      .get();
    checkResult(result);
    const doc = Array.isArray(result?.data) ? result.data[0] : result?.data;
    if (!doc) return undefined;
    if (doc.ownerId !== owner) throw new ApiError("FORBIDDEN");
    return structuredClone(doc.value);
  }
  async function write(client, owner, kind, key, value) {
    if (Buffer.byteLength(JSON.stringify(value)) > 950 * 1024)
      throw new ApiError("INVALID_INPUT", "errors.workspaceTooLarge");
    const result = await client
      .collection(collections[kind])
      .doc(docId(owner, kind, key))
      .set({ ownerId: owner, value: structuredClone(value) });
    checkResult(result);
  }
  return {
    async readOwned(principal) {
      return (
        (await read(db, principal.userId, "workspace", "singleton")) ?? null
      );
    },
    async transactionOwned(principal, callback) {
      return db.runTransaction(async (transaction) => {
        const owner = principal.userId;
        let workspace = await read(
            transaction,
            owner,
            "workspace",
            "singleton",
          ),
          workspaceChanged = false;
        const tx = {
          get workspace() {
            return workspace;
          },
          set workspace(value) {
            workspace = value;
            workspaceChanged = true;
          },
          getReceipt: (key) => read(transaction, owner, "receipt", key),
          putReceipt: (key, value) =>
            write(transaction, owner, "receipt", key, value),
          getMedia: (key) => read(transaction, owner, "media", key),
          putMedia: (key, value) =>
            write(transaction, owner, "media", key, value),
          getImport: (key) => read(transaction, owner, "import", key),
          putImport: (key, value) =>
            write(transaction, owner, "import", key, value),
          getMapping: (key) => read(transaction, owner, "mapping", key),
          putMapping: (key, value) =>
            write(transaction, owner, "mapping", key, value),
          async listMedia() {
            const items = [];
            let offset = 0;
            for (;;) {
              const result = await transaction
                .collection(collections.media)
                .where({ ownerId: owner })
                .skip(offset)
                .limit(100)
                .get();
              const batch = result?.data ?? [];
              checkResult(result);
              for (const doc of batch) {
                if (doc.ownerId !== owner) throw new ApiError("FORBIDDEN");
                items.push(structuredClone(doc.value));
              }
              if (batch.length < 100) break;
              offset += 100;
              if (offset > 2000)
                throw new ApiError("UNAVAILABLE", "errors.mediaQuota");
            }
            return items;
          },
        };
        const result = await callback(tx);
        if (workspaceChanged)
          await write(transaction, owner, "workspace", "singleton", workspace);
        return result;
      });
    },
  };
}
module.exports = { createCloudbaseStore, collections };
