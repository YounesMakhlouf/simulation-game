import {Scene} from "phaser";
import {createPresetButton} from "../classes/ButtonFactory";

export class MainMenu extends Scene {
    constructor() {
        super("MainMenu");
    }

    create() {
        this.add.image(0, 0, "background").setOrigin(0, 0);

        const centerX = this.cameras.main.width / 2;
        const startY = 524;
        const buttonSpacing = 70;

        createPresetButton(this, "menu", centerX, startY, "Let's Play!", () => {
            this.scene.start("CharacterSelect");
        });

        createPresetButton(this, "menu", centerX, startY + buttonSpacing, "Instructions", () => {
            this.scene.launch("InstructionsModal");
        });

        createPresetButton(this, "menu", centerX, startY + buttonSpacing * 2, "Credits", () => {
            window.open("https://github.com/YounesMakhlouf/simulation-game", "_blank");
        });

        this.input.once("pointerdown", () => {
            this.game.audioManager.playMusic("gameplay-music");
        });

        this.input.keyboard.on("keydown-M", () => this.game.audioManager.toggleMute());
    }
}
