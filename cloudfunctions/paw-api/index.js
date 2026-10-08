"use strict";
const cloudbase = require("@cloudbase/node-sdk");
const { handleRequest } = require("../../backend/api.cjs");
const {readBetaPolicy,reviewedError}=require("../../backend/beta-access.cjs");
const { resolvePrincipal } = require("../../backend/identity.cjs");
const {createPlatformProfileLookup}=require("../../backend/verified-profile.cjs");
const {createAuthStore}=require("../../backend/email-auth.cjs");
const { createCloudbaseStore } = require("../../backend/cloudbase-store.cjs");
const { createCloudbaseStorage } = require("../../backend/storage.cjs");
const app = cloudbase.init({
  env: process.env.PAW_CLOUD_ENV_ID ?? "paw-diary-d8g3p4tlsb305221d",
  region: "ap-shanghai",
});
exports.main = async (event, context) => {
  try {
    const betaPolicy=readBetaPolicy(process.env);
    const principal = await resolvePrincipal(context, {
      betaPolicy,
      auth: app.auth(),
      getPlatformContext: cloudbase.getCloudbaseContext,
      authToken:event?.authToken,
      readVerifiedProof:uid=>createAuthStore({db:app.database()}).transaction(tx=>tx.get("p:"+uid)),
      readVerifiedProfile:createPlatformProfileLookup({environmentId:process.env.PAW_CLOUD_ENV_ID??"paw-diary-d8g3p4tlsb305221d",publishableKey:process.env.PAW_CLOUD_PUBLISHABLE_KEY}),
    });
    const request={...event};delete request.authToken;
    return await handleRequest(request, {
      principal,
      store: createCloudbaseStore({ db: app.database() }),
      storage: createCloudbaseStorage({ app }),
    });
  } catch(error) {
    return reviewedError(error);
  }
};
