import { BaseModal } from '../classes/BaseModal';

export class IntelModal extends BaseModal {
    constructor() {
        super('IntelModal', {
            titleText: 'Intelligence Briefing',
            titleColor: '#5a2d0c',
            titleY: 150,
            panelColor: 0xfdf5e6, // Old paper color
            panelBorderColor: 0x5a2d0c, // Dark brown border
            panelWidth: 800,
            panelHeight: 500,
            panelX: 112, // Centered: (1024 - 800) / 2
            panelY: 134, // Centered: (768 - 500) / 2
            closeButtonText: '[ Close Dossier ]',
            closeButtonColor: '#a0885f',
            closeButtonHoverColor: '#d4b47a',
            closeButtonY: 520
        });
        this.intelReports = [];
    }

    init(data) {
        super.init(data);
        this.intelReports = data.intelReports || [];
    }

    createContent() {
        const panelX = this.cameras.main.width / 2;
        const panelY = this.cameras.main.height / 2;
        const panelWidth = this.options.panelWidth;

        // Add classified stamp
        const stamp = this.add.image(panelX + 250, panelY - 150, 'classified_stamp')
            .setScale(0.7)
            .setAlpha(0.25)
            .setRotation(0.15)
            .setDepth(1); // On top of the paper, but below the text

        // Divider line
        this.add.graphics()
            .fillStyle(0x5a2d0c, 1)
            .fillRect(panelX - 200, panelY - 170, 400, 2)
            .setDepth(2);

        // Intel reports content
        let yOffset = panelY - 120;
        const xStart = panelX - 350;
        const lineHeight = 30;

        if (this.intelReports.length === 0) {
            this.add.text(panelX, yOffset, 'No intelligence reports available.', {
                fontSize: '18px', fontFamily: 'Georgia, serif', color: '#5a2d0c'
            }).setOrigin(0.5).setDepth(2);
        } else {
            console.log(this.intelReports)
            this.intelReports.forEach((report, index) => {
                this.add.text(xStart, yOffset, `Report #${index + 1}: `, {
                    fontSize: '22px', fontFamily: 'Georgia, serif', color: '#5a2d0c', fontStyle: 'bold'
                }).setDepth(2);
                
                yOffset += lineHeight;
                
                const content = this.add.text(xStart, yOffset, report, {
                    fontSize: '18px', fontFamily: 'Georgia, serif', color: '#5a2d0c',
                    wordWrap: { width: panelWidth - 100 }
                }).setDepth(2);
                
                yOffset += content.height + 20; // Add space after each report
            });
        }
    }
}