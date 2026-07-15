import {Scene} from "phaser";
import {createPresetButton} from "../classes/ButtonFactory";
import ApiService from "../services/ApiService";

export class MainMenu extends Scene {
    constructor() {
        super("MainMenu");
    }

    create() {
        this.add.image(0, 0, "background").setOrigin(0, 0);

        const centerX = this.cameras.main.width / 2;
        this.startY = 524;
        this.buttonSpacing = 70;

        // Play buttons depend on whether a saved game is bound to a character;
        // fall back to a fresh start when the backend is unreachable.
        ApiService.getSession()
            .then((session) => this.createPlayButtons(centerX, session))
            .catch(() => this.createPlayButtons(centerX, null));

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

    createPlayButtons(centerX, session) {
        if (!this.scene.isActive()) return;

        if (session && session.player_character_id) {
            createPresetButton(this, "menu", centerX, this.startY, `Continue as ${session.player_character_name}`, () => {
                this.scene.start("Game", { characterId: session.player_character_id });
            });
            createPresetButton(this, "menu", centerX, this.startY - this.buttonSpacing, "New Game", async () => {
                try {
                    await ApiService.resetGame();
                    this.scene.start("CharacterSelect");
                } catch (error) {
                    console.error("Failed to reset game:", error);
                }
            });
        } else {
            createPresetButton(this, "menu", centerX, this.startY, "Let's Play!", () => {
                this.scene.start("CharacterSelect");
            });
        }
    }
}
