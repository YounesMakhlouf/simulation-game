import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import { POLL_INTERVAL_MS } from "../src/config";

vi.mock("phaser", () => ({
  default: { Events: { EventEmitter } },
}));

vi.mock("../src/services/ApiService", () => ({
  default: {
    getGameState: vi.fn(),
    submitAction: vi.fn(),
  },
}));

import ApiService from "../src/services/ApiService";
import { GameManager } from "../src/classes/GameManager";

function makeManager(round = 1) {
  const manager = new GameManager({}, "hannibal");
  manager.gameState = { round_number: round };
  return manager;
}

const state = (round, over = false) => ({
  round_number: round,
  is_game_over: over,
  crisis_update: `Crisis of round ${round}`,
});

beforeEach(() => {
  vi.useFakeTimers();
  ApiService.getGameState.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pollForNextRound", () => {
  it("keeps polling while the round is unchanged, then advances", async () => {
    const manager = makeManager(1);
    const crisis = vi.fn();
    manager.events.on("showCrisisUpdate", crisis);

    ApiService.getGameState
      .mockResolvedValueOnce(state(1))
      .mockResolvedValueOnce(state(2));

    manager.pollForNextRound();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(crisis).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    expect(crisis).toHaveBeenCalledWith("Crisis of round 2", 2);
    expect(manager.gamePhase).toBe("DIPLOMACY");
    expect(manager._pollTimer).toBeNull();
  });

  it("stops and shows the end-game modal when the game is over", async () => {
    const manager = makeManager(4);
    const endGame = vi.fn();
    manager.events.on("showEndGameModal", endGame);

    ApiService.getGameState.mockResolvedValue(state(4, true));

    manager.pollForNextRound();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(endGame).toHaveBeenCalled();
    expect(manager._pollTimer).toBeNull();
  });

  it("keeps polling through request failures", async () => {
    const manager = makeManager(1);
    const crisis = vi.fn();
    manager.events.on("showCrisisUpdate", crisis);

    ApiService.getGameState
      .mockRejectedValueOnce(new Error("timeout"))
      .mockResolvedValueOnce(state(2));

    manager.pollForNextRound();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(crisis).toHaveBeenCalledWith("Crisis of round 2", 2);
  });

  it("ignores a response that resolves after polling was stopped", async () => {
    const manager = makeManager(1);
    const crisis = vi.fn();
    manager.events.on("showCrisisUpdate", crisis);

    let resolveRequest;
    ApiService.getGameState.mockReturnValue(
      new Promise((resolve) => {
        resolveRequest = resolve;
      })
    );

    manager.pollForNextRound();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS); // request now in flight

    manager.stopPolling();
    resolveRequest(state(2)); // stale response arrives afterwards
    await vi.runOnlyPendingTimersAsync();

    expect(crisis).not.toHaveBeenCalled();
    expect(manager.gameState.round_number).toBe(1);
  });

  it("restarting polling invalidates the previous loop", async () => {
    const manager = makeManager(1);
    manager.pollForNextRound();
    const firstRunId = manager._pollRunId;

    manager.pollForNextRound();

    expect(manager._pollRunId).toBeGreaterThan(firstRunId);
    expect(manager._pollTimer).not.toBeNull();
  });
});

describe("destroy", () => {
  it("stops the timer and removes listeners", () => {
    const manager = makeManager(1);
    const listener = vi.fn();
    manager.events.on("phaseChanged", listener);

    manager.pollForNextRound();
    manager.destroy();

    expect(manager._pollTimer).toBeNull();
    manager.events.emit("phaseChanged", "ACTION");
    expect(listener).not.toHaveBeenCalled();
  });
});

describe("submitPlayerAction", () => {
  it("emits an error and does not poll when submission fails", async () => {
    const manager = makeManager(1);
    const error = vi.fn();
    manager.events.on("error", error);
    ApiService.submitAction.mockRejectedValue(new Error("400"));

    await manager.submitPlayerAction({ character_id: "hannibal" });

    expect(error).toHaveBeenCalledWith("Failed to submit your action.");
    expect(manager._pollTimer).toBeNull();
  });
});
