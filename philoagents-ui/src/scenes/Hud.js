import Phaser, { Scene } from "phaser";
import { COLORS } from "../configs/Theme";

const PHASE_GUIDANCE = {
    INITIALIZING: ['Preparing the round', 'wait for the situation report.'],
    DIPLOMACY: ['Diplomacy', 'negotiate with delegates, then choose your action.'],
    ACTION: ['Action', 'describe your plan, assign resources, then submit your action.'],
    WAITING_FOR_JUDGE: ['Resolving the round', 'wait for the results of everyone’s actions.'],
    ROUND_FAILED: ['Round interrupted', 'retry the round to continue.'],
};

export class HUDScene extends Scene {
    constructor() {
        super('HUDScene');
        this.gameManager = null;
    }

    init(data) {
        this.gameManager = data.gameManager;
    }

    create() {
        this.resourceRows = {};
        this.resourceValues = {};
        this.panel = document.createElement('aside');
        this.panel.className = 'game-hud';
        this.panel.setAttribute('aria-label', 'Round status and resources');
        this.panel.innerHTML = `
            <section class="hud-overview hud-card" aria-label="Current round">
                <div class="hud-overview-top">
                    <p class="hud-round"></p>
                    <button class="hud-intel" type="button">View intel (0)</button>
                </div>
                <p class="hud-phase"><strong></strong><span></span></p>
            </section>
            <section class="hud-resources hud-card" aria-label="Your resources">
                <h2>Resources</h2>
                <dl></dl>
            </section>
            <div class="hud-actions"><button type="button" hidden>Choose action</button></div>`;
        this.roundText = this.panel.querySelector('.hud-round');
        this.phaseText = this.panel.querySelector('.hud-phase strong');
        this.nextStepText = this.panel.querySelector('.hud-phase span');
        this.resourceList = this.panel.querySelector('dl');
        this.intelButton = this.panel.querySelector('.hud-intel');
        this.endDiplomacyButton = this.panel.querySelector('.hud-actions button');
        this.intelButton.addEventListener('click', () => {
            const reports = this.gameManager.gameState.your_character?.known_intel || [];
            if (reports.length) this.scene.get('Game').showIntelModal(reports);
        });
        this.endDiplomacyButton.addEventListener('click', () => {
            if (this.gameManager.gamePhase === 'ROUND_FAILED') {
                this.gameManager.retryRound();
            } else {
                this.gameManager.startActionPhase();
            }
        });
        this.panel.addEventListener('keydown', event => event.stopPropagation());
        this.panel.addEventListener('keyup', event => event.stopPropagation());
        document.body.append(this.panel);

        const syncVisibility = () => {
            this.panel.hidden = !this.scene.isActive() || this.scene.manager.getScenes(true).some(scene => scene.overlay);
        };
        this.game.events.on('poststep', syncVisibility);
        this.gameManager.events.on('stateUpdated', this.updateHUD, this);
        this.gameManager.events.on('phaseChanged', this.updatePhase, this);
        const cleanup = () => {
            this.panel.remove();
            this.game.events.off('poststep', syncVisibility);
            this.detachGameManagerEvents();
            this.events.off(Phaser.Scenes.Events.SHUTDOWN, cleanup);
            this.events.off(Phaser.Scenes.Events.DESTROY, cleanup);
        };
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
        this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
        this.updateHUD(this.gameManager.gameState);
        this.updatePhase(this.gameManager.gamePhase);
        syncVisibility();
    }

    detachGameManagerEvents() {
        this.gameManager.events.off('stateUpdated', this.updateHUD, this);
        this.gameManager.events.off('phaseChanged', this.updatePhase, this);
    }

    updateHUD(gameState) {
        if (!gameState?.your_character) return;
        this.roundText.textContent = `Round ${gameState.round_number}`;
        const resources = gameState.your_character.resources;
        for (const key of Object.keys(this.resourceRows)) {
            if (!(key in resources)) {
                this.resourceRows[key].row.remove();
                delete this.resourceRows[key];
                delete this.resourceValues[key];
            }
        }
        for (const [key, value] of Object.entries(resources)) {
            if (!this.resourceRows[key]) {
                const row = document.createElement('div');
                const label = document.createElement('dt');
                const name = key.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase();
                label.textContent = name.charAt(0).toUpperCase() + name.slice(1);
                const amount = document.createElement('dd');
                const number = document.createElement('span');
                amount.append(number);
                row.append(label, amount);
                this.resourceList.append(row);
                this.resourceRows[key] = { row, amount, number };
            }
            const { number, amount } = this.resourceRows[key];
            number.textContent = value.toLocaleString('en-US');
            const previous = this.resourceValues[key];
            if (previous !== undefined && value !== previous) this.showResourceDelta(amount, value - previous);
            this.resourceValues[key] = value;
        }
        const intelCount = gameState.your_character.known_intel?.length || 0;
        this.intelButton.textContent = `View intel (${intelCount})`;
        this.intelButton.disabled = intelCount === 0;
    }

    showResourceDelta(anchor, delta) {
        anchor.querySelector('.hud-resource-delta')?.remove();
        const floater = document.createElement('span');
        floater.className = 'hud-resource-delta';
        floater.textContent = `${delta > 0 ? '+' : ''}${delta.toLocaleString('en-US')}`;
        floater.style.color = delta > 0 ? COLORS.positiveCss : COLORS.negativeCss;
        anchor.append(floater);
        floater.addEventListener('animationend', () => floater.remove(), { once: true });
    }

    updatePhase(newPhase) {
        if (!this.phaseText || !newPhase) return;
        const [name, nextStep] = PHASE_GUIDANCE[newPhase];
        this.phaseText.textContent = name;
        this.nextStepText.textContent = ` — ${nextStep}`;
        this.endDiplomacyButton.textContent = newPhase === 'ROUND_FAILED' ? 'Retry round' : 'Choose action';
        this.endDiplomacyButton.hidden = newPhase !== 'DIPLOMACY' && newPhase !== 'ROUND_FAILED';
    }
}
