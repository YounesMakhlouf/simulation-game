import { afterEach, beforeEach, expect, it, vi } from "vitest";
import ApiService from "../src/services/ApiService";
import { REQUEST_TIMEOUT_MS } from "../src/config";

beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(AbortSignal, "timeout").mockImplementation((delay) => {
        const controller = new AbortController();
        setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), delay);
        return controller.signal;
    });
});

afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

function mockScoresRequest(timeoutMs, scores, delay) {
    const fetchMock = vi.fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ scoring_timeout_ms: timeoutMs }) })
        .mockImplementationOnce((url, options) => new Promise((resolve, reject) => {
            options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
            if (delay !== undefined) {
                setTimeout(() => resolve({ ok: true, json: async () => scores }), delay);
            }
        }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
}

it("waits beyond the ordinary timeout using the server's scoring budget", async () => {
    const scores = { scores: { scipio: { undergame_score: 20 } } };
    const fetchMock = mockScoresRequest(210000, scores, 20000);
    const result = ApiService.submitGuessAndGetScores("hannibal", "My theory");
    await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS);
    expect(AbortSignal.timeout).toHaveBeenNthCalledWith(1, REQUEST_TIMEOUT_MS);
    expect(AbortSignal.timeout).toHaveBeenNthCalledWith(2, 210000);
    const [url, options] = fetchMock.mock.calls[1];
    expect(url).toMatch(/\/game\/end$/);
    expect(options.signal.aborted).toBe(false);
    expect(JSON.parse(options.body)).toEqual({ player_character_id: "hannibal", undergame_guess: "My theory" });
    await vi.advanceTimersByTimeAsync(5000);
    expect(await result).toEqual(scores);
});

it("reports the actual scoring timeout when the server does not finish", async () => {
    mockScoresRequest(50000);
    const result = ApiService.submitGuessAndGetScores("hannibal", "My theory");
    const rejected = expect(result).rejects.toThrow("Request to /game/end timed out after 50000ms");
    await vi.advanceTimersByTimeAsync(50000);
    await rejected;
});

it.each([undefined, 0, -1, "150000"])("rejects an invalid server scoring timeout: %s", async (timeoutMs) => {
    const fetchMock = mockScoresRequest(timeoutMs);
    await expect(ApiService.submitGuessAndGetScores("hannibal", "My theory"))
        .rejects.toThrow("Server returned an invalid scoring timeout.");
    expect(fetchMock).toHaveBeenCalledTimes(1);
});

it("aborts an in-flight chat request without returning fallback dialogue", async () => {
    const controller = new AbortController();
    const fetchMock = vi.fn((url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
    }));
    vi.stubGlobal("fetch", fetchMock);
    const pending = ApiService.sendMessage("scipio", "hannibal", "Hi", controller.signal);
    const cancelled = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    await cancelled;
    expect(fetchMock.mock.calls[0][1].signal.aborted).toBe(true);
    expect(console.error).not.toHaveBeenCalled();
});

it("does not start a chat request that was already cancelled", async () => {
    const controller = new AbortController();
    controller.abort();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await expect(ApiService.sendMessage("scipio", "hannibal", "Hi", controller.signal))
        .rejects.toMatchObject({ name: "AbortError" });
    expect(fetchMock).not.toHaveBeenCalled();
});
