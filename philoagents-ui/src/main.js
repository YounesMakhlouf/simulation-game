import {Game} from './scenes/Game';
import {MainMenu} from './scenes/MainMenu';
import {Preloader} from './scenes/Preloader';
import {PauseMenu} from './scenes/PauseMenu';
import {CharacterSelect} from "./scenes/CharacterSelect";
import {HUDScene} from "./scenes/Hud";
import {CrisisModal} from "./scenes/CrisisModal";
import {ActionModal} from "./scenes/ActionModal";
import {IntelModal} from "./scenes/IntelModal";
import {EndGameModal} from "./scenes/EndGameModal";
import {ScoreboardScene} from "./scenes/ScoreboardScene";
import {AudioManager} from "./classes/AudioManager";

const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH
    },
    dom: {
        createContainer: true
    },
    scene: [Preloader, MainMenu, Game, PauseMenu, CharacterSelect, HUDScene, CrisisModal, ActionModal, IntelModal, EndGameModal, ScoreboardScene],
    physics: {
        default: "arcade", arcade: {
            gravity: {y: 0},
        },
    },
};
const game = new Phaser.Game(config);
game.audioManager = new AudioManager(game);
export default game;
