"use strict";
const { ApiError } = require("./workspace.cjs");
function createPlatformProfileLookup({
  environmentId,
  publishableKey,
  fetch: fetchProfile = globalThis.fetch,
} = {}) {
  if (
    typeof environmentId !== "string" ||
    !/^[a-z0-9-]{1,80}$/.test(environmentId)
  )
    throw new ApiError("UNAVAILABLE");
  const endpoint = `https://${environmentId}.api.tcloudbasegateway.com/auth/v1/user/me`;
  return async (authToken) => {
    if (
      typeof authToken !== "string" ||
      !authToken ||
      authToken.length > 8192 ||
      /[\s\x00-\x1f\x7f]/.test(authToken)
    )
      return null;
    if (
      typeof publishableKey !== "string" ||
      !publishableKey ||
      typeof fetchProfile !== "function"
    )
      throw new ApiError("UNAVAILABLE");
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 2000);
    try {
      // Authenticated SDK profile requests use Bearer rather than accessKey identity.
      // publishableKey fixes this server's configured public tenant; no invented key header.
      const response = await fetchProfile(endpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authToken}`,
          "X-TCB-Region": "ap-shanghai",
        },
        redirect: "error",
        signal: controller.signal,
      });
      if (response.status === 401 || response.status === 403) return null;
      if (!response.ok || !response.body) throw new ApiError("UNAVAILABLE");
      const reader = response.body.getReader(),
        chunks = [];
      let length = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > 65536) {
          await reader.cancel();
          throw new ApiError("UNAVAILABLE");
        }
        chunks.push(Buffer.from(value));
      }
      let profile;
      try {
        profile = JSON.parse(Buffer.concat(chunks, length).toString("utf8"));
      } catch {
        throw new ApiError("UNAVAILABLE");
      }
      if (
        !profile ||
        typeof profile !== "object" ||
        Array.isArray(profile) ||
        profile.error ||
        profile.code
      )
        return null;
      return profile;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      throw new ApiError("UNAVAILABLE");
    } finally {
      clearTimeout(timeout);
    }
  };
}
module.exports = { createPlatformProfileLookup };
