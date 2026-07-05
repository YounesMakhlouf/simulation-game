import Phaser from "phaser";

const BUTTON_PRESETS = {
    // Main menu style - white with blue hover
    menu: {
        width: 350,
        height: 60,
        radius: 20,
        maxFontSize: 28,
        bgColor: 0xffffff,
        hoverBgColor: 0x87ceeb,
        shadowColor: 0x666666,
        textColor: "#000000",
        fontFamily: "Arial",
        fontStyle: "bold",
        liftOnHover: true,
    },

    // Action/confirm button - green
    confirm: {
        width: 250,
        height: 60,
        radius: 15,
        maxFontSize: 24,
        bgColor: 0x006400,
        hoverBgColor: 0x008000,
        shadowColor: 0x003300,
        textColor: "#ffffff",
        fontFamily: "Georgia, serif",
        fontStyle: "bold",
        liftOnHover: false,
    },

    // Danger/action phase button - dark red
    danger: {
        width: 280,
        height: 50,
        radius: 15,
        maxFontSize: 20,
        bgColor: 0x8b0000,
        hoverBgColor: 0xb22222,
        shadowColor: 0x4a0000,
        textColor: "#ffffff",
        fontFamily: "Georgia, serif",
        fontStyle: "bold",
        liftOnHover: false,
        hasBorder: true,
        borderColor: 0xffffff,
        borderWidth: 2,
    },

    // Info/intel button - dark blue
    info: {
        width: 150,
        height: 40,
        radius: 10,
        maxFontSize: 18,
        bgColor: 0x003366,
        hoverBgColor: 0x004488,
        shadowColor: 0x001a33,
        textColor: "#ffffff",
        fontFamily: "Georgia, serif",
        fontStyle: "normal",
        liftOnHover: false,
    },

    // Small utility button
    small: {
        width: 280,
        height: 50,
        radius: 12,
        maxFontSize: 22,
        bgColor: 0xffffff,
        hoverBgColor: 0x87ceeb,
        shadowColor: 0x666666,
        textColor: "#000000",
        fontFamily: "Arial",
        fontStyle: "bold",
        liftOnHover: true,
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
        radius = 20,
        maxFontSize = 28,
        minFontSize = 10,
        padding = 10,
        bgColor = 0xffffff,
        hoverBgColor = 0x87ceeb,
        shadowColor = 0x666666,
        textColor = "#000000",
        fontFamily = "Arial",
        fontStyle = "bold",
        liftOnHover = true,
        hasBorder = false,
        borderColor = 0xffffff,
        borderWidth = 2,
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

    // Label with dynamic font fitting
    let fontSize = maxFontSize;
    let label;
    do {
        if (label) label.destroy();
        label = scene.add
            .text(0, 0, text, {
                fontSize: `${fontSize}px`, fontFamily, color: textColor, fontStyle,
            })
            .setOrigin(0.5);
        fontSize -= 1;
    } while (label.width > width - padding && fontSize >= minFontSize);

    container.add([shadow, bg, label]);
    container.setSize(width, height);
    container.setInteractive(
        new Phaser.Geom.Rectangle(0, 0, width, height),
        Phaser.Geom.Rectangle.Contains
    );

    // Interactions
    container.on("pointerover", () => {
        drawBg(bg, hoverBgColor, 1);
        if (liftOnHover) label.y -= 2;
    });

    container.on("pointerout", () => {
        drawBg(bg, bgColor);
        if (liftOnHover) label.y += 2;
    });

    if (typeof onClick === "function") {
        container.on("pointerdown", onClick);
    }

    // Store label reference for easy text updates
    container.setData("label", label);

    return {container, shadow, bg, label};
}

/**
 * Creates a button using a preset style.
 * @param {Phaser.Scene} scene - The Phaser scene
 * @param {string} preset - Preset name: 'menu', 'confirm', 'danger', 'info', 'small'
 * @param {number} x - X position
 * @param {number} y - Y position
 * @param {string} text - Button label
 * @param {function} onClick - Click handler
 * @param {object} overrides - Optional overrides for the preset
 * @returns {{container, shadow, bg, label}}
 */
export function createPresetButton(scene, preset, x, y, text, onClick, overrides = {}) {
    const presetOpts = BUTTON_PRESETS[preset] || BUTTON_PRESETS.menu;
    return createUIButton(scene, x, y, text, onClick, {...presetOpts, ...overrides});
}
