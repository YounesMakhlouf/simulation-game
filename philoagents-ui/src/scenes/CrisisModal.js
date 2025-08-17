import { BaseModal } from '../classes/BaseModal';

export class CrisisModal extends BaseModal {
    constructor() {
        super('CrisisModal', {
            titleText: 'Situation Report',
            closeButtonText: '[ Continue ]',
            closeButtonColor: '#ffd700',
            closeButtonHoverColor: '#ffffff'
        });
    }

    init(data) {
        super.init(data);
        this.roundNumber = data.round || 'N/A';
        this.crisisText = data.text || 'No crisis update available.';
    }

    createContent() {
        // Update the title with round number
        if (this.title) {
            this.title.setText(`Round ${this.roundNumber} - Situation Report`);
        }
        const b = this.getContentBounds();
        // Add crisis text content
        const text = this.add.text(
            b.x,
            b.y,
            this.crisisText, 
            { 
                fontSize: '20px', 
                color: '#dddddd',
                wordWrap: { width: b.width, useAdvancedWrap: true },
                lineSpacing: 6
            }
        ).setOrigin(0, 0);
    }
}