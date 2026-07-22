import { afterEach, describe, expect, test, vi } from "vitest";
import { ApiError, api } from "./api";

function mockFetch(status: number, body: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } })),
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("apiFetch error mapping", () => {
  test("429 native body surfaces status, _tag as code, and retryAfter", async () => {
    mockFetch(429, { _tag: "SpendoffRateLimited", message: "Too many attempts.", retryAfter: 42 });
    const err = await api.loginOptions({ email: "x@y.z" }).catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.status).toBe(429);
    expect(err.code).toBe("SpendoffRateLimited");
    expect(err.retryAfter).toBe(42);
  });

  test("frozen {error,message} body still maps error to code, no retryAfter", async () => {
    mockFetch(403, { error: "forbidden", message: "Nope." });
    const err = await api.loginOptions({ email: "x@y.z" }).catch((e) => e);
    expect(err.code).toBe("forbidden");
    expect(err.message).toBe("Nope.");
    expect(err.retryAfter).toBeUndefined();
  });
});
