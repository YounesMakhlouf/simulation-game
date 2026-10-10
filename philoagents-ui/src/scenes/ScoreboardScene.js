import { createReadablePanel } from '../classes/ReadablePanel';
import { Scene } from 'phaser';
import { COLORS } from '../configs/Theme';
import { escapeHtml } from '../escapeHtml';

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
            .fillStyle(COLORS.panel, 0.98)
            .lineStyle(1, COLORS.border, 1)
            .fillRoundedRect(100, 100, 824, 568, 8)
            .strokeRoundedRect(100, 100, 824, 568, 8);

        // Create HTML content for the scoreboard
        const scoreboardHTML = `
            <div class="scoreboard-container">
                <h2 class="scoreboard-subtitle">The Secret Undergame:</h2>
                <p class="scoreboard-text">${escapeHtml(this.scores.actual_undergame)}</p>
                
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
                
                <button class="scoreboard-return" id="return-button">Return to Main Menu</button>
            </div>
        `;

        // Add the DOM element
        const scoreboardElement = createReadablePanel(this, 'Final Scores', scoreboardHTML);
        
        // Add event listener to the return button
        const returnButton = scoreboardElement.querySelector('#return-button');
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
                    <td>${escapeHtml(scoreData.name)}</td>
                    <td>${escapeHtml(scoreData.faction_score)}</td>
                    <td>${escapeHtml(scoreData.undergame_score)}</td>
                    <td><strong>${escapeHtml(scoreData.total_score)}</strong></td>
                </tr>
            `;
        }).join('');
    }
}
