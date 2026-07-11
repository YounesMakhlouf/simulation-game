import Phaser, { Scene } from "phaser";
import { createUIButton } from "./ButtonFactory";
import { COLORS } from "../configs/Theme";

export class BaseModal extends Scene {
    constructor(key, options = {}) {
        super(key);

        this.options = {
            // Overlay (kept mainly as an input blocker; the backdrop blur now
            // provides the visual separation, so this is only a light dim)
            overlayColor: 0x000000,
            overlayAlpha: 0.35,

            // Backdrop focus effect to clearly signal a stopped game state).
            backdropBlur: true,
            backdropGrayscale: 0.6,
            backdropBlurStrength: 1,

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
            closeButtonColor: COLORS.goldCss,
            closeButtonHoverColor: "#ffffff",

            // Keyboard
            closeOnEsc: true,
            resumeGameOnClose: true,

            ...options,
        };

        this.modalData = null;
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
        this.applyBackdropFilters();

        const cleanup = () => this.removeBackdropFilters();
        this.events.once(Phaser.Scenes.Events.SLEEP, cleanup);
        this.events.once(Phaser.Scenes.Events.SHUTDOWN, cleanup);
        this.events.once(Phaser.Scenes.Events.DESTROY, cleanup);
    }

    // Blur + desaturate the main camera of every active scene rendered behind
    // this modal, so the modal panel becomes the visual focus.
    applyBackdropFilters() {
        this._backdropFilters = null;
        if (!this.options.backdropBlur) return;
        if (this.sys.game.renderer.type !== Phaser.WEBGL) return;

        const manager = this.scene.manager;
        const myIndex = manager.getIndex(this.scene.key);
        this._backdropFilters = [];

        manager.getScenes(true).forEach((scene) => {
            if (scene.scene.key === this.scene.key) return;
            // Only filter scenes that render behind this modal (lower index)
            if (manager.getIndex(scene) > myIndex) return;
            const camera = scene.cameras && scene.cameras.main;
            if (!camera || !camera.filters) return;

            const blur = camera.filters.internal.addBlur(0, 2, 2, this.options.backdropBlurStrength);
            const desaturate = camera.filters.internal.addColorMatrix();
            desaturate.colorMatrix.grayscale(this.options.backdropGrayscale);
            this._backdropFilters.push({ camera, controllers: [blur, desaturate] });
        });
    }

    removeBackdropFilters() {
        if (!this._backdropFilters) return;
        this._backdropFilters.forEach(({ camera, controllers }) => {
            controllers.forEach((c) => camera.filters.internal.remove(c));
        });
        this._backdropFilters = null;
    }

    createOverlay() {
        const { width, height } = this.scale;
        // Rectangle blocks clicks to the game behind the modal
        this.overlay = this.add
            .rectangle(0, 0, width, height, this.options.overlayColor, this.options.overlayAlpha)
            .setOrigin(0)
            .setInteractive();
    }

    createPanel() {
        const { panelX, panelY, panelWidth, panelHeight } = this.computePanelRect();

        this.panelX = panelX;
        this.panelY = panelY;
        this.panelWidth = panelWidth;
        this.panelHeight = panelHeight;

        this.panel = this.add.graphics();
        this.panel.fillStyle(this.options.panelColor, this.options.panelAlpha);
        this.panel.lineStyle(this.options.panelBorderWidth, this.options.panelBorderColor, 1);
        this.panel.fillRoundedRect(panelX, panelY, panelWidth, panelHeight, this.options.panelRadius);
        this.panel.strokeRoundedRect(panelX, panelY, panelWidth, panelHeight, this.options.panelRadius);
    }

    computePanelRect() {
        const { width, height } = this.scale;
        const margin = this.options.margin;

        const maxW = Math.min(this.options.maxPanelWidth, width - margin * 2);
        const maxH = Math.min(this.options.maxPanelHeight, height - margin * 2);

        const panelWidth = Math.max(320, maxW);
        const panelHeight = Math.max(220, maxH);

        const panelX = this.options.autoCenter ? (width - panelWidth) / 2 : this.options.panelX ?? margin;
        const panelY = this.options.autoCenter ? (height - panelHeight) / 2 : this.options.panelY ?? margin;

        return { panelX, panelY, panelWidth, panelHeight };
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
    }

    // Safe content rect: inside panel, below title, above bottom padding
    getContentBounds() {
        const pad = this.options.padding;
        const top = this.title ? this.title.getBounds().bottom + pad * 0.6 : this.panelY + pad;

        const x = this.panelX + pad;
        const y = top;
        const width = this.panelWidth - pad * 2;
        const height = this.panelY + this.panelHeight - pad - top;

        return { x, y, width, height };
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
            .setInteractive({ useHandCursor: true });

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

    createButton(x, y, text, onClick, opts = {}) {
        const defaults = { width: 280, height: 50, radius: 12 };
        const { container } = createUIButton(this, x, y, text, onClick, {
            ...defaults, ...opts,
        });
        return container;
    }
}
