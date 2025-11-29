import { createServerFn } from "@tanstack/react-start";
import { useAppSession } from "./-sessions/useSession";
import { createSignedToken, type SignedToken } from "../lib/tokens";
import type { SessionData } from "./-sessions/useSession";
import { logger } from "../lib/logger";


/**
 * Create an ephemeral token from session data.
 * This token can be used for temporary authentication/authorization.
 */
async function createEphemeralToken(sessionData: SessionData): Promise<SignedToken> {
  logger.info("Creating ephemeral token", { userId: sessionData.userId });
  return createSignedToken<SessionData>(sessionData);
}

export const getEphemeralTokenFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const session = await useAppSession();
    if (!session.data?.userId) {
      logger.warn("Unauthorized request for ephemeral token", { session: session.data });
      throw new Error("Unauthorized to get ephemeral token");
    }

    const sessionData: SessionData = {
      userId: session.data.userId,
      email: session.data.email ?? undefined,
      moderator: session.data.moderator ?? false,
    };

    logger.info("Generating ephemeral token for user", { userId: sessionData.userId });
    const token = await createEphemeralToken(sessionData);
    logger.debug("Ephemeral token generated", { userId: sessionData.userId });
    return token;
  },
);
