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
        this.exchangeController = null;

        this.hasSetupListeners = false;
    }

    // === Initialization ===

    initialize(dialogueBox) {
        this.dialogueBox = dialogueBox;
        dialogueBox.bind(this);

        if (!this.hasSetupListeners) {
            this.setupKeyboardListeners();
            this.onSceneClose = () => this.destroy();
            this.scene.events.once('shutdown', this.onSceneClose);
            this.scene.events.once('destroy', this.onSceneClose);
            this.hasSetupListeners = true;
        }
    }

    setupKeyboardListeners() {
        this.keyboard = this.scene.input.keyboard;
        this.keydownListener = (event) => {
            if (event.target?.closest('button, input, textarea, select, dialog')) return;
            if (event.key === 'Escape' && this.isInDialogue()) {
                this.closeDialogue();
                return;
            }
            if (!this.isTyping) {
                if (this.isStreaming && (event.key === 'Space' || event.key === ' ')) {
                    this.skipStreaming();
                }
                return;
            }

            this.handleKeyPress(event);
        };
        this.keyboard.on('keydown', this.keydownListener);
    }

    // === Input Handling ===

    async handleKeyPress(event) {
        if (event.key === 'Escape') {
            this.closeDialogue();
            return;
        }
        if (!this.isTyping || this.exchangeController) return;
        if (event.key === 'Enter') {
            await this.handleEnterKey();
        } else if (event.key === 'Backspace') {
            this.currentMessage = this.currentMessage.slice(0, -1);
            this.updateDialogueText();
        } else if (event.key.length === 1) { // Single character keys
            this.currentMessage += event.key;
            this.updateDialogueText();
        }
    }

    async handleEnterKey() {
        if (this.exchangeController || !this.isInDialogue()) return;
        if (this.currentMessage.trim() !== '') {
            const controller = new AbortController();
            this.exchangeController = controller;
            const message = this.currentMessage;
            this.currentMessage = '';
            this.isTyping = false;
            this.streamingText = '';
            this.dialogueBox.appendMessage(this.playerName(), message, 'player');
            this.dialogueBox.appendMessage(this.activeDelegate.name, '', 'delegate');
            this.dialogueBox.setInputState('');
            this.dialogueBox.setBusy(true);

            try {
                if (this.activeDelegate.defaultMessage) {
                    await this.handleDefaultMessage(controller.signal);
                } else {
                    await this.handleWebSocketMessage(message, controller.signal);
                }
            } catch (error) {
                if (!controller.signal.aborted) {
                    console.error('Dialogue exchange failed:', error);
                    this.dialogueBox.updateReply(this.streamingText, 'Conversation could not be completed. Please try again.');
                }
            } finally {
                if (this.exchangeController === controller) {
                    WebSocketApiService.disconnect();
                    this.exchangeController = null;
                    this.isStreaming = false;
                    this.isTyping = true;
                    this.dialogueBox.setBusy(false);
                }
            }
        }
    }

    // === Message Processing ===

    async handleDefaultMessage(signal) {
        const apiResponse = this.activeDelegate.defaultMessage;
        await this.streamText(apiResponse, signal);
    }

    async handleWebSocketMessage(message, signal) {
        this.isStreaming = true;
        this.streamingText = '';

        try {
            await this.processWebSocketMessage(message, signal);
        } catch (error) {
            signal.throwIfAborted();
            if (this.streamingText) throw error;
            console.error('WebSocket error:', error);
            WebSocketApiService.disconnect();
            await this.fallbackToRegularApi(message, signal);
        }
    }

    async processWebSocketMessage(message, signal) {
        await WebSocketApiService.connect();
        signal.throwIfAborted();

        await new Promise((resolve, reject) => {
            let timeout;
            let finished = false;
            const onAbort = () => finish(signal.reason);
            const finish = (error) => {
                if (finished) return;
                finished = true;
                clearTimeout(timeout);
                signal.removeEventListener('abort', onAbort);
                if (signal.aborted || error) {
                    reject(error);
                } else {
                    this.finishStreaming();
                    resolve();
                }
            };
            const resetTimeout = () => {
                clearTimeout(timeout);
                timeout = setTimeout(() => finish(new Error('The response stream timed out.')), STREAM_IDLE_TIMEOUT_MS);
            };
            const callbacks = {
                onMessage: () => finish(),
                onChunk: (chunk) => {
                    if (finished || signal.aborted) return;
                    resetTimeout();
                    this.streamingText += chunk;
                    this.dialogueBox.updateReply(this.streamingText);
                },
                onStreamingStart: () => {
                    if (finished || signal.aborted) return;
                    resetTimeout();
                    this.isStreaming = true;
                },
                onStreamingEnd: () => finish(),
                onError: (error) => finish(error),
            };
            signal.addEventListener('abort', onAbort, { once: true });
            resetTimeout();
            WebSocketApiService.sendMessage(this.playerCharacterId, this.activeDelegate.id, message, callbacks)
                .catch(finish);
        });
    }

    finishStreaming() {
        this.isStreaming = false;
        this.dialogueBox.updateReply(this.streamingText);
    }

    async fallbackToRegularApi(message, signal) {
        const apiResponse = await ApiService.sendMessage(this.playerCharacterId, this.activeDelegate.id, message, signal);
        signal.throwIfAborted();
        await this.streamText(apiResponse, signal);
    }

    // === UI Management ===

    updateDialogueText() {
        this.dialogueBox.setInputState(this.currentMessage);
    }

    // === Dialogue Flow Control ===

    playerName() {
        return this.scene.playerConfig?.name || 'You';
    }

    startDialogue(playerCharacterId, delegate) {
        this.closeDialogue();
        this.playerCharacterId = playerCharacterId;
        this.activeDelegate = delegate;
        this.isTyping = true;
        this.currentMessage = '';

        this.dialogueBox.open(delegate);
    }

    closeDialogue() {
        if (this.exchangeController) {
            this.dialogueBox.updateReply(this.streamingText, 'Response interrupted.');
            this.exchangeController.abort();
        }
        this.exchangeController = null;
        WebSocketApiService.disconnect();
        this.dialogueBox.setBusy(false);
        this.dialogueBox.hide();
        this.isTyping = false;
        this.currentMessage = '';
        this.isStreaming = false;
    }

    destroy() {
        this.closeDialogue();
        this.keyboard?.off('keydown', this.keydownListener);
        this.scene.events.off('shutdown', this.onSceneClose);
        this.scene.events.off('destroy', this.onSceneClose);
        this.hasSetupListeners = false;
    }

    isInDialogue() {
        return this.dialogueBox && this.dialogueBox.isVisible();
    }

    continueDialogue() {
        if (this.isInDialogue() && this.isStreaming) this.skipStreaming();
    }

    // === Text Streaming ===

    async streamText(text, signal, speed = 30) {
        signal.throwIfAborted();
        this.isStreaming = true;
        this.streamingText = '';

        for (let i = 0; i < text.length; i++) {
            this.streamingText += text[i];
            this.dialogueBox.updateReply(this.streamingText);

            await new Promise(resolve => {
                const onAbort = () => {
                    clearTimeout(timer);
                    resolve();
                };
                const timer = setTimeout(() => {
                    signal.removeEventListener('abort', onAbort);
                    resolve();
                }, speed);
                signal.addEventListener('abort', onAbort, { once: true });
            });
            signal.throwIfAborted();

            if (!this.isStreaming) break;
        }

        this.streamingText = text;
        this.dialogueBox.updateReply(text);
        this.isStreaming = false;
        return true;
    }

    skipStreaming() {
        this.isStreaming = false;
    }
}

export default DialogueManager;
