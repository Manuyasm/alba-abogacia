import { describe, expect, it, vi } from "vitest";
import { verifyCaptchaToken } from "./verify";

const config = {
  apiUrl: "https://cap.alba-abogacia.es",
  siteKey: "d9256640cb53",
  secretKey: "test-secret-key",
};

describe("verifyCaptchaToken", () => {
  it("accepts a valid token on first use", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    const result = await verifyCaptchaToken(
      "d9256640cb53:challenge:solution",
      config,
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ success: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const call = fetchMock.mock.calls.at(0);
    if (!call) throw new Error("fetch was not called");
    const [url, init] = call;
    expect(url).toBe("https://cap.alba-abogacia.es/d9256640cb53/siteverify");
    expect(init.method).toBe("POST");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({
      secret: "test-secret-key",
      response: "d9256640cb53:challenge:solution",
    });
  });

  it("rejects a reused token (Cap consumes tokens atomically on first verify)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      json: async () => ({ success: false, error: "Token not found" }),
    });

    const result = await verifyCaptchaToken(
      "d9256640cb53:challenge:solution",
      config,
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ success: false, reason: "invalid_token" });
  });

  it("rejects a missing token without calling Cap", async () => {
    const fetchMock = vi.fn();

    const result = await verifyCaptchaToken("", config, fetchMock as unknown as typeof fetch);

    expect(result).toEqual({ success: false, reason: "missing_token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed token without calling Cap", async () => {
    const fetchMock = vi.fn();

    const result = await verifyCaptchaToken(
      "not-a-real-token",
      config,
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ success: false, reason: "missing_token" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns a generic failure when the Cap instance is unreachable", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));

    const result = await verifyCaptchaToken(
      "d9256640cb53:challenge:solution",
      config,
      fetchMock as unknown as typeof fetch,
    );

    expect(result).toEqual({ success: false, reason: "network_error" });
  });
});
