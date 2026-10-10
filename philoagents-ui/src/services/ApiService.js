import { getApiBaseUrl, REQUEST_TIMEOUT_MS } from '../config';

class ApiService {
    constructor() {
        this.apiUrl = getApiBaseUrl();
    }

    async request(endpoint, method, data, timeoutMs = REQUEST_TIMEOUT_MS, signal) {
        signal?.throwIfAborted();
        const url = `${this.apiUrl}${endpoint}`;
        const options = {
            method, headers: {
                'Content-Type': 'application/json',
            }, body: data ? JSON.stringify(data) : undefined,
            signal: signal
                ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)])
                : AbortSignal.timeout(timeoutMs),
        };

        let response;
        try {
            response = await fetch(url, options);
        } catch (error) {
            if (error.name === 'TimeoutError') {
                throw new Error(`Request to ${endpoint} timed out after ${timeoutMs}ms`);
            }
            throw error;
        }

        if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            throw new Error(typeof body.detail === 'string'
                ? body.detail : `API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    async sendMessage(senderId, receiverId, message, signal) {
        try {
            const data = await this.request('/chat', 'POST', {
                sender_id: senderId, receiver_id: receiverId, message: message,
            }, undefined, signal);

            return data.response;
        } catch (error) {
            if (signal?.aborted) throw error;
            console.error('Error sending message to API:', error);
            return this.getFallbackResponse();
        }
    }

    getFallbackResponse() {
        return "I am sorry, I am occupied with matters of state and cannot speak at this moment.";
    }

    async resetMemory() {
        try {
            return await this.request('/reset-memory', 'POST');
        } catch (error) {
            console.error('Error resetting memory:', error);
            throw error;
        }
    }

    /**
     * Fetches the current session: which character (if any) the saved game
     * is bound to.
     * @returns {Promise<object>} { player_character_id, player_character_name, round_number, scoring_timeout_ms }
     */
    async getSession(signal) {
        return this.request('/game/session', 'GET', undefined, undefined, signal);
    }

    /**
     * Binds the player to a character, starting (or continuing) the game.
     * @param {string} characterId - The ID of the chosen character.
     */
    async startGame(characterId, signal) {
        return this.request('/game/start', 'POST', { character_id: characterId }, undefined, signal);
    }

    /**
     * Resets the game to the initial scenario, clearing all progress.
     */
    async resetGame(signal) {
        return this.request('/game/reset', 'POST', undefined, undefined, signal);
    }

    /**
     * Fetches the entire current game state for a specific character.
     * @param {string} characterId - The ID of the player's character.
     * @returns {Promise<object>} The full game state object.
     */
    async getGameState(characterId) {
        try {
            return await this.request(`/game/status/${characterId}`, 'GET');
        } catch (error) {
            console.error('Error fetching game state:', error);
            throw error;
        }
    }

    /**
     * Submits the player's final, official action for the round.
     * @param {object} actionData - The action object to be submitted.
     * @returns {Promise<object>} The server's confirmation message.
     */
    async submitAction(actionData) {
        try {
            return await this.request('/game/action', 'POST', actionData);
        } catch (error) {
            console.error('Error submitting action:', error);
            throw error;
        }
    }

    async retryRound() {
        return this.request('/game/retry', 'POST');
    }

    /**
     * Submits the player's final Undergame guess and retrieves the final scores.
     * @param {string} characterId - The ID of the player's character.
     * @param {string} guess - The player's text guess for the Undergame.
     * @returns {Promise<object>} The final scores object from the server.
     */
    async submitGuessAndGetScores(characterId, guess) {
        try {
            const { scoring_timeout_ms: timeoutMs } = await this.getSession();
            if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
                throw new Error('Server returned an invalid scoring timeout.');
            }
            return await this.request('/game/end', 'POST', {
                player_character_id: characterId,
                undergame_guess: guess,
            }, timeoutMs);
        } catch (error) {
            console.error('Error submitting final guess:', error);
            throw error;
        }
    }
}


export default new ApiService();
