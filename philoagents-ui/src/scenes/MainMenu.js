import {Scene} from "phaser";
import {createPresetButton} from "../classes/ButtonFactory";
import ApiService from "../services/ApiService";
import { COLORS, FONTS } from "../configs/Theme";

export class MainMenu extends Scene {
    constructor() {
        super("MainMenu");
    }

    create() {
        this.add.image(0, 0, "background").setOrigin(0, 0);

        const centerX = this.cameras.main.width / 2;
        this.startY = 524;
        this.buttonSpacing = 70;
        this.playButtons = [];
        this.loadingSession = false;
        this.isStarting = false;
        this.input.enabled = true;
        const controller = new AbortController();
        this.abortController = controller;
        this.events.once("shutdown", () => controller.abort());

        this.statusText = this.add.text(centerX, this.startY - this.buttonSpacing - 42, "", {
            fontSize: "18px", fontFamily: FONTS.body, color: COLORS.textCss,
            backgroundColor: COLORS.panelCss, padding: { x: 16, y: 12 },
            align: "center", wordWrap: { width: 620 },
        }).setOrigin(0.5, 1);
        this.retryButton = createPresetButton(this, "menu", centerX, this.startY - this.buttonSpacing, "Retry Connection", () => {
            this.loadSession();
        }).container.setVisible(false);
        this.loadSession();

        createPresetButton(this, "menu", centerX, this.startY + this.buttonSpacing, "Instructions", () => {
            this.scene.launch("InstructionsModal");
        });

        createPresetButton(this, "menu", centerX, this.startY + this.buttonSpacing * 2, "Credits", () => {
            window.open("https://github.com/YounesMakhlouf/simulation-game", "_blank");
        });

        this.input.once("pointerdown", () => {
            this.game.audioManager.playMusic("gameplay-music");
        });

        this.input.keyboard.on("keydown-M", () => this.game.audioManager.toggleMute());
        this.input.keyboard.on("keydown-F", () => this.scale.toggleFullscreen());
    }

    async loadSession() {
        if (this.loadingSession) return;
        this.loadingSession = true;
        const signal = this.abortController.signal;
        this.retryButton.setVisible(false);
        this.statusText.setText("Loading saved game...").setColor(COLORS.textCss);
        try {
            const session = await ApiService.getSession(signal);
            if (signal.aborted) return;
            this.statusText.setText(session.player_character_id
                ? `Saved game: ${session.player_character_name} · Round ${session.round_number}`
                : "No saved game. Choose a delegate to begin.");
            this.createPlayButtons(this.cameras.main.width / 2, session);
        } catch (error) {
            if (signal.aborted) return;
            this.statusText.setText("Could not check your saved game.\nRetry to reconnect.").setColor(COLORS.negativeCss);
            this.retryButton.setVisible(true);
        }
        if (!signal.aborted) this.loadingSession = false;
    }

    createPlayButtons(centerX, session) {
        if (!this.scene.isActive()) return;

        if (session.player_character_id) {
            const continueButton = createPresetButton(this, "primary", centerX, this.startY - this.buttonSpacing, "Continue", () => {
                this.scene.start("Game", { characterId: session.player_character_id });
            }).container;
            const newGameButton = createPresetButton(this, "danger", centerX, this.startY, "New Game", async () => {
                if (this.isStarting) return;
                this.isStarting = true;
                this.input.enabled = false;
                this.playButtons.forEach(button => button.disableInteractive().setAlpha(0.6));
                newGameButton.label.setText("Starting new game...");
                this.statusText.setText("Replacing saved progress with a new game...").setColor(COLORS.textCss);
                const signal = this.abortController.signal;
                try {
                    await ApiService.resetGame(signal);
                    if (signal.aborted) return;
                    this.scene.start("CharacterSelect");
                } catch (error) {
                    if (signal.aborted) return;
                    this.isStarting = false;
                    this.input.enabled = true;
                    this.playButtons.forEach(button => button.destroy());
                    this.playButtons = [];
                    this.statusText.setText("Could not confirm the new game.\nRetry to check your saved progress.").setColor(COLORS.negativeCss);
                    this.retryButton.setVisible(true);
                }
            });
            this.playButtons = [continueButton, newGameButton.container];
        } else {
            this.playButtons = [createPresetButton(this, "primary", centerX, this.startY - this.buttonSpacing, "New Game", () => {
                this.scene.start("CharacterSelect");
            }).container];
        }
    }
}
