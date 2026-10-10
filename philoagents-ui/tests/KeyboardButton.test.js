import { afterEach, expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { addKeyboardButton } from '../src/classes/KeyboardButton';

afterEach(() => vi.unstubAllGlobals());

it('syncs native buttons with visibility, disabled state, resizing and scene cleanup', () => {
    const handlers = {};
    const button = { style: {}, addEventListener: (name, fn) => { handlers[name] = fn; }, remove: vi.fn() };
    vi.stubGlobal('document', { createElement: () => button, body: { append: vi.fn() } });
    const target = Object.assign(new EventEmitter(), {
        visible: true, input: { enabled: true }, getBounds: () => ({ x: 100, y: 200, width: 300, height: 60 }),
    });
    let active = true, label = 'Continue', canvasWidth = 512, modal;
    const scene = {
        events: new EventEmitter(), input: { enabled: true }, scale: { width: 1024, height: 768 },
        game: { events: new EventEmitter(), canvas: { getBoundingClientRect: () => ({ left: 10, top: 20, width: canvasWidth, height: 384 }) } },
        scene: { isActive: () => active, manager: { getScenes: () => modal ? [scene, modal] : [scene] } },
    };
    const click = vi.fn();
    target.on('pointerup', click);
    addKeyboardButton(scene, target, () => label);
    expect(button.style.left).toBe('60px');
    expect(button.textContent).toBe('Continue');
    handlers.click();
    expect(click).toHaveBeenCalledOnce();
    target.input.enabled = false;
    handlers.click();
    expect(button.disabled).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    target.input.enabled = true;
    label = 'Submitting…'; canvasWidth = 1024;
    scene.game.events.emit('poststep');
    expect(button.textContent).toBe(label);
    expect(button.style.left).toBe('110px');
    modal = { overlay: {} };
    handlers.click();
    expect(button.hidden).toBe(true);
    expect(click).toHaveBeenCalledOnce();
    modal = null; active = false;
    scene.game.events.emit('poststep');
    expect(button.hidden).toBe(true);
    active = true; target.visible = false;
    scene.game.events.emit('poststep');
    expect(button.hidden).toBe(true);
    scene.events.emit('shutdown');
    expect(button.remove).toHaveBeenCalledOnce();
    expect(scene.game.events.listenerCount('poststep')).toBe(0);
    expect(scene.events.listenerCount('destroy')).toBe(0);
});
