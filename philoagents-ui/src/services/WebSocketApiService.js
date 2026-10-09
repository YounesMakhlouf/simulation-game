import { getWebSocketBaseUrl, REQUEST_TIMEOUT_MS } from '../config';

class WebSocketApiService {
    constructor() {
        // Initialize connection-related properties
        this.initializeConnectionProperties();

        // Set up WebSocket URL based on environment
        this.baseUrl = getWebSocketBaseUrl();
    }

    initializeConnectionProperties() {
        this.socket = null;
        this.messageCallbacks = new Map();
        this.connected = false;
        this.connectionPromise = null;
        this.connectionTimeout = REQUEST_TIMEOUT_MS;
        this.connectionTimeoutId = null;
        this.rejectConnection = null;
    }

    connect() {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            this.rejectConnection = reject;
            this.connectionTimeoutId = setTimeout(() => {
                this.disconnect(new Error('WebSocket connection timeout'));
            }, this.connectionTimeout);

            const socket = new WebSocket(`${this.baseUrl}/ws/chat`);
            this.socket = socket;

            socket.onopen = () => {
                if (this.socket !== socket) return;
                console.log('WebSocket connection established');
                this.connected = true;
                clearTimeout(this.connectionTimeoutId);
                this.connectionTimeoutId = null;
                this.rejectConnection = null;
                resolve();
            };

            socket.onmessage = (event) => {
                if (this.socket === socket) this.handleMessage(event);
            };

            socket.onerror = (error) => {
                if (this.socket !== socket) return;
                console.error('WebSocket error:', error);
                this.notifyError(error);
                this.disconnect(error);
            };

            socket.onclose = () => {
                if (this.socket !== socket) return;
                console.log('WebSocket connection closed');
                // A close during an active exchange means no terminating frame
                // will ever arrive; let the consumer unblock instead of hanging.
                const error = new Error('WebSocket connection closed');
                this.notifyError(error);
                this.disconnect(error);
            };
        });

        return this.connectionPromise;
    }

    handleMessage(event) {
        let data;
        try {
            data = JSON.parse(event.data);
        } catch (error) {
            this.notifyError(new Error('Received a malformed WebSocket frame'));
            return;
        }

        if (data.error) {
            console.error('WebSocket error:', data.error);
            this.notifyError(new Error(data.error));
            return;
        }

        if (data.streaming !== undefined) {
            this.handleStreamingUpdate(data.streaming);
            return;
        }

        if (data.chunk) {
            this.triggerCallback('chunk', data.chunk);
            return;
        }

        if (data.response) {
            this.triggerCallback('message', data.response);
        }
    }

    handleStreamingUpdate(isStreaming) {
        const streamingCallback = this.messageCallbacks.get('streaming');
        if (streamingCallback) {
            streamingCallback(isStreaming);
        }
    }

    triggerCallback(type, data) {
        const callback = this.messageCallbacks.get(type);
        if (callback) {
            callback(data);
        }
    }

    notifyError(error) {
        this.triggerCallback('error', error);
    }

    async sendMessage(senderId, receiverId, message, callbacks = {}) {
        if (!this.connected) {
            await this.connect();
        }

        this.registerCallbacks(callbacks);

        this.socket.send(JSON.stringify({
            sender_id: senderId, receiver_id: receiverId, message: message,
        }));
    }

    registerCallbacks(callbacks) {
        this.messageCallbacks.clear();
        if (callbacks.onMessage) {
            this.messageCallbacks.set('message', callbacks.onMessage);
        }

        if (callbacks.onStreamingStart) {
            this.messageCallbacks.set('streaming', (isStreaming) => {
                if (isStreaming) {
                    callbacks.onStreamingStart();
                } else if (callbacks.onStreamingEnd) {
                    callbacks.onStreamingEnd();
                }
            });
        }

        if (callbacks.onChunk) {
            this.messageCallbacks.set('chunk', callbacks.onChunk);
        }

        if (callbacks.onError) {
            this.messageCallbacks.set('error', callbacks.onError);
        }
    }

    disconnect(reason = new DOMException('WebSocket connection cancelled', 'AbortError')) {
        this.messageCallbacks.clear();
        clearTimeout(this.connectionTimeoutId);
        this.connectionTimeoutId = null;
        this.rejectConnection?.(reason);
        this.rejectConnection = null;
        this.connectionPromise = null;
        this.connected = false;
        const socket = this.socket;
        this.socket = null;
        if (socket) {
            socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null;
            socket.close();
        }
    }
}

export default new WebSocketApiService();
