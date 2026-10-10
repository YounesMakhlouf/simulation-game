import { BaseModal } from '../classes/BaseModal.js';

export class InstructionsModal extends BaseModal {
    constructor() {
        super('InstructionsModal', {
            titleText: 'How to Play', closeButtonText: '[ Continue ]',
            maxPanelWidth: 600,
            maxPanelHeight: 400,
        });
    }

    createContent() {
        const instructions = ['Arrow keys for moving', 'SPACE for talking to others', 'ESC for closing the dialogue', 'M for muting the sound', 'F for fullscreen','1. Read the Crisis Update each round.', '2. Submit your action (Diplomacy, Military, etc.).', '3. Negotiate privately with other delegates.', '4. Achieve your goals and deduce the secret plot.', 'Good luck, diplomat.'];

        this.addScrollableDom(`<ul>${instructions.map(text => `<li>${text}</li>`).join('')}</ul>`);
    }
}
