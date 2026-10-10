import { addKeyboardButton } from "./KeyboardButton";
import { COLORS, FONTS } from "../configs/Theme";

const BUTTON_PRESETS = {
    menu: {
        width: 350,
        height: 60,
        maxFontSize: 28,
        bgColor: COLORS.panel,
        hoverBgColor: COLORS.panelHover,
        textColor: COLORS.textCss,
    },
    primary: {
        width: 350,
        height: 60,
        maxFontSize: 28,
    },
    confirm: {
        width: 250,
        height: 60,
        maxFontSize: 24,
    },
    action: {
        width: 280,
        height: 50,
        maxFontSize: 20,
    },
    danger: {
        width: 350,
        height: 60,
        maxFontSize: 28,
        bgColor: COLORS.danger,
        hoverBgColor: COLORS.dangerHover,
        textColor: COLORS.textCss,
        borderColor: COLORS.dangerHover,
    },
    info: {
        width: 150,
        height: 40,
        maxFontSize: 18,
        bgColor: COLORS.panel,
        hoverBgColor: COLORS.panelHover,
        textColor: COLORS.textCss,
    },
};

/**
 * Creates a UI button with customizable options.
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} text - Button label
 * @param {function} onClick - Click handler
 * @param {object} opts - Custom options (merged with defaults)
 * @returns {{container, shadow, bg, label}}
 */
export function createUIButton(scene, x, y, text, onClick, opts = {}) {
    const {
        width = 350,
        height = 60,
        radius = 8,
        maxFontSize = 28,
        minFontSize = 10,
        padding = 10,
        bgColor = COLORS.gold,
        hoverBgColor = COLORS.goldHover,
        shadowColor = COLORS.background,
        textColor = COLORS.backgroundCss,
        fontFamily = FONTS.body,
        fontStyle = "bold",
        liftOnHover = false,
        hasBorder = true,
        borderColor = COLORS.border,
        borderWidth = 1,
        alpha = 1,
    } = opts;

    // Container for positioning
    const container = scene.add.container(x, y);

    // Shadow
    const shadow = scene.add.graphics();
    shadow.fillStyle(shadowColor, 1);
    shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 4, width, height, radius);

    // Background drawing helper
    const drawBg = (graphics, fillColor, fillAlpha = alpha) => {
        graphics.clear();
        graphics.fillStyle(fillColor, fillAlpha);
        graphics.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
        if (hasBorder) {
            graphics.lineStyle(borderWidth, borderColor, 1);
            graphics.strokeRoundedRect(-width / 2, -height / 2, width, height, radius);
        }
    };

    // Background
    const bg = scene.add.graphics();
    drawBg(bg, bgColor);

    // Label with dynamic font fitting; setFontSize re-measures in place
    const label = scene.add
        .text(0, 0, text, {
            fontSize: `${maxFontSize}px`, fontFamily, color: textColor, fontStyle,
        })
        .setOrigin(0.5);
    for (let fontSize = maxFontSize - 1; label.width > width - padding && fontSize >= minFontSize; fontSize--) {
        label.setFontSize(fontSize);
    }

    container.add([shadow, bg, label]);
    // setSize gives the container a centered hit area for setInteractive
    container.setSize(width, height);
    container.setInteractive();

    // Interactions
    container.on("pointerover", () => {
        drawBg(bg, hoverBgColor, 1);
        if (liftOnHover) label.y -= 2;
    });

    container.on("pointerout", () => {
        drawBg(bg, bgColor);
        if (liftOnHover) label.y += 2;
    });

    container.on("pointerdown", () => {
        scene.sound.play("ui-click", { volume: 0.4 });
        scene.tweens.add({ targets: container, scale: 0.95, duration: 60, yoyo: true });
    });

    if (typeof onClick === "function") {
        container.on("pointerup", onClick);
    }

    // Store label reference for easy text updates
    container.setData("label", label);

    addKeyboardButton(scene, container, () => label.text);
    return { container, shadow, bg, label };
}

/**
 * Creates a button using a preset style.
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {string} preset - Preset name: 'menu', 'primary', 'confirm', 'action', 'danger', 'info'
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} text - Button label
 * @param {function} onClick - Click handler
 * @param {object} overrides - Optional overrides for the preset
 * @returns {{container, shadow, bg, label}}
 */
export function createPresetButton(scene, preset, x, y, text, onClick, overrides = {}) {
    const presetOpts = BUTTON_PRESETS[preset] || BUTTON_PRESETS.menu;
    return createUIButton(scene, x, y, text, onClick, { ...presetOpts, ...overrides });
}
