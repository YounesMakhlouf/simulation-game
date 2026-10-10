class DialogueBox {
    constructor(scene) {
        this.panel = document.createElement('section');
        this.panel.className = 'dialogue-panel';
        this.panel.setAttribute('aria-label', 'Conversation');
        this.speaker = document.createElement('h2');
        this.content = document.createElement('div');
        this.content.className = 'dialogue-content';
        this.content.tabIndex = 0;
        this.content.setAttribute('aria-label', 'Conversation text');
        this.panel.innerHTML = `<div class="dialogue-heading"></div>
            <form class="dialogue-compose">
                <label for="dialogue-message">Your message</label>
                <input id="dialogue-message" autocomplete="off">
                <button type="submit">Send</button>
            </form>
            <button class="dialogue-reply" type="button">Reply</button>`;
        this.form = this.panel.querySelector('form');
        this.input = this.panel.querySelector('input');
        this.reply = this.panel.querySelector('.dialogue-reply');
        const heading = this.panel.querySelector('.dialogue-heading');
        this.closeButton = document.createElement('button');
        this.closeButton.type = 'button';
        this.closeButton.textContent = 'Close';
        heading.append(this.speaker, this.closeButton);
        heading.after(this.content);
        this.panel.addEventListener('keydown', event => event.stopPropagation());
        this.panel.addEventListener('keyup', event => event.stopPropagation());
        document.body.append(this.panel);
        this.hide();
        this.setInputState('', false);
        const cleanup = () => {
            this.panel.remove();
            scene.events.off('shutdown', cleanup);
            scene.events.off('destroy', cleanup);
        };
        scene.events.once('shutdown', cleanup);
        scene.events.once('destroy', cleanup);
    }

    bind(manager) {
        this.input.addEventListener('input', () => { manager.currentMessage = this.input.value; });
        this.form.addEventListener('submit', event => {
            event.preventDefault();
            manager.currentMessage = this.input.value;
            manager.handleEnterKey();
        });
        this.reply.addEventListener('click', () => manager.continueDialogue());
        this.closeButton.addEventListener('click', () => manager.closeDialogue());
        this.panel.addEventListener('keydown', event => {
            if (event.key === 'Escape') manager.closeDialogue();
        });
    }

    setInputState(message, typing, busy = false) {
        const entering = typing && this.form.hidden;
        if (this.input.value !== message) this.input.value = message;
        this.form.hidden = !typing;
        this.content.hidden = typing;
        this.reply.hidden = typing;
        this.reply.disabled = busy;
        if (entering && !this.panel.hidden) this.input.focus();
    }

    show(message) {
        this.content.textContent = message;
        this.panel.hidden = false;
    }

    setSpeaker(name) {
        this.speaker.textContent = name || '';
        this.speaker.hidden = !name;
    }

    hide() {
        this.panel.hidden = true;
        this.form.hidden = true;
    }

    isVisible() { return !this.panel.hidden; }
}

export default DialogueBox;
