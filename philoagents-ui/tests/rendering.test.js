import { describe, expect, it, vi } from 'vitest';
import { escapeHtml } from '../src/escapeHtml';

vi.mock('../src/classes/ReadablePanel', () => ({ createReadablePanel: vi.fn() }));
import { createReadablePanel } from '../src/classes/ReadablePanel';

vi.mock('phaser', () => ({ Scene: class {} }));
vi.mock('../src/classes/BaseModal', () => ({ BaseModal: class {} }));

import { CrisisModal } from '../src/scenes/CrisisModal';
import { IntelModal } from '../src/scenes/IntelModal';
import { ScoreboardScene } from '../src/scenes/ScoreboardScene';
import DialogueBox from '../src/classes/DialogueBox';

const payload = '<img src=x onerror="alert(1)">&\n</div><script>alert(2)</script>';

function captureDom() {
    const element = { node: { style: {}, firstElementChild: { textContent: '' } }, setOrigin() { return this; }, setDepth() { return this; }, setVisible() { return this; } };
    let html;
    return {
        element,
        create(value) { html = value; return element; },
        check() {
            expect(html).not.toContain(payload);
            expect(html).not.toContain('<img');
            expect(html).not.toContain('<script');
            expect(html).toContain(escapeHtml(payload));
        },
    };
}

it('escapes HTML characters without losing plain text or line breaks', () => {
    expect(escapeHtml('&<>"\'\n')).toBe('&amp;&lt;&gt;&quot;&#39;\n');
    expect(escapeHtml('&lt;img&gt;')).toBe('&amp;lt;img&amp;gt;');
    expect(escapeHtml(42)).toBe('42');
});

describe('untrusted display text', () => {
    it('escapes crisis reports', () => {
        const modal = new CrisisModal();
        const dom = captureDom();
        modal.crisisText = payload;
        modal.getContentBounds = () => ({ width: 400 });
        modal.addScrollableDom = dom.create;
        modal.createContent();
        dom.check();
    });

    it('escapes private intelligence', () => {
        const modal = new IntelModal();
        const dom = captureDom();
        const stamp = { setScale() { return this; }, setAlpha() { return this; }, setRotation() { return this; }, setDepth() { return this; } };
        modal.intelReports = [payload];
        modal.getContentBounds = () => ({ y: 0 });
        modal.add = { image: () => stamp };
        modal.addScrollableDom = dom.create;
        modal.createContent();
        dom.check();
    });

    it('escapes the final plot and character names', () => {
        const scene = new ScoreboardScene();
        const dom = captureDom();
        const graphics = { fillStyle() { return this; }, fillRect() { return this; }, lineStyle() { return this; }, fillRoundedRect() { return this; }, strokeRoundedRect() { return this; } };
        dom.element.querySelector = () => ({ addEventListener() {} });
        createReadablePanel.mockImplementation((scene, title, html) => dom.create(html));
        scene.cameras = { main: { width: 1024, height: 768 } };
        scene.add = { graphics: () => graphics, dom: () => ({ createFromHTML: dom.create }) };
        scene.scores = { actual_undergame: payload, scores: { hannibal: { name: payload, faction_score: 80, undergame_score: 20, total_score: 100 } } };
        scene.create();
        dom.check();
        expect(scene.generateScoreRows()).toContain(escapeHtml(payload));
    });

    it('escapes scrollable dialogue, including text entered by the player', () => {
        const box = Object.create(DialogueBox.prototype);
        box.panel = { hidden: true };
        box.form = { hidden: true };
        box.content = { textContent: '', scrollTop: 40 };
        const content = box.content;
        box.show(payload);
        expect(content.textContent).toBe(payload);
        expect(box.isVisible()).toBe(true);
        box.show(payload + ' more text');
        expect(box.content).toBe(content);
        expect(content.scrollTop).toBe(40);
        box.hide();
        expect(box.isVisible()).toBe(false);
    });
});
