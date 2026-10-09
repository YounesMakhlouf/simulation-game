import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import DialogueManager from "../src/classes/DialogueManager";
import ApiService from "../src/services/ApiService";
import WebSocketApiService from "../src/services/WebSocketApiService";
import { STREAM_IDLE_TIMEOUT_MS } from "../src/config";

vi.mock("../src/services/ApiService", () => ({ default: { sendMessage: vi.fn() } }));
vi.mock("../src/services/WebSocketApiService", () => ({
    default: { connect: vi.fn(), sendMessage: vi.fn(), disconnect: vi.fn() },
}));

let manager, scene, box, exchanges;

function deferred() {
    let resolve;
    const promise = new Promise((done) => { resolve = done; });
    return { promise, resolve };
}

beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
    scene = {
        input: { keyboard: new EventEmitter() },
        events: new EventEmitter(),
        time: { addEvent: vi.fn(() => ({ remove: vi.fn() })) },
        playerConfig: { name: "You" },
    };
    let visible = false;
    box = {
        show: vi.fn(() => { visible = true; }),
        hide: vi.fn(() => { visible = false; }),
        setSpeaker: vi.fn(),
        isVisible: () => visible,
    };
    exchanges = [];
    WebSocketApiService.connect.mockResolvedValue();
    WebSocketApiService.sendMessage.mockImplementation(async (...args) => {
        exchanges.push(args[3]);
    });
    ApiService.sendMessage.mockResolvedValue("Hello");
    manager = new DialogueManager(scene);
    manager.initialize(box);
    manager.startDialogue("scipio", { id: "hannibal", name: "Hannibal" });
    manager.currentMessage = "Hi";
});

afterEach(() => {
    manager.destroy?.();
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
});

it("ignores repeated Enter and further input until the exchange finishes", async () => {
    const connecting = deferred();
    WebSocketApiService.connect.mockReturnValueOnce(connecting.promise);
    const pending = manager.handleEnterKey();
    expect(manager.isTyping).toBe(false);
    scene.input.keyboard.emit("keydown", { key: "Enter" });
    scene.input.keyboard.emit("keydown", { key: "x" });
    await manager.handleEnterKey();
    await manager.handleKeyPress({ key: "x" });
    expect(WebSocketApiService.connect).toHaveBeenCalledTimes(1);

    connecting.resolve();
    await vi.advanceTimersByTimeAsync(0);
    await manager.handleEnterKey();
    manager.continueDialogue();
    manager.continueDialogue();
    expect(manager.isTyping).toBe(false);
    expect(WebSocketApiService.sendMessage).toHaveBeenCalledTimes(1);
    exchanges[0].onChunk("Hello");
    exchanges[0].onStreamingEnd();
    await pending;
    expect(box.show).toHaveBeenLastCalledWith("Hello", true);

    manager.continueDialogue();
    manager.currentMessage = "Another message";
    const next = manager.handleEnterKey();
    await vi.advanceTimersByTimeAsync(0);
    expect(WebSocketApiService.sendMessage).toHaveBeenCalledTimes(2);
    exchanges[1].onStreamingEnd();
    await next;
});

