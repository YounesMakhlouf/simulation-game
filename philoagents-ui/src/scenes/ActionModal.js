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
        this.input.keyboard.disableGlobalCapture();

        const content = this.getContentBounds();

        const formElement = this.addScrollableDom(`

<div class="action-modal-form" style="box-sizing:border-box; padding:12px 16px 16px;"> <h2>Final Action</h2> <div id="final-action-container"> <label for="action-type">Action Type:</label> <select id="action-type"> <option value="DIPLOMACY">DIPLOMACY</option> <option value="MILITARY">MILITARY</option> <option value="ECONOMIC">ECONOMIC</option> <option value="ESPIONAGE">ESPIONAGE</option> </select>
  <label for="action-details">Action Details:</label>
  <textarea id="action-details" placeholder="Specific details of your chosen action..."></textarea>

  <label for="reasoning">Reasoning:</label>
  <textarea id="reasoning" placeholder="Your in-character reasoning..."></textarea>
</div>

<h2>Resource Cost</h2>
<div id="resource-cost-container"></div>

<button id="submit-button">Submit Final Action</button>
<p id="error-message">Please fill all required fields.</p>
</div> `);


        // Populate resources
        const resourceContainer = formElement.getChildByID('resource-cost-container');
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
        const submitButton = formElement.getChildByID('submit-button');
        submitButton.addEventListener('click', () => this.handleSubmit(formElement));

        // Prevent Phaser keyboard capture when focusing inputs
        const inputs = formElement.node.querySelectorAll('textarea, input, select');
        inputs.forEach((el) => {
            el.addEventListener('focus', () => this.input.keyboard.disableGlobalCapture());
            el.addEventListener('blur', () => this.input.keyboard.enableGlobalCapture());
        });

        // Keep DOM aligned if window/game resizes
        this.events.on('modal-resize', (bounds) => {
            formElement.setPosition(bounds.x, bounds.y);
            formElement.node.style.width = `${bounds.width}px`;
            formElement.node.style.maxHeight = `${bounds.height}px`;
        });

        // Re-enable capture when shutting down
        this.events.once('shutdown', () => this.input.keyboard.enableGlobalCapture());
    }

    handleSubmit(form) {
        const errorMessageElement = form.getChildByID('error-message');
        errorMessageElement.style.visibility = 'hidden';

        const requiredFields = ['action-details', 'reasoning'];
        let isValid = true;

        requiredFields.forEach((id) => {
            const el = form.getChildByID(id);
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
        const resourceInputs = form.node.querySelectorAll('.resource-input');
        resourceInputs.forEach((input) => {
            const value = Math.max(0, parseInt(input.value || '0', 10));
            const name = input.id.replace('resource-', '');
            if (value > 0) resourceCost[name] = value;
        });

        const finalAction = {
            character_id: this.gameManager.playerCharacterId,
            reasoning: form.getChildByID('reasoning').value,
            action_type: form.getChildByID('action-type').value,
            action_details: form.getChildByID('action-details').value,
            resource_cost: resourceCost
        };

        this.gameManager.submitPlayerAction(finalAction);
        this.closeModal();
    }
}