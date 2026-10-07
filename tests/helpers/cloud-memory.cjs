"use strict";
function memoryStore() {
  const owners = new Map();
  let queue = Promise.resolve();
  return {
    async readOwned(p) {
      return structuredClone(owners.get(p.userId) ?? null);
    },
    transactionOwned(p, fn) {
      const run = queue.then(async () => {
        const previous = owners.get(p.userId),
          value = structuredClone(
            previous ?? {
              workspace: null,
              receipts: {},
              media: {},
              imports: {},
              mappings: {},
            },
          );
        const tx = {
          get workspace() {
            return value.workspace;
          },
          set workspace(x) {
            value.workspace = x;
          },
          getReceipt: (k) => value.receipts[k],
          putReceipt: (k, v) => {
            value.receipts[k] = v;
          },
          getMedia: (k) => value.media[k],
          putMedia: (k, v) => {
            value.media[k] = v;
          },
          listMedia: () => Object.values(value.media),
          getImport: (k) => value.imports[k],
          putImport: (k, v) => {
            value.imports[k] = v;
          },
          getMapping: (k) => value.mappings[k],
          putMapping: (k, v) => {
            value.mappings[k] = v;
          },
        };
        const result = await fn(tx);
        owners.set(p.userId, value);
        return result;
      });
      queue = run.catch(() => {});
      return run;
    },
  };
}
module.exports = { memoryStore };
