import { BaseModal } from "../classes/BaseModal";

export class CrisisModal extends BaseModal {
  constructor() {
    super("CrisisModal", {
      titleText: "Situation Report",
      closeButtonText: "[ Continue ]",
      closeButtonColor: "#ffd700",
      closeButtonHoverColor: "#ffffff",
    });
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

    const b = this.getContentBounds();

    // Add crisis text as HTML instead of Phaser text
    const crisisElement = this.addScrollableDom(`
        <div style="
            font-size: 20px;
            color: #dddddd;
            width: ${b.width}px;
            line-height: 1.4;
            word-wrap: break-word;
            white-space: normal;
            font-family: Arial, sans-serif;
            text-align: left;
            padding: 10px;
            margin-block-end: 1rem;
        ">
            ${this.crisisText}
        </div>
    `);

    crisisElement.setOrigin(0, 0);
  }
}