it("lets Escape close dialogue while a response is pending", async () => {
    const pending = manager.handleEnterKey();
    await vi.advanceTimersByTimeAsync(0);
    scene.input.keyboard.emit("keydown", { key: "Escape" });
    await pending;
    expect(box.isVisible()).toBe(false);
    expect(ApiService.sendMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});

it("does not send or clean up a newer exchange after an old connection resolves", async () => {
    const connecting = deferred();
    WebSocketApiService.connect.mockReturnValueOnce(connecting.promise);
    const old = manager.handleEnterKey();
    manager.closeDialogue();
    manager.startDialogue("scipio", { id: "hanno", name: "Hanno" });
    manager.currentMessage = "New conversation";
    const next = manager.handleEnterKey();
    await vi.advanceTimersByTimeAsync(0);
    const disconnects = WebSocketApiService.disconnect.mock.calls.length;

    connecting.resolve();
    await old;
    expect(WebSocketApiService.sendMessage).toHaveBeenCalledTimes(1);
    expect(WebSocketApiService.sendMessage.mock.calls[0].slice(0, 3))
        .toEqual(["scipio", "hanno", "New conversation"]);
    expect(WebSocketApiService.disconnect).toHaveBeenCalledTimes(disconnects);
    expect(ApiService.sendMessage).not.toHaveBeenCalled();
    manager.continueDialogue();
    expect(manager.isTyping).toBe(false);
    exchanges[0].onStreamingEnd();
    await next;
});

it.each(["shutdown", "destroy"])("cancels streaming and keyboard listeners on scene %s", async (event) => {
    const pending = manager.handleEnterKey();
    await vi.advanceTimersByTimeAsync(0);
    const callbacks = exchanges[0];
    scene.events.emit(event);
    await pending;
    const updates = box.show.mock.calls.length;

    callbacks.onChunk("Stale reply");
    callbacks.onStreamingStart();
    callbacks.onStreamingEnd();
    callbacks.onError(new Error("Late failure"));
    await vi.advanceTimersByTimeAsync(STREAM_IDLE_TIMEOUT_MS + 5000);
    expect(box.show).toHaveBeenCalledTimes(updates);
    expect(box.isVisible()).toBe(false);
    expect(scene.input.keyboard.listenerCount("keydown")).toBe(0);
    expect(scene.events.listenerCount("shutdown")).toBe(0);
    expect(scene.events.listenerCount("destroy")).toBe(0);
    expect(ApiService.sendMessage).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
});

it("aborts an HTTP fallback and ignores its late response after reopening dialogue", async () => {
    const response = deferred();
    WebSocketApiService.connect.mockRejectedValueOnce(new Error("Offline"));
    ApiService.sendMessage.mockReturnValueOnce(response.promise);
    const pending = manager.handleEnterKey();
    await vi.advanceTimersByTimeAsync(0);
    const signal = ApiService.sendMessage.mock.calls[0][3];

    manager.closeDialogue();
    expect(signal.aborted).toBe(true);
    manager.startDialogue("scipio", { id: "hanno", name: "Hanno" });
    const updates = box.show.mock.calls.length;
    response.resolve("Stale HTTP reply");
    await pending;
    expect(box.show).toHaveBeenCalledTimes(updates);
    expect(manager.isTyping).toBe(true);
    expect(vi.getTimerCount()).toBe(0);
});

it("cancels a default reply's animation timer when dialogue closes", async () => {
    manager.activeDelegate.defaultMessage = "Default reply";
    const pending = manager.handleEnterKey();
    await vi.advanceTimersByTimeAsync(30);
    manager.closeDialogue();
    const updates = box.show.mock.calls.length;
    await pending;
    expect(box.show).toHaveBeenCalledTimes(updates);
    expect(vi.getTimerCount()).toBe(0);
    expect(WebSocketApiService.connect).not.toHaveBeenCalled();
});

it("falls back after a silent stream", async () => {
    const pending = manager.handleEnterKey();
    await vi.advanceTimersByTimeAsync(STREAM_IDLE_TIMEOUT_MS + 1000);
    await pending;
    expect(ApiService.sendMessage).toHaveBeenCalledTimes(1);
    expect(box.show).toHaveBeenLastCalledWith("Hello", true);
});

it.each(["server error", "timeout"])("marks a streamed reply incomplete after %s without resending", async (failure) => {
    const pending = manager.handleEnterKey();
    await vi.advanceTimersByTimeAsync(0);
    exchanges[0].onChunk("I agree to your offer.");
    if (failure === "server error") {
        exchanges[0].onError(new Error("Conversation could not be saved."));
    } else {
        await vi.advanceTimersByTimeAsync(STREAM_IDLE_TIMEOUT_MS);
    }
    await pending;
    expect(ApiService.sendMessage).not.toHaveBeenCalled();
    expect(box.show).toHaveBeenLastCalledWith("Conversation could not be completed. Please try again.", true);
    expect(manager.isStreaming).toBe(false);
    expect(manager.exchangeController).toBeNull();
    expect(vi.getTimerCount()).toBe(0);
    const updates = box.show.mock.calls.length;
    exchanges[0].onStreamingEnd();
    expect(box.show).toHaveBeenCalledTimes(updates);
});
