import ApiService from '../services/ApiService';
import WebSocketApiService from '../services/WebSocketApiService';
import { STREAM_IDLE_TIMEOUT_MS } from '../config';

class DialogueManager {
    constructor(scene) {
        // Core properties
        this.scene = scene;
        this.dialogueBox = null;
        this.playerCharacterId = null;
        this.activeDelegate = null;
        // State management
        this.isTyping = false;
        this.isStreaming = false;
        this.currentMessage = '';
        this.streamingText = '';

        // Cursor properties
        this.cursorBlinkEvent = null;
        this.cursorVisible = true;

        // Connection management
        this.hasSetupListeners = false;
        this.disconnectTimeout = null;
    }

    // === Initialization ===

    initialize(dialogueBox) {
        this.dialogueBox = dialogueBox;

        if (!this.hasSetupListeners) {
            this.setupKeyboardListeners();
            this.hasSetupListeners = true;
        }
    }

    setupKeyboardListeners() {
        this.scene.input.keyboard.on('keydown', async (event) => {
            if (!this.isTyping) {
                if (this.isStreaming && (event.key === 'Space' || event.key === ' ')) {
                    this.skipStreaming();
                }
                return;
            }

            this.handleKeyPress(event);
        });
    }

    // === Input Handling ===

    async handleKeyPress(event) {
        if (event.key === 'Enter') {
            await this.handleEnterKey();
        } else if (event.key === 'Escape') {
            this.closeDialogue();
        } else if (event.key === 'Backspace') {
            this.currentMessage = this.currentMessage.slice(0, -1);
            this.updateDialogueText();
        } else if (event.key.length === 1) { // Single character keys
            if (!this.isTyping) {
                this.currentMessage = '';
                this.isTyping = true;
            }

            this.currentMessage += event.key;
            this.updateDialogueText();
        }
    }

    async handleEnterKey() {
        if (this.currentMessage.trim() !== '') {
            this.dialogueBox.setSpeaker(this.activeDelegate.name);
            this.dialogueBox.show('...', true);
            this.stopCursorBlink();

            if (this.activeDelegate.defaultMessage) {
                await this.handleDefaultMessage();
            } else {
                await this.handleWebSocketMessage(this.currentMessage);
            }

            this.currentMessage = '';
            this.isTyping = false;
        } else if (!this.isTyping) {
            this.restartTypingPrompt();
        }
    }

    // === Message Processing ===

    async handleDefaultMessage() {
        const apiResponse = this.activeDelegate.defaultMessage;
        this.dialogueBox.show('', true);
        await this.streamText(apiResponse);
    }

    async handleWebSocketMessage(message) {
        this.dialogueBox.show('', true);
        this.isStreaming = true;
        this.streamingText = '';

        try {
            await this.processWebSocketMessage(message);
        } catch (error) {
            console.error('WebSocket error:', error);
            await this.fallbackToRegularApi(message);
        } finally {
            this.isTyping = false;
        }
    }

