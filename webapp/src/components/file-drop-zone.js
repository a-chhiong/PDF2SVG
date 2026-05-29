import { LitElement, html } from 'lit';

export class FileDropZone extends LitElement {
    // Render inside the Light DOM to inherit all global theme styles from style.css perfectly
    createRenderRoot() {
        return this;
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
                    <input type="file" id="file-input" accept="application/pdf" @change=${this._onChange} hidden>
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
        if (file.type !== 'application/pdf') {
            alert('Please select a valid PDF file.');
            return;
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdfjsLib = window['pdfjs-dist/build/pdf'] || window.pdfjsLib;
            const pdf = await pdfjsLib.getDocument({
                data: arrayBuffer,
                cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/cmaps/',
                cMapPacked: true,
                standardFontsUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/standard_fonts/'
            }).promise;
            
            // Dispatch custom event to app-root containing the loaded PDF object & file name
            this.dispatchEvent(new CustomEvent('file-loaded', {
                bubbles: true,
                composed: true,
                detail: { pdf, fileName: file.name }
            }));
        } catch (error) {
            console.error('Error loading PDF file:', error);
            alert('Failed to load PDF file. Check browser console.');
        }
    }
}

customElements.define('file-drop-zone', FileDropZone);
