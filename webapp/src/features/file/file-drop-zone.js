import { LitElement, html } from 'lit';

export class FileDropZone extends LitElement {
    createRenderRoot() {
        return this; // Light DOM delivery to inherit system wide styles
    }

    render() {
        return html`
            <div id="drop-zone" class="drop-zone"
                 @click=${this._onClick}
                 @dragover=${this._onDragOver}
                 @dragleave=${this._onDragLeave}
                 @drop=${this._onDrop}>
                <div class="drop-zone-content">
                    <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="17 8 12 3 7 8"/>
                        <line x1="12" y1="3" x2="12" y2="15"/>
                    </svg>
                    <p>Drag & Drop your PDF</p>
                    <span>or click to browse files</span>
                    <input type="file" id="file-input" accept=".pdf,application/pdf" @change=${this._onChange} hidden>
                </div>
            </div>
        `;
    }

    _onClick() {
        const fileInput = this.querySelector('#file-input');
        if (fileInput) fileInput.click();
    }

    _onDragOver(e) {
        e.preventDefault();
        const dropZone = this.querySelector('#drop-zone');
        if (dropZone) dropZone.classList.add('drag-over');
    }

    _onDragLeave() {
        const dropZone = this.querySelector('#drop-zone');
        if (dropZone) dropZone.classList.remove('drag-over');
    }

    _onDrop(e) {
        e.preventDefault();
        const dropZone = this.querySelector('#drop-zone');
        if (dropZone) dropZone.classList.remove('drag-over');
        
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            this.handleFile(files[0]);
        }
    }

    _onChange(e) {
        if (e.target.files.length > 0) {
            this.handleFile(e.target.files[0]);
        }
    }

    async handleFile(file) {
        const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
        if (!isPdf) {
            alert('Please select a valid PDF file.');
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            
            // Dispatch event with the raw data stream up to the layout root components
            this.dispatchEvent(new CustomEvent('file-loaded', {
                bubbles: true,
                composed: true,
                detail: { arrayBuffer, fileName: file.name }
            }));
        } catch (error) {
            console.error('Error reading file array buffer:', error);
            alert('Failed to process file selection.');
        }
    }
}

customElements.define('file-drop-zone', FileDropZone);