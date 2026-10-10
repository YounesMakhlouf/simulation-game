import { beforeEach, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { MainMenu } from "../src/scenes/MainMenu";
import { CharacterSelect } from "../src/scenes/CharacterSelect";
import ApiService from "../src/services/ApiService";
import { createPresetButton } from "../src/classes/ButtonFactory";

vi.mock("phaser", () => ({ Scene: class {} }));
vi.mock("../src/classes/KeyboardButton", () => ({ addKeyboardButton: vi.fn() }));
vi.mock("../src/classes/ButtonFactory", () => ({ createPresetButton: vi.fn() }));
vi.mock("../src/services/ApiService", () => ({ default: { getSession: vi.fn(), request: vi.fn(), resetGame: vi.fn(), startGame: vi.fn() } }));

function object() {
    return {
        text: "", visible: true, node: { style: {}, innerHTML: "" },
        setText: vi.fn(function (value) { this.text = value; return this; }),
        setVisible: vi.fn(function (value) { this.visible = value; return this; }),
        setOrigin: vi.fn().mockReturnThis(), setColor: vi.fn().mockReturnThis(),
        setDisplaySize: vi.fn().mockReturnThis(), setAlpha: vi.fn().mockReturnThis(),
        setInteractive: vi.fn().mockReturnThis(), disableInteractive: vi.fn().mockReturnThis(),
        destroy: vi.fn(),
    };
}

function prepare(SceneClass) {
    const scene = new SceneClass();
    scene.events = new EventEmitter();
    scene.cameras = { main: { width: 1024 } };
    scene.scale = { width: 1024, height: 768 };
    scene.scene = { isActive: () => true, start: vi.fn(), launch: vi.fn() };
    scene.input = { enabled: true, once: vi.fn(), keyboard: { on: vi.fn() } };
    scene.add = { image: () => object(), text: (x, y, text) => Object.assign(object(), { text }) };
    return scene;
}

function deferred() {
    let resolve, reject;
    const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
    return { promise, resolve, reject };
}

const saved = { player_character_id: "hannibal", player_character_name: "Hannibal Barca", round_number: 4 };
const character = { id: "hannibal", name: "Hannibal Barca", title: "General", strengths: "Veteran troops", objectives: "Secure a port" };

beforeEach(() => {
    vi.resetAllMocks();
    createPresetButton.mockImplementation((scene, preset, x, y, text, onClick) => ({
        container: object(), label: Object.assign(object(), { text }), onClick,
    }));
});

it("shows a session-loading state and offers retry without assuming there is no save", async () => {
    const menu = prepare(MainMenu);
    const request = deferred();
    ApiService.getSession.mockReturnValueOnce(request.promise).mockResolvedValueOnce(saved);
    menu.create();
    expect(menu.statusText.text).toBe("Loading saved game...");
    expect(menu.playButtons).toEqual([]);
    expect(menu.retryButton.visible).toBe(false);
    request.reject(new Error("offline"));
    await vi.waitFor(() => expect(menu.retryButton.visible).toBe(true));
    expect(menu.statusText.text).toContain("Could not check");
    expect(menu.playButtons).toEqual([]);
    await menu.loadSession();
    expect(menu.statusText.text).toContain("Hannibal Barca · Round 4");
    expect(menu.retryButton.visible).toBe(false);
    expect(menu.playButtons).toHaveLength(2);
    const continueIndex = createPresetButton.mock.calls.findIndex(call => call[4] === "Continue");
    createPresetButton.mock.results[continueIndex].value.onClick();
    expect(menu.scene.start).toHaveBeenCalledWith("Game", { characterId: "hannibal" });
});

it("checks the session again after a lost reset response, preventing stale Continue", async () => {
    const menu = prepare(MainMenu);
    ApiService.getSession.mockResolvedValueOnce(saved).mockResolvedValueOnce({ player_character_id: null, player_character_name: null, round_number: 1 });
    const reset = deferred();
    ApiService.resetGame.mockReturnValue(reset.promise);
    menu.create();
    await vi.waitFor(() => expect(menu.playButtons).toHaveLength(2));
    const oldButtons = [...menu.playButtons];
    const index = createPresetButton.mock.calls.findIndex(call => call[4] === "New Game");
    const button = createPresetButton.mock.results[index].value;
    const first = button.onClick();
    await button.onClick();
    expect(ApiService.resetGame).toHaveBeenCalledOnce();
    expect(menu.input.enabled).toBe(false);
    expect(button.label.text).toBe("Starting new game...");
    reset.reject(new Error("lost response"));
    await first;
    expect(menu.input.enabled).toBe(true);
    expect(menu.retryButton.visible).toBe(true);
    expect(menu.playButtons).toEqual([]);
    oldButtons.forEach(button => expect(button.destroy).toHaveBeenCalledOnce());
    await menu.loadSession();
    expect(menu.statusText.text).toContain("No saved game");
    expect(menu.playButtons).toHaveLength(1);
});

it("ignores a session response from a previous scene visit", async () => {
    const menu = prepare(MainMenu);
    const old = deferred();
    ApiService.getSession.mockReturnValueOnce(old.promise).mockResolvedValueOnce(saved);
    menu.create();
    const oldSignal = ApiService.getSession.mock.calls[0][0];
    menu.events.emit("shutdown");
    menu.create();
    await vi.waitFor(() => expect(menu.playButtons).toHaveLength(2));
    old.resolve({ player_character_id: null });
    await old.promise;
    expect(oldSignal.aborted).toBe(true);
    expect(menu.statusText.text).toContain("Round 4");
    expect(menu.playButtons).toHaveLength(2);
});

it("lets delegate loading recover from an empty response", async () => {
    const selection = prepare(CharacterSelect);
    selection.createInfoPanel = vi.fn();
    selection.createCharacterPortraits = vi.fn();
    selection.createSelectButton = vi.fn();
    ApiService.request.mockResolvedValueOnce({ characters: [] }).mockResolvedValueOnce({ characters: [character] });
    selection.create();
    expect(selection.statusText.text).toBe("Loading delegates...");
    await vi.waitFor(() => expect(selection.retryButton.visible).toBe(true));
    expect(selection.createSelectButton).not.toHaveBeenCalled();
    await selection.loadCharacters();
    expect(selection.characters).toEqual([character]);
    expect(selection.statusText.visible).toBe(false);
    expect(selection.retryButton.visible).toBe(false);
    expect(selection.createSelectButton).toHaveBeenCalledOnce();
});

it("escapes strategic profile text while showing both strengths and objectives", () => {
    const selection = prepare(CharacterSelect);
    const strategy = object();
    strategy.createElement = vi.fn().mockReturnThis();
    strategy.node.setAttribute = vi.fn();
    const graphics = { fillStyle() { return this; }, fillRoundedRect() { return this; }, lineStyle() { return this; }, strokeRoundedRect() { return this; } };
    selection.add.dom = () => strategy;
    selection.add.graphics = () => graphics;
    selection.createInfoPanel();
    selection.selectedCharacter = { ...character, strengths: '<img src=x onerror="bad()">', objectives: "Protect trade & allies" };
    selection.updateInfoPanel();
    const html = selection.infoPanel.strategy.node.innerHTML;
    expect(html).toContain("Strengths:");
    expect(html).toContain("Objectives:");
    expect(html).toContain("&lt;img");
    expect(html).not.toContain("<img");
    expect(html).toContain("Protect trade &amp; allies");
    expect(strategy.node.className).toBe("delegate-strategy");
    expect(strategy.node.tabIndex).toBe(0);
    expect(strategy.node.setAttribute).toHaveBeenCalledWith("aria-label", "Delegate strengths and objectives");
});

it("locks the chosen delegate during start, prevents duplicate submission, and offers retry", async () => {
    const selection = prepare(CharacterSelect);
    selection.selectedCharacter = character;
    selection.abortController = new AbortController();
    selection.showError = vi.fn();
    selection.createSelectButton();
    const request = deferred();
    ApiService.startGame.mockReturnValueOnce(request.promise).mockResolvedValueOnce({});
    const first = selection.startSelectedGame();
    selection.selectCharacter({ getData: () => ({ id: "scipio" }) });
    await selection.startSelectedGame();
    expect(ApiService.startGame).toHaveBeenCalledOnce();
    expect(selection.selectedCharacter.id).toBe("hannibal");
    expect(selection.selectButton.label.text).toBe("Starting game...");
    request.reject(new Error("offline"));
    await first;
    expect(selection.input.enabled).toBe(true);
    expect(selection.selectButton.label.text).toBe("Retry Start");
    expect(selection.showError).toHaveBeenCalledOnce();
    await selection.startSelectedGame();
    expect(selection.scene.start).toHaveBeenCalledWith("Game", { characterId: "hannibal" });
});
