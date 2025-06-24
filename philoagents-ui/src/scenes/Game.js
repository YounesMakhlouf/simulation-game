import {Scene} from 'phaser';
import Character from '../classes/Character';
import DialogueBox from '../classes/DialogueBox';
import DialogueManager from '../classes/DialogueManager';

export class Game extends Scene {
    constructor() {
        super('Game');
        this.controls = null;
        this.player = null;
        this.cursors = null;
        this.dialogueBox = null;
        this.spaceKey = null;

        // Game State
        this.playerCharacterId = null; // e.g., 'castlereagh'
        this.currentRound = 1;
        this.gameState = {}; // Will hold crisis updates, resources, etc.
        this.isPlayerTurn = true; // Controls when the player can act

        // Characters & Interaction
        this.delegates = []; // Array to hold all character/NPC objects
        this.activeDelegate = null; // The NPC the player is currently near

        this.dialogueManager = null;
        this.labelsVisible = true;
    }

    init(data) {
        // Get the chosen character from the CharacterSelect scene
        this.playerCharacterId = data.characterId;
    }

    create() {
        const map = this.createTilemap();
        const tileset = this.addTileset(map);
        const layers = this.createLayers(map, tileset);
        let screenPadding = 20;
        let maxDialogueHeight = 200;

        this.createDelegates(map, layers);

        this.setupPlayer(map, layers.worldLayer);
        const camera = this.setupCamera(map);

        this.setupControls(camera);

        this.setupDialogueSystem();

        this.dialogueBox = new DialogueBox(this);
        this.dialogueText = this.add
            .text(60, this.game.config.height - maxDialogueHeight - screenPadding + screenPadding, '', {
                font: "18px monospace",
                fill: "#ffffff",
                padding: {x: 20, y: 10},
                wordWrap: {width: 680},
                lineSpacing: 6,
                maxLines: 5
            })
            .setScrollFactor(0)
            .setDepth(30)
            .setVisible(false);

        this.spaceKey = this.input.keyboard.addKey('SPACE');

        // Initialize the dialogue manager
        this.dialogueManager = new DialogueManager(this);
        this.dialogueManager.initialize(this.dialogueBox);
    }

    createDelegates(map, layers) {
        const delegateConfigs = [{
            id: "metternich", name: "Metternich", atlas: "metternich_atlas", defaultDirection: "right", roamRadius: 800
        }, {
            id: "alexander_i", name: "Alexander I", atlas: "tsar_atlas", defaultDirection: "left", roamRadius: 750
        }, {
            id: "talleyrand", name: "Talleyrand", atlas: "talleyrand_atlas", defaultDirection: "front", roamRadius: 720
        }, // Add other delegates here...
        ];

        this.philosophers = [];

        delegateConfigs.forEach(config => {
            if (config.id !== this.playerCharacterId) {
                const spawnPoint = map.findObject("Objects", (obj) => obj.name === config.name);

                if (!spawnPoint) {
                    console.log(config)
                    console.error(`ERROR: Spawn point not found for delegate: "${config.name}". Check your Tiled map for an object with this exact name in the "Objects" object layer.`);
                    return; // Skip creating this character to prevent a crash.
                }

                this[config.id] = new Character(this, {
                    id: config.id,
                    name: config.name,
                    spawnPoint: spawnPoint,
                    atlas: config.id,
                    defaultDirection: config.defaultDirection,
                    worldLayer: layers.worldLayer,
                    defaultMessage: config.defaultMessage,
                    roamRadius: config.roamRadius,
                    moveSpeed: config.moveSpeed || 40,
                    pauseChance: config.pauseChance || 0.2,
                    directionChangeChance: config.directionChangeChance || 0.3,
                    handleCollisions: true
                });

                this.philosophers.push(this[config.id]);
            }
        });

        // Make all philosopher labels visible initially
        this.toggleDelegatesLabels(true);

        // Add collisions between philosophers
        for (let i = 0; i < this.philosophers.length; i++) {
            for (let j = i + 1; j < this.philosophers.length; j++) {
                this.physics.add.collider(this.philosophers[i].sprite, this.philosophers[j].sprite);
            }
        }
    }

