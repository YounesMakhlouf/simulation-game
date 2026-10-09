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
    retryRound: vi.fn(),
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
  ApiService.submitAction.mockReset();
  ApiService.retryRound.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("pollForNextRound", () => {
  it("stops on a reported round failure and offers a retry", async () => {
    const manager = makeManager();
    const error = vi.fn();
    manager.events.on("error", error);
    ApiService.getGameState.mockResolvedValue({ ...state(1), round_error: "Retry this round." });

    manager.pollForNextRound();
    await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);

    expect(manager.gamePhase).toBe("ROUND_FAILED");
    expect(manager._pollTimer).toBeNull();
    expect(error).toHaveBeenCalledWith("Retry this round.");
    ApiService.retryRound.mockResolvedValue({});
    await manager.retryRound();
    expect(ApiService.retryRound).toHaveBeenCalledOnce();
    expect(manager.gamePhase).toBe("WAITING_FOR_JUDGE");
    expect(manager._pollTimer).not.toBeNull();
  });

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
  it("restores the action phase when the server rejects the submission", async () => {
    const manager = makeManager(1);
    const error = vi.fn();
    manager.events.on("error", error);
    ApiService.submitAction.mockRejectedValue(new Error("400"));
    ApiService.getGameState.mockResolvedValue(state(1));

    const accepted = await manager.submitPlayerAction({ character_id: "hannibal" });

    expect(error).toHaveBeenCalledWith("400");
    expect(accepted).toBe(false);
    expect(manager.gamePhase).toBe("ACTION");
    expect(manager._pollTimer).toBeNull();
  });

  it("polls an accepted action when its HTTP response was lost", async () => {
    const manager = makeManager();
    const error = vi.fn();
    manager.events.on("error", error);
    ApiService.submitAction.mockRejectedValue(new Error("timeout"));
    ApiService.getGameState.mockResolvedValue({ ...state(1), is_processing_round: true, has_pending_action: true });

    expect(await manager.submitPlayerAction({ character_id: "hannibal" })).toBe(true);
    expect(manager.gamePhase).toBe("WAITING_FOR_JUDGE");
    expect(manager._pollTimer).not.toBeNull();
    expect(error).not.toHaveBeenCalled();
  });
});

describe("resume", () => {
  it("resumes polling when a round is processing", async () => {
    const manager = makeManager();
    const crisis = vi.fn();
    manager.events.on("showCrisisUpdate", crisis);
    ApiService.getGameState.mockResolvedValue({ ...state(1), is_processing_round: true });

    await manager.startGame();

    expect(manager.gamePhase).toBe("WAITING_FOR_JUDGE");
    expect(manager._pollTimer).not.toBeNull();
    expect(crisis).not.toHaveBeenCalled();
  });

  it("offers a retry after reloading a failed round", async () => {
    const manager = makeManager();
    manager.events.on("error", () => {});
    ApiService.getGameState.mockResolvedValue({ ...state(1), round_error: "Round failed", has_pending_action: true });
    await manager.startGame();
    expect(manager.gamePhase).toBe("ROUND_FAILED");
    expect(manager._pollTimer).toBeNull();
  });
});

it("keeps the retry available if the retry request fails", async () => {
  const manager = makeManager();
  manager.events.on("error", () => {});
  ApiService.retryRound.mockRejectedValue(new Error("offline"));
  await manager.retryRound();
  expect(manager.gamePhase).toBe("ROUND_FAILED");
  expect(manager._pollTimer).not.toBeNull();
});

it("recovers a retry whose response was lost", async () => {
  const manager = makeManager();
  manager.events.on("error", () => {});
  ApiService.retryRound.mockRejectedValue(new Error("timeout"));
  ApiService.getGameState.mockResolvedValue({ ...state(1), is_processing_round: true });
  await manager.retryRound();
  await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
  expect(manager.gamePhase).toBe("WAITING_FOR_JUDGE");
  ApiService.getGameState.mockResolvedValue(state(2));
  await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
  expect(manager.gamePhase).toBe("DIPLOMACY");
  expect(manager._pollTimer).toBeNull();
});

it("reopens action submission if a server restart discarded the pending action", async () => {
  const manager = makeManager();
  manager.events.on("error", () => {});
  const actionModal = vi.fn();
  manager.events.on("showActionModal", actionModal);
  ApiService.getGameState.mockResolvedValue({ ...state(1), is_processing_round: false, has_pending_action: false });
  manager.pollForNextRound();
  await vi.advanceTimersByTimeAsync(POLL_INTERVAL_MS);
  expect(manager.gamePhase).toBe("ACTION");
  expect(actionModal).toHaveBeenCalledOnce();
  expect(manager._pollTimer).toBeNull();
});
