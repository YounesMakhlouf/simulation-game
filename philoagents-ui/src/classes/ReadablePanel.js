// Native dialogs stay at viewport scale and keep focus inside an open modal.
export function createReadablePanel(scene, title, html, onCancel) {
    const panel = document.createElement('dialog');
    panel.className = 'readable-panel';
    const heading = document.createElement('h2');
    heading.textContent = title;
    heading.id = `${scene.scene.key}-panel-title`;
    panel.setAttribute('aria-labelledby', heading.id);
    const content = document.createElement('div');
    content.className = 'readable-content';
    content.innerHTML = html;
    panel.append(heading, content);
    panel.addEventListener('keydown', event => event.stopPropagation());
    panel.addEventListener('keyup', event => event.stopPropagation());
    panel.addEventListener('cancel', event => { event.preventDefault(); onCancel?.(); });
    document.body.append(panel);
    panel.showModal();
    const cleanup = () => {
        panel.close();
        panel.remove();
        for (const event of ['shutdown', 'destroy', 'sleep']) scene.events.off(event, cleanup);
    };
    scene.events.once('shutdown', cleanup);
    scene.events.once('destroy', cleanup);
    scene.events.once('sleep', cleanup);
    return panel;
}
