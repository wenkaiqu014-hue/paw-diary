"use strict";
const { ApiError } = require("./workspace.cjs");
function createCloudbaseStorage({
  app,
  fetch: fetchFile = globalThis.fetch,
  readTimeoutMs = 2500,
} = {}) {
  if (!app) throw new ApiError("UNAVAILABLE");
  return {
    async prepare(cloudPath) {
      const result = await app.getUploadMetadata({ cloudPath });
      const data = result?.data;
      if (!data?.fileId || !data.url || !data.authorization || !data.token)
        throw new ApiError("UNAVAILABLE");
      return {
        fileRef: data.fileId,
        upload: {
          url: data.url,
          method: "PUT",
          headers: {
            Signature: data.authorization,
            "x-cos-security-token": data.token,
            "x-cos-meta-fileid": data.cosFileId,
            authorization: data.authorization,
            key: encodeURIComponent(cloudPath),
          },
        },
      };
    },
    async downloadUrl(fileRef){const reply=await app.getTempFileURL({fileList:[{fileID:fileRef,maxAge:60}]});const file=reply?.fileList?.[0];if(!file||file.code&&file.code!=="SUCCESS"||typeof file.tempFileURL!=="string"||!file.tempFileURL.startsWith("https://"))throw new ApiError("UNAVAILABLE");return {downloadUrl:file.tempFileURL,expiresIn:60};},
    async read(fileRef, maxBytes = 1024 * 1024) {
      const info = await app.getFileInfo({ fileList: [fileRef] });
      const file = info?.fileList?.[0];
      if (
        !file ||
        (file.code && file.code !== "SUCCESS") ||
        !Number.isFinite(file.size) ||
        file.size <= 0 ||
        file.size > maxBytes
      )
        throw new ApiError("INVALID_INPUT", "errors.invalidImage");
      // The signed URL stays inside this server adapter. SDK downloadFile buffers
      // the whole body; a bounded reader also protects against growth after HEAD.
      if (
        typeof fetchFile !== "function" ||
        typeof file.tempFileURL !== "string" ||
        !file.tempFileURL.startsWith("https://")
      )
        throw new ApiError("UNAVAILABLE");
      const controller = new AbortController(),
        timeout = setTimeout(() => controller.abort(), readTimeoutMs);
      try {
        const response = await fetchFile(file.tempFileURL, {
          signal: controller.signal,
          redirect: "error",
        });
        if (!response.ok || !response.body) throw new ApiError("UNAVAILABLE");
        const reader = response.body.getReader(),
          chunks = [];
        let length = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          length += value.byteLength;
          if (length > maxBytes) {
            await reader.cancel();
            throw new ApiError("INVALID_INPUT", "errors.invalidImage");
          }
          chunks.push(Buffer.from(value));
        }
        if (length === 0)
          throw new ApiError("INVALID_INPUT", "errors.invalidImage");
        return Buffer.concat(chunks, length);
      } finally {
        clearTimeout(timeout);
      }
    },
    async remove(fileRef) {
      const result = await app.deleteFile({ fileList: [fileRef] });
      const file = result?.fileList?.[0];
      if(file?.code==='SUCCESS')return;
      // A failed delete is not quota release. Only an authenticated, server-only
      // signed HEAD proving 404 can confirm an object was never uploaded.
      const info=await app.getFileInfo({fileList:[fileRef]}),metadata=info?.fileList?.[0];
      if(metadata?.code==='SUCCESS'&&typeof metadata.tempFileURL==='string'&&metadata.tempFileURL.startsWith('https://')&&typeof fetchFile==='function'){
        const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),1500);
        try{const head=await fetchFile(metadata.tempFileURL,{method:'HEAD',redirect:'error',signal:controller.signal});if(head.status===404)return;}finally{clearTimeout(timeout);}
      }
      throw new ApiError("UNAVAILABLE");
    },
  };
}
module.exports = { createCloudbaseStorage };
