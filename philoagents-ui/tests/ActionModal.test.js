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
