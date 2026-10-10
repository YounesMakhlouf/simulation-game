import { BaseModal } from '../classes/BaseModal';

export class EndGameModal extends BaseModal {
    constructor() {
        super('EndGameModal', {
            titleText: 'The Final Reckoning',
            maxPanelWidth: 824,
            maxPanelHeight: 568,
            // No close button: the only way out of the end screen is the guess
            // form. A close button here would leave the game paused forever.
            closeButtonText: '',
            closeOnEsc: false,
            resumeGameOnClose: false,
            backdropGrayscale: 1, // fully gray the world at game over
        });
    }

    init(data) {
        super.init(data);
        this.gameManager = data.gameManager;
    }

    createContent() {
        const formHTML = `
            <div class="end-game-form">
                <p>The simulation has concluded. What was the secret force guiding the events of this world?</p>
                <label for="undergame-guess">Your final guess</label>
                <textarea id="undergame-guess" placeholder="Describe the Undergame in your own words..."></textarea>
                <p id="error-text" role="alert" class="error-text"></p>
                <button id="submit-guess-button">Submit Final Guess</button>
            </div>
        `;

        const formElement = this.addScrollableDom(formHTML);

        // --- 3. ADD EVENT LISTENER ---

        const guessInput = formElement.querySelector('#undergame-guess');
        const submitButton = formElement.querySelector('#submit-guess-button');
        const errorText = formElement.querySelector('#error-text');
        submitButton.addEventListener('click', async () => {
            const guess = guessInput.value;

            // --- Validation ---
            if (guess.trim().length < 20) { // Check for a minimum length
                errorText.textContent = 'Your guess must be at least 20 characters long.';
                guessInput.classList.add('input-error');
                return;
            }

            // Disable the button and show loading state
            submitButton.disabled = true;
            submitButton.textContent = 'Calculating scores...';
            errorText.textContent = '';
            guessInput.classList.remove('input-error');

            try {
                // Call the ApiService via the GameManager
                const finalScores = await this.gameManager.api.submitGuessAndGetScores(this.gameManager.playerCharacterId, guess);

                // Stop this scene and launch the final scoreboard
                this.closeModal();
                this.scene.start('ScoreboardScene', { scores: finalScores });

            } catch (apiError) {
                console.error("API Error during score calculation:", apiError);
                errorText.textContent = 'Error communicating with the server. Please try again.';
                // Re-enable the button on failure
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Final Guess';
            }
        });
    }
}
