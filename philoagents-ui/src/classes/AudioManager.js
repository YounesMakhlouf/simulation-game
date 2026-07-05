export class AudioManager {
    /**
     * A central manager for all game audio, including background music and sound effects.
     * @param {Phaser.Game} game - The main Phaser game instance.
     */
    constructor(game) {
        this.game = game;
        this.currentMusic = null;
        this.musicVolume = 0.5; // Default volume (0 to 1)
    }

    /**
     * Plays a background music track. If another track is already playing, it stops it first.
     * @param {string} key - The key of the audio asset to play.
     * @param {boolean} loop - Whether the music should loop. Defaults to true.
     */
    playMusic(key, loop = true) {
        // Stop any currently playing music to prevent overlap
        if (this.currentMusic) {
            this.currentMusic.stop();
        }

        // Play the new music track
        this.currentMusic = this.game.sound.add(key, {
            loop: loop, volume: this.musicVolume
        });
        this.currentMusic.play();
    }
}