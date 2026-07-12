import { createContext, type AppContext } from "../src/context.js";
import { createApp } from "../src/app.js";

export async function testApp() {
  const ctx = await createContext({ dbUrl: process.env.OPENLOCALE_TEST_PG === "1" || process.env.OPENLOCALE_TEST_PG_URL
    ? (process.env.OPENLOCALE_TEST_PG_URL ?? "postgres://openlocale:openlocale@localhost:5433/openlocale")
    : ":memory:" });
  const app = createApp(async () => ctx);
  return { app, ctx };
}

/** Sign up via Better Auth and return a Cookie header for subsequent requests. */
export async function signUp(
  app: Awaited<ReturnType<typeof testApp>>["app"],
  email: string,
  password = "password1234",
  name = "Test User"
): Promise<string> {
  const res = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, name })
  });
  if (res.status !== 200) {
    throw new Error(`sign-up failed: ${res.status} ${await res.text()}`);
  }
  const setCookies = res.headers.getSetCookie?.() ?? [res.headers.get("set-cookie") ?? ""];
  return setCookies.map((c) => c.split(";")[0]).join("; ");
}

export async function cleanup(ctx: AppContext) {
  await ctx.handle.close();
}
