import { BaseModal } from '../classes/BaseModal';
import { FONTS } from '../configs/Theme';

export class IntelModal extends BaseModal {
    constructor() {
        super('IntelModal', {
            titleText: 'Intelligence Briefing',
            titleColor: '#5a2d0c',
            panelColor: 0xfdf5e6, // Old paper color
            panelBorderColor: 0x5a2d0c, // Dark brown border
            maxPanelWidth: 800,
            maxPanelHeight: 500,
            closeButtonText: '[ Close Dossier ]',
            closeButtonColor: '#a0885f',
            closeButtonHoverColor: '#d4b47a',
        });
        this.intelReports = [];
    }

    init(data) {
        super.init(data);
        this.intelReports = data.intelReports || [];
    }

    createContent() {
        const b = this.getContentBounds();

        // Classified stamp: top-right of the dossier, under the text
        this.add.image(this.panelX + this.panelWidth - 140, b.y + 50, 'classified_stamp')
            .setScale(0.7)
            .setAlpha(0.25)
            .setRotation(0.15)
            .setDepth(1);

        const reportsHtml = this.intelReports.length === 0
            ? '<p>No intelligence reports available.</p>'
            : this.intelReports
                .map((report, index) => `<h3 style="margin: 0 0 4px;">Report #${index + 1}</h3><p style="margin: 0 0 16px;">${report}</p>`)
                .join('');

        this.addScrollableDom(`
            <div style="
                font-family: ${FONTS.heading};
                font-size: 18px;
                color: #5a2d0c;
                line-height: 1.4;
                padding: 0 10px;
            ">${reportsHtml}</div>
        `).setDepth(2);
    }
}
