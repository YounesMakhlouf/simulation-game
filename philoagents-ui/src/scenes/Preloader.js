import { Scene } from 'phaser';

export class Preloader extends Scene
{
    constructor ()
    {
        super('Preloader');
    }

    preload ()
    {
        this.load.setPath('assets');

        // General assets
        this.load.image('background', 'talking_philosophers.jpg');
        this.load.image('logo', 'logo.png');
        this.load.image('metternich_portrait', 'images/portraits/metternich.webp');
        this.load.image('alexander_i_portrait', 'images/portraits/alexander_i.webp');
        this.load.image('talleyrand_portrait', 'images/portraits/talleyrand.webp');
        this.load.image('castlereagh_portrait', 'images/portraits/castlereagh.webp');
        // Tilesets
        this.load.image("tuxmon-tiles", "tilesets/tuxmon-sample-32px-extruded.png");
        this.load.image("greece-tiles", "tilesets/ancient_greece_tileset.png");
        this.load.image("plant-tiles", "tilesets/plant.png");

        // Tilemap
        this.load.tilemapTiledJSON("map", "tilemaps/philoagents-town.json");

        // Character assets
        this.load.atlas("sophia", "characters/sophia/atlas.png", "characters/sophia/atlas.json");
        this.load.atlas("metternich", "characters/metternich/atlas.png", "characters/metternich/atlas.json");
        this.load.atlas("alexander_i", "characters/alexander_i/atlas.png", "characters/alexander_i/atlas.json");
        this.load.atlas("talleyrand", "characters/talleyrand/atlas.png", "characters/talleyrand/atlas.json");
        this.load.atlas("castlereagh", "characters/castlereagh/atlas.png", "characters/castlereagh/atlas.json");
        // this.load.atlas("leibniz", "characters/leibniz/atlas.png", "characters/leibniz/atlas.json");
        // this.load.atlas("ada_lovelace", "characters/ada/atlas.png", "characters/ada/atlas.json");
        // this.load.atlas("turing", "characters/turing/atlas.png", "characters/turing/atlas.json");
        // this.load.atlas("searle", "characters/searle/atlas.png", "characters/searle/atlas.json");
        // this.load.atlas("chomsky", "characters/chomsky/atlas.png", "characters/chomsky/atlas.json");
        // this.load.atlas("dennett", "characters/dennett/atlas.png", "characters/dennett/atlas.json");
        // this.load.atlas("miguel", "characters/miguel/atlas.png", "characters/miguel/atlas.json");
        // this.load.atlas("paul", "characters/paul/atlas.png", "characters/paul/atlas.json");
    }

    create ()
    {
        this.scene.start('MainMenu');
    }
}
