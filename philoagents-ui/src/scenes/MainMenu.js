import {Scene} from "phaser";

export class MainMenu extends Scene {
    constructor() {
        super("MainMenu");
    }

    create() {
        this.add.image(0, 0, "background").setOrigin(0, 0);

        const centerX = this.cameras.main.width / 2;
        const startY = 524;
        const buttonSpacing = 70;

        this.createButton(centerX, startY, "Let's Play!", () => {
            this.scene.start("CharacterSelect");
        });

        this.createButton(centerX, startY + buttonSpacing, "Instructions", () => {
            this.scene.launch("InstructionsModal");
        });

        this.createButton(centerX, startY + buttonSpacing * 2, "Credits", () => {
            window.open("https://github.com/YounesMakhlouf/simulation-game", "_blank");
        });
        this.input.once("pointerdown", () => {
            this.game.audioManager.playMusic("gameplay-music");
        });
    }

    createButton(x, y, text, callback) {
        const buttonWidth = 350;
        const buttonHeight = 60;
        const cornerRadius = 20;
        const maxFontSize = 28;
        const padding = 10;

        const shadow = this.add.graphics();
        shadow.fillStyle(0x666666, 1);
        shadow.fillRoundedRect(x - buttonWidth / 2 + 4, y - buttonHeight / 2 + 4, buttonWidth, buttonHeight, cornerRadius);

        const button = this.add.graphics();
        button.fillStyle(0xffffff, 1);
        button.fillRoundedRect(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight, cornerRadius);
        button.setInteractive(new Phaser.Geom.Rectangle(x - buttonWidth / 2, y - buttonHeight / 2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

        let fontSize = maxFontSize;
        let buttonText;
        do {
            if (buttonText) buttonText.destroy();

            buttonText = this.add
                .text(x, y, text, {
                    fontSize: `${fontSize}px`, fontFamily: "Arial", color: "#000000", fontStyle: "bold",
                })
                .setOrigin(0.5);

            fontSize -= 1;
        } while (buttonText.width > buttonWidth - padding && fontSize > 10);

        button.on("pointerover", () => {
            this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, true);
            buttonText.y -= 2;
        });

        button.on("pointerout", () => {
            this.updateButtonStyle(button, shadow, x, y, buttonWidth, buttonHeight, cornerRadius, false);
            buttonText.y += 2;
        });

        button.on("pointerdown", callback);

        return {button, shadow, text: buttonText};
    }

    updateButtonStyle(button, shadow, x, y, width, height, radius, isHover) {
        button.clear();
        shadow.clear();

        if (isHover) {
            button.fillStyle(0x87ceeb, 1);
            shadow.fillStyle(0x888888, 1);
            shadow.fillRoundedRect(x - width / 2 + 2, y - height / 2 + 2, width, height, radius);
        } else {
            button.fillStyle(0xffffff, 1);
            shadow.fillStyle(0x666666, 1);
            shadow.fillRoundedRect(x - width / 2 + 4, y - height / 2 + 4, width, height, radius);
        }

        button.fillRoundedRect(x - width / 2, y - height / 2, width, height, radius);
    }
}
