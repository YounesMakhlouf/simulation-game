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
        this.load.image('metternich_portrait', 'images/portraits/metternich.webp');
        this.load.image('alexander_i_portrait', 'images/portraits/alexander_i.webp');
        this.load.image('talleyrand_portrait', 'images/portraits/talleyrand.webp');
        this.load.image('castlereagh_portrait', 'images/portraits/castlereagh.webp');
        this.load.image('hannibal_barca_portrait', 'images/portraits/hannibal_barca.webp');
        this.load.image('hanno_the_great_portrait', 'images/portraits/hanno_the_great.webp');
        this.load.image('scipio_africanus_portrait', 'images/portraits/scipio_africanus.webp');
        this.load.image('philip_v_of_macedon_portrait', 'images/portraits/philip_v_of_macedon.webp');
        // Tilesets
        this.load.image("tuxmon-tiles", "tilesets/tuxmon-sample-32px-extruded.png");
        this.load.image("greece-tiles", "tilesets/ancient_greece_tileset.png");
        this.load.image("plant-tiles", "tilesets/plant.png");

        // Tilemap
        this.load.tilemapTiledJSON("map", "tilemaps/philoagents-town.json");

        // Character assets
        this.load.atlas("sophia_atlas", "characters/sophia/atlas.png", "characters/sophia/atlas.json");
        this.load.atlas("metternich_atlas", "characters/metternich/atlas.png", "characters/metternich/atlas.json");
        this.load.atlas("alexander_i_atlas", "characters/alexander_i/atlas.png", "characters/alexander_i/atlas.json");
        this.load.atlas("talleyrand_atlas", "characters/talleyrand/atlas.png", "characters/talleyrand/atlas.json");
        this.load.atlas("castlereagh_atlas", "characters/castlereagh/atlas.png", "characters/castlereagh/atlas.json");
        // this.load.atlas("leibniz", "characters/leibniz/atlas.png", "characters/leibniz/atlas.json");
        // this.load.atlas("ada_lovelace", "characters/ada/atlas.png", "characters/ada/atlas.json");
        // this.load.atlas("turing", "characters/turing/atlas.png", "characters/turing/atlas.json");
        // this.load.atlas("searle", "characters/searle/atlas.png", "characters/searle/atlas.json");
         this.load.atlas("hannibal_barca_atlas", "characters/hannibal_barca/atlas.png", "characters/hannibal_barca/atlas.json");
        // this.load.atlas("dennett", "characters/dennett/atlas.png", "characters/dennett/atlas.json");
        // this.load.atlas("miguel", "characters/miguel/atlas.png", "characters/miguel/atlas.json");
        // this.load.atlas("paul", "characters/paul/atlas.png", "characters/paul/atlas.json");
    }

    create() {
        this.scene.start('MainMenu');
    }
}
