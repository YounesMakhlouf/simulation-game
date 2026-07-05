import { getApiBaseUrl, REQUEST_TIMEOUT_MS } from '../config';

class ApiService {
    constructor() {
        this.apiUrl = getApiBaseUrl();
    }

    async request(endpoint, method, data) {
        const url = `${this.apiUrl}${endpoint}`;
        const options = {
            method, headers: {
                'Content-Type': 'application/json',
            }, body: data ? JSON.stringify(data) : undefined,
            signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        };

        let response;
        try {
            response = await fetch(url, options);
        } catch (error) {
            if (error.name === 'TimeoutError') {
                throw new Error(`Request to ${endpoint} timed out after ${timeout}ms`);
            }
            throw error;
        }

        if (!response.ok) {
            throw new Error(`API error: ${response.status} ${response.statusText}`);
        }

        return response.json();
    }

    async sendMessage(senderId, receiverId, message) {
        try {
            const data = await this.request('/chat', 'POST', {
                sender_id: senderId, receiver_id: receiverId, message: message,
            });

            return data.response;
        } catch (error) {
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

    /**
     * Submits the player's final Undergame guess and retrieves the final scores.
     * @param {string} characterId - The ID of the player's character.
     * @param {string} guess - The player's text guess for the Undergame.
     * @returns {Promise<object>} The final scores object from the server.
     */
    async submitGuessAndGetScores(characterId, guess) {
        try {
            return await this.request('/game/end', 'POST', {
                player_character_id: characterId,
                undergame_guess: guess,
            });
        } catch (error) {
            console.error('Error submitting final guess:', error);
            throw error;
        }
    }
}


export default new ApiService(); 