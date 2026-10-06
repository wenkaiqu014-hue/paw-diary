const safeError = (code = "UNAVAILABLE") =>
  Object.assign(new Error("errors." + code.toLowerCase()), {
    code,
    messageKey: "errors." + code.toLowerCase(),
  });
const publicSession = (user) =>
  user &&
  typeof user.id === "string" &&
  user.id &&
  user.is_anonymous === false &&
  typeof user.email === "string" &&
  user.email &&
  typeof user.email_confirmed_at === "string" &&
  Number.isFinite(Date.parse(user.email_confirmed_at))
    ? { userId: user.id }
    : null;
export function createCloudbaseAuth({ app } = {}) {
  if (!app || typeof app.auth !== "function") throw safeError();
  const sdk = app.auth(),
    challenges = new Map();
  let counter = 0;
  return {
    async getSession() {
      const result = await sdk.getSession();
      if (result?.error) throw safeError("UNAUTHENTICATED");
      if (!result?.data?.session) return null;
      const fresh = await sdk.getUser();
      if (fresh?.error) throw safeError("UNAUTHENTICATED");
      return publicSession(fresh?.data?.user);
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
      if (result?.error) throw safeError("UNAUTHENTICATED");
      const session = publicSession(result?.data?.user);
      if (!session) throw safeError("UNAUTHENTICATED");
      challenges.delete(challenge.id);
      return session;
    },
    async signOut() {
      challenges.clear();
      await sdk.signOut();
    },
    subscribe(listener) {
      const subscription = sdk.onAuthStateChange((_event, session) =>
        listener(publicSession(session?.user)),
      );
      return () => subscription?.data?.subscription?.unsubscribe?.();
    },
  };
}
