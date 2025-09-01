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
    } = opts;

    // Container for positioning
    const container = scene.add.container(x, y);

    // Shadow
    const shadow = scene.add.graphics();
    shadow.fillStyle(shadowColor, 1);
    shadow.fillRoundedRect(-width / 2 + 4, -height / 2 + 4, width, height, radius);

    // Background
    const bg = scene.add.graphics();
    bg.fillStyle(bgColor, 1);
    bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);

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
    container.setInteractive(new Phaser.Geom.Rectangle(-width / 2, -height / 2, width, height), Phaser.Geom.Rectangle.Contains);

    // Interactions
    container.on("pointerover", () => {
        bg.clear();
        bg.fillStyle(hoverBgColor, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
        if (liftOnHover) label.y -= 2;
    });

    container.on("pointerout", () => {
        bg.clear();
        bg.fillStyle(bgColor, 1);
        bg.fillRoundedRect(-width / 2, -height / 2, width, height, radius);
        if (liftOnHover) label.y += 2;
    });

    if (typeof onClick === "function") {
        container.on("pointerdown", onClick);
    }

    return {container, shadow, bg, label};
}
