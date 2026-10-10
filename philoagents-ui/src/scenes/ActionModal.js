import {BaseModal} from '../classes/BaseModal';

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
            <div class="action-modal-form"> <h2>Final Action</h2> <div id="final-action-container"> <label for="action-type">Action Type:</label> <select id="action-type"> <option value="DIPLOMACY">DIPLOMACY</option> <option value="MILITARY">MILITARY</option> <option value="ECONOMIC">ECONOMIC</option> <option value="ESPIONAGE">ESPIONAGE</option> </select>
              <label for="action-details">Action Details:</label>
              <textarea id="action-details" placeholder="Specific details of your chosen action..."></textarea>
            </div>
            
            <h2>Resource Cost</h2>
            <div id="resource-cost-container"></div>
            
            <button id="submit-button">Submit Final Action</button>
            <p id="error-message" role="alert">Please fill all required fields.</p>
            </div> `);


        // Populate resources
        const resourceContainer = formElement.querySelector('#resource-cost-container');
        Object.keys(playerResources).forEach((resourceName) => {
            const max = playerResources[resourceName] ?? 0;
            const resourceDiv = document.createElement('div');
            resourceDiv.className = 'resource-item';

            const label = document.createElement('label');
            label.htmlFor = `resource-${resourceName}`;
            label.innerText = `${resourceName} (Max: ${max}):`;

            const input = document.createElement('input');
            input.type = 'number';
            input.id = `resource-${resourceName}`;
            input.className = 'resource-input';
            input.min = '0';
            input.max = String(max);
            input.value = '0';
            input.addEventListener('input', () => {
                // Clamp to [0, max]
                const v = Math.max(0, Math.min(max, parseInt(input.value || '0', 10)));
                input.value = String(isFinite(v) ? v : 0);
            });

            resourceDiv.appendChild(label);
            resourceDiv.appendChild(input);
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
