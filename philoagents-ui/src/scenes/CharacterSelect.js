import Phaser, { Scene, TintModes } from "phaser";
import ApiService from "../services/ApiService";
import { addKeyboardButton } from "../classes/KeyboardButton";
import { createPresetButton } from "../classes/ButtonFactory";
import { COLORS, FONTS } from "../configs/Theme";
import { escapeHtml } from "../escapeHtml";

export class CharacterSelect extends Scene {
    constructor() {
        super("CharacterSelect");
        this.characters = [];
        this.selectedCharacter = null;
        this.portraits = [];
        this.infoPanel = {};
    }

    create() {
        // Reset scene state in case this Scene instance is reused
        this.characters = [];
        this.selectedCharacter = null;
        this.portraits = [];
        this.infoPanel = {};
        this.selectionBorder = null;
        this.errorText = null;
        this.isStarting = false;
        this.loadingCharacters = false;
        this.input.enabled = true;
        const controller = new AbortController();
        this.abortController = controller;
        this.events.once("shutdown", () => controller.abort());

        const { width, height } = this.scale;
        const centerX = width / 2;
        this.add
            .image(0, 0, "character_selection_background")
            .setOrigin(0, 0)
            .setDisplaySize(width, height)
            .setAlpha(0.7);
        this.add
            .text(centerX, 80, "Choose Your Delegate", {
                fontSize: "54px", fontFamily: FONTS.heading, color: COLORS.textCss, stroke: COLORS.backgroundCss, strokeThickness: 6,
            })
            .setOrigin(0.5);

        createPresetButton(this, "menu", 110, 30, "Main Menu", () => {
            this.scene.start("MainMenu");
        }, { width: 180, height: 40, maxFontSize: 18 });

        this.statusText = this.add
            .text(centerX, height / 2, "Loading delegates...", {
                fontSize: "24px", fontFamily: FONTS.body, color: COLORS.textCss, align: "center",
            })
            .setOrigin(0.5);
        this.retryButton = createPresetButton(this, "menu", centerX, height / 2 + 70, "Retry Connection", () => {
            this.loadCharacters();
        }).container.setVisible(false);
        this.loadCharacters();
    }

    async loadCharacters() {
        if (this.loadingCharacters) return;
        this.loadingCharacters = true;
        const signal = this.abortController.signal;
        this.retryButton.setVisible(false);
        this.statusText.setText("Loading delegates...").setColor(COLORS.textCss);
        try {
            const data = await ApiService.request("/game/characters", "GET", undefined, undefined, signal);
            if (signal.aborted) return;
            if (data.characters.length === 0) throw new Error("No delegates are available.");
            this.characters = data.characters;
            this.createInfoPanel();
            this.createCharacterPortraits();
            this.createSelectButton();
            this.statusText.setVisible(false);
        } catch (error) {
            if (signal.aborted) return;
            this.statusText.setText("Could not load delegates.\nRetry to reconnect.").setColor(COLORS.negativeCss);
            this.retryButton.setVisible(true);
        }
        if (!signal.aborted) this.loadingCharacters = false;
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
            addKeyboardButton(this, portrait, () => `Select ${char.name}`, "pointerdown");

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
        if (this.isStarting) return;
        // Clear hover tint and any existing glow from all portraits
        this.portraits.forEach((portrait) => {
            portrait.clearTint();
            if (portrait.filters) portrait.filters.internal.clear();
        });

        // Highlight the selected one. The gold border always renders; the soft
        // gold glow is a v4 filter (WebGL-only), so it is skipped on the Canvas
        // fallback renderer where filters are unavailable.
        if (this.sys.game.renderer.type === Phaser.WEBGL) {
            selectedPortrait.enableFilters();
            selectedPortrait.filters.internal.addGlow(COLORS.gold, 6, 0, 1);
        }

        if (!this.selectionBorder) this.selectionBorder = this.add.graphics();
        this.selectionBorder.clear();
        this.selectionBorder.lineStyle(6, COLORS.gold, 1);
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
        const panelX = this.scale.width / 2;
        const panelY = 515;
        const panelWidth = 800;
        const panelHeight = 250;

        const panel = this.add.graphics();
        panel.fillStyle(COLORS.panel, 0.98);
        panel.fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 8);
        panel.lineStyle(1, COLORS.border, 1);
        panel.strokeRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 8);

        this.infoPanel.name = this.add
            .text(panelX, panelY - 90, "", {
                fontSize: "36px", fontFamily: FONTS.heading, color: COLORS.textCss,
            })
            .setOrigin(0.5);

        this.infoPanel.title = this.add
            .text(panelX, panelY - 50, "", {
                fontSize: "24px", fontFamily: FONTS.body, color: COLORS.secondaryTextCss, fontStyle: "italic",
            })
            .setOrigin(0.5);

        this.infoPanel.strategy = this.add.dom(panelX - panelWidth / 2 + 20, panelY - 15)
            .createElement("div")
            .setOrigin(0, 0);
        this.infoPanel.strategy.node.className = "delegate-strategy";
        this.infoPanel.strategy.node.tabIndex = 0;
        this.infoPanel.strategy.node.setAttribute("aria-label", "Delegate strengths and objectives");
    }

    updateInfoPanel() {
        if (this.selectedCharacter) {
            this.infoPanel.name.setText(this.selectedCharacter.name);
            this.infoPanel.title.setText(this.selectedCharacter.title);
            this.infoPanel.strategy.node.innerHTML = `
                <p><strong>Strengths:</strong> ${escapeHtml(this.selectedCharacter.strengths)}</p>
                <p><strong>Objectives:</strong> ${escapeHtml(this.selectedCharacter.objectives)}</p>
            `;
        }
    }

    createSelectButton() {
        this.selectButton = createPresetButton(this, "confirm", this.scale.width / 2, this.scale.height - 48, "Confirm Delegate", () => {
            this.startSelectedGame();
        });
    }

    async startSelectedGame() {
        if (this.isStarting || !this.selectedCharacter) return;
        this.isStarting = true;
        this.input.enabled = false;
        this.selectButton.container.disableInteractive().setAlpha(0.6);
        this.selectButton.label.setText("Starting game...");
        if (this.errorText) this.errorText.destroy();
        this.errorText = null;
        const characterId = this.selectedCharacter.id;
        const signal = this.abortController.signal;
        try {
            await ApiService.startGame(characterId, signal);
            if (signal.aborted) return;
            this.scene.start("Game", { characterId });
        } catch (error) {
            if (signal.aborted) return;
            this.isStarting = false;
            this.input.enabled = true;
            this.selectButton.container.setInteractive({ useHandCursor: true }).setAlpha(1);
            this.selectButton.label.setText("Retry Start");
            this.showError("Could not start this delegate. Retry, or check your saved game from the main menu.");
        }
    }

    showError(message) {
        if (this.errorText) this.errorText.destroy();
        this.errorText = this.add
            .text(this.scale.width / 2, this.scale.height - 104, message, {
                fontSize: "18px", fontFamily: FONTS.body, color: COLORS.negativeCss,
                align: "center", wordWrap: { width: this.scale.width - 200 },
            })
            .setOrigin(0.5);
    }
}
