import { expect, it, vi } from 'vitest';

vi.mock('../src/classes/BaseModal', () => ({ BaseModal: class {} }));
import { ActionModal } from '../src/scenes/ActionModal';

function makeForm() {
    const fields = {
        'submit-button': { disabled: false },
        'error-message': { style: {} },
        'action-details': { value: 'March on Rome', classList: { remove() {}, add() {} } },
        'action-type': { value: 'MILITARY' },
    };
    return { fields, querySelector: selector => fields[selector.slice(1)], querySelectorAll: () => [] };
}

it('retains the form and permits another submission after rejection', async () => {
    const modal = new ActionModal();
    const form = makeForm();
    modal.gameManager = { playerCharacterId: 'hannibal', submitPlayerAction: vi.fn().mockResolvedValue(false) };
    modal.closeModal = vi.fn();

    await modal.handleSubmit(form);

    expect(modal.closeModal).not.toHaveBeenCalled();
    expect(form.fields['action-details'].value).toBe('March on Rome');
    expect(form.fields['submit-button'].disabled).toBe(false);
    expect(form.fields['error-message'].style.visibility).toBe('visible');
});

it('allows one submission at a time and resumes the game after acceptance', async () => {
    const modal = new ActionModal();
    const form = makeForm();
    let resolve;
    modal.gameManager = { playerCharacterId: 'hannibal', submitPlayerAction: vi.fn(() => new Promise(done => { resolve = done; })) };
    modal.closeModal = vi.fn();
    modal.scene = { resume: vi.fn() };

    const pending = modal.handleSubmit(form);
    await modal.handleSubmit(form);
    expect(modal.gameManager.submitPlayerAction).toHaveBeenCalledOnce();
    expect(modal.closeModal).not.toHaveBeenCalled();
    resolve(true);
    await pending;

    expect(modal.closeModal).toHaveBeenCalledOnce();
    expect(modal.scene.resume).toHaveBeenCalledWith('Game');
    expect(modal.scene.resume).toHaveBeenCalledWith('HUDScene');
});

function createPlanner() {
    const node = () => ({ children: [], attributes: {}, value: '',
        appendChild(child) { this.children.push(child); },
        setAttribute(name, value) { this.attributes[name] = value; },
        addEventListener(name, listener) { this[name] = listener; } });
    vi.stubGlobal('document', { createElement: node });
    const form = makeForm();
    Object.assign(form.fields, { 'action-explanation': node(), 'action-example': node(), 'resource-cost-container': node() });
    form.fields['action-type'] = Object.assign(node(), { value: 'DIPLOMACY' });
    form.fields['submit-button'].addEventListener = vi.fn();
    form.querySelectorAll = () => form.fields['resource-cost-container'].children.map(row => row.children[1]);
    const modal = new ActionModal();
    modal.gameManager = { playerCharacterId: 'hannibal', gameState: { your_character: { resources: { Treasury: 2000 } } },
        submitPlayerAction: vi.fn().mockResolvedValue(false) };
    modal.readablePanel = { classList: { add: vi.fn() } };
    modal.addScrollableDom = vi.fn(() => form);
    modal.createContent();
    return { modal, form };
}

it('explains all four action types and gives examples without overwriting a draft', () => {
    try {
        const { form } = createPlanner();
        const actionType = form.fields['action-type'];
        const examples = new Set();
        for (const [type, explanation] of [['DIPLOMACY', 'agreement'], ['MILITARY', 'Deploy'], ['ECONOMIC', 'Invest'], ['ESPIONAGE', 'intelligence']]) {
            actionType.value = type;
            actionType.change();
            expect(form.fields['action-explanation'].textContent).toContain(explanation);
            expect(form.fields['action-example'].textContent).toMatch(/^Example: .+/);
            examples.add(form.fields['action-example'].textContent);
        }
        expect(examples.size).toBe(4);
        expect(form.fields['action-details'].value).toBe('March on Rome');
    } finally { vi.unstubAllGlobals(); }
});

it('shows formatted spending and remaining resources, clamps input, and submits numeric costs', async () => {
    try {
        const { modal, form } = createPlanner();
        const [label, input, summary] = form.fields['resource-cost-container'].children[0].children;
        expect(label.textContent).toBe('Treasury');
        expect(summary.textContent).toBe('Spend 0 / Available 2,000 / Remaining 2,000');
        expect(input.attributes['aria-describedby']).toBe(summary.id);
        for (const [value, clamped, remaining] of [['200', '200', '1,800'], ['3000', '2000', '0'], ['-10', '0', '2,000'], ['invalid', '0', '2,000']]) {
            input.value = value;
            input.input();
            expect(input.value).toBe(clamped);
            expect(summary.textContent).toContain(`Remaining ${remaining}`);
        }
        input.value = '200'; input.input();
        await modal.handleSubmit(form);
        expect(modal.gameManager.submitPlayerAction).toHaveBeenCalledWith(expect.objectContaining({ resource_cost: { Treasury: 200 } }));
    } finally { vi.unstubAllGlobals(); }
});
