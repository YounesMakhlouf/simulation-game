import { COLORS, FONTS } from "../configs/Theme";
import { escapeHtml } from "../escapeHtml";

class DialogueBox {
    constructor(scene, config = {}) {
        this.scene = scene;

        // Set default configuration values
        const {
            x = 100,
            y = 500,
            width = 824,
            height = 200,
            backgroundColor = COLORS.panel,
            backgroundAlpha = 0.98,
            borderColor = COLORS.border,
            borderWidth = 1,
            textConfig = {
                fontSize: "24px",
                fontFamily: FONTS.body,
                fill: COLORS.textCss,
                wordWrap: { width: 784 }
            },
            depth = 30,
            enableScrolling = true,
        } = config;

        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.enableScrolling = enableScrolling;

        // Create background
        const graphics = scene.add.graphics();
        graphics.fillStyle(backgroundColor, backgroundAlpha);
        graphics.fillRect(x, y, width, height);
        graphics.lineStyle(borderWidth, borderColor);
        graphics.strokeRect(x, y, width, height);

        // Create text with padding (for fallback)
        this.text = scene.add.text(x + 20, y + 20, "", textConfig);

        // Create DOM element for scrollable content
        this.domElement = null;

        // Group elements
        // Speaker name tab sitting on the box's top border
        this.nameTab = scene.add
            .text(x + 16, y, "", {
                fontSize: "18px",
                fontFamily: FONTS.body,
                fontStyle: "bold",
                fill: COLORS.goldCss,
                backgroundColor: COLORS.panelCss,
                padding: { x: 8, y: 4 },
            })
            .setOrigin(0, 1)
            .setVisible(false);

        this.container = scene.add.container(0, 0, [graphics, this.text, this.nameTab]);
        this.container.setDepth(depth);
        this.container.setScrollFactor(0);
        this.hide();
    }

    show(message) {
        if (this.enableScrolling) {
            this.showWithScrolling(message);
        } else {
            this.showWithPhaser(message);
        }

        this.container.setVisible(true);
    }

    showWithPhaser(message) {
        this.text.setText(message);
        this.text.setVisible(true);
        if (this.domElement) {
            this.domElement.setVisible(false);
        }
    }

    showWithScrolling(message) {
        this.text.setVisible(false);

        if (this.domElement) {
            this.domElement.node.firstElementChild.textContent = message;
            this.domElement.setVisible(true);
            return;
        }

        // Create scrollable DOM element
        const padding = 20;
        const contentWidth = this.width - padding * 2;
        const contentHeight = this.height - padding * 2;

        const html = `
            <div style="
                font-size: 1.5rem;
                color: ${COLORS.textCss};
                font-family: ${FONTS.body};
                line-height: 1.4;
                overflow-wrap: break-word;
                white-space: pre-wrap;
                padding: 0;
                margin: 0;
                box-sizing: border-box;
                background: transparent;
            ">${escapeHtml(message)}</div>
        `;

        this.domElement = this.scene.add
            .dom(this.x + padding, this.y + padding)
            .createFromHTML(html)
            .setOrigin(0, 0);

        this.domElement.node.style.inlineSize = `${contentWidth / 16}rem`;
        this.domElement.node.style.blockSize = `${contentHeight / 16}rem`;
        this.domElement.node.style.overflowY = "auto";
        this.domElement.node.style.overflowX = "hidden";

        // Add to container if possible
        this.container.add(this.domElement);
    }

    setSpeaker(name) {
        this.nameTab.setText(name || "").setVisible(!!name);
    }

    hide() {
        this.container.setVisible(false);

        // Clean up DOM element
        if (this.domElement) {
            this.domElement.setVisible(false);
        }
    }

    isVisible() {
        return this.container.visible;
    }
}

export default DialogueBox;
