import {Scene} from "phaser";

export class BaseModal extends Scene {
    constructor(key, options = {}) {
        super(key);

        this.options = {
            // Overlay
            overlayColor: 0x000000,
            overlayAlpha: 0.7,

            // Panel
            panelColor: 0x111111,
            panelAlpha: 0.92,
            panelBorderColor: 0xffffff,
            panelBorderWidth: 2,
            panelRadius: 16,

            // Layout
            margin: 24, // distance from screen edges
            padding: 20, // inner padding
            maxPanelWidth: 924,
            maxPanelHeight: 668,
            autoCenter: true,

            // Title
            titleText: "Modal Dialog",
            titleFontSize: "32px",
            titleColor: "#ffffff",

            // Close button
            closeButtonText: "[ Continue ]",
            closeButtonFontSize: "24px",
            closeButtonColor: "#ffd700",
            closeButtonHoverColor: "#ffffff",

            // Keyboard
            closeOnEsc: true,
            resumeGameOnClose: true,

            ...options,
        };

        this.modalData = null;

        // store objects for layout updates
        this._layout = {
            panel: null, overlay: null, title: null,
        };
    }

    init(data) {
        this.modalData = data || {};
    }

    create() {
        this.createOverlay();
        this.createPanel();
        this.createTitle();
        this.createContent(); // subclass implements
        if (this.options.closeButtonText) this.createCloseButton();
        this.setupKeyboardHandling();

        // keep layout correct on resize
        this.scale.on("resize", this.updateLayout, this);
        this.events.once(Phaser.Scenes.Events.SLEEP, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, this.updateLayout, this);
        });
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, this.updateLayout, this);
        });
        this.events.once(Phaser.Scenes.Events.DESTROY, () => {
            this.scale.off(Phaser.Scale.Events.RESIZE, this.updateLayout, this);
        });
    }

    shutdown() {
        this.scale.off("resize", this.updateLayout, this);
    }

    createOverlay() {
        const {width, height} = this.scale;
        this.overlay = this.add.graphics();
        this.overlay.fillStyle(this.options.overlayColor, this.options.overlayAlpha);
        this.overlay.fillRect(0, 0, width, height);
        // Block clicks to the game behind the modal
        this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);
        this._layout.overlay = this.overlay;
    }

    createPanel() {
        const {panelX, panelY, panelWidth, panelHeight} = this.computePanelRect();

        this.panelX = panelX;
        this.panelY = panelY;
        this.panelWidth = panelWidth;
        this.panelHeight = panelHeight;

        this.panel = this.add.graphics();
        this.redrawPanel();
        this._layout.panel = this.panel;
    }

    redrawPanel() {
        const g = this.panel;
        g.clear();
        g.fillStyle(this.options.panelColor, this.options.panelAlpha);
        g.lineStyle(this.options.panelBorderWidth, this.options.panelBorderColor, 1);
        g.fillRoundedRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight, this.options.panelRadius);
        g.strokeRoundedRect(this.panelX, this.panelY, this.panelWidth, this.panelHeight, this.options.panelRadius);
    }

    computePanelRect() {
        const {width, height} = this.scale;
        const margin = this.options.margin;

        const maxW = Math.min(this.options.maxPanelWidth, width - margin * 2);
        const maxH = Math.min(this.options.maxPanelHeight, height - margin * 2);

        const panelWidth = Math.max(320, maxW);
        const panelHeight = Math.max(220, maxH);

        const panelX = this.options.autoCenter ? (width - panelWidth) / 2 : this.options.panelX ?? margin;
        const panelY = this.options.autoCenter ? (height - panelHeight) / 2 : this.options.panelY ?? margin;

        return {panelX, panelY, panelWidth, panelHeight};
    }

    createTitle() {
        if (!this.options.titleText) return;

        const x = this.panelX + this.panelWidth / 2;
        const y = this.panelY + this.options.padding + 6;

        this.title = this.add
            .text(x, y, this.options.titleText, {
                fontSize: this.options.titleFontSize, color: this.options.titleColor,
            })
            .setOrigin(0.5, 0);

        this._layout.title = this.title;
    }

    // Safe content rect: inside panel, below title, above bottom padding
    getContentBounds() {
        const pad = this.options.padding;
        const top = this.title ? this.title.getBounds().bottom + pad * 0.6 : this.panelY + pad;

        const x = this.panelX + pad;
        const y = top;
        const width = this.panelWidth - pad * 2;
        const height = this.panelY + this.panelHeight - pad - top;

        return {x, y, width, height};
    }

    createContent() {
        // Override in subclass
    }

    createCloseButton() {
        const y = this.panelY + this.panelHeight - this.options.padding - 8;

        this.closeButton = this.add
            .text(this.panelX + this.panelWidth / 2, y, this.options.closeButtonText, {
                fontSize: this.options.closeButtonFontSize, color: this.options.closeButtonColor, fontStyle: "bold",
            })
            .setOrigin(0.5, 1)
            .setInteractive({useHandCursor: true});

        this.closeButton.on("pointerover", () => this.closeButton.setColor(this.options.closeButtonHoverColor));
        this.closeButton.on("pointerout", () => this.closeButton.setColor(this.options.closeButtonColor));
        this.closeButton.on("pointerdown", () => this.closeModal());
    }

    setupKeyboardHandling() {
        if (this.options.closeOnEsc) {
            this.input.keyboard.on("keydown-ESC", () => this.closeModal());
        }
    }

    closeModal() {
        this.scene.stop(this.scene.key);
        if (this.options.resumeGameOnClose) this.scene.resume("Game");
        if (typeof this.options.onClose === "function") this.options.onClose();
    }

    updateLayout() {
        if (!this.sys || !this.sys.isActive) return;

        // Overlay
        const {width, height} = this.scale;
        this.overlay.clear();
        this.overlay.fillStyle(this.options.overlayColor, this.options.overlayAlpha);
        this.overlay.fillRect(0, 0, width, height);
        this.overlay.setInteractive(new Phaser.Geom.Rectangle(0, 0, width, height), Phaser.Geom.Rectangle.Contains);

        // Panel
        const r = this.computePanelRect();
        this.panelX = r.panelX;
        this.panelY = r.panelY;
        this.panelWidth = r.panelWidth;
        this.panelHeight = r.panelHeight;
        this.redrawPanel();

        // Title
        if (this.title) {
            this.title.setPosition(this.panelX + this.panelWidth / 2, this.panelY + this.options.padding + 6);
        }

        // Subclasses that use getContentBounds() can reflow if needed in their own resize handlers
        this.events.emit("modal-resize", this.getContentBounds());
    }

    // Optional helper to place a scrollable DOM container inside the content bounds
    addScrollableDom(html) {
        const b = this.getContentBounds();
        const dom = this.add.dom(b.x, b.y).createFromHTML(html).setOrigin(0, 0);
        // Ensure it fits. Reserve some space for the close button if present to avoid overlap.
        const reservedForCloseBtn = this.options.closeButtonText ? 56 : 0; // ~24px text + margins
        const maxH = Math.max(0, Math.floor(b.height - reservedForCloseBtn));
        dom.node.style.width = `${Math.floor(b.width)}px`;
        dom.node.style.maxHeight = `${maxH}px`;
        dom.node.style.marginBottom = `${reservedForCloseBtn}px`;
        dom.node.style.overflowY = "auto";
        dom.node.style.overflowX = "hidden"; // <- prevent horizontal scroll
        dom.node.style.boxSizing = "border-box";
        dom.node.style.webkitOverflowScrolling = "touch";
        return dom;
    }
}
