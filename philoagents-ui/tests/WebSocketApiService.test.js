import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import WebSocketApiService from "../src/services/WebSocketApiService";

function registerSpies() {
  const callbacks = {
    onMessage: vi.fn(),
    onChunk: vi.fn(),
    onStreamingStart: vi.fn(),
    onStreamingEnd: vi.fn(),
    onError: vi.fn(),
  };
  WebSocketApiService.registerCallbacks(callbacks);
  return callbacks;
}

const frame = (payload) => ({ data: JSON.stringify(payload) });

beforeEach(() => {
  WebSocketApiService.messageCallbacks.clear();
});

describe("handleMessage", () => {
  it("routes chunks, streaming flags, and the final response", () => {
    const cb = registerSpies();

    WebSocketApiService.handleMessage(frame({ streaming: true }));
    expect(cb.onStreamingStart).toHaveBeenCalled();

    WebSocketApiService.handleMessage(frame({ chunk: "Hello" }));
    expect(cb.onChunk).toHaveBeenCalledWith("Hello");

    WebSocketApiService.handleMessage(frame({ response: "Hello world", streaming: false }));
    // A response frame with streaming:false is treated as a streaming update.
    expect(cb.onStreamingEnd).toHaveBeenCalled();

    WebSocketApiService.handleMessage(frame({ response: "Hello world" }));
    expect(cb.onMessage).toHaveBeenCalledWith("Hello world");
  });

  it("surfaces server error frames via onError", () => {
    const cb = registerSpies();
    WebSocketApiService.handleMessage(frame({ error: "Message too large." }));
    expect(cb.onError).toHaveBeenCalledWith(new Error("Message too large."));
    expect(cb.onMessage).not.toHaveBeenCalled();
  });

  it("surfaces malformed frames via onError instead of throwing", () => {
    const cb = registerSpies();
    WebSocketApiService.handleMessage({ data: "not json{" });
    expect(cb.onError).toHaveBeenCalledWith(
      new Error("Received a malformed WebSocket frame")
    );
  });
});

describe("disconnect", () => {
  it("clears callbacks before closing so the deliberate close is silent", () => {
    const cb = registerSpies();
    const close = vi.fn(() => {
      // Simulate the browser firing onclose synchronously, as the service's
      // own onclose handler calls notifyError.
      WebSocketApiService.notifyError(new Error("WebSocket connection closed"));
    });
    WebSocketApiService.socket = { close };

    WebSocketApiService.disconnect();

    expect(close).toHaveBeenCalled();
    expect(cb.onError).not.toHaveBeenCalled();
    expect(WebSocketApiService.connected).toBe(false);
  });
});

describe("connection lifecycle", () => {
  let sockets;

  beforeEach(() => {
    vi.useFakeTimers();
    WebSocketApiService.disconnect();
    sockets = [];
    vi.stubGlobal("WebSocket", class {
      constructor() {
        this.close = vi.fn();
        this.send = vi.fn();
        sockets.push(this);
      }
    });
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    WebSocketApiService.disconnect();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("cancels a pending connection and ignores its events after reconnecting", async () => {
    const first = WebSocketApiService.connect();
    const cancelled = expect(first).rejects.toMatchObject({ name: "AbortError" });
    const stale = { open: sockets[0].onopen, close: sockets[0].onclose, message: sockets[0].onmessage };
    WebSocketApiService.disconnect();
    await cancelled;
    expect(sockets[0].close).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);

    const next = WebSocketApiService.connect();
    sockets[1].onopen();
    await next;
    const callbacks = registerSpies();
    stale.open();
    stale.close();
    stale.message(frame({ chunk: "Old reply" }));
    await vi.advanceTimersByTimeAsync(WebSocketApiService.connectionTimeout);
    expect(WebSocketApiService.socket).toBe(sockets[1]);
    expect(WebSocketApiService.connected).toBe(true);
    expect(callbacks.onChunk).not.toHaveBeenCalled();
    expect(callbacks.onError).not.toHaveBeenCalled();
  });

  it.each(["error", "close", "timeout"])("settles a failed connection on %s", async (failure) => {
    const pending = WebSocketApiService.connect();
    const rejected = expect(pending).rejects.toBeInstanceOf(Error);
    if (failure === "error") sockets[0].onerror(new Error("Offline"));
    else if (failure === "close") sockets[0].onclose();
    else await vi.advanceTimersByTimeAsync(WebSocketApiService.connectionTimeout);
    await rejected;
    expect(WebSocketApiService.socket).toBeNull();
    expect(WebSocketApiService.connectionPromise).toBeNull();
    expect(WebSocketApiService.connected).toBe(false);
    expect(vi.getTimerCount()).toBe(0);
  });
});
