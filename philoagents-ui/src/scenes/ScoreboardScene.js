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

        // Create HTML content for the scoreboard
        const scoreboardHTML = `
            <div class="scoreboard-container">
                <h1 class="scoreboard-title">Final Scores</h1>
                <h2 class="scoreboard-subtitle">The Secret Undergame:</h2>
                <p class="scoreboard-text">${this.scores.actual_undergame}</p>
                
                <table class="scoreboard-table">
                    <thead>
                        <tr>
                            <th>Character</th>
                            <th>Faction</th>
                            <th>Undergame</th>
                            <th>Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.generateScoreRows()}
                    </tbody>
                </table>
                
                <div class="scoreboard-return" id="return-button">[ Return to Main Menu ]</div>
            </div>
        `;

        // Add the DOM element
        const scoreboardElement = this.add.dom(512, 384).createFromHTML(scoreboardHTML).setOrigin(0.5);
        
        // Add event listener to the return button
        const returnButton = scoreboardElement.getChildByID('return-button');
        returnButton.addEventListener('click', () => {
            this.scene.start('MainMenu');
        });
    }
    
    generateScoreRows() {
        // Sort characters by total score (descending)
        const sortedScores = Object.entries(this.scores.scores)
            .sort((a, b) => b[1].total_score - a[1].total_score);
            
        return sortedScores.map((entry, index) => {
            const [charId, scoreData] = entry;
            const winnerClass = index === 0 ? 'scoreboard-winner' : '';
            
            return `
                <tr class="${winnerClass}">
                    <td>${scoreData.name}</td>
                    <td>${scoreData.faction_score}</td>
                    <td>${scoreData.undergame_score}</td>
                    <td><strong>${scoreData.total_score}</strong></td>
                </tr>
            `;
        }).join('');
    }
}