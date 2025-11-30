import { useSession } from "@tanstack/react-start/server";

export type SessionData = {
  userId: string;
  email?: string;
  moderator: boolean;
};

export function useAppSession() {
  return useSession<SessionData>({
    name: "arabian-session",
    password: process.env.SESSION_SECRET,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      httpOnly: true,
    },
  });
}
