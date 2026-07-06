import { describe, expect, it } from "vitest";
import { getApiBaseUrl, getWebSocketBaseUrl } from "../src/config";

// API_BASE_URL is not defined in tests, so resolution falls through to the
// window.location heuristics (the build-time override is baked in by webpack
// and can't change at runtime).

describe("getApiBaseUrl", () => {
  it("defaults to localhost:8000 over http", () => {
    window.location = { protocol: "http:", hostname: "localhost" };
    expect(getApiBaseUrl()).toBe("http://localhost:8000");
  });

  it("swaps the UI port for the API port under https (Codespaces)", () => {
    window.location = {
      protocol: "https:",
      hostname: "my-codespace-8080.app.github.dev",
    };
    expect(getApiBaseUrl()).toBe("https://my-codespace-8000.app.github.dev");
  });
});

describe("getWebSocketBaseUrl", () => {
  it("derives ws from http", () => {
    window.location = { protocol: "http:", hostname: "localhost" };
    expect(getWebSocketBaseUrl()).toBe("ws://localhost:8000");
  });

  it("derives wss from https", () => {
    window.location = {
      protocol: "https:",
      hostname: "my-codespace-8080.app.github.dev",
    };
    expect(getWebSocketBaseUrl()).toBe("wss://my-codespace-8000.app.github.dev");
  });
});
