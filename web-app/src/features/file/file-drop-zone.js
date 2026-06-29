import { LitElement, html, css } from 'lit';
import { ref, createRef } from 'lit/directives/ref.js';
import { classMap } from 'lit/directives/class-map.js';

export class FileDropZone extends LitElement {
  static properties = {
    _isDragOver: { type: Boolean, state: true },
  };

  static styles = css`
    :host {
      display: block;
      animation: fadeIn 0.35s ease forwards;
    }

    .drop-zone {
      border: 2px dashed var(--border-color);
      border-radius: var(--radius-xl);
      padding: clamp(1.5rem, 4vw, 3.5rem) clamp(1rem, 2.5vw, 2rem);
      text-align: center;
      cursor: pointer;
      transition: border-color 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
      position: relative;
      overflow: hidden;
      background: var(--bg-surface);
      -webkit-tap-highlight-color: transparent;
    }

    .drop-zone::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(circle at center, var(--color-primary-light) 0%, transparent 70%);
      opacity: 0;
      transition: opacity 0.3s ease;
    }

    .drop-zone:hover::before,
    .drop-zone.drag-over::before {
      opacity: 1;
    }

    .drop-zone:hover,
    .drop-zone.drag-over {
      border-color: var(--color-primary);
    }

    .drop-zone.drag-over {
      transform: scale(1.015);
      border-color: var(--color-primary);
      box-shadow: 0 0 0 4px var(--color-primary-light), var(--shadow-lg);
    }

    .drop-zone-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.5rem;
      position: relative;
      pointer-events: none;
    }

    .upload-icon {
      width: clamp(36px, 5vw, 56px);
      height: clamp(36px, 5vw, 56px);
      color: var(--color-primary);
      margin-bottom: clamp(0.25rem, 0.5vw, 0.5rem);
      opacity: 0.9;
      transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
      filter: drop-shadow(0 2px 8px var(--color-primary-glow));
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .drop-zone:hover .upload-icon {
      transform: translateY(-6px) scale(1.08);
      opacity: 1;
      filter: drop-shadow(0 4px 16px var(--color-primary-glow));
    }

    .drop-zone p {
      font-size: clamp(0.9rem, 1.4vw, 1.15rem);
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
      pointer-events: none;
    }

    .drop-hint {
      color: var(--text-muted);
      font-size: clamp(0.72rem, 0.85vw, 0.85rem);
      pointer-events: none;
    }

    .drop-formats {
      color: var(--text-muted);
      font-size: clamp(0.65rem, 0.75vw, 0.75rem);
      margin-top: 0.25rem;
      pointer-events: none;
    }

    @media (max-width: 640px) {
      .drop-zone {
        padding: 2.5rem 1.25rem;
        border-radius: var(--radius-lg);
      }
      .upload-icon {
        width: 44px;
        height: 44px;
      }
      .drop-zone p {
        font-size: 1rem;
      }
    }

    @media (orientation: landscape) and (max-height: 500px) {
      .drop-zone {
        padding: 1.5rem 1rem;
      }
      .upload-icon {
        width: 36px;
        height: 36px;
        margin-bottom: 0.25rem;
      }
      .drop-zone p {
        font-size: 0.9rem;
      }
    }
  `;

  constructor() {
    super();
    this._isDragOver = false;
    this._fileInputRef = createRef();
  }

  render() {
    const classes = { 'drop-zone': true, 'drag-over': this._isDragOver };
    return html`
      <div
        class=${classMap(classes)}
        @click=${this._onClick}
        @dragover=${this._onDragOver}
        @dragleave=${this._onDragLeave}
        @drop=${this._onDrop}
      >
        <div class="drop-zone-content">
          <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <p>Drag & Drop your PDF</p>
          <span class="drop-hint">or click to browse files</span>
          <span class="drop-formats">PDF files only</span>
          <input ${ref(this._fileInputRef)} type="file" accept=".pdf,application/pdf" @change=${this._onChange} hidden>
        </div>
      </div>
    `;
  }

  _onClick() {
    this._fileInputRef.value?.click();
  }

  _onDragOver(e) {
    e.preventDefault();
    this._isDragOver = true;
  }

  _onDragLeave() {
    this._isDragOver = false;
  }

  _onDrop(e) {
    e.preventDefault();
    this._isDragOver = false;
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
      this.dispatchEvent(new CustomEvent('file-loaded', {
        bubbles: true,
        composed: true,
        detail: { arrayBuffer, fileName: file.name },
      }));
    } catch (error) {
      console.error('Error reading file array buffer:', error);
      alert('Failed to process file selection.');
    }
  }
}

customElements.define('file-drop-zone', FileDropZone);