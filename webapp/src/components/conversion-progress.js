import { LitElement, html } from 'lit';

export class ConversionProgress extends LitElement {
    static properties = {
        status: { type: String }
    };

    constructor() {
        super();
        this.status = 'Preparing document...';
    }

    // Render inside the Light DOM to inherit all global theme styles from style.css perfectly
    createRenderRoot() {
        return this;
    }

    render() {
        return html`
            <div id="status-container" class="status-container">
                <div class="spinner"></div>
                <p id="status-text">${this.status}</p>
            </div>
        `;
    }

    /**
     * Backward compatible method that updates the status property.
     * Triggers LitElement's native reactive rendering pipeline.
     * @param {string} text - The status feedback text run
     */
    updateStatus(text) {
        this.status = text;
    }
}

customElements.define('conversion-progress', ConversionProgress);
