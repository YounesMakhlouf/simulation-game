import {Scene} from 'phaser';

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

        const panelX = this.cameras.main.width / 2;
        const panelY = this.cameras.main.height / 2;
        const panelWidth = 800;
        const panelHeight = 500;

        // Panel background (paper color)
        this.add.graphics()
            .fillStyle(0xfdf5e6, 1) // Old paper color
            .fillRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 15)
            .lineStyle(2, 0x5a2d0c, 1) // Dark brown border
            .strokeRoundedRect(panelX - panelWidth / 2, panelY - panelHeight / 2, panelWidth, panelHeight, 15);

        const stamp = this.add.image(panelX + 250, panelY - 150, 'classified_stamp')
            .setScale(0.7)
            .setAlpha(0.25)
            .setRotation(0.15)
            .setDepth(1);        // On top of the paper, but below the text

        // --- DOSSIER CONTENT ---
        const title = this.add.text(panelX, panelY - 200, 'Intelligence Briefing', {
            fontSize: '32px', fontFamily: 'Georgia, serif', color: '#5a2d0c', fontStyle: 'bold'
        }).setOrigin(0.5).setDepth(2); // Depth 2: On top of the stamp

        // Divider line
        this.add.graphics()
            .fillStyle(0x5a2d0c, 1)
            .fillRect(panelX - 200, panelY - 170, 400, 2)
            .setDepth(2);

        // Display Intel Reports
        if (this.intelReports.length > 0) {
            const reportText = this.intelReports.join('\n\n• ');
            this.add.text(panelX, panelY, `• ${reportText}`, {
                fontSize: '20px', fontFamily: 'Special Elite, monospace', // Thematic font
                color: '#333333', wordWrap: {width: panelWidth - 80}, lineSpacing: 10
            }).setOrigin(0.5).setDepth(2);
        } else {
            this.add.text(panelX, panelY, 'The dossier is empty.', {
                fontSize: '20px', fontFamily: 'Special Elite, monospace', color: '#888888', fontStyle: 'italic'
            }).setOrigin(0.5).setDepth(2);
        }

        // --- CLOSE BUTTON ---
        const closeButton = this.add.text(panelX, panelY + 220, '[ Close Dossier ]', {
            fontSize: '24px', color: '#a0885f', // Muted gold/brown
            fontFamily: 'Georgia, serif', fontStyle: 'bold'
        }).setOrigin(0.5).setInteractive({useHandCursor: true}).setDepth(2);

        closeButton.on('pointerdown', () => {
            this.scene.stop('IntelModal');
            this.scene.resume('Game');
        });

        closeButton.on('pointerover', () => closeButton.setColor('#d4b47a'));
        closeButton.on('pointerout', () => closeButton.setColor('#a0885f'));
    }
}