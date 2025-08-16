import { Scene } from 'phaser';

/**
 * BaseModal - A reusable base class for all modal dialogs in the game
 * 
 * This class provides common functionality for modal dialogs including:
 * - Background overlay
 * - Modal panel with customizable dimensions
 * - Title text
 * - Close button with hover effects
 * - Keyboard handling
 */
export class BaseModal extends Scene {
    /**
     * @param {string} key - The scene key for this modal
     * @param {Object} options - Configuration options for the modal
     */
    constructor(key, options = {}) {
        super(key);
        
        // Default options
        this.options = {
            // Background overlay
            overlayColor: 0x000000,
            overlayAlpha: 0.7,
            
            // Modal panel
            panelColor: 0x111111,
            panelAlpha: 0.9,
            panelBorderColor: 0xffffff,
            panelBorderWidth: 2,
            panelWidth: 824,
            panelHeight: 568,
            panelRadius: 15,
            panelX: 100,
            panelY: 100,
            
            // Title
            titleText: 'Modal Dialog',
            titleFontSize: '32px',
            titleColor: '#ffffff',
            titleY: 140,
            
            // Close button
            closeButtonText: '[ Continue ]',
            closeButtonFontSize: '24px',
            closeButtonColor: '#ffd700',
            closeButtonHoverColor: '#ffffff',
            closeButtonY: 620,
            
            // Keyboard handling
            closeOnEsc: true,
            
            // Resume game on close
            resumeGameOnClose: true,
            
            ...options
        };
        
        // Store any data passed to the modal
        this.modalData = null;
    }
    
    /**
     * Initialize the modal with data
     * @param {Object} data - Data passed to the modal
     */
    init(data) {
        this.modalData = data || {};
    }
    
    /**
     * Create the modal elements
     */
    create() {
        this.createOverlay();
        this.createPanel();
        this.createTitle();
        this.createContent(); // Implemented by subclasses
        this.createCloseButton();
        this.setupKeyboardHandling();
    }
    
    /**
     * Create the semi-transparent background overlay
     */
    createOverlay() {
        this.overlay = this.add.graphics();
        this.overlay.fillStyle(this.options.overlayColor, this.options.overlayAlpha);
        this.overlay.fillRect(0, 0, this.cameras.main.width, this.cameras.main.height);
    }
    
    /**
     * Create the modal panel
     */
    createPanel() {
        this.panel = this.add.graphics();
        this.panel.fillStyle(this.options.panelColor, this.options.panelAlpha);
        this.panel.lineStyle(this.options.panelBorderWidth, this.options.panelBorderColor, 1);
        
        // Calculate panel position
        this.panelX = this.options.panelX;
        this.panelY = this.options.panelY;
        this.panelWidth = this.options.panelWidth;
        this.panelHeight = this.options.panelHeight;
        
        this.panel.fillRoundedRect(
            this.panelX, 
            this.panelY, 
            this.panelWidth, 
            this.panelHeight, 
            this.options.panelRadius
        );
        
        this.panel.strokeRoundedRect(
            this.panelX, 
            this.panelY, 
            this.panelWidth, 
            this.panelHeight, 
            this.options.panelRadius
        );
    }
    
    /**
     * Create the title text
     */
    createTitle() {
        if (this.options.titleText) {
            this.title = this.add.text(
                this.cameras.main.width / 2, 
                this.options.titleY, 
                this.options.titleText, 
                { 
                    fontSize: this.options.titleFontSize, 
                    color: this.options.titleColor 
                }
            ).setOrigin(0.5);
        }
    }
    
    /**
     * Create the content of the modal
     * This method should be overridden by subclasses
     */
    createContent() {
        // To be implemented by subclasses
    }
    
