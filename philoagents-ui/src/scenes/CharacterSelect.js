import {Scene, TintModes} from "phaser";
import ApiService from "../services/ApiService";
import {createPresetButton} from "../classes/ButtonFactory";

export class CharacterSelect extends Scene {
    constructor() {
        super("CharacterSelect");
        this.characters = [];
        this.selectedCharacter = null;
        this.portraits = [];
        this.infoPanel = {};
    }

    async create() {
        // Reset scene state in case this Scene instance is reused
        this.characters = [];
        this.selectedCharacter = null;
        this.portraits = [];
        this.infoPanel = {};

        const {width, height} = this.sys.game.config;
        this.add
            .image(0, 0, "character_selection_background")
            .setOrigin(0, 0)
            .setDisplaySize(width, height)
            .setAlpha(0.7);
        this.add
            .text(512, 80, "Choose Your Delegate", {
                fontSize: "54px", fontFamily: "Georgia, serif", color: "#FFFFFF", stroke: "#000000", strokeThickness: 6,
            })
            .setOrigin(0.5);

        try {
            const data = await ApiService.request("/game/characters", "GET");
            this.characters = data.characters;

            // Now that we have the data, create the rest of the scene
            this.createInfoPanel();
            this.createCharacterPortraits();
            this.createSelectButton();
        } catch (error) {
            console.error("Failed to fetch character data:", error);
            // Display an error message to the player
            this.add
                .text(512, 384, "Error: Could not connect to the server.\nPlease ensure the backend is running.", {
                    fontSize: "24px", color: "#ff0000", align: "center",
                })
                .setOrigin(0.5);
        }
    }

    createCharacterPortraits() {
        const startX = 150;
        const y = 280;
        const spacing = 240;
        const TARGET_HEIGHT = 200; // All portraits will be scaled to this height

        this.characters.forEach((char, index) => {
            const portraitX = startX + index * spacing;
            const portrait = this.add
                .image(portraitX, y, char.portrait_key)
                .setInteractive();

            const scale = TARGET_HEIGHT / portrait.height;
            portrait.setScale(scale);

            portrait.setData("character", char);
            this.portraits.push(portrait);

            // Hover highlight: additive brighten (v4 tint mode), skipped while selected
            portrait.on("pointerover", () => {
                if (this.selectedCharacter !== char) {
                    portrait.setTint(0x444444).setTintMode(TintModes.ADD);
                }
            });
            portrait.on("pointerout", () => {
                if (this.selectedCharacter !== char) portrait.clearTint();
            });

            portrait.on("pointerdown", () => {
                this.selectCharacter(portrait);
            });
        });

        // Initially select the first character if available
        if (this.portraits.length > 0) {
            this.selectCharacter(this.portraits[0]);
        }
    }

    selectCharacter(selectedPortrait) {
        // Clear hover tint and any existing glow from all portraits
        this.portraits.forEach((portrait) => {
            portrait.clearTint();
            if (portrait.filters) portrait.filters.internal.clear();
        });

        // Highlight the selected one with a crisp gold border + a soft gold glow (v4 filter)
        selectedPortrait.enableFilters();
        selectedPortrait.filters.internal.addGlow(0xffd700, 6, 0, 1);

        if (!this.selectionBorder) this.selectionBorder = this.add.graphics();
        this.selectionBorder.clear();
        this.selectionBorder.lineStyle(6, 0xffd700, 1);
        this.selectionBorder.strokeRect(
            selectedPortrait.x - selectedPortrait.displayWidth / 2,
            selectedPortrait.y - selectedPortrait.displayHeight / 2,
            selectedPortrait.displayWidth,
            selectedPortrait.displayHeight
        );

        this.selectedCharacter = selectedPortrait.getData("character");
        this.updateInfoPanel();
    }

    createInfoPanel() {
        const panelX = 512;
        const panelY = 550;
        const panelWidth = 800;
        const panelHeight = 250;

        const panel = this.add.graphics();
        panel.fillStyle(0x000000, 0.6);
        panel.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 15);
        panel.lineStyle(2, 0xffffff, 0.8);
        panel.strokeRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 15);

        this.infoPanel.name = this.add
            .text(panelX, panelY - 90, "", {
                fontSize: "36px", fontFamily: "Georgia, serif", color: "#ffffff",
            })
            .setOrigin(0.5);

        this.infoPanel.title = this.add
            .text(panelX, panelY - 50, "", {
                fontSize: "24px", fontFamily: "Georgia, serif", color: "#dddddd", fontStyle: "italic",
            })
            .setOrigin(0.5);

        this.infoPanel.description = this.add
            .text(panelX, panelY + 25, "", {
                fontSize: "20px",
                fontFamily: "Arial",
                color: "#ffffff",
                wordWrap: {width: panelWidth - 40},
                align: "center",
            })
            .setOrigin(0.5);
    }

    updateInfoPanel() {
        if (this.selectedCharacter) {
            this.infoPanel.name.setText(this.selectedCharacter.name);
            this.infoPanel.title.setText(this.selectedCharacter.title);
            this.infoPanel.description.setText(this.selectedCharacter.description);
        }
    }

    createSelectButton() {
        createPresetButton(this, "confirm", 512, 720, "Confirm Delegate", () => {
            if (this.selectedCharacter) {
                this.scene.start("Game", {characterId: this.selectedCharacter.id});
            }
        });
    }
}
