import { BaseModal } from '../classes/BaseModal';
import { COLORS, FONTS } from '../configs/Theme';
import { escapeHtml } from '../escapeHtml';

export class IntelModal extends BaseModal {
    constructor() {
        super('IntelModal', {
            titleText: 'Intelligence Briefing',
            titleColor: COLORS.inkCss,
            panelColor: COLORS.parchment,
            panelAlpha: 1,
            panelBorderColor: COLORS.ink,
            maxPanelWidth: 800,
            maxPanelHeight: 500,
            closeButtonText: '[ Close Dossier ]',
            closeButtonColor: COLORS.inkCss,
            closeButtonHoverColor: COLORS.backgroundCss,
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
                .map((report, index) => `<h3 style="margin: 0 0 4px; font-family: ${FONTS.heading};">Report #${index + 1}</h3><p style="margin: 0 0 16px; white-space: pre-wrap;">${escapeHtml(report)}</p>`)
                .join('');

        this.addScrollableDom(`
            <div style="
                font-family: ${FONTS.body};
                font-size: 18px;
                color: ${COLORS.inkCss};
                line-height: 1.4;
                padding: 0 10px;
            ">${reportsHtml}</div>
        `).setDepth(2);
    }
}
