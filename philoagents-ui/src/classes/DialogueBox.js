class DialogueBox {
    constructor(scene, config = {}) {
        this.scene = scene;
        this.awaitingInput = false;

        // Set default configuration values
        const {
            x = 100,
            y = 500,
            width = 824,
            height = 200,
            backgroundColor = 0x000000,
            backgroundAlpha = 0.7,
            borderColor = 0xffffff,
            borderWidth = 2,
            textConfig = {
                font: '24px Arial',
                fill: '#ffffff',
                wordWrap: { width: 784 }
            },
            depth = 30,
            enableScrolling = true,
        } = config;

        this.config = config;
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
        this.container = scene.add.container(0, 0, [graphics, this.text]);
        this.container.setDepth(depth);
        this.container.setScrollFactor(0);
        this.hide();
    }

    show(message, awaitInput = false) {
        this.awaitingInput = awaitInput;

        if (this.enableScrolling && this.shouldUseScrolling(message)) {
            this.showWithScrolling(message);
        } else {
            this.showWithPhaser(message);
        }

        this.container.setVisible(true);
    }

    shouldUseScrolling(message) {
        // Simple heuristic: if message is long or contains many line breaks
        return message.length > 500 || (message.match(/\n/g) || []).length > 5;
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
            this.domElement.destroy();
        }

        // Create scrollable DOM element
        const padding = 20;
        const contentWidth = this.width - padding * 2;
        const contentHeight = this.height - padding * 2;

        const html = `
            <div style="
                font-size: 24px;
                color: #ffffff;
                font-family: Arial, sans-serif;
                line-height: 1.4;
                word-wrap: break-word;
                white-space: pre-wrap;
                padding: 0;
                margin: 0;
                width: 100%;
                height: 100%;
                overflow-y: auto;
                overflow-x: hidden;
                box-sizing: border-box;
                background: transparent;
            ">${message.replace(/\n/g, "<br>")}</div>
        `;

        this.domElement = this.scene.add
            .dom(this.x + padding, this.y + padding)
            .createFromHTML(html)
            .setOrigin(0, 0);

        this.domElement.node.style.width = `${contentWidth}px`;
        this.domElement.node.style.height = `${contentHeight}px`;

        // Add to container if possible
        this.container.add(this.domElement);
    }

    hide() {
        this.container.setVisible(false);
        this.awaitingInput = false;

        // Clean up DOM element
        if (this.domElement) {
            this.domElement.setVisible(false);
        }
    }

    destroy() {
        if (this.domElement) {
            this.domElement.destroy();
        }
        this.container.destroy();
    }

    isVisible() {
        return this.container.visible;
    }

    isAwaitingInput() {
        return this.awaitingInput;
    }
}

export default DialogueBox;
