import Phaser from "phaser";
import ApiService from "../services/ApiService";
import { POLL_INTERVAL_MS } from "../config";

export class GameManager {
  /**
   * The GameManager is the central controller for the game's state and flow.
   * @param {Phaser.Scene} scene - The main Game scene.
   * @param {string} playerCharacterId - The ID of the character the player has chosen.
   */
  constructor(scene, playerCharacterId) {
    this.scene = scene;
    this.playerCharacterId = playerCharacterId;

    this.api = ApiService;

    this.gameState = {}; // Will hold the full state from the backend
    this.gamePhase = "INITIALIZING"; // e.g., 'INITIALIZING', 'DIPLOMACY', 'ACTION', 'WAITING_FOR_JUDGE'
    this._pollTimer = null; // Handle for the round-polling timer.

    // Using Phaser's event emitter to communicate with the UI
    this.events = new Phaser.Events.EventEmitter();
  }

  /**
   * Starts the game by fetching the initial state from the server.
   */
  async startGame() {
    console.log("GameManager: Starting game...");
    this.setGamePhase("INITIALIZING");
    await this.fetchAndProcessGameState();
  }

  /**
   * Fetches the latest game state from the backend and processes it.
   */
  async fetchAndProcessGameState() {
    console.log("GameManager: Fetching latest game state...");
    try {
      this.gameState = await this.api.getGameState(this.playerCharacterId);
      console.log("GameManager: Game state received:", this.gameState);

      // Notify the UI that the state has been updated
      this.events.emit("stateUpdated", this.gameState);
      if (this.gameState.is_game_over) {
        this.events.emit("showEndGameModal");
      } else {
        // Show the crisis update to the player
        this.events.emit(
          "showCrisisUpdate",
          this.gameState.crisis_update,
          this.gameState.round_number
        );
      }

      // After the player acknowledges the update, start the next phase
      this.startDiplomacyPhase();
    } catch (error) {
      console.error("GameManager: Failed to process game state.", error);
      this.events.emit("error", "Could not connect to the server.");
    }
  }

  /**
   * Transitions the game into the Diplomacy Phase.
   */
  startDiplomacyPhase() {
    console.log("GameManager: Starting Diplomacy Phase.");
    this.setGamePhase("DIPLOMACY");
  }

  /**
   * Transitions the game into the Action Phase.
   */
  startActionPhase() {
    console.log("GameManager: Starting Action Phase.");
    this.setGamePhase("ACTION");
    this.events.emit("showActionModal"); // Tell the UI to show the action form
  }

  /**
   * Submits the player's action and transitions to the waiting phase.
   * @param {object} actionData - The action object from the UI form.
   */
  async submitPlayerAction(actionData) {
    console.log("GameManager: Submitting player action...", actionData);
    this.setGamePhase("WAITING_FOR_JUDGE");

    try {
      await this.api.submitAction(actionData);
      console.log(
        "GameManager: Action submitted successfully. Waiting for next round..."
      );

      // Start polling for the next round's state update.
      this.pollForNextRound();
    } catch (error) {
      console.error("GameManager: Failed to submit action.", error);
      this.events.emit("error", "Failed to submit your action.");
    }
  }

  /**
   * Periodically checks the server for a new game state (i.e., a new round).
   * Individual requests time out via ApiService, so a hung backend just skips
   * a tick; polling stops once the round advances or the game ends.
   */
  pollForNextRound() {
    const initialRound = this.gameState.round_number;

    this.stopPolling(); // Ensure only one poll loop is ever running.

    this._pollTimer = setInterval(async () => {
      console.log("GameManager: Polling for new round...");
      try {
        const newState = await this.api.getGameState(this.playerCharacterId);

        if (newState.is_game_over) {
          console.log("GameManager: Game is over!");
          this.stopPolling();
          this.gameState = newState;
          this.events.emit("stateUpdated", this.gameState);
          this.events.emit("showEndGameModal");
          return;
        }

        if (newState.round_number > initialRound) {
          console.log("GameManager: New round received.");
          this.stopPolling();
          this.gameState = newState;
          this.events.emit("stateUpdated", this.gameState);
          this.events.emit(
            "showCrisisUpdate",
            this.gameState.crisis_update,
            this.gameState.round_number
          );
          this.startDiplomacyPhase();
        }
      } catch (error) {
        console.error("GameManager: Error polling for new round:", error);
      }
    }, POLL_INTERVAL_MS);
  }

  /**
   * Stops the round-polling loop, if one is running.
   */
  stopPolling() {
    if (this._pollTimer) {
      clearInterval(this._pollTimer);
      this._pollTimer = null;
    }
  }

  /**
   * A private helper to set the game phase and notify the UI.
   * @param {string} newPhase
   */
  setGamePhase(newPhase) {
    this.gamePhase = newPhase;
    this.events.emit("phaseChanged", newPhase);
    console.log(`GameManager: Phase changed to ${newPhase}`);
  }

  /**
   * Releases all resources: stops polling and removes event listeners. Call
   * this when the Game scene shuts down so timers don't fire on a dead scene.
   */
  destroy() {
    this.stopPolling();
    this.events.removeAllListeners();
  }
}
