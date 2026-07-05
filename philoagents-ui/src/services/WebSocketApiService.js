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
    }

    connect() {
        if (this.connectionPromise) {
            return this.connectionPromise;
        }

        this.connectionPromise = new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                if (this.socket) {
                    this.socket.close();
                }
                this.connectionPromise = null;
                reject(new Error('WebSocket connection timeout'));
            }, this.connectionTimeout);

            this.socket = new WebSocket(`${this.baseUrl}/ws/chat`);

            this.socket.onopen = () => {
                console.log('WebSocket connection established');
                this.connected = true;
                clearTimeout(timeoutId);
                resolve();
            };

            this.socket.onmessage = this.handleMessage.bind(this);

            this.socket.onerror = (error) => {
                console.error('WebSocket error:', error);
                clearTimeout(timeoutId);
                this.connectionPromise = null;
                reject(error);
            };

            this.socket.onclose = () => {
                console.log('WebSocket connection closed');
                this.connected = false;
                this.connectionPromise = null;
                // A close during an active exchange means no terminating frame
                // will ever arrive; let the consumer unblock instead of hanging.
                this.notifyError(new Error('WebSocket connection closed'));
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

    disconnect() {
        if (this.socket) {
            // Clear the callbacks first so the deliberate close below does not
            // fire the error callback via onclose.
            this.messageCallbacks.clear();
            this.socket.close();
            this.connected = false;
            this.connectionPromise = null;
        }
    }
}

export default new WebSocketApiService(); 