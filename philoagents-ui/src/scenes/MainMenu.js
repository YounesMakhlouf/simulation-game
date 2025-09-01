import {Scene} from "phaser";
import {createUIButton} from "../classes/ButtonFactory";

export class MainMenu extends Scene {
    constructor() {
        super("MainMenu");
    }

    create() {
        this.add.image(0, 0, "background").setOrigin(0, 0);

        const centerX = this.cameras.main.width / 2;
        const startY = 524;
        const buttonSpacing = 70;

        this.createMenuButton(centerX, startY, "Let's Play!", () => {
            this.scene.start("CharacterSelect");
        });

        this.createMenuButton(centerX, startY + buttonSpacing, "Instructions", () => {
            this.scene.launch("InstructionsModal");
        });

        this.createMenuButton(centerX, startY + buttonSpacing * 2, "Credits", () => {
            window.open("https://github.com/YounesMakhlouf/simulation-game", "_blank");
        });
        this.input.once("pointerdown", () => {
            this.game.audioManager.playMusic("gameplay-music");
        });
    }

    createMenuButton(x, y, text, callback) {
        const {container} = createUIButton(this, x, y, text, callback, {
            width: 350,
            height: 60,
            radius: 20,
            maxFontSize: 28,
            padding: 10,
            bgColor: 0xffffff,
            hoverBgColor: 0x87ceeb,
            shadowColor: 0x666666,
            textColor: "#000000",
            fontFamily: "Arial",
            fontStyle: "bold",
            liftOnHover: true,
        });
        return container;
    }
}
