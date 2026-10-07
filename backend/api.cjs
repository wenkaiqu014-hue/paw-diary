"use strict";
const { randomUUID } = require("node:crypto");
const {
  ApiError,
  emptyWorkspace,
  validatePrincipal,
  transformHealth,
  writeTransaction,
  hash,
} = require("./workspace.cjs");
const healthActions = new Set([
  "pets.save",
  "pets.reorder",
  "records.save",
  "recordTypes.manage",
  "records.saveBatch",
  "stage3.onboarding.save",
  "stage3.recap.save",
  "records.delete",
  "reminders.save",
  "reminders.complete",
  "trash.move",
  "trash.restore",
  "profile.save",
]);
async function handleRequest(
  request,
  {
    principal,
    store,
    storage,
    clock = () => new Date().toISOString(),
    idFactory = randomUUID,
    environmentId = process.env.PAW_CLOUD_ENV_ID ??
      "paw-diary-d8g3p4tlsb305221d",
  } = {},
) {
  try {
    validatePrincipal(principal);
    if (
      !request ||
      request.version !== 1 ||
      typeof request.action !== "string" ||
      !request.payload ||
      typeof request.payload !== "object" ||
      Array.isArray(request.payload)
    )
      throw new ApiError("INVALID_INPUT");
    const workspaceId = `cloud:${hash({ ownerId: principal.userId, environmentId })}`;
    if (
      request.expectedWorkspaceId !== undefined &&
      request.expectedWorkspaceId !== workspaceId
    )
      throw new ApiError("UNAUTHENTICATED", "errors.workspaceChanged");
    if (!store) throw new ApiError("UNAVAILABLE");
    const limit = request.action.startsWith("imports.")
      ? 100 * 1024 * 1024
      : 64 * 1024;
    if (Buffer.byteLength(JSON.stringify(request.payload)) > limit)
      throw new ApiError("INVALID_INPUT");
    const deps = { principal, store, storage, clock, idFactory };
    const identify = (reply) => ({ ...reply, workspaceId });
    if (request.action === "health.snapshot") {
      const stored = await store.readOwned(principal);
      const w = stored?.snapshot
        ? stored
        : (stored?.workspace ?? emptyWorkspace());
      return {
        ok: true,
        data: structuredClone(w.snapshot),
        revision: w.revision,
        workspaceId,
      };
    }
    if (healthActions.has(request.action))
      return identify(
        await writeTransaction(request, deps, (_, w) =>
          transformHealth(w, request.action, request.payload, deps),
        ),
      );
    if (request.action.startsWith("media."))
      return identify(await require("./photos.cjs").handleMedia(request, deps));
    if (request.action.startsWith("imports."))
      return identify(
        await require("./imports.cjs").handleImport(request, deps),
      );
    throw new ApiError("INVALID_INPUT");
  } catch (error) {
    const known = error instanceof ApiError;
    const code = known
      ? error.code
      : error?.name === "TransactionConflict" ||
          /transaction.*conflict/i.test(error?.message ?? "")
        ? "CONFLICT"
        : error?.message &&
            /不存在|无效|不能为空|不能|请|缺少|不支持|没有|格式|超过|需|日期|回收站|归属|必须/.test(
              error.message,
            )
          ? "INVALID_INPUT"
          : "UNAVAILABLE";
    return {
      ok: false,
      error: {
        code,
        messageKey: known ? error.messageKey : "errors." + code.toLowerCase(),
        ...(known && error.params ? { params: error.params } : {}),
      },
    };
  }
}
module.exports = { handleRequest };
