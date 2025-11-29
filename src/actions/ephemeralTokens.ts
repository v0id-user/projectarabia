import { createServerFn } from "@tanstack/react-start";
import { useAppSession } from "./-sessions/useSession";
import { createSignedToken, type SignedToken } from "../lib/tokens";

type SessionData = {
  userId: string;
  email: string;
  moderator: boolean;
};

/**
 * Create an ephemeral token from session data.
 * This token can be used for temporary authentication/authorization.
 */
function createEphemeralToken(sessionData: SessionData): SignedToken {
  return createSignedToken<SessionData>(sessionData);
}

export const getEphemeralTokenFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await useAppSession();
    if (!session.data?.userId || !session.data?.email) {
      throw new Error("Unauthorized");
    }

    const sessionData: SessionData = {
      userId: session.data.userId,
      email: session.data.email,
      moderator: session.data.moderator ?? false,
    };

    const token = createEphemeralToken(sessionData);
    return token;
  },
);
