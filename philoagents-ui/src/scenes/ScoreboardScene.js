import { Scene } from 'phaser';

export class ScoreboardScene extends Scene {
    constructor() {
        super('ScoreboardScene');
    }

    init(data) {
        this.scores = data.scores;
    }

    create() {
        // --- 1. SETUP UI ELEMENTS ---

        // Semi-transparent background overlay
        this.add.graphics()
            .fillStyle(0x000000, 0.8)
            .fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);

        // Main panel
        this.add.graphics()
            .fillStyle(0x111111, 0.95)
            .lineStyle(2, 0xffd700, 1) // Gold border
            .fillRoundedRect(100, 100, 824, 568, 15)
            .strokeRoundedRect(100, 100, 824, 568, 15);

        // Title
        this.add.text(512, 140, 'Final Scores', {
            fontSize: '48px', fontFamily: 'Georgia, serif', color: '#ffffff'
        }).setOrigin(0.5);

        // Undergame reveal
        this.add.text(512, 200, 'The Secret Undergame:', {
            fontSize: '24px', color: '#ffd700', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.add.text(512, 240, this.scores.actual_undergame, {
            fontSize: '18px', color: '#dddddd', align: 'center',
            wordWrap: { width: 700 }
        }).setOrigin(0.5);

        // --- 2. DISPLAY SCORES ---
        const startY = 320;
        const lineHeight = 40;
        
        // Header row
        this.add.text(200, startY, 'Character', { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' });
        this.add.text(400, startY, 'Faction', { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' });
        this.add.text(500, startY, 'Undergame', { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' });
        this.add.text(650, startY, 'Total', { fontSize: '22px', color: '#ffffff', fontStyle: 'bold' });

        // Sort characters by total score (descending)
        const sortedScores = Object.entries(this.scores.scores)
            .sort((a, b) => b[1].total_score - a[1].total_score);

        // Display each character's scores
        sortedScores.forEach((entry, index) => {
            const [charId, scoreData] = entry;
            const rowY = startY + (index + 1) * lineHeight;
            
            // Highlight the winner
            const textColor = index === 0 ? '#ffd700' : '#ffffff';
            
            this.add.text(200, rowY, scoreData.name, { fontSize: '20px', color: textColor });
            this.add.text(400, rowY, scoreData.faction_score.toString(), { fontSize: '20px', color: textColor });
            this.add.text(500, rowY, scoreData.undergame_score.toString(), { fontSize: '20px', color: textColor });
            this.add.text(650, rowY, scoreData.total_score.toString(), { fontSize: '20px', color: textColor, fontStyle: 'bold' });
        });

        // --- 3. ADD RETURN TO MENU BUTTON ---
        const returnButton = this.add.text(512, 620, '[ Return to Main Menu ]', {
            fontSize: '24px', color: '#ffd700', fontStyle: 'bold'
        })
            .setOrigin(0.5)
            .setInteractive({ useHandCursor: true });

        returnButton.on('pointerdown', () => {
            this.scene.start('MainMenu');
        });
    }
}