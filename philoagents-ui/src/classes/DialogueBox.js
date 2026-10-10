class DialogueBox {
    constructor(scene) {
        this.threads = new Map();
        this.busy = false;
        this.panel = document.createElement('section');
        this.panel.className = 'dialogue-panel';
        this.panel.setAttribute('aria-label', 'Conversation');
        this.panel.innerHTML = `
            <div class="dialogue-heading">
                <img class="dialogue-portrait" alt="">
                <h2></h2>
                <button class="dialogue-close" type="button">Close</button>
            </div>
            <div class="dialogue-content" tabindex="0" aria-label="Conversation history"></div>
            <p class="dialogue-status" role="status" hidden></p>
            <form class="dialogue-compose">
                <label for="dialogue-message">Your message</label>
                <input id="dialogue-message" autocomplete="off">
                <button type="submit">Send</button>
            </form>`;
        this.portrait = this.panel.querySelector('img');
        this.speaker = this.panel.querySelector('h2');
        this.content = this.panel.querySelector('.dialogue-content');
        this.status = this.panel.querySelector('.dialogue-status');
        this.form = this.panel.querySelector('form');
        this.input = this.panel.querySelector('input');
        this.send = this.form.querySelector('button');
        this.closeButton = this.panel.querySelector('.dialogue-close');
        this.panel.addEventListener('keydown', event => event.stopPropagation());
        this.panel.addEventListener('keyup', event => event.stopPropagation());
        document.body.append(this.panel);
        this.hide();
        this.setInputState('');
        const cleanup = () => {
            this.panel.remove();
            scene.events.off('shutdown', cleanup);
            scene.events.off('destroy', cleanup);
        };
        scene.events.once('shutdown', cleanup);
        scene.events.once('destroy', cleanup);
    }

    bind(manager) {
        this.input.addEventListener('input', () => {
            manager.currentMessage = this.input.value;
            this.send.disabled = this.busy || !this.input.value.trim();
        });
        this.form.addEventListener('submit', event => {
            event.preventDefault();
            manager.currentMessage = this.input.value;
            manager.handleEnterKey();
            this.input.focus();
        });
        this.closeButton.addEventListener('click', () => manager.closeDialogue());
        this.panel.addEventListener('keydown', event => {
            if (event.key === 'Escape') manager.closeDialogue();
        });
    }

    open(delegate) {
        this.speaker.textContent = delegate.name;
        this.portrait.src = `assets/images/portraits/${delegate.id}.webp`;
        this.portrait.alt = `${delegate.name} portrait`;
        if (!this.threads.has(delegate.id)) {
            this.threads.set(delegate.id, document.createElement('div'));
        }
        this.thread = this.threads.get(delegate.id);
        this.content.replaceChildren(this.thread);
        this.reply = null;
        this.setBusy(false);
        this.setInputState('');
        this.panel.hidden = false;
        this.content.scrollTop = this.content.scrollHeight;
        this.input.focus();
    }

    setInputState(message) {
        if (this.input.value !== message) this.input.value = message;
        this.send.disabled = this.busy || !message.trim();
    }

    setBusy(busy) {
        this.busy = busy;
        this.status.hidden = !busy;
        this.status.textContent = busy ? `${this.speaker.textContent} is responding…` : '';
        this.send.disabled = busy || !this.input.value.trim();
    }

    appendMessage(speaker, text, role) {
        const follow = this.isAtBottom() || role === 'player';
        const article = document.createElement('article');
        article.className = `dialogue-turn dialogue-turn-${role}`;
        const name = document.createElement('strong');
        name.textContent = speaker;
        const body = document.createElement('p');
        body.textContent = text;
        const error = document.createElement('p');
        error.className = 'dialogue-error';
        error.setAttribute('role', 'alert');
        error.hidden = true;
        article.append(name, body, error);
        article.hidden = !text;
        this.thread.append(article);
        if (role === 'delegate') this.reply = { article, body, error };
        if (follow) this.content.scrollTop = this.content.scrollHeight;
    }

    updateReply(text, error = '') {
        const follow = this.isAtBottom();
        this.reply.body.textContent = text;
        this.reply.error.textContent = error;
        this.reply.error.hidden = !error;
        this.reply.article.hidden = !text && !error;
        if (follow) this.content.scrollTop = this.content.scrollHeight;
    }

    isAtBottom() {
        return this.content.scrollHeight - this.content.clientHeight - this.content.scrollTop < 32;
    }

    hide() { this.panel.hidden = true; }

    isVisible() { return !this.panel.hidden; }
}

export default DialogueBox;
