import {Scene} from "phaser";

export class ActionModal extends Scene {
    constructor() {
        super("ActionModal");
        this.gameManager = null;
    }

    init(data) {
        this.gameManager = data.gameManager;
    }

    create() {
        // Create the background and panel like in the CrisisModal
        const background = this.add.graphics().fillStyle(0x000000, 0.7).fillRect(0, 0, 1024, 768);
        const panel = this.add.graphics().fillStyle(0x111111, 0.9).lineStyle(2, 0xffffff, 1).fillRoundedRect(50, 50, 924, 668, 15).strokeRoundedRect(50, 50, 924, 668, 15);
        this.add
            .text(512, 80, "Action Phase: Plan Your Move", {
                fontSize: "32px", color: "#ffffff",
            })
            .setOrigin(0.5);
        const playerResources = this.gameManager.gameState.your_character.resources || {};

        // Disable keyboard capture to allow text input in form elements
        this.input.keyboard.disableGlobalCapture();

        // --- Create the HTML Form using Phaser's DOM Element ---
        // This is a placeholder for the HTML you would write in an external file or string.
        const formHTML = `
        <div class="action-modal-form">
            <h2>Final Action</h2>
            <div id="final-action-container">
                <label for="action-type">Action Type:</label>
                <select id="action-type">
                    <option value="DIPLOMACY">DIPLOMACY</option>
                    <option value="MILITARY">MILITARY</option>
                    <option value="ECONOMIC">ECONOMIC</option>
                    <option value="ESPIONAGE">ESPIONAGE</option>
                </select>

                <label for="action-details">Action Details:</label>
                <textarea id="action-details" placeholder="Specific details of your chosen action..."></textarea>

                <label for="reasoning">Reasoning:</label>
                <textarea id="reasoning" placeholder="Your in-character reasoning..."></textarea>
            </div>

            <h2>Resource Cost</h2>
            <div id="resource-cost-container">
                <!-- This will be populated dynamically -->
            </div>

            <button id="submit-button">Submit Final Action</button>
            <p id="error-message" style="color: red; text-align: center; visibility: hidden;">Please fill all required fields.</p>
        </div>
    `;

        const formElement = this.add.dom(512, 400).createFromHTML(formHTML);

        const resourceContainer = formElement.getChildByID("resource-cost-container");
        Object.keys(playerResources).forEach((resourceName) => {
            const resourceDiv = document.createElement("div");
            resourceDiv.style.display = "flex";
            resourceDiv.style.justifyContent = "space-between";
            resourceDiv.style.alignItems = "center";
            resourceDiv.style.marginBottom = "10px";

            const label = document.createElement("label");
            label.htmlFor = `resource-${resourceName}`;
            label.innerText = `${resourceName} (Max: ${playerResources[resourceName]}):`;

            const input = document.createElement("input");
            input.type = "number";
            input.id = `resource-${resourceName}`;
            input.className = "resource-input"; // For selecting all resource inputs later
            input.min = 0;
            input.max = playerResources[resourceName];
            input.value = 0;
            input.style.width = "100px";

            resourceDiv.appendChild(label);
            resourceDiv.appendChild(input);
            resourceContainer.appendChild(resourceDiv);
        });
        // Add event listener to the submit button
        const submitButton = formElement.getChildByID("submit-button");
        submitButton.addEventListener("click", () => {
            this.handleSubmit(formElement);
        });

        // Add event listeners to prevent Phaser from capturing keyboard events when form elements are focused
        const textareas = formElement.node.querySelectorAll("textarea");
        textareas.forEach((textarea) => {
            textarea.addEventListener("focus", () => {
                this.input.keyboard.disableGlobalCapture();
            });
        });

        // Re-enable keyboard capture when the modal is closed
        this.events.on("shutdown", () => {
            this.input.keyboard.enableGlobalCapture();
        });
    }

    handleSubmit(form) {
        const errorMessageElement = form.getChildByID("error-message");
        errorMessageElement.style.visibility = "hidden";

        // --- 1. VALIDATION ---
        const requiredFields = ["action-details", "reasoning"];
        let isValid = true;

        requiredFields.forEach((id) => {
            const element = form.getChildByID(id);
            element.classList.remove("input-error");
            if (element.value.trim() === "") {
                element.classList.add("input-error");
                isValid = false;
            }
        });

        if (!isValid) {
            errorMessageElement.innerText = "Please fill all required text fields.";
            errorMessageElement.style.visibility = "visible";
            return;
        }

        // --- 2. GATHER DATA and CONSTRUCT THE FINAL ACTION OBJECT ---

        // a. Gather resource costs
        const resourceCost = {};
        const resourceInputs = form.node.querySelectorAll(".resource-input"); // Use querySelectorAll
        resourceInputs.forEach((input) => {
            const value = parseInt(input.value, 10);
            if (value > 0) {
                // Get the resource name from the input's ID (e.g., "resource-MilitaryPower")
                const resourceName = input.id.replace("resource-", "");
                resourceCost[resourceName] = value;
            }
        });

        // b. Construct the final object
        const finalAction = {
            character_id: this.gameManager.playerCharacterId,
            reasoning: form.getChildByID("reasoning").value,
            action_type: form.getChildByID("action-type").value,
            action_details: form.getChildByID("action-details").value,
            resource_cost: resourceCost, // Add the dynamically gathered costs
        };

        console.log("Submitting Action Object:", finalAction);

        // --- 3. SUBMIT TO GAMEMANAGER ---
        this.gameManager.submitPlayerAction(finalAction);

        // --- 4. CLOSE MODAL ---
        this.scene.stop("ActionModal");
        // NOTE: We don't resume the 'Game' scene here. We wait for the new round.
        // The GameManager will handle resuming/restarting scenes after polling.
    }
}
