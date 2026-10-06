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
function publicSession(user, raw) {
  const rawId = raw?.sub ?? raw?.uid ?? raw?.id;
  return user &&
    typeof user.id === "string" &&
    user.id &&
    user.id === rawId &&
    user.is_anonymous === false &&
    raw?.is_anonymous !== true &&
    raw?.isAnonymous !== true &&
    raw?.email_verified === true &&
    typeof raw.email === "string" &&
    raw.email
    ? { userId: user.id }
    : null;
}
export function createCloudbaseAuth({ app } = {}) {
  if (!app || typeof app.auth !== "function") throw safeError();
  const sdk = app.auth(),
    challenges = new Map();
  let counter = 0,
    confirmedUserId = null,
    authEpoch = 0;
  const checked = async (user) => {
    if (typeof sdk.getUserInfo !== "function") throw safeError();
    let raw;
    try {
      raw = await sdk.getUserInfo();
    } catch (error) {
      throw authFailure(error);
    }
    return publicSession(user, raw);
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
      const principal = await checked(user);
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
          const value = await checked(user);
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
