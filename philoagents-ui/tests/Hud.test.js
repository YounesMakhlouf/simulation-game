import { afterEach, expect, it, vi } from 'vitest';
vi.mock('phaser', () => ({ default: {}, Scene: class {} }));
import { HUDScene } from '../src/scenes/Hud';

function node() {
    return { children: [], style: {}, append(...children) { this.children.push(...children); },
        remove: vi.fn(), addEventListener: vi.fn(), querySelector: () => null };
}
function hudFixture() {
    vi.stubGlobal('document', { createElement: node });
    const hud = new HUDScene();
    Object.assign(hud, { resourceRows: {}, resourceValues: {}, resourceList: node(), roundText: node(), phaseText: node(),
        nextStepText: node(), intelButton: node(), endDiplomacyButton: node() });
    return hud;
}
const state = (resources, intel = []) => ({ round_number: 2, your_character: { resources, known_intel: intel } });
afterEach(() => vi.unstubAllGlobals());

it('uses readable resource labels and formatted values without animating initial totals', () => {
    const hud = hudFixture();
    const delta = vi.spyOn(hud, 'showResourceDelta');
    hud.updateHUD(state({ Treasury: 2000, VeteranArmy: 80, NumidianCavalry: 40, SiegeEquipment: 20, Spies: 5 }));
    expect(hud.roundText.textContent).toBe('Round 2');
    expect(hud.resourceRows.Treasury.number.textContent).toBe('2,000');
    expect(hud.resourceRows.VeteranArmy.row.children[0].textContent).toBe('Veteran army');
    expect(hud.resourceRows.NumidianCavalry.row.children[0].textContent).toBe('Numidian cavalry');
    expect(hud.resourceRows.SiegeEquipment.row.children[0].textContent).toBe('Siege equipment');
    expect(delta).not.toHaveBeenCalled();
    expect(hud.intelButton.disabled).toBe(true);
});

it('keeps signed resource changes, reuses rows, and updates intel availability', () => {
    const hud = hudFixture();
    const delta = vi.spyOn(hud, 'showResourceDelta').mockImplementation(() => {});
    hud.updateHUD(state({ Treasury: 2000, VeteranArmy: 80 }));
    const row = hud.resourceRows.Treasury.row;
    hud.updateHUD(state({ Treasury: 1800, VeteranArmy: 90 }, ['Enemy supply route']));
    expect(hud.resourceRows.Treasury.row).toBe(row);
    expect(delta.mock.calls.map(call => call[1])).toEqual([-200, 10]);
    expect(hud.intelButton.textContent).toBe('View intel (1)');
    expect(hud.intelButton.disabled).toBe(false);
    hud.updateHUD(state({ Treasury: 1800 }));
    expect(hud.resourceRows.VeteranArmy).toBeUndefined();
});

it.each([
    ['INITIALIZING', 'Preparing the round', 'situation report', true],
    ['DIPLOMACY', 'Diplomacy', 'negotiate with delegates, then choose your action.', false],
    ['ACTION', 'Action', 'submit your action', true],
    ['WAITING_FOR_JUDGE', 'Resolving the round', 'wait for the results', true],
    ['ROUND_FAILED', 'Round interrupted', 'retry the round', false],
])('shows the next step for %s', (phase, title, nextStep, hidden) => {
    const hud = hudFixture();
    hud.updatePhase(phase);
    expect(hud.phaseText.textContent).toBe(title);
    expect(hud.nextStepText.textContent).toContain(nextStep);
    expect(hud.endDiplomacyButton.hidden).toBe(hidden);
    expect(hud.endDiplomacyButton.textContent).toBe(phase === 'ROUND_FAILED' ? 'Retry round' : 'Choose action');
});

it.each([[200, '+200', '#9bc49b'], [-20, '-20', '#e99a91']])('keeps the signed indicator for %i', (delta, label, color) => {
    const hud = hudFixture();
    const anchor = node();
    hud.showResourceDelta(anchor, delta);
    const indicator = anchor.children[0];
    expect(indicator.textContent).toBe(label);
    expect(indicator.style.color).toBe(color);
    const onEnd = indicator.addEventListener.mock.calls[0][1];
    onEnd();
    expect(indicator.remove).toHaveBeenCalledOnce();
});
