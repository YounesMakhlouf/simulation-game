import {BaseModal} from '../classes/BaseModal';

const ACTION_GUIDANCE = {
    DIPLOMACY: {
        explanation: 'Seek an agreement, build an alliance, or negotiate support with another faction.',
        example: 'Offer a truce in exchange for safe passage through a rival’s territory.',
    },
    MILITARY: {
        explanation: 'Deploy forces to attack, defend, or secure a strategic position.',
        example: 'Send 20 troops to reinforce a threatened city and protect its supply route.',
    },
    ECONOMIC: {
        explanation: 'Invest in trade, supplies, or infrastructure to strengthen your faction.',
        example: 'Spend 200 treasury to purchase grain and resupply the army.',
    },
    ESPIONAGE: {
        explanation: 'Use agents to gather intelligence or disrupt a rival’s plans.',
        example: 'Send two spies to discover where the enemy plans to move its army.',
    },
};

export class ActionModal extends BaseModal {
    constructor() {
        super('ActionModal', {
            titleText: 'Action Phase: Plan Your Move', closeButtonText: '',  // No close button; we use a form submit
            resumeGameOnClose: false, closeOnEsc: false
        });
        this.gameManager = null;
    }

    init(data) {
        super.init(data);
        this.gameManager = data.gameManager;
    }

    createContent() {
        const playerResources = this.gameManager.gameState.your_character.resources || {};

        const formElement = this.addScrollableDom(`
            <div class="action-modal-form">
                <div class="action-form-fields">
                    <h2>Final Action</h2>
                    <div id="final-action-container">
                        <label for="action-type">Action Type:</label>
                        <select id="action-type" aria-describedby="action-explanation action-example">
                            <option value="DIPLOMACY">Diplomacy</option>
                            <option value="MILITARY">Military</option>
                            <option value="ECONOMIC">Economic</option>
                            <option value="ESPIONAGE">Espionage</option>
                        </select>
                        <div class="action-guidance" aria-live="polite">
                            <p id="action-explanation"></p>
                            <p id="action-example"></p>
                        </div>
                        <label for="action-details">Action Details:</label>
                        <textarea id="action-details" placeholder="Describe what you want to do, where, and what you hope to achieve."></textarea>
                    </div>
                    <h2>Resource Spending</h2>
                    <div id="resource-cost-container"></div>
                </div>
                <div class="action-form-footer">
                    <button id="submit-button">Submit Final Action</button>
                    <p id="error-message" role="alert">Please fill all required fields.</p>
                </div>
            </div>`);
        this.readablePanel.classList.add('action-planning-panel');

        const actionType = formElement.querySelector('#action-type');
        const updateGuidance = () => {
            const guidance = ACTION_GUIDANCE[actionType.value];
            formElement.querySelector('#action-explanation').textContent = guidance.explanation;
            formElement.querySelector('#action-example').textContent = `Example: ${guidance.example}`;
        };
        actionType.addEventListener('change', updateGuidance);
        updateGuidance();

        // Populate resources
        const resourceContainer = formElement.querySelector('#resource-cost-container');
        const formatNumber = new Intl.NumberFormat('en-US').format;
        Object.keys(playerResources).forEach((resourceName) => {
            const max = playerResources[resourceName] ?? 0;
            const resourceDiv = document.createElement('div');
            resourceDiv.className = 'resource-item';

            const label = document.createElement('label');
            label.htmlFor = `resource-${resourceName}`;
            label.textContent = resourceName;

            const input = document.createElement('input');
            input.type = 'number';
            input.id = `resource-${resourceName}`;
            input.className = 'resource-input';
            input.min = '0';
            input.max = String(max);
            input.value = '0';
            const summary = document.createElement('output');
            summary.id = `resource-summary-${resourceName}`;
            summary.className = 'resource-summary';
            summary.setAttribute('aria-live', 'polite');
            input.setAttribute('aria-describedby', summary.id);
            const updateSummary = () => {
                const spend = Number(input.value);
                summary.textContent = `Spend ${formatNumber(spend)} / Available ${formatNumber(max)} / Remaining ${formatNumber(max - spend)}`;
            };
            updateSummary();
            input.addEventListener('input', () => {
                // Clamp to [0, max]
                const v = Math.max(0, Math.min(max, parseInt(input.value || '0', 10)));
                input.value = String(isFinite(v) ? v : 0);
                updateSummary();
            });

            resourceDiv.appendChild(label);
            resourceDiv.appendChild(input);
            resourceDiv.appendChild(summary);
            resourceContainer.appendChild(resourceDiv);
        });

        // Submit
        const submitButton = formElement.querySelector('#submit-button');
        submitButton.addEventListener('click', () => this.handleSubmit(formElement));
    }

    async handleSubmit(form) {
        const submitButton = form.querySelector('#submit-button');
        if (submitButton.disabled) return;
        const errorMessageElement = form.querySelector('#error-message');
        errorMessageElement.style.visibility = 'hidden';

        const requiredFields = ['action-details'];
        let isValid = true;

        requiredFields.forEach((id) => {
            const el = form.querySelector('#' + id);
            el.classList.remove('input-error');
            if (!el.value || el.value.trim() === '') {
                el.classList.add('input-error');
                isValid = false;
            }
        });

        if (!isValid) {
            errorMessageElement.innerText = 'Please fill all required text fields.';
            errorMessageElement.style.visibility = 'visible';
            return;
        }

        // Gather resource costs
        const resourceCost = {};
        const resourceInputs = form.querySelectorAll('.resource-input');
        resourceInputs.forEach((input) => {
            const value = Math.max(0, parseInt(input.value || '0', 10));
            const name = input.id.replace('resource-', '');
            if (value > 0) resourceCost[name] = value;
        });

        const finalAction = {
            character_id: this.gameManager.playerCharacterId,
            action_type: form.querySelector('#action-type').value,
            action_details: form.querySelector('#action-details').value,
            resource_cost: resourceCost
        };

        submitButton.disabled = true;
        submitButton.textContent = 'Submitting action...';
        const accepted = await this.gameManager.submitPlayerAction(finalAction);
        if (accepted) {
            this.closeModal();
            this.scene.resume('Game');
            this.scene.resume('HUDScene');
        } else {
            submitButton.disabled = false;
            submitButton.textContent = 'Submit Final Action';
            errorMessageElement.textContent = 'Your action was not accepted. Please try again.';
            errorMessageElement.style.visibility = 'visible';
        }
    }
}
