import {Scene} from 'phaser';

export class Preloader extends Scene {
    constructor() {
        super('Preloader');
    }

    preload() {
        this.load.setPath('assets');

        // General assets
        this.load.image('background', 'hannibal_crossing_the_alps.png');
        this.load.image('logo', 'logo.png');
        this.load.image('hannibal_barca_portrait', 'images/portraits/hannibal_barca.webp');
        this.load.image('hanno_the_great_portrait', 'images/portraits/hanno_the_great.webp');
        this.load.image('scipio_africanus_portrait', 'images/portraits/scipio_africanus.webp');
        this.load.image('philip_v_of_macedon_portrait', 'images/portraits/philip_v_of_macedon.webp');
        this.load.image('character_selection_background', 'character_selection_background.webp');
        this.load.image('classified_stamp', 'images/ui/classified_stamp.png');

        // Tilesets
        this.load.image("tuxmon-tiles", "tilesets/tuxmon-sample-32px-extruded.png");
        this.load.image("greece-tiles", "tilesets/ancient_greece_tileset.png");
        this.load.image("plant-tiles", "tilesets/plant.png");

        // Tilemap
        this.load.tilemapTiledJSON("map", "tilemaps/philoagents-town.json");

        // Character assets
        this.load.atlas("sophia", "characters/sophia/atlas.png", "characters/sophia/atlas.json");
        this.load.atlas("hanno_the_great", "characters/hanno_the_great/atlas.png", "characters/hanno_the_great/atlas.json");
        this.load.atlas("philip_v_of_macedon", "characters/philip_v_of_macedon/atlas.png", "characters/philip_v_of_macedon/atlas.json");
        this.load.atlas("scipio_africanus", "characters/scipio_africanus/atlas.png", "characters/scipio_africanus/atlas.json");
        this.load.atlas("hannibal_barca", "characters/hannibal_barca/atlas.png", "characters/hannibal_barca/atlas.json");
        // this.load.atlas("castlereagh", "characters/castlereagh/atlas.png", "characters/castlereagh/atlas.json");
        // this.load.atlas("leibniz", "characters/leibniz/atlas.png", "characters/leibniz/atlas.json");
        // this.load.atlas("ada_lovelace", "characters/ada/atlas.png", "characters/ada/atlas.json");
        // this.load.atlas("turing", "characters/turing/atlas.png", "characters/turing/atlas.json");
        // this.load.atlas("searle", "characters/searle/atlas.png", "characters/searle/atlas.json");
        // this.load.atlas("dennett", "characters/dennett/atlas.png", "characters/dennett/atlas.json");
        // this.load.atlas("miguel", "characters/miguel/atlas.png", "characters/miguel/atlas.json");
        // this.load.atlas("paul", "characters/paul/atlas.png", "characters/paul/atlas.json");
        this.load.audio('gameplay-music', 'audio/epic-theme.ogg');
    }

    create() {
        this.scene.start('MainMenu');
    }
}
