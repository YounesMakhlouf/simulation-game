// Match native keyboard controls to canvas bounds without changing the map scale.
export function addKeyboardButton(scene, target, getLabel, event = 'pointerup') {
    const button = document.createElement('button');
    button.className = 'canvas-keyboard-button';
    button.type = 'button';
    button.addEventListener('keydown', event => event.stopPropagation());
    button.addEventListener('keyup', event => event.stopPropagation());
    const sync = () => {
        const scenes = scene.scene.manager.getScenes(true);
        const modal = scenes.findLast(item => item.overlay);
        let visible = target.visible && scene.scene.isActive() && (!modal || modal === scene);
        for (let parent = target.parentContainer; parent; parent = parent.parentContainer) visible &&= parent.visible;
        button.hidden = !visible;
        button.disabled = !target.input?.enabled || !scene.input.enabled;
        const label = getLabel();
        if (button.textContent !== label) button.textContent = label;
        if (!visible) return;
        const canvas = scene.game.canvas.getBoundingClientRect();
        const bounds = target.getBounds();
        const scaleX = canvas.width / scene.scale.width;
        const scaleY = canvas.height / scene.scale.height;
        Object.assign(button.style, {
            left: `${canvas.left + bounds.x * scaleX}px`, top: `${canvas.top + bounds.y * scaleY}px`,
            width: `${bounds.width * scaleX}px`, height: `${bounds.height * scaleY}px`,
        });
    };
    button.addEventListener('click', () => {
        sync();
        if (!button.disabled && !button.hidden) target.emit(event);
    });
    document.body.append(button);
    scene.game.events.on('poststep', sync);
    sync();
    const cleanup = () => {
        button.remove();
        scene.game.events.off('poststep', sync);
        target.off('destroy', cleanup);
        scene.events.off('shutdown', cleanup);
        scene.events.off('destroy', cleanup);
    };
    target.once('destroy', cleanup);
    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
    return button;
}