    checkPhilosopherInteraction() {
        let nearbyPhilosopher = null;

        for (const philosopher of this.philosophers) {
            if (philosopher.isPlayerNearby(this.player)) {
                nearbyPhilosopher = philosopher;
                break;
            }
        }

        if (nearbyPhilosopher) {
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
                if (!this.dialogueBox.isVisible()) {
                    this.dialogueManager.startDialogue(nearbyPhilosopher);
                } else if (!this.dialogueManager.isTyping) {
                    this.dialogueManager.continueDialogue();
                }
            }

            if (this.dialogueBox.isVisible()) {
                nearbyPhilosopher.facePlayer(this.player);
            }
        } else if (this.dialogueBox.isVisible()) {
            this.dialogueManager.closeDialogue();
        }
    }

    createTilemap() {
        return this.make.tilemap({key: "map"});
    }

    addTileset(map) {
        const tuxmonTileset = map.addTilesetImage("tuxmon-sample-32px-extruded", "tuxmon-tiles");
        const greeceTileset = map.addTilesetImage("ancient_greece_tileset", "greece-tiles");
        const plantTileset = map.addTilesetImage("plant", "plant-tiles");

        return [tuxmonTileset, greeceTileset, plantTileset];
    }

    createLayers(map, tilesets) {
        const belowLayer = map.createLayer("Below Player", tilesets, 0, 0);
        const worldLayer = map.createLayer("World", tilesets, 0, 0);
        const aboveLayer = map.createLayer("Above Player", tilesets, 0, 0);
        worldLayer.setCollisionByProperty({collides: true});
        aboveLayer.setDepth(10);
        return {belowLayer, worldLayer, aboveLayer};
    }

    setupPlayer(map, worldLayer) {
        const spawnPoint = map.findObject("Objects", (obj) => obj.name === "Spawn Point");
        this.player = this.physics.add.sprite(spawnPoint.x, spawnPoint.y, "sophia", "sophia-front")
            .setSize(30, 40)
            .setOffset(0, 6);

        this.physics.add.collider(this.player, worldLayer);

        this.philosophers.forEach(philosopher => {
            this.physics.add.collider(this.player, philosopher.sprite);
        });

        this.createPlayerAnimations();

        // Set world bounds for physics
        this.physics.world.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        this.physics.world.setBoundsCollision(true, true, true, true);
    }

    createPlayerAnimations() {
        const anims = this.anims;
        const animConfig = [{key: "sophia-left-walk", prefix: "sophia-left-walk-"}, {
            key: "sophia-right-walk", prefix: "sophia-right-walk-"
        }, {key: "sophia-front-walk", prefix: "sophia-front-walk-"}, {
            key: "sophia-back-walk", prefix: "sophia-back-walk-"
        }];

        animConfig.forEach(config => {
            anims.create({
                key: config.key,
                frames: anims.generateFrameNames("sophia", {prefix: config.prefix, start: 0, end: 8, zeroPad: 4}),
                frameRate: 10,
                repeat: -1,
            });
        });
    }

    setupCamera(map) {
        const camera = this.cameras.main;
        camera.startFollow(this.player);
        camera.setBounds(0, 0, map.widthInPixels, map.heightInPixels);
        return camera;
    }

    setupControls(camera) {
        this.cursors = this.input.keyboard.createCursorKeys();
        this.controls = new Phaser.Cameras.Controls.FixedKeyControl({
            camera: camera,
            left: this.cursors.left,
            right: this.cursors.right,
            up: this.cursors.up,
            down: this.cursors.down,
            speed: 0.5,
        });

        this.labelsVisible = true;

        // Add ESC key for pause menu
        this.input.keyboard.on('keydown-ESC', () => {
            if (!this.dialogueBox.isVisible()) {
                this.scene.pause();
                this.scene.launch('PauseMenu');
            }
        });
    }

    setupDialogueSystem() {
        const screenPadding = 20;
        const maxDialogueHeight = 200;

        this.dialogueBox = new DialogueBox(this);
        this.dialogueText = this.add
            .text(60, this.game.config.height - maxDialogueHeight - screenPadding + screenPadding, '', {
                font: "18px monospace",
                fill: "#ffffff",
                padding: {x: 20, y: 10},
                wordWrap: {width: 680},
                lineSpacing: 6,
                maxLines: 5
            })
            .setScrollFactor(0)
            .setDepth(30)
            .setVisible(false);

        this.spaceKey = this.input.keyboard.addKey('SPACE');

        this.dialogueManager = new DialogueManager(this);
        this.dialogueManager.initialize(this.dialogueBox);
    }

    update(time, delta) {
        const isInDialogue = this.dialogueBox.isVisible();

        if (!isInDialogue) {
            this.updatePlayerMovement();
        }

        this.checkPhilosopherInteraction();

        this.philosophers.forEach(philosopher => {
            philosopher.update(this.player, isInDialogue);
        });

        if (this.controls) {
            this.controls.update(delta);
        }
    }

    updatePlayerMovement() {
        const speed = 175;
        const prevVelocity = this.player.body.velocity.clone();
        this.player.body.setVelocity(0);

        if (this.cursors.left.isDown) {
            this.player.body.setVelocityX(-speed);
        } else if (this.cursors.right.isDown) {
            this.player.body.setVelocityX(speed);
        }

        if (this.cursors.up.isDown) {
            this.player.body.setVelocityY(-speed);
        } else if (this.cursors.down.isDown) {
            this.player.body.setVelocityY(speed);
        }

        this.player.body.velocity.normalize().scale(speed);

        const currentVelocity = this.player.body.velocity.clone();
        const isMoving = Math.abs(currentVelocity.x) > 0 || Math.abs(currentVelocity.y) > 0;

        if (this.cursors.left.isDown && isMoving) {
            this.player.anims.play("sophia-left-walk", true);
        } else if (this.cursors.right.isDown && isMoving) {
            this.player.anims.play("sophia-right-walk", true);
        } else if (this.cursors.up.isDown && isMoving) {
            this.player.anims.play("sophia-back-walk", true);
        } else if (this.cursors.down.isDown && isMoving) {
            this.player.anims.play("sophia-front-walk", true);
        } else {
            this.player.anims.stop();
            if (prevVelocity.x < 0) this.player.setTexture("sophia", "sophia-left"); else if (prevVelocity.x > 0) this.player.setTexture("sophia", "sophia-right"); else if (prevVelocity.y < 0) this.player.setTexture("sophia", "sophia-back"); else if (prevVelocity.y > 0) this.player.setTexture("sophia", "sophia-front"); else {
                // If prevVelocity is zero, maintain current direction
                // Get current texture frame name
                const currentFrame = this.player.frame.name;

                // Extract direction from current animation or texture
                let direction = "front"; // Default

                // Check if the current frame name contains direction indicators
                if (currentFrame.includes("left")) direction = "left"; else if (currentFrame.includes("right")) direction = "right"; else if (currentFrame.includes("back")) direction = "back"; else if (currentFrame.includes("front")) direction = "front";

                // Set the static texture for that direction
                this.player.setTexture("sophia", `sophia-${direction}`);
            }
        }
    }

    toggleDelegatesLabels(visible) {
        this.delegates.forEach(delegate => {
            if (delegate.nameLabel) {
                delegate.nameLabel.setVisible(visible);
            }
        });
    }
}
