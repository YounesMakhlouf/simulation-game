import { afterEach, expect, it, vi } from 'vitest';
import DialogueBox from '../src/classes/DialogueBox';

function element() {
    return { children: [], hidden: false, value: '', textContent: '', scrollTop: 0, scrollHeight: 500, clientHeight: 150,
        append(...nodes) { this.children.push(...nodes); },
        replaceChildren(...nodes) { this.children = nodes; },
        setAttribute: vi.fn(), focus: vi.fn() };
}
function boxFixture() {
    vi.stubGlobal('document', { createElement: element });
    const box = Object.create(DialogueBox.prototype);
    Object.assign(box, { threads: new Map(), panel: element(), content: element(), input: element(), speaker: element(),
        portrait: element(), send: element(), status: element() });
    box.open({ id: 'scipio', name: 'Scipio' });
    return box;
}
afterEach(() => vi.unstubAllGlobals());

it('retains each delegate’s messages across closing and reopening', () => {
    const box = boxFixture();
    box.appendMessage('You', 'Peace?', 'player');
    box.appendMessage('Scipio', '', 'delegate');
    box.updateReply('Perhaps.');
    const thread = box.thread;
    box.hide();
    box.open({ id: 'hanno', name: 'Hanno' });
    expect(box.thread.children).toHaveLength(0);
    box.open({ id: 'scipio', name: 'Scipio' });
    expect(box.thread).toBe(thread);
    expect(box.thread.children).toHaveLength(2);
    expect(box.thread.children[1].children[1].textContent).toBe('Perhaps.');
    expect(box.portrait.src).toBe('assets/images/portraits/scipio.webp');
});

it('updates one reply as plain text and preserves scrolling while reading earlier turns', () => {
    const box = boxFixture();
    box.appendMessage('You', 'Peace?', 'player');
    box.appendMessage('Scipio', '', 'delegate');
    box.content.scrollTop = 20;
    const payload = '<img src=x onerror="alert(1)">';
    box.updateReply(payload);
    expect(box.reply.body.textContent).toBe(payload);
    expect(box.thread.children).toHaveLength(2);
    expect(box.content.scrollTop).toBe(20);
    box.updateReply(payload, 'Response interrupted.');
    expect(box.reply.body.textContent).toBe(payload);
    expect(box.reply.error.hidden).toBe(false);
    box.content.scrollTop = 340;
    box.updateReply(payload + ' More');
    expect(box.content.scrollTop).toBe(500);
});

it('keeps history and the composer visible, names the responding delegate, and retains drafts', () => {
    const box = boxFixture();
    box.setBusy(true);
    box.setInputState('My next draft');
    expect(box.status.textContent).toBe('Scipio is responding…');
    expect(box.status.hidden).toBe(false);
    expect(box.send.disabled).toBe(true);
    expect(box.input.value).toBe('My next draft');
    expect(box.content.hidden).toBe(false);
    box.setBusy(false);
    expect(box.input.value).toBe('My next draft');
    expect(box.send.disabled).toBe(false);
    expect(box.status.hidden).toBe(true);
    box.setInputState('   ');
    expect(box.send.disabled).toBe(true);
});
