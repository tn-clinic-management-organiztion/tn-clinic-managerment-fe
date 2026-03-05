import { BackendResponse } from "@/types/backend-response";
import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

type BackendLoginResponse = {
  access_token: string;
  refresh_token: string;
};

type JwtPayloadFromBackend = {
  sub: string;
  user_type?: "STAFF" | "PATIENT" | "ADMIN";
  role?: string;
  staff_id?: string;
  patient_id?: string;
  username?: string;
  assigned_room_id?: number;
};

function decodeJwtPayload(token: string): JwtPayloadFromBackend | null {
  try {
    const payloadPart = token.split(".")[1];
    if (!payloadPart) return null;

    const json = Buffer.from(payloadPart, "base64url").toString("utf8");
    return JSON.parse(json);
  } catch (e) {
    console.error("decodeJwtPayload failed:", e);
    return null;
  }
}

async function backendLogin(
  username: string,
  password: string
): Promise<BackendLoginResponse> {
  const res = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    cache: "no-store",
  });

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Login failed: ${res.status} ${msg}`);
  }

  const response: BackendResponse<BackendLoginResponse> = await res.json();
  return response.data;
}

async function backendRefresh(
  refreshToken: string
): Promise<BackendLoginResponse> {
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URL}/auth/refresh`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // RefreshTokenDto { refresh_token }
      body: JSON.stringify({ refresh_token: refreshToken }),
      cache: "no-store",
    }
  );

  if (!res.ok) {
    const msg = await res.text().catch(() => "");
    throw new Error(`Refresh failed: ${res.status} ${msg}`);
  }

  const response: BackendResponse<BackendLoginResponse> = await res.json();
  return response.data;
}

// Lấy exp (seconds) từ JWT access token
function getAccessTokenExpiryMs(accessToken: string): number | null {
  const payload = decodeJwtPayload(accessToken);
  // exp theo chuẩn JWT (seconds)
  const exp = (payload as any)?.exp as number | undefined;
  if (!exp) return null;
  return exp * 1000;
}

export const authConfig: NextAuthConfig = {
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        username: { label: "Username", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(creds) {
        const username = String(creds?.username ?? "");
        const password = String(creds?.password ?? "");

        if (!username || !password) return null;

        const tokens = await backendLogin(username, password);
        const payload = decodeJwtPayload(tokens.access_token);

        if (!payload?.sub) return null;

        console.log("payload from backend:", payload);

        // NextAuth "user" object -> đưa data cần dùng vào đây
        return {
          id: payload.sub,
          username: payload.username ?? username,
          user_type: payload.user_type ?? "STAFF",
          role: payload.role,
          staff_id: payload.staff_id,
          patient_id: payload.patient_id,
          assigned_room_id: payload.assigned_room_id,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          access_token_expires_at: getAccessTokenExpiryMs(tokens.access_token),
        } as any;
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // JWT callback
    async jwt({ token, user }) {
      if (user) {
        token.user = {
          id: (user as any).id,
          username: (user as any).username,
          user_type: (user as any).user_type,
          role: (user as any).role,
          staff_id: (user as any).staff_id,
          patient_id: (user as any).patient_id,
          assigned_room_id: (user as any).assigned_room_id,
        };

        token.access_token = (user as any).access_token;
        token.refresh_token = (user as any).refresh_token;
        token.access_token_expires_at = (user as any).access_token_expires_at;

        return token;
      }

      // Nếu chưa có token gì => coi như chưa login
      if (!token.access_token || !token.refresh_token) return token;

      // Nếu còn hạn => ok
      const expiresAt = Number(token.access_token_expires_at ?? 0);
      const now = Date.now();

      // Trừ hao 30s tránh “vừa hết hạn”
      if (expiresAt && now < expiresAt - 30_000) return token;

      // Hết hạn => refresh
      try {
        const refreshed = await backendRefresh(String(token.refresh_token));

        token.access_token = refreshed.access_token;
        token.refresh_token = refreshed.refresh_token;
        token.access_token_expires_at = getAccessTokenExpiryMs(
          refreshed.access_token
        );
        const payload = decodeJwtPayload(refreshed.access_token);
        if (payload?.sub) {
          token.user = {
            ...(token.user as any),
            id: payload.sub,
            user_type: payload.user_type ?? (token.user as any)?.user_type,
            role: payload.role ?? (token.user as any)?.role,
            staff_id: payload.staff_id ?? (token.user as any)?.staff_id,
            patient_id: payload.patient_id ?? (token.user as any)?.patient_id,
            username: payload.username ?? (token.user as any)?.username,
            assigned_room_id:
              payload.assigned_room_id ?? (token.user as any)?.assigned_room_id,
          };
        }

        return token;
      } catch {
        (token as any).error = "RefreshAccessTokenError";
        return token;
      }
    },

    async session({ session, token }) {
      (session as any).user = token.user ?? null;
      (session as any).access_token = token.access_token ?? null;
      (session as any).error = (token as any).error ?? null;
      return session;
    },

    // Authorized callback
    authorized({ auth, request }) {
      const pathname = request.nextUrl.pathname;

      // Public routes
      if (pathname.startsWith("/login")) return true;

      // Any protected group must have session
      return !!auth?.user;
    },
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);
