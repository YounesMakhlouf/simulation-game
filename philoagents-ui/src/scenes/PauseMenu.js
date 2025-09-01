import {BaseModal} from "../classes/BaseModal";
import ApiService from "../services/ApiService";

export class PauseMenu extends BaseModal {
    constructor() {
        super("PauseMenu", {
            titleText: "GAME PAUSED",
            titleColor: "#000000",
            titleSize: "28px",
            titleY: 180,
            panelColor: 0xffffff,
            panelBorderColor: 0x000000,
            panelWidth: 400,
            panelHeight: 300,
            panelX: 312, // Centered: (1024 - 400) / 2
            panelY: 234, // Centered: (768 - 300) / 2
            closeButtonText: null,
            closeOnEsc: true,
            resumeGameOnClose: true,
            backgroundAlpha: 0.7,
        });
    }

    createContent() {
        // Ensure resuming is enabled by default each time the pause menu opens
        this.options.resumeGameOnClose = true;
        const centerX = this.cameras.main.width / 2;
        const centerY = this.cameras.main.height / 2;

        const buttonY = centerY - 50;
        const buttonSpacing = 70;

        this.createButton(centerX, buttonY, "Resume Game", () => {
            // Explicitly re-enable resume in case it was disabled by other actions earlier
            this.options.resumeGameOnClose = true;
            this.closeModal();
        });

        this.createButton(centerX, buttonY + buttonSpacing, "Main Menu", () => {
            this.returnToMainMenu();
        });

        this.createButton(centerX, buttonY + buttonSpacing * 2, "Reset Game", () => {
            this.resetGame();
        });
    }

    // Using the createButton method from BaseModal

    returnToMainMenu() {
        // Do not resume Game when closing this modal
        this.options.resumeGameOnClose = false;
        this.scene.stop("HUDScene");
        this.scene.stop("Game");
        this.scene.start("MainMenu");
        this.closeModal();
    }

    async resetGame() {
        try {
            await ApiService.resetMemory();

            // Do not resume the old Game instance; we're restarting
            this.options.resumeGameOnClose = false;
            this.scene.stop("HUDScene");
            this.scene.stop("Game");
            this.scene.start("Game");
            this.closeModal();
        } catch (error) {
            console.error("Failed to reset game:", error);

            const centerX = this.cameras.main.width / 2;
            const centerY = this.cameras.main.height / 2 + 120;

            const errorText = this.add
                .text(centerX, centerY, "Failed to reset game. Try again.", {
                    fontSize: "16px", fontFamily: "Arial", color: "#FF0000",
                })
                .setOrigin(0.5)
                .setDepth(3);

            this.time.delayedCall(3000, () => {
                errorText.destroy();
            });
        }
    }
}
