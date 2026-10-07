"use strict";
// Context and auth must come from the platform SDK, never request.payload.
async function resolvePrincipal(
  context,
  { auth, getPlatformContext, readVerifiedProfile, readVerifiedProof, authToken } = {},
) {
  if (!auth) return null;
  const trusted = await auth.getAuthContext(context),
    user = auth.getUserInfo();
  const platform =
    typeof getPlatformContext === "function"
      ? getPlatformContext(context)
      : null;
  const platformUid = platform?.TCB_UUID ?? user?.uid;
  const anonymous = platform
    ? platform.TCB_ISANONYMOUS_USER === "true"
      ? true
      : platform.TCB_ISANONYMOUS_USER === "false"
        ? false
        : null
    : user?.isAnonymous;
  if (!trusted?.uid || trusted.uid !== platformUid || anonymous !== false)
    return null;
  if (typeof readVerifiedProfile === "function") {
    const credential = context?.extendedContext?.accessToken ?? authToken;
    if (typeof credential !== "string" || !credential) return null;
    const profile = await readVerifiedProfile(credential);
    if (
      !profile ||
      (profile.sub ?? profile.uid ?? profile.id) !== trusted.uid ||
      typeof profile.email !== "string" ||
      !profile.email.trim() ||
      profile.is_anonymous === true ||
      profile.isAnonymous === true
    )
      return null;
    if (profile.email_verified !== true) {
      const proof = typeof readVerifiedProof === 'function' ? await readVerifiedProof(trusted.uid) : null;
      if (!proof || proof.kind !== 'verified' || proof.ownerId !== trusted.uid ||
          proof.emailHash !== require('./email-auth.cjs').emailHash(profile.email) ||
          typeof proof.verifiedAt !== 'string' || !Number.isFinite(Date.parse(proof.verifiedAt))) return null;
    }
    return { userId: trusted.uid, emailVerified: true, isAnonymous: false };
  }
  const result = await auth.getEndUserInfo(trusted.uid);
  if (result?.code) return null;
  const record = result?.userInfo;
  if (
    !record ||
    (record.sub ?? record.uid) !== trusted.uid ||
    record.isAnonymous === true ||
    record.is_anonymous === true ||
    typeof record.email !== "string" ||
    !record.email.trim() ||
    !(record.email_verified === true || record.emailVerified === true)
  )
    return null;
  return { userId: trusted.uid, emailVerified: true, isAnonymous: false };
}
module.exports = { resolvePrincipal };
