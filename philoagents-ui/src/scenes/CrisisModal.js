import { Scene } from 'phaser';

export class CrisisModal extends Scene {
    constructor() {
        super('CrisisModal');
    }

    init(data) {
        this.roundNumber = data.round || 'N/A';
        this.crisisText = data.text || 'No crisis update available.';
    }

    create() {
        // Create a semi-transparent background overlay
        const background = this.add.graphics();
        background.fillStyle(0x000000, 0.7);
        background.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        // Create the modal panel
        const panel = this.add.graphics();
        panel.fillStyle(0x111111, 0.9);
        panel.lineStyle(2, 0xffffff, 1);
        panel.fillRoundedRect(100, 100, 824, 568, 15);
        panel.strokeRoundedRect(100, 100, 824, 568, 15);

        // Add content
        this.add.text(512, 140, `Round ${this.roundNumber} - Situation Report`, { fontSize: '32px', color: '#ffffff' }).setOrigin(0.5);
        this.add.text(120, 200, this.crisisText, { fontSize: '20px', color: '#dddddd', wordWrap: { width: 784 } });

        // Add a "Continue" button
        const continueButton = this.add.text(512, 620, '[ Continue ]', { fontSize: '24px', color: '#ffd700', fontStyle: 'bold' })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        continueButton.on('pointerdown', () => {
            this.scene.stop('CrisisModal'); // Stop this modal scene
            this.scene.resume('Game');      // Resume the main game scene
        });
    }
}