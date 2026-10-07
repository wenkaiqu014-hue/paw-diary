const safeError = (code = "UNAVAILABLE") =>
  Object.assign(new Error("errors." + code.toLowerCase()), {
    code,
    messageKey: "errors." + code.toLowerCase(),
  });
function authFailure(error) {
  const code = error?.code ?? error?.error;
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
export function createCloudbaseAuth({ app, invokeAuth } = {}) {
  if (!app || typeof app.auth !== "function") throw safeError();
  const sdk = app.auth(),
    challenges = new Map();
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
    async requestEmailCode({ email } = {}) {
      if (
        typeof email !== "string" ||
        email.length > 254 ||
        !/^\S+@\S+\.\S+$/.test(email.trim())
      )
        throw safeError("INVALID_INPUT");
      if(typeof invokeAuth==="function"){
        const reply=await serverCall('auth.requestEmailCode',{email:email.trim()});
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
    async verifyEmailCode({ challenge, code } = {}) {
      const verify = challenges.get(challenge?.id);
      if (
        !verify ||
        typeof code !== "string" ||
        !/^[0-9]{4,10}$/.test(code.trim())
      )
        throw safeError("INVALID_INPUT");
      if(typeof invokeAuth==="function"){
        const observed=authEpoch;
        const reply=await serverCall('auth.verifyEmailCode',{id:challenge.id,code:code.trim()}),issued=reply?.session;
        if(typeof issued?.access_token!=="string"||!issued.access_token||typeof issued?.refresh_token!=="string"||!issued.refresh_token||typeof reply?.principal?.userId!=="string"||!reply.principal.userId||typeof sdk.setSession!=="function")throw safeError("UNAUTHENTICATED");
        if(observed!==authEpoch||challenges.get(challenge.id)!==verify)throw safeError("UNAUTHENTICATED");
        const installed=await sdk.setSession({access_token:issued.access_token,refresh_token:issued.refresh_token});if(installed?.error)throw authFailure(installed.error);
        const installedEpoch=authEpoch;
        // SDK 3.10.1 setSession/getSession reads getUser(false), so explicitly
        // refresh the normalized user before retaining a verification candidate.
        const fresh=await sdk.getUser(true);if(fresh?.error)throw authFailure(fresh.error);
        const current=await sdk.getSession();if(current?.error)throw authFailure(current.error);
        const user=fresh?.data?.user;
        const principal=await checked(user,current?.data?.session);
        if(installedEpoch!==authEpoch||!principal||principal.userId!==reply.principal.userId)throw safeError("UNAUTHENTICATED");
        confirmedUserId=principal.userId;challenges.delete(challenge.id);return principal;
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
          if (error.code === "UNAUTHENTICATED") {
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
