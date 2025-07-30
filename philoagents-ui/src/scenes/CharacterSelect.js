import {Scene} from 'phaser';

export class CharacterSelect extends Scene {
    constructor() {
        super('CharacterSelect');
        this.characters = [];
        this.selectedCharacter = null;
        this.portraits = [];
        this.infoPanel = {};
    }

    async create() {
        const {width, height} = this.sys.game.config;
        this.add.image(0, 0, 'character_selection_background').setOrigin(0, 0).setDisplaySize(width, height).setAlpha(0.7);
        this.add.text(512, 80, 'Choose Your Delegate', {
            fontSize: '54px', fontFamily: 'Georgia, serif', color: '#FFFFFF', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5);

        try {
            const response = await fetch('http://localhost:8000/game/characters');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            this.characters = data.characters;

            // Now that we have the data, create the rest of the scene
            this.createInfoPanel();
            this.createCharacterPortraits();
            this.createSelectButton();

        } catch (error) {
            console.error("Failed to fetch character data:", error);
            // Display an error message to the player
            this.add.text(512, 384, 'Error: Could not connect to the server.\nPlease ensure the backend is running.', {
                fontSize: '24px', color: '#ff0000', align: 'center'
            }).setOrigin(0.5);
        }
    }

    createCharacterPortraits() {
        const startX = 150;
        const y = 280;
        const spacing = 240;
        const TARGET_HEIGHT = 200; // All portraits will be scaled to this height

        this.characters.forEach((char, index) => {
            const portraitX = startX + (index * spacing);
            const portrait = this.add.image(portraitX, y, char.portrait_key)
                .setInteractive();

            const scale = TARGET_HEIGHT / portrait.height;
            portrait.setScale(scale);

            portrait.setData('character', char);
            this.portraits.push(portrait);
            // Visual feedback for selection
            const border = this.add.graphics();
            portrait.setData('border', border);

            portrait.on('pointerdown', () => {
                this.selectCharacter(portrait);
            });
        });

        // Initially select the first character
        this.selectCharacter(this.portraits[0]);
    }

    selectCharacter(selectedPortrait) {
        // Reset all borders
        this.portraits.forEach(portrait => {
            portrait.getData('border').clear();
            portrait.setTint(0xffffff); // Reset tint
        });

        // Highlight the selected one
        const border = selectedPortrait.getData('border');
        border.lineStyle(6, 0xffd700, 1); // Gold border
        border.strokeRect(selectedPortrait.x - selectedPortrait.displayWidth / 2, selectedPortrait.y - selectedPortrait.displayHeight / 2, selectedPortrait.displayWidth, selectedPortrait.displayHeight);
        selectedPortrait.setTint(0xffffcc); // Slight highlight tint

        this.selectedCharacter = selectedPortrait.getData('character');
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

        this.infoPanel.name = this.add.text(panelX, panelY - 90, '', {
            fontSize: '36px', fontFamily: 'Georgia, serif', color: '#ffffff'
        }).setOrigin(0.5);

        this.infoPanel.title = this.add.text(panelX, panelY - 50, '', {
            fontSize: '24px', fontFamily: 'Georgia, serif', color: '#dddddd', fontStyle: 'italic'
        }).setOrigin(0.5);

        this.infoPanel.description = this.add.text(panelX, panelY + 25, '', {
            fontSize: '20px', fontFamily: 'Arial', color: '#ffffff', wordWrap: {width: panelWidth - 40}, align: 'center'
        }).setOrigin(0.5);
    }

    updateInfoPanel() {
        if (this.selectedCharacter) {
            this.infoPanel.name.setText(this.selectedCharacter.name);
            this.infoPanel.title.setText(this.selectedCharacter.title);
            this.infoPanel.description.setText(this.selectedCharacter.description);
        }
    }

    createSelectButton() {
        const buttonX = 512;
        const buttonY = 720;
        const buttonWidth = 250;
        const buttonHeight = 60;

        const button = this.add.graphics();
        button.fillStyle(0x006400, 1); // Dark green
        button.fillRoundedRect(buttonX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight, 15);

        const buttonText = this.add.text(buttonX, buttonY, 'Confirm Delegate', {
            fontSize: '24px', fontFamily: 'Georgia, serif', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        button.setInteractive(new Phaser.Geom.Rectangle(buttonX - buttonWidth / 2, buttonY - buttonHeight / 2, buttonWidth, buttonHeight), Phaser.Geom.Rectangle.Contains);

        button.on('pointerover', () => button.fillStyle(0x008000, 1));

        button.on('pointerout', () => button.fillStyle(0x006400, 1));

        button.on('pointerdown', () => {
            if (this.selectedCharacter) {
                // Pass the selected character's ID to the Game scene
                this.scene.start('Game', {characterId: this.selectedCharacter.id});
            }
        });
    }
}