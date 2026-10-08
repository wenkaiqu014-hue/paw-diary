const safeError = (code = "UNAVAILABLE") =>
  Object.assign(new Error("errors." + code.toLowerCase()), {
    code,
    messageKey: "errors." + code.toLowerCase(),
  });
const reviewedCodes = new Set(["BETA_CODE_REQUIRED", "BETA_CODE_INVALID", "BETA_ACCESS_REQUIRED", "BETA_CONFIG_INVALID", "RATE_LIMITED"]);
function authFailure(error) {
  const code = error?.code ?? error?.error;
  if (reviewedCodes.has(code)) {
    const failure = safeError(code), seconds = error?.params?.retryAfterSeconds;
    if (code === "RATE_LIMITED" && Number.isInteger(seconds) && seconds >= 0 && seconds <= 86400) failure.params = {retryAfterSeconds:seconds};
    return failure;
  }
  return error?.status === 401 ||
    error?.statusCode === 401 ||
    [
      "UNAUTHENTICATED",
      "unauthenticated",
      "token_expired",
      "invalid_access_token",
      "invalid_refresh_token",
      "user_not_found",
    ].includes(code)
    ? safeError("UNAUTHENTICATED")
    : safeError("UNAVAILABLE");
}
function publicSession(user, raw, requireVerified = true) {
  const rawId = raw?.sub ?? raw?.uid ?? raw?.id;
  return user &&
    typeof user.id === "string" &&
    user.id &&
    user.id === rawId &&
    user.is_anonymous === false &&
    raw?.is_anonymous !== true &&
    raw?.isAnonymous !== true &&
    (!requireVerified || raw?.email_verified === true) &&
    typeof raw.email === "string" &&
    raw.email
    ? { userId: user.id }
    : null;
}
export function createCloudbaseAuth({ app, invokeAuth, betaRequired = false } = {}) {
  if (betaRequired && typeof invokeAuth !== "function") throw safeError("BETA_CONFIG_INVALID");
  if (!app || typeof app.auth !== "function") throw safeError();
  const sdk = app.auth(),
    challenges = new Map(),
    pendingVerifications = new Set();
  let counter = 0,
    confirmedUserId = null,
    authEpoch = 0;
  const serverCall = async (action, payload, authToken) => {
    let reply;
    try { reply = await invokeAuth({action,payload,...(authToken?{authToken}:{})}); }
    catch(error) { throw authFailure(error); }
    if(reply?.ok!==true)throw authFailure(reply?.error??reply);
    return reply.data;
  };
  const checked = async (user, issuedSession) => {
    if (typeof sdk.getUserInfo !== "function") throw safeError();
    let raw;
    try {
      raw = await sdk.getUserInfo();
    } catch (error) {
      throw authFailure(error);
    }
    if(typeof invokeAuth!=="function")return publicSession(user, raw);
    const candidate=publicSession(user,raw,false);
    if(!candidate)return null;
    let session=issuedSession;
    if(!session){const result=await sdk.getSession();if(result?.error)throw authFailure(result.error);session=result?.data?.session;}
    if(typeof session?.access_token!=="string"||!session.access_token)return null;
    const status=await serverCall('auth.session',{},session.access_token);
    if(status?.principal?.userId!==candidate.userId)return null;
    const current=await sdk.getSession();if(current?.error)throw authFailure(current.error);
    const currentUser=current?.data?.user??current?.data?.session?.user;
    return currentUser?.id===candidate.userId&&currentUser.is_anonymous===false?candidate:null;
  };
  return {
    async getRequestSession() {
      const observed = authEpoch;
      const result = await sdk.getSession();
      if (result?.error) throw authFailure(result.error);
      const session = result?.data?.session,
        user = result?.data?.user ?? session?.user;
      if (
        !session ||
        typeof session.access_token !== "string" ||
        !session.access_token
      )
        return null;
      const principal = await checked(user, session);
      if (observed === authEpoch && principal)
        confirmedUserId = principal.userId;
      return principal ? { principal, authToken: session.access_token } : null;
    },
    async getSession() {
      const observed = authEpoch;
      const result = await sdk.getSession();
      if (result?.error) throw authFailure(result.error);
      if (!result?.data?.session) return null;
      const fresh = await sdk.getUser();
      if (fresh?.error) throw authFailure(fresh.error);
      const principal = await checked(fresh?.data?.user);
      if (observed === authEpoch && principal)
        confirmedUserId = principal.userId;
      return principal;
    },
    async requestEmailCode({ email, betaCode } = {}) {
      if (betaRequired && !betaCode) throw safeError("BETA_CODE_REQUIRED");
      if (betaRequired && (typeof betaCode !== "string" || !/^[0-9]{6}$/.test(betaCode))) throw safeError("BETA_CODE_INVALID");
      if (
        typeof email !== "string" ||
        email.length > 254 ||
        !/^\S+@\S+\.\S+$/.test(email.trim())
      )
        throw safeError("INVALID_INPUT");
      if(typeof invokeAuth==="function"){
        const reply=await serverCall('auth.requestEmailCode',{email:email.trim(),...(typeof betaCode==='string'?{betaCode}:{})});
        if(typeof reply?.id!=="string"||!reply.id||reply.id.length>256)throw safeError();
        challenges.set(reply.id,{server:true});return {id:reply.id};
      }
      const result = await sdk.signInWithOtp({
        email: email.trim(),
        options: { shouldCreateUser: true },
      });
      if (result?.error || typeof result?.data?.verifyOtp !== "function")
        throw safeError();
      const id =
        globalThis.crypto?.randomUUID?.() ??
        `challenge-${Date.now()}-${++counter}`;
      challenges.set(id, result.data.verifyOtp);
      return { id };
    },
    async verifyEmailCode({ challenge, code, betaCode } = {}) {
      if (betaRequired && !betaCode) throw safeError("BETA_CODE_REQUIRED");
      if (betaRequired && (typeof betaCode !== "string" || !/^[0-9]{6}$/.test(betaCode))) throw safeError("BETA_CODE_INVALID");
      const verify = challenges.get(challenge?.id);
      if (
        !verify ||
        typeof code !== "string" ||
        !/^[0-9]{4,10}$/.test(code.trim())
      )
        throw safeError("INVALID_INPUT");
      if(typeof invokeAuth==="function"){
        const observed=authEpoch;
        const reply=await serverCall('auth.verifyEmailCode',{id:challenge.id,code:code.trim(),...(typeof betaCode==='string'?{betaCode}:{})}),issued=reply?.session;
        if(typeof issued?.access_token!=="string"||!issued.access_token||typeof issued?.refresh_token!=="string"||!issued.refresh_token||typeof reply?.principal?.userId!=="string"||!reply.principal.userId||typeof sdk.setSession!=="function")throw safeError("UNAUTHENTICATED");
        if(observed!==authEpoch||challenges.get(challenge.id)!==verify)throw safeError("UNAUTHENTICATED");
        const credentials={access_token:issued.access_token,refresh_token:issued.refresh_token};
        // Preserve only platform-supplied OAuth routing/expiry metadata. Never
        // invent a token version or turn provider/profile fields into proof.
        for(const key of ['token_type','version','scope','expires_at','expires_in'])if(Object.hasOwn(issued,key))credentials[key]=issued[key];
        // setSession can deliver its own same-user auth events after resolving.
        // Remember every intervening foreign/empty identity, even if A returns.
        const verification={userId:reply.principal.userId,invalidated:false};
        pendingVerifications.add(verification);
        try{
          const installed=await sdk.setSession(credentials);if(installed?.error)throw authFailure(installed.error);
          // SDK 3.10.1 setSession/getSession reads getUser(false), so explicitly
          // refresh the normalized user before retaining a verification candidate.
          const fresh=await sdk.getUser(true);if(fresh?.error)throw authFailure(fresh.error);
          const current=await sdk.getSession();if(current?.error)throw authFailure(current.error);
          const user=fresh?.data?.user;
          const principal=await checked(user,current?.data?.session);
          if(verification.invalidated||challenges.get(challenge.id)!==verify||!principal||principal.userId!==reply.principal.userId)throw safeError("UNAUTHENTICATED");
          confirmedUserId=principal.userId;challenges.delete(challenge.id);return principal;
        }finally{pendingVerifications.delete(verification);}
      }
      const result = await verify({ token: code.trim() });
      if (result?.error) throw authFailure(result.error);
      const session = await checked(result?.data?.user);
      if (session) confirmedUserId = session.userId;
      if (!session) throw safeError("UNAUTHENTICATED");
      challenges.delete(challenge.id);
      return session;
    },
    async signOut() {
      challenges.clear();
      confirmedUserId = null;
      await sdk.signOut();
    },
    subscribe(listener) {
      let active = true,
        epoch = 0;
      const subscription = sdk.onAuthStateChange(async (_event, session) => {
        const current = ++epoch,
          user = session?.user;
        authEpoch++;
        for(const verification of pendingVerifications){
          if(!user||user.id!==verification.userId)verification.invalidated=true;
        }
        if (!user) {
          confirmedUserId = null;
          if (active) listener(null);
          return;
        }
        const switched =
          confirmedUserId !== null && confirmedUserId !== user.id;
        if (switched) {
          confirmedUserId = null;
          if (active) listener(null);
        }
        try {
          const value = await checked(user,session);
          if (!active || current !== epoch) return;
          confirmedUserId = value?.userId ?? null;
          listener(value);
        } catch (error) {
          if (!active || current !== epoch) return;
          if (["UNAUTHENTICATED","BETA_ACCESS_REQUIRED","BETA_CONFIG_INVALID"].includes(error.code)) {
            confirmedUserId = null;
            listener(null);
          } /* same-user transient failures preserve the last confirmed view and drafts */
        }
      });
      return () => {
        active = false;
        epoch++;
        subscription?.data?.subscription?.unsubscribe?.();
      };
    },
  };
}
