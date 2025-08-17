import {BaseModal} from '../classes/BaseModal';

export class EndGameModal extends BaseModal {
    constructor() {
        super('EndGameModal', {
            titleText: 'The Final Reckoning',
            titleColor: '#ffffff',
            titleSize: '48px',
            titleY: 150,
            panelColor: 0x111111,
            panelBorderColor: 0xffd700, // Gold border
            panelWidth: 824,
            panelHeight: 568,
            panelX: 100,
            panelY: 100,
            showCloseButton: false,
            closeOnEsc: false,
            resumeGameOnClose: false,
            backgroundAlpha: 0.8
        });
    }

    init(data) {
        super.init(data);
        this.gameManager = data.gameManager;
    }

    createContent() {
        this.input.keyboard.disableGlobalCapture();
        // Instruction text
        this.add.text(512, 220, 'The simulation has concluded. Now, you must answer the final question:\nWhat was the secret force guiding the events of this world?', {
            fontSize: '20px', color: '#dddddd', align: 'center', wordWrap: {width: 780}
        }).setOrigin(0.5).setDepth(2);

        // --- 2. CREATE THE HTML FORM ---

        const formHTML = `
            <div class="end-game-form">
                <textarea id="undergame-guess" placeholder="Describe the Undergame in your own words..."></textarea>
                <p id="error-text" class="error-text"></p>
                <button id="submit-guess-button">Submit Final Guess</button>
            </div>
        `;

        const formElement = this.add.dom(512, 450).createFromHTML(formHTML).setDepth(2);

        // --- 3. ADD EVENT LISTENER ---

        const guessInput = formElement.getChildByID('undergame-guess');
        const submitButton = formElement.getChildByID('submit-guess-button');
        const errorText = formElement.getChildByID('error-text');
        // Prevent Phaser keyboard capture when focusing inputs
        const inputs = formElement.node.querySelectorAll('textarea, input, select');
        inputs.forEach((el) => {
            el.addEventListener('focus', () => this.input.keyboard.disableGlobalCapture());
            el.addEventListener('blur', () => this.input.keyboard.enableGlobalCapture());
        });

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
                this.scene.start('ScoreboardScene', {scores: finalScores});

            } catch (apiError) {
                console.error("API Error during score calculation:", apiError);
                errorText.textContent = 'Error communicating with the server. Please try again.';
                // Re-enable the button on failure
                submitButton.disabled = false;
                submitButton.textContent = 'Submit Final Guess';
            }
        });
        this.events.once('shutdown', () => this.input.keyboard.enableGlobalCapture());
    }
}