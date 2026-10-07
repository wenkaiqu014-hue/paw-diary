import {createCloudAttachmentRepository} from './cloud-attachment-repository.js';
import { clone, validateSnapshot } from "../domain/schema.js?v=0.2.0";
import { createCloudMediaRepository } from "./cloud-media-repository.js";
export class CloudApiError extends Error {
  constructor(error = {}) {
    super(error.messageKey ?? "errors.unavailable");
    this.code = error.code ?? "UNAVAILABLE";
    this.messageKey = error.messageKey ?? "errors.unavailable";
    this.params = error.params;
  }
}
export function createCloudRepository({
  invoke,
  clock = () => new Date().toISOString(),
  storage = globalThis.localStorage,
  workspaceId,
  principal,
} = {}) {
  if (typeof invoke !== "function" || !principal?.userId)
    throw new CloudApiError({ code: "UNAUTHENTICATED" });
  // Device preference remains owner-scoped; export identity is assigned by the
  // trusted server and never taken from a caller's label or the plain UID.
  const selectionKey = `paw-diary:selection:account:${principal.userId}`;
  let id = null,
    state = null,
    revision = 0,
    queue = Promise.resolve();
  let selected;
  try {
    selected = storage?.getItem(selectionKey) ?? null;
  } catch {
    selected = null;
  }
  const apply = (candidate, version) => {
    if (!Number.isSafeInteger(version) || version < 0)
      throw new CloudApiError();
    const checked = validateSnapshot(candidate);
    if (checked.mode !== "account") throw new CloudApiError();
    if (!state || version >= revision) {
      state = checked;
      revision = version;
    }
  };
  const view = () => {
    const next = clone(state);
    if (
      selected &&
      next.pets.some((p) => p.id === selected && p.deletedAt === null)
    )
      next.activePetId = selected;
    return next;
  };
  const send = async (request, retry = false) => {
    if (id) request = { ...request, expectedWorkspaceId: id };
    let result;
    try {
      result = await invoke(request);
    } catch {
      if (retry) {
        try {
          result = await invoke(request);
        } catch {
          throw new CloudApiError();
        }
      } else throw new CloudApiError();
    }
    result = result?.result ?? result;
    if (!result?.ok) throw new CloudApiError(result?.error);
    if (result.workspaceId !== undefined) {
      if (
        typeof result.workspaceId !== "string" ||
        !/^cloud:[a-f0-9]{64}$/.test(result.workspaceId)
      )
        throw new CloudApiError();
      if (id && id !== result.workspaceId)
        throw new CloudApiError({ code: "UNAUTHENTICATED" });
      id = result.workspaceId;
    }
    if (result.snapshot) apply(result.snapshot, result.revision);
    else if (request.action === "health.snapshot")
      apply(result.data, result.revision);
    return result;
  };
  const refresh = async () => {
    await send({ version: 1, action: "health.snapshot", payload: {} });
    return view();
  };
  const serial = (fn) => {
    const pending = queue.then(fn);
    queue = pending.catch(() => {});
    return pending;
  };
  const request = (action, payload = {}, options = {}) => {
    const write =
      options.write ??
      ![
        "health.snapshot",
        "media.list",
        "media.read",
        "attachments.list",
        "attachments.read",
        "imports.preview",
      ].includes(action);
    if (!write)
      return send({ version: 1, action, payload }).then((r) => clone(r.data));
    return serial(async () => {
      if (!state) await refresh();
      const operationId =
        options.operationId ??
        globalThis.crypto?.randomUUID?.() ??
        `op-${clock()}-${Math.random().toString(36).slice(2)}`;
      const req = {
        version: 1,
        action,
        payload,
        expectedRevision: options.baseRevision ?? revision,
        idempotencyKey: operationId,
      };
      const result = await send(req, true);
      if (!result.snapshot && result.revision >= revision) await refresh();
      return clone(result.data);
    });
  };
  const repo = {
    snapshot: async () => {
      if (!state) await refresh();
      return view();
    },
    refresh,
    getRevision: () => revision,
    getWorkspaceId: () => {
      if (!id) throw new CloudApiError();
      return id;
    },
    request,
    savePet: (input, o) => request("pets.save", input, o),
    manageRecordTypes: (command, o) => request("recordTypes.manage", command, o),
    saveRecord: (input, o) => request("records.save", input, o),
    saveRecordBatch: (inputs, o) => request("records.saveBatch", {inputs}, o),
    saveOnboarding: (input, o) => request("stage3.onboarding.save", input, o),
    saveRecap: (input, o) => request("stage3.recap.save", input, o),
    deleteRecord: (id, o) =>
      request("records.delete", { id }, o).then(() => undefined),
    saveReminder: (input, o) => request("reminders.save", input, o),
    completeReminder: (id, input, o) =>
      request("reminders.complete", { id, input }, o),
    moveToTrash: (input, o) => request("trash.move", input, o),
    restoreFromTrash: (input, o) => request("trash.restore", input, o),
    reorderPets: (ids, o) => request("pets.reorder", { ids }, o),
    saveProfile: (input, o) => request("profile.save", input, o),
    selectPet: async (petId) => {
      if (!state) await refresh();
      if (!state.pets.some((p) => p.id === petId && p.deletedAt === null))
        throw new CloudApiError({ code: "INVALID_INPUT" });
      selected = petId;
      try {
        storage?.setItem(selectionKey, petId);
      } catch {}
    },
    getRawBackup: async () => JSON.stringify(await repo.snapshot()),
  };
  repo.media = createCloudMediaRepository({ repository: repo });
  repo.attachments = createCloudAttachmentRepository({ repository: repo });
  return repo;
}
