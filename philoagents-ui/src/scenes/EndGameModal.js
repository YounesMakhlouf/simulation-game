import { Scene } from 'phaser';

export class EndGameModal extends Scene {
    constructor() {
        super('EndGameModal');
    }

    init(data) {
        this.gameManager = data.gameManager;
    }

    create() {
        // --- 1. SETUP UI ELEMENTS ---

        // Semi-transparent background overlay
        this.add.graphics()
            .fillStyle(0x000000, 0.8)
            .fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        // Main modal panel
        this.add.graphics()
            .fillStyle(0x111111, 0.95)
            .lineStyle(2, 0xffd700, 1) // Gold border
            .fillRoundedRect(100, 100, 824, 568, 15)
            .strokeRoundedRect(100, 100, 824, 568, 15);

        // Title and instruction text
        this.add.text(512, 150, 'The Final Reckoning', {
            fontSize: '48px', fontFamily: 'Georgia, serif', color: '#ffffff'
        }).setOrigin(0.5);

        this.add.text(512, 220, 'The simulation has concluded. Now, you must answer the final question:\nWhat was the secret force guiding the events of this world?', {
            fontSize: '20px', color: '#dddddd', align: 'center', wordWrap: { width: 780 }
        }).setOrigin(0.5);

        // --- 2. CREATE THE HTML FORM ---

        const formHTML = `
            <div class="end-game-form">
                <textarea id="undergame-guess" placeholder="Describe the Undergame in your own words..."></textarea>
                <p id="error-text" class="error-text"></p>
                <button id="submit-guess-button">Submit Final Guess</button>
            </div>
        `;

        const formElement = this.add.dom(512, 450).createFromHTML(formHTML);

        // --- 3. ADD EVENT LISTENER ---

        const guessInput = formElement.getChildByID('undergame-guess');
        const submitButton = formElement.getChildByID('submit-guess-button');
        const errorText = formElement.getChildByID('error-text');

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
                const finalScores = await this.gameManager.api.submitGuessAndGetScores(
                    this.gameManager.playerCharacterId,
                    guess
                );

                // Stop this scene and launch the final scoreboard
                this.scene.stop();
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