"use strict";
const cloudbase = require("@cloudbase/node-sdk");
const { handleRequest } = require("../../backend/api.cjs");
const { resolvePrincipal } = require("../../backend/identity.cjs");
const { createCloudbaseStore } = require("../../backend/cloudbase-store.cjs");
const { createCloudbaseStorage } = require("../../backend/storage.cjs");
const app = cloudbase.init({
  env: process.env.PAW_CLOUD_ENV_ID ?? "paw-diary-d8g3p4tlsb305221d",
  region: "ap-shanghai",
});
exports.main = async (event, context) => {
  try {
    const principal = await resolvePrincipal(context, {
      auth: app.auth(),
      getPlatformContext: cloudbase.getCloudbaseContext,
    });
    return await handleRequest(event, {
      principal,
      store: createCloudbaseStore({ db: app.database() }),
      storage: createCloudbaseStorage({ app }),
    });
  } catch {
    return {
      ok: false,
      error: { code: "UNAVAILABLE", messageKey: "errors.unavailable" },
    };
  }
};
