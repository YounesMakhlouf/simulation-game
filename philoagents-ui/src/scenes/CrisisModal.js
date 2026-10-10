import { BaseModal } from "../classes/BaseModal";
import { COLORS, FONTS } from "../configs/Theme";
import { escapeHtml } from "../escapeHtml";

export class CrisisModal extends BaseModal {
  constructor() {
    // Close button text/colors are the BaseModal defaults
    super("CrisisModal", { titleText: "Situation Report" });
  }

  init(data) {
    super.init(data);
    this.roundNumber = data.round || "N/A";
    this.crisisText = data.text || "No crisis update available.";
  }

  createContent() {
    // Update the title with round number
    if (this.title) {
      this.title.setText(`Round ${this.roundNumber} - Situation Report`);
    }

    // Add crisis text as HTML instead of Phaser text
    this.addScrollableDom(`
        <div style="
            font-size: 1.25rem;
            color: ${COLORS.textCss};
            inline-size: 100%;
            line-height: 1.4;
            overflow-wrap: break-word;
            white-space: pre-wrap;
            font-family: ${FONTS.body};
            text-align: start;
            padding: 0.625rem;
            margin-block-end: 1rem;
        ">
            ${escapeHtml(this.crisisText)}
        </div>
    `);

  }
}
