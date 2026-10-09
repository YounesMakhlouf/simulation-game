export class AudioManager {
    /**
     * A central manager for all game audio, including background music and sound effects.
     * @param {Phaser.Game} game - The main Phaser game instance.
     */
    constructor(game) {
        this.game = game;
        this.currentMusic = null;
        this.musicVolume = 0.5; // Default volume (0 to 1)
        this.pendingMusic = null;
        this.game.cache.audio.events.on("add", (_cache, key) => {
            if (this.pendingMusic?.key === key) {
                this.playMusic(key, this.pendingMusic.loop);
            }
        });
    }

    /**
     * Plays a background music track. If another track is already playing, it stops it first.
     * @param {string} key - The key of the audio asset to play.
     * @param {boolean} loop - Whether the music should loop. Defaults to true.
     */
    playMusic(key, loop = true) {
        if (!this.game.cache.audio.exists(key)) {
            this.pendingMusic = { key, loop };
            return;
        }
        this.pendingMusic = null;
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

    /**
     * Toggles global mute for all game audio.
     * @returns {boolean} The new mute state.
     */
    toggleMute() {
        this.game.sound.mute = !this.game.sound.mute;
        return this.game.sound.mute;
    }
}
