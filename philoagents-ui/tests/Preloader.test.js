import { beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { Preloader } from "../src/scenes/Preloader";
import { AudioManager } from "../src/classes/AudioManager";

vi.mock("phaser", () => ({ Scene: class {} }));

function makePreloader() {
    const preloader = new Preloader();
    const menu = { events: new EventEmitter() };
    preloader.load = Object.assign(new EventEmitter(), {
        setPath: vi.fn(), image: vi.fn(), audio: vi.fn(),
        tilemapTiledJSON: vi.fn(), atlas: vi.fn(), start: vi.fn(),
    });
    preloader.game = { events: new EventEmitter() };
    preloader.scene = { get: vi.fn(() => menu), start: vi.fn(), launch: vi.fn(), stop: vi.fn() };
    preloader.children = { removeAll: vi.fn() };
    preloader.scale = { width: 1024, height: 768 };
    const rectangle = { setStrokeStyle: vi.fn().mockReturnThis(), setOrigin: vi.fn().mockReturnThis() };
    preloader.add = { rectangle: () => rectangle };
    return { preloader, menu };
}

it("preloads the compressed background without queuing gameplay music", () => {
    const { preloader } = makePreloader();
    preloader.preload();
    expect(preloader.load.image).toHaveBeenCalledWith("background", "hannibal_crossing_the_alps.webp");
    expect(preloader.load.audio).toHaveBeenCalledWith("ui-click", "audio/click.wav");
    expect(preloader.load.audio).not.toHaveBeenCalledWith("gameplay-music", expect.anything());
});

it("loads music after the menu renders and stops on completion", () => {
    const { preloader, menu } = makePreloader();
    preloader.preload();
    preloader.create();
    expect(preloader.scene.launch).toHaveBeenCalledWith("MainMenu");
    expect(preloader.scene.stop).not.toHaveBeenCalled();
    expect(preloader.children.removeAll).toHaveBeenCalledWith(true);
    expect(preloader.load.listenerCount("progress")).toBe(0);

    preloader.game.events.emit("postrender");
    expect(preloader.load.start).not.toHaveBeenCalled();
    menu.events.emit("create");
    expect(preloader.load.start).not.toHaveBeenCalled();
    preloader.game.events.emit("postrender");
    expect(preloader.load.audio).toHaveBeenCalledWith("gameplay-music", "audio/epic-theme.ogg");
    expect(preloader.load.start).toHaveBeenCalledOnce();

    // Leaving the menu does not stop the separate scene that owns this load.
    menu.events.emit("shutdown");
    preloader.game.events.emit("postrender");
    expect(preloader.scene.stop).not.toHaveBeenCalled();
    expect(preloader.load.start).toHaveBeenCalledOnce();
    preloader.load.emit("complete");
    expect(preloader.scene.stop).toHaveBeenCalledOnce();
});

let audio, game, cached, track;

beforeEach(() => {
    cached = new Set();
    track = { play: vi.fn(), stop: vi.fn() };
    game = {
        cache: { audio: { exists: key => cached.has(key), events: new EventEmitter() } },
        sound: { add: vi.fn(() => track), mute: false },
    };
    audio = new AudioManager(game);
});

function cacheAudio(key) {
    cached.add(key);
    game.cache.audio.events.emit("add", game.cache.audio, key, {});
}

it("waits for music requested before loading completes, preserving its playback options", () => {
    audio.playMusic("gameplay-music", false);
    expect(game.sound.add).not.toHaveBeenCalled();
    cacheAudio("ui-click");
    expect(game.sound.add).not.toHaveBeenCalled();
    cacheAudio("gameplay-music");
    expect(game.sound.add).toHaveBeenCalledExactlyOnceWith("gameplay-music", { loop: false, volume: 0.5 });
    expect(track.play).toHaveBeenCalledOnce();
});

it("does not autoplay loaded music until the player's first request", () => {
    cacheAudio("gameplay-music");
    expect(game.sound.add).not.toHaveBeenCalled();
    audio.playMusic("gameplay-music");
    expect(track.play).toHaveBeenCalledOnce();
    audio.playMusic("gameplay-music");
    expect(track.stop).toHaveBeenCalledOnce();
});
