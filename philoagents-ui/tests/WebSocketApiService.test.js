import { beforeEach, describe, expect, it, vi } from "vitest";
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
