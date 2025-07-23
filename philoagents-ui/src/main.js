import { Game } from './scenes/Game';
import { MainMenu } from './scenes/MainMenu';
import { Preloader } from './scenes/Preloader';
import { PauseMenu } from './scenes/PauseMenu';
import {CharacterSelect} from "./scenes/CharacterSelect";
import {HUDScene} from "./scenes/Hud";
import {CrisisModal} from "./scenes/CrisisModal";

const config = {
    type: Phaser.AUTO,
    width: 1024,
    height: 768,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    scene: [
        Preloader,
        MainMenu,
        Game,
        PauseMenu,
        CharacterSelect,
        HUDScene,
        CrisisModal
    ],
    physics: {
        default: "arcade",
        arcade: {
            gravity: { y: 0 },
        },
    },
};

export default new Phaser.Game(config);
