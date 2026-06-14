import Phaser, {Scene} from "phaser";
import {createPresetButton} from "../classes/ButtonFactory";

export class HUDScene extends Scene {
    constructor() {
        super("HUDScene");

        this.gameManager = null;
        this.intelButton = null;
        this.roundText = null;
        this.phaseText = null;
        this.resourceTexts = [];
        this.endDiplomacyButton = null;
    }

    init(data) {
        this.gameManager = data.gameManager;
    }

    create() {
        this.roundText = this.add.text(20, 20, "Round: 1", {
            fontSize: "24px", color: "#ffffff", stroke: "#000000", strokeThickness: 4,
        });
        this.phaseText = this.add
            .text(this.cameras.main.width - 20, 20, "Phase: INITIALIZING", {
                fontSize: "24px", color: "#ffffff", stroke: "#000000", strokeThickness: 4,
            })
            .setOrigin(1, 0);
        this.createEndDiplomacyButton();
        this.createIntelButton();

        this.gameManager.events.on("stateUpdated", this.updateHUD, this);
        this.gameManager.events.on("phaseChanged", this.updatePhase, this);

        // Detach listeners when this scene shuts down or is destroyed to avoid updates on dead objects
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.detachGameManagerEvents());
        this.events.once(Phaser.Scenes.Events.DESTROY, () => this.detachGameManagerEvents());

        this.updateHUD(this.gameManager.gameState);
        this.updatePhase(this.gameManager.gamePhase);
    }

    detachGameManagerEvents() {
        if (this.gameManager && this.gameManager.events) {
            this.gameManager.events.off("stateUpdated", this.updateHUD, this);
            this.gameManager.events.off("phaseChanged", this.updatePhase, this);
        }
    }

    createIntelButton() {
        const buttonX = this.cameras.main.width - 90;
        const buttonY = 80;

        const {container, label} = createPresetButton(this, "info", buttonX, buttonY, "View Intel (0)", () => {
            if (this.gameManager.gameState.your_character?.known_intel?.length > 0) {
                const intelReports = this.gameManager.gameState.your_character.known_intel;
                this.scene.get("Game").showIntelModal(intelReports);
            }
        }, {alpha: 0.8});

        this.intelButton = container;
        this.intelButton.setData("label", label);
    }

    createEndDiplomacyButton() {
        const buttonX = this.cameras.main.width / 2;
        const buttonY = this.cameras.main.height - 40;

        const {container} = createPresetButton(this, "danger", buttonX, buttonY, "Proceed to Action Phase", () => {
            this.tweens.add({
                targets: this.endDiplomacyButton,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    this.gameManager.startActionPhase();
                },
            });
        }, {alpha: 0.8});

        this.endDiplomacyButton = container;
        this.endDiplomacyButton.setVisible(false);
    }

    updateHUD(gameState) {
        if (!gameState || !gameState.your_character) return;

        // Update Round Number
        this.roundText.setText(`Round: ${gameState.round_number}`);

        // Clear previous resource texts
        this.resourceTexts.forEach((text) => text.destroy());
        this.resourceTexts = [];

        // Dynamically display resources
        const resources = gameState.your_character.resources;
        let yPos = 60;
        for (const [key, value] of Object.entries(resources)) {
            const resourceText = this.add.text(20, yPos, `${key}: ${value}`, {
                fontSize: "18px", color: "#ffffff",
            });
            this.resourceTexts.push(resourceText);
            yPos += 25;
        }

        const intelCount = gameState.your_character.known_intel?.length || 0;
        const buttonLabel = this.intelButton.getData("label");
        if (buttonLabel) buttonLabel.setText(`View Intel (${intelCount})`);

        // Disable the button visually if there is no intel
        if (this.intelButton && !this.intelButton.destroyed) {
            if (intelCount === 0) {
                this.intelButton.setAlpha(0.5).disableInteractive();
            } else {
                this.intelButton.setAlpha(1).setInteractive({useHandCursor: true});
            }
        }
    }

    updatePhase(newPhase) {
        // If UI not yet created (early call), safely ignore
        if (!this.phaseText || !this.endDiplomacyButton || !newPhase) {
            return;
        }

        const phaseName = newPhase.replace("_", " ").toUpperCase();
        this.phaseText.setText(`Phase: ${phaseName}`);
        this.endDiplomacyButton.setVisible(newPhase === "DIPLOMACY");
    }
}
