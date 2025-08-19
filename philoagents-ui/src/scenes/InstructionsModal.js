import {BaseModal} from '../classes/BaseModal.js';

export class InstructionsModal extends BaseModal {
    constructor() {
        super('InstructionsModal', {
            titleText: 'How to Play', closeButtonText: '[ Continue ]',
            maxPanelWidth: 600,
            maxPanelHeight: 400,
        });
    }

    createContent() {
        const b = this.getContentBounds();

        const instructions = ['Arrow keys for moving', 'SPACE for talking to others', 'ESC for closing the dialogue', '1. Read the Crisis Update each round.', '2. Submit your action (Diplomacy, Military, etc.).', '3. Negotiate privately with other delegates.', '4. Achieve your goals and deduce the secret plot.', 'Good luck, diplomat.'];

        const style = {
            fontSize: '20px', color: '#ffffff', align: 'center', wordWrap: {width: b.width - 10}
        };

        this.instructionsText = this.add.text(0, 0, instructions.join('\n'), style)
            .setOrigin(0.5, 0.5);

        // Function to recenter text
        const recenter = (bounds) => {
            const textHeight = this.instructionsText.height;
            const textWidth = this.instructionsText.width;

            const centerX = bounds.x + bounds.width / 2;
            const centerY = bounds.y + bounds.height / 2;

            this.instructionsText.setPosition(centerX, centerY);
        };

        // Initial centering
        recenter(b);

        // Recenter on modal resize
        this.events.on('modal-resize', (bounds) => {
            this.instructionsText.setWordWrapWidth(bounds.width - 10, true);
            recenter(bounds);
        });
    }
}