    async processWebSocketMessage(message) {
        await WebSocketApiService.connect();

        let streamError = null;
        let lastActivity = Date.now();
        const callbacks = {
            onMessage: () => {
                this.finishStreaming();
            }, onChunk: (chunk) => {
                lastActivity = Date.now();
                this.streamingText += chunk;
                this.dialogueBox.show(this.streamingText, true);
            }, onStreamingStart: () => {
                lastActivity = Date.now();
                this.isStreaming = true;
            }, onStreamingEnd: () => {
                this.finishStreaming();
            }, onError: (error) => {
                streamError = error;
                this.isStreaming = false;
            }
        };

        await WebSocketApiService.sendMessage(this.playerCharacterId, this.activeDelegate.id, message, callbacks);

        // Wait for the stream to finish, but never forever: a dropped
        // connection or a silent server must not freeze the dialogue.
        while (this.isStreaming) {
            if (Date.now() - lastActivity > STREAM_IDLE_TIMEOUT_MS) {
                streamError = new Error('The response stream timed out.');
                this.isStreaming = false;
                break;
            }
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        if (streamError && !this.streamingText) {
            // Nothing arrived; let the caller fall back to the REST API.
            WebSocketApiService.disconnect();
            throw streamError;
        }
        if (streamError) {
            // Keep the partial reply rather than re-sending the message.
            console.warn('Stream interrupted, keeping partial response:', streamError);
            this.dialogueBox.show(this.streamingText, true);
        }

        this.currentMessage = '';
        WebSocketApiService.disconnect();
    }

    finishStreaming() {
        this.isStreaming = false;
        this.dialogueBox.show(this.streamingText, true);
    }

    async fallbackToRegularApi(message) {
        const apiResponse = await ApiService.sendMessage(this.playerCharacterId, this.activeDelegate.id, message);
        await this.streamText(apiResponse);
    }

    // === UI Management ===

    updateDialogueText() {
        const displayText = this.currentMessage + (this.cursorVisible ? '|' : '');
        this.dialogueBox.show(displayText, true);
    }

    restartTypingPrompt() {
        this.currentMessage = '';
        this.dialogueBox.setSpeaker(this.playerName());
        this.dialogueBox.show('|', true);

        this.stopCursorBlink();
        this.cursorVisible = true;
        this.startCursorBlink();

        this.updateDialogueText();
    }

    // === Cursor Management ===

    startCursorBlink() {
        this.cursorBlinkEvent = this.scene.time.addEvent({
            delay: 300, callback: () => {
                if (this.dialogueBox.isVisible() && this.isTyping) {
                    this.cursorVisible = !this.cursorVisible;
                    this.updateDialogueText();
                }
            }, loop: true
        });
    }

    stopCursorBlink() {
        if (this.cursorBlinkEvent) {
            this.cursorBlinkEvent.remove();
            this.cursorBlinkEvent = null;
        }
    }

    // === Dialogue Flow Control ===

    playerName() {
        return this.scene.playerConfig?.name || 'You';
    }

    startDialogue(playerCharacterId, delegate) {
        this.cancelDisconnectTimeout();
        this.playerCharacterId = playerCharacterId;
        this.activeDelegate = delegate;
        this.isTyping = true;
        this.currentMessage = '';

        this.dialogueBox.setSpeaker(this.playerName());
        this.dialogueBox.show('|', true);
        this.stopCursorBlink();

        this.cursorVisible = true;
        this.startCursorBlink();
    }

    closeDialogue() {
        this.dialogueBox.hide();
        this.isTyping = false;
        this.currentMessage = '';
        this.isStreaming = false;

        this.stopCursorBlink();
        this.scheduleDisconnect();
    }

    isInDialogue() {
        return this.dialogueBox && this.dialogueBox.isVisible();
    }

    continueDialogue() {
        if (!this.dialogueBox.isVisible()) return;

        if (this.isStreaming) {
            this.skipStreaming();
        } else if (!this.isTyping) {
            this.isTyping = true;
            this.currentMessage = '';
            this.dialogueBox.show('', false);
            this.restartTypingPrompt();
        }
    }

    // === Text Streaming ===

    async streamText(text, speed = 30) {
        this.isStreaming = true;
        let displayedText = '';

        this.stopCursorBlink();

        for (let i = 0; i < text.length; i++) {
            displayedText += text[i];
            this.dialogueBox.show(displayedText, true);

            await new Promise(resolve => setTimeout(resolve, speed));

            if (!this.isStreaming) break;
        }

        if (this.isStreaming) {
            this.dialogueBox.show(text, true);
        }

        this.isStreaming = false;
        return true;
    }

    skipStreaming() {
        this.isStreaming = false;
    }

    // === Connection Management ===

    cancelDisconnectTimeout() {
        if (this.disconnectTimeout) {
            clearTimeout(this.disconnectTimeout);
            this.disconnectTimeout = null;
        }
    }

    scheduleDisconnect() {
        this.cancelDisconnectTimeout();

        this.disconnectTimeout = setTimeout(() => {
            WebSocketApiService.disconnect();
        }, 5000);
    }
}

export default DialogueManager; 
