import {Scene} from 'phaser';

export class HUDScene extends Scene {
    constructor() {
        super('HUDScene');

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
        this.roundText = this.add.text(20, 20, 'Round: 1', {
            fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
        });
        this.phaseText = this.add.text(this.cameras.main.width - 20, 20, 'Phase: INITIALIZING', {
            fontSize: '24px', color: '#ffffff', stroke: '#000000', strokeThickness: 4
        }).setOrigin(1, 0);
        this.createEndDiplomacyButton();
        this.createIntelButton();

        this.gameManager.events.on('stateUpdated', this.updateHUD, this);
        this.gameManager.events.on('phaseChanged', this.updatePhase, this);

        this.updateHUD(this.gameManager.gameState);
        this.updatePhase(this.gameManager.gamePhase);
    }

    createIntelButton() {
        const buttonWidth = 150;
        const buttonHeight = 40;
        const buttonX = this.cameras.main.width - 90; // Position in top-right corner
        const buttonY = 80;

        this.intelButton = this.add.container(buttonX, buttonY);

        const buttonBackground = this.add.graphics()
            .fillStyle(0x003366, 0.8) // Dark blue
            .fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 10);

        const buttonText = this.add.text(0, 0, 'View Intel (0)', {
            fontSize: '18px', fontFamily: 'Georgia, serif', color: '#ffffff'
        }).setOrigin(0.5);

        this.intelButton.add([buttonBackground, buttonText]);
        this.intelButton.setSize(buttonWidth, buttonHeight);
        this.intelButton.setInteractive({useHandCursor: true});

        // Initially, it might be disabled if there's no intel
        this.intelButton.setData('text', buttonText); // Store reference for easy updates

        this.intelButton.on('pointerdown', () => {
            if (this.gameManager.gameState.your_character?.known_intel?.length > 0) {
                // Get the latest intel from the game manager
                const intelReports = this.gameManager.gameState.your_character.known_intel;
                // Launch the modal, passing the intel data
                this.scene.get('Game').showIntelModal(intelReports);
            }
        });

        // Add hover effects for better UX
        this.intelButton.on('pointerover', () => buttonBackground.setAlpha(1));
        this.intelButton.on('pointerout', () => buttonBackground.setAlpha(0.8));
    }


    createEndDiplomacyButton() {
        const buttonWidth = 280;
        const buttonHeight = 50;
        const buttonX = this.cameras.main.width / 2;
        const buttonY = this.cameras.main.height - 40;

        // Create a container for the button for easy show/hide
        this.endDiplomacyButton = this.add.container(buttonX, buttonY);

        const buttonBackground = this.add.graphics()
            .fillStyle(0x8B0000, 0.8) // Dark red, semi-transparent
            .fillRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 15)
            .lineStyle(2, 0xffffff, 1)
            .strokeRoundedRect(-buttonWidth / 2, -buttonHeight / 2, buttonWidth, buttonHeight, 15);

        const buttonText = this.add.text(0, 0, 'Proceed to Action Phase', {
            fontSize: '20px', fontFamily: 'Georgia, serif', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.endDiplomacyButton.add([buttonBackground, buttonText]);
        this.endDiplomacyButton.setSize(buttonWidth, buttonHeight);
        this.endDiplomacyButton.setInteractive({useHandCursor: true});

        // Initially hide the button
        this.endDiplomacyButton.setVisible(false);

        // --- Event Handlers ---
        this.endDiplomacyButton.on('pointerdown', () => {
            // Add a visual effect for the click
            this.tweens.add({
                targets: this.endDiplomacyButton,
                scaleX: 0.95,
                scaleY: 0.95,
                duration: 100,
                yoyo: true,
                onComplete: () => {
                    // Call the GameManager function to advance the phase
                    this.gameManager.startActionPhase();
                }
            });
        });

        this.endDiplomacyButton.on('pointerover', () => {
            buttonBackground.fillStyle(0xB22222, 1); // Lighter red on hover
        });

        this.endDiplomacyButton.on('pointerout', () => {
            buttonBackground.fillStyle(0x8B0000, 0.8);
        });
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

        const intelCount = gameState.your_character.known_intel?.length || 0;
        const buttonText = this.intelButton.getData('text');
        buttonText.setText(`View Intel (${intelCount})`);

        // Disable the button visually if there is no intel
        if (intelCount === 0) {
            this.intelButton.setAlpha(0.5).disableInteractive();
        } else {
            this.intelButton.setAlpha(1).setInteractive({useHandCursor: true});
        }
    }

    updatePhase(newPhase) {
        const phaseName = newPhase.replace('_', ' ').toUpperCase();
        this.phaseText.setText(`Phase: ${phaseName}`);
        if (newPhase === 'DIPLOMACY') {
            this.endDiplomacyButton.setVisible(true);
        } else {
            this.endDiplomacyButton.setVisible(false);
        }
    }
}