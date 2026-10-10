import Phaser from "phaser";
import { Game } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import { PauseMenu } from './scenes/PauseMenu';
import { CharacterSelect } from "./scenes/CharacterSelect";
import { HUDScene } from "./scenes/Hud";
import { CrisisModal } from "./scenes/CrisisModal";
import { ActionModal } from "./scenes/ActionModal";
import { IntelModal } from "./scenes/IntelModal";
import { EndGameModal } from "./scenes/EndGameModal";
import { InstructionsModal } from "./scenes/InstructionsModal";
import { ScoreboardScene } from "./scenes/ScoreboardScene";
import { AudioManager } from "./classes/AudioManager";
import { COLORS } from "./configs/Theme";

const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    backgroundColor: COLORS.background,
    roundPixels: true,
    scale: {
        mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, fullscreenTarget: document.body
    },
    dom: {
        createContainer: true
    },
    scene: [Preloader, MainMenu, Game, PauseMenu, CharacterSelect, HUDScene, CrisisModal, ActionModal, IntelModal, EndGameModal, InstructionsModal, ScoreboardScene],
    physics: {
        default: "arcade", arcade: {
            gravity: { y: 0 },
        },
    },
};
const game = new Phaser.Game(config);
game.audioManager = new AudioManager(game);
// A key held while focus enters HTML must not keep moving the player.
document.addEventListener('focusin', () => {
    game.scene.getScenes(true).forEach(scene => scene.input.keyboard?.resetKeys());
});
export default game;
