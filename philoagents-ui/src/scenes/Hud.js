import {Scene} from 'phaser';

export class HUDScene extends Scene {
    constructor() {
        super('HUDScene');
        this.gameManager = null;

        // UI Text Objects
        this.roundText = null;
        this.phaseText = null;
        this.resourceTexts = [];
    }

    init(data) {
        this.gameManager = data.gameManager;
    }

    create() {
        this.roundText = this.add.text(20, 20, 'Round: 1', {
            fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
        });
        this.phaseText = this.add.text(this.cameras.main.width - 20, 20, 'Phase: INITIALIZING', {
            fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(1, 0);

        this.gameManager.events.on('stateUpdated', this.updateHUD, this);
        this.gameManager.events.on('phaseChanged', this.updatePhase, this);

        this.updateHUD(this.gameManager.gameState);
    }

    updateHUD(gameState) {
        if (!gameState || !gameState.your_character) return;

        // Update Round Number
        this.roundText.setText(`Round: ${gameState.round_number}`);

        // Clear previous resource texts
        this.resourceTexts.forEach(text => text.destroy());
        this.resourceTexts = [];

        // Dynamically display resources
        const resources = gameState.your_character.resources;
        let yPos = 60;
        for (const [key, value] of Object.entries(resources)) {
            const resourceText = this.add.text(20, yPos, `${key}: ${value}`, {fontSize: '18px', color: '#ffffff'});
            this.resourceTexts.push(resourceText);
            yPos += 25;
        }

        // TODO: Add an 'Intel' button here that listens for a click
        // to show the intel modal.
    }

    updatePhase(newPhase) {
        const phaseName = newPhase.replace('_', ' ').toUpperCase();
        this.phaseText.setText(`Phase: ${phaseName}`);
    }
}