    /**
     * Create the close button
     */
    createCloseButton() {
        this.closeButton = this.add.text(
            this.cameras.main.width / 2, 
            this.options.closeButtonY, 
            this.options.closeButtonText, 
            { 
                fontSize: this.options.closeButtonFontSize, 
                color: this.options.closeButtonColor,
                fontStyle: 'bold'
            }
        )
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true });
        
        // Add hover effects
        this.closeButton.on('pointerover', () => {
            this.closeButton.setColor(this.options.closeButtonHoverColor);
        });
        
        this.closeButton.on('pointerout', () => {
            this.closeButton.setColor(this.options.closeButtonColor);
        });
        
        // Add click handler
        this.closeButton.on('pointerdown', () => {
            this.closeModal();
        });
    }
    
    /**
     * Setup keyboard handling
     */
    setupKeyboardHandling() {
        if (this.options.closeOnEsc) {
            this.input.keyboard.on('keydown-ESC', () => {
                this.closeModal();
            });
        }
    }
    
    /**
     * Close the modal
     */
    closeModal() {
        this.scene.stop(this.scene.key);
        
        if (this.options.resumeGameOnClose) {
            this.scene.resume('Game');
        }
        
        // Call the onClose callback if provided
        if (typeof this.options.onClose === 'function') {
            this.options.onClose();
        }
    }
    
    /**
     * Create a button with hover effects
     * @param {number} x - X position
     * @param {number} y - Y position
     * @param {string} text - Button text
     * @param {function} callback - Click callback
     * @param {Object} style - Button style
     */
    createButton(x, y, text, callback, style = {}) {
        const buttonStyle = {
            backgroundColor: 0x4a90e2,
            borderColor: 0x3a70b2,
            textColor: '#FFFFFF',
            hoverBackgroundColor: 0x5da0f2,
            width: 250,
            height: 50,
            cornerRadius: 15,
            fontSize: '22px',
            fontFamily: 'Arial',
            fontStyle: 'bold',
            ...style
        };
        
        const buttonWidth = buttonStyle.width;
        const buttonHeight = buttonStyle.height;
        const cornerRadius = buttonStyle.cornerRadius;
        
        // Create shadow
        const shadow = this.add.graphics();
        shadow.fillStyle(0x000000, 0.4);
        shadow.fillRoundedRect(
            x - buttonWidth / 2 + 5, 
            y - buttonHeight / 2 + 5, 
            buttonWidth, 
            buttonHeight, 
            cornerRadius
        );
        
        // Create button
        const button = this.add.graphics();
        button.fillStyle(buttonStyle.backgroundColor, 1);
        button.lineStyle(2, buttonStyle.borderColor, 1);
        button.fillRoundedRect(
            x - buttonWidth / 2, 
            y - buttonHeight / 2, 
            buttonWidth, 
            buttonHeight, 
            cornerRadius
        );
        button.strokeRoundedRect(
            x - buttonWidth / 2, 
            y - buttonHeight / 2, 
            buttonWidth, 
            buttonHeight, 
            cornerRadius
        );
        
        button.setInteractive(
            new Phaser.Geom.Rectangle(
                x - buttonWidth / 2, 
                y - buttonHeight / 2, 
                buttonWidth, 
                buttonHeight
            ),
            Phaser.Geom.Rectangle.Contains
        );
        
        // Create button text
        const buttonText = this.add.text(x, y, text, {
            fontSize: buttonStyle.fontSize,
            fontFamily: buttonStyle.fontFamily,
            color: buttonStyle.textColor,
            fontStyle: buttonStyle.fontStyle
        }).setOrigin(0.5);
        
        // Add hover effects
        button.on('pointerover', () => {
            button.clear();
            button.fillStyle(buttonStyle.hoverBackgroundColor, 1);
            button.lineStyle(2, buttonStyle.borderColor, 1);
            button.fillRoundedRect(
                x - buttonWidth / 2, 
                y - buttonHeight / 2, 
                buttonWidth, 
                buttonHeight, 
                cornerRadius
            );
            button.strokeRoundedRect(
                x - buttonWidth / 2, 
                y - buttonHeight / 2, 
                buttonWidth, 
                buttonHeight, 
                cornerRadius
            );
            buttonText.y -= 2;
        });
        
        button.on('pointerout', () => {
            button.clear();
            button.fillStyle(buttonStyle.backgroundColor, 1);
            button.lineStyle(2, buttonStyle.borderColor, 1);
            button.fillRoundedRect(
                x - buttonWidth / 2, 
                y - buttonHeight / 2, 
                buttonWidth, 
                buttonHeight, 
                cornerRadius
            );
            button.strokeRoundedRect(
                x - buttonWidth / 2, 
                y - buttonHeight / 2, 
                buttonWidth, 
                buttonHeight, 
                cornerRadius
            );
            buttonText.y += 2;
        });
        
        // Add click handler
        button.on('pointerdown', callback);
        
        return { button, shadow, text: buttonText };
    }
}