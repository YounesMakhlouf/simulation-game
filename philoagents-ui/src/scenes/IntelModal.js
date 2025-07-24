import { Scene } from 'phaser';

export class IntelModal extends Scene {
    constructor() {
        super('IntelModal');
        this.intelReports = [];
    }

    init(data) {
        this.intelReports = data.intelReports || [];
    }

    create() {
        // Create a semi-transparent background overlay
        const background = this.add.graphics();
        background.fillStyle(0x000000, 0.7);
        background.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        // Create the modal panel
        const panel = this.add.graphics();
        panel.fillStyle(0x1a2d3d, 0.9); // Dark blue-grey panel
        panel.lineStyle(2, 0x87ceeb, 1); // Sky blue border
        panel.fillRoundedRect(100, 100, 824, 568, 15);
        panel.strokeRoundedRect(100, 100, 824, 568, 15);

        // Add Title
        this.add.text(512, 140, 'Intelligence Briefing', {
            fontSize: '32px',
            color: '#ffffff',
            fontFamily: 'Georgia, serif'
        }).setOrigin(0.5);

        // --- Display Intel Reports ---
        let yPos = 200;
        if (this.intelReports.length === 0) {
            this.add.text(512, 384, 'No intelligence gathered yet.', {
                fontSize: '20px',
                color: '#aaaaaa',
                fontStyle: 'italic'
            }).setOrigin(0.5);
        } else {
            this.intelReports.forEach((report, index) => {
                const reportText = `• ${report}`;
                this.add.text(130, yPos, reportText, {
                    fontSize: '18px',
                    color: '#e0e0e0',
                    wordWrap: { width: 764 }
                });
                // Simple way to estimate text height for positioning the next item
                const lines = reportText.length / 80; // Rough estimate
                yPos += 30 + (lines * 20);
            });
        }

        // Add a "Close" button
        const closeButton = this.add.text(512, 620, '[ Close Briefing ]', {
            fontSize: '24px',
            color: '#ffd700',
            fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });

        closeButton.on('pointerdown', () => {
            this.scene.stop('IntelModal'); // Stop this modal scene
            this.scene.resume('Game');     // Resume the main game scene
        });
    }
}