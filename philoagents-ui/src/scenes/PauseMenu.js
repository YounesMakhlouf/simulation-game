import {BaseModal} from "../classes/BaseModal";
import ApiService from "../services/ApiService";
import { COLORS, FONTS } from "../configs/Theme";

export class PauseMenu extends BaseModal {
    constructor() {
        super("PauseMenu", {
            titleText: "GAME PAUSED",
            maxPanelWidth: 400,
            maxPanelHeight: 300,
            closeButtonText: null,
            backdropGrayscale: 1, // fully gray the frozen game while paused
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
        }, { bgColor: COLORS.panel, hoverBgColor: COLORS.panelHover, textColor: COLORS.textCss });

        this.createButton(centerX, buttonY + buttonSpacing * 2, "Reset Game", () => {
            this.resetGame();
        }, { bgColor: COLORS.danger, hoverBgColor: COLORS.dangerHover, textColor: COLORS.textCss, borderColor: COLORS.dangerHover });
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
            await ApiService.resetGame();
            await ApiService.resetMemory();

            // The reset cleared the character binding, so a new character
            // must be chosen; do not resume the old Game instance.
            this.options.resumeGameOnClose = false;
            this.scene.stop("HUDScene");
            this.scene.stop("Game");
            this.scene.start("CharacterSelect");
            this.closeModal();
        } catch (error) {
            console.error("Failed to reset game:", error);

            const centerX = this.cameras.main.width / 2;
            const centerY = this.cameras.main.height / 2 + 120;

            const errorText = this.add
                .text(centerX, centerY, "Failed to reset game. Try again.", {
                    fontSize: "16px", fontFamily: FONTS.body, color: COLORS.negativeCss,
                })
                .setOrigin(0.5)
                .setDepth(3);

            this.time.delayedCall(3000, () => {
                errorText.destroy();
            });
        }
    }
}
