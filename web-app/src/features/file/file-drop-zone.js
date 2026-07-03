import { LitElement, html, css } from 'lit';
import { ref, createRef } from 'lit/directives/ref.js';
import { classMap } from 'lit/directives/class-map.js';
import { buttonBase } from '../../styles/shared-styles.js';

export class FileDropZone extends LitElement {
  static properties = {
    _isDragOver: { type: Boolean, state: true },
  };

  static styles = [
    buttonBase,
    css`
      :host {
        display: block;
        animation: fadeIn 0.35s ease forwards;
        flex: 1;
        align-self: stretch;
      }

      .placeholder-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 0.5rem;
        padding: clamp(1.5rem, 4vw, 3rem) clamp(1rem, 2.5vw, 2rem);
        border: 2px dashed var(--border-color);
        border-radius: var(--radius-xl);
        background-color: transparent;
        transition: border-color 0.25s ease, background-color 0.25s ease;
        height: 100%;
        box-sizing: border-box;
        cursor: pointer;
        -webkit-tap-highlight-color: transparent;
      }

      .upload-icon {
        width: clamp(40px, 6vw, 64px);
        height: clamp(40px, 6vw, 64px);
        color: var(--color-primary);
        margin-bottom: clamp(0.5rem, 1vw, 1.25rem);
        opacity: 0.95;
        transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
        filter: drop-shadow(0 2px 8px var(--color-primary-glow));
      }

      @keyframes float {
        0% { transform: translateY(-6px) scale(1.06); }
        50% { transform: translateY(-12px) scale(1.06); }
        100% { transform: translateY(-6px) scale(1.06); }
      }

      .placeholder-container:hover .upload-icon {
        animation: float 2.5s ease-in-out infinite;
        opacity: 1;
        filter: drop-shadow(0 4px 16px var(--color-primary-glow));
      }

      .placeholder-container.drag-over {
        border-color: var(--color-primary);
        background-color: var(--color-primary-light);
      }

      .placeholder-container.drag-over .upload-icon {
        transform: translateY(-8px) scale(1.08);
        filter: drop-shadow(0 4px 16px var(--color-primary-glow));
      }

      .drop-title {
        font-size: clamp(1rem, 1.5vw, 1.3rem);
        font-weight: 700;
        color: var(--text-primary);
        margin: 0;
        pointer-events: none;
      }

      .drop-divider {
        color: var(--text-muted);
        font-size: clamp(0.72rem, 0.85vw, 0.85rem);
        font-weight: 500;
        margin: 0.25rem 0;
        pointer-events: none;
      }

      .btn-choose {
        pointer-events: none;
        margin: 0.5rem 0;
      }

      .drop-formats {
        color: var(--text-muted);
        font-size: clamp(0.65rem, 0.75vw, 0.75rem);
        margin-top: 0.25rem;
        pointer-events: none;
      }

      @media (max-width: 640px) {
        .placeholder-container {
          padding: 2.5rem 1.25rem;
        }
        .upload-icon {
          width: 44px;
          height: 44px;
        }
      }

      @media (orientation: landscape) and (max-height: 500px) {
        .placeholder-container {
          padding: 1.5rem 1rem;
        }
        .upload-icon {
          width: 36px;
          height: 36px;
          margin-bottom: 0.25rem;
        }
      }
    `
  ];

  constructor() {
    super();
    this._isDragOver = false;
    this._fileInputRef = createRef();
  }

  render() {
    const classes = { 'placeholder-container': true, 'drag-over': this._isDragOver };
    return html`
      <div
        class=${classMap(classes)}
        @click=${this._onClick}
        @dragover=${this._onDragOver}
        @dragleave=${this._onDragLeave}
        @drop=${this._onDrop}
      >
        <svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="14 2 14 8 20 8" stroke-linecap="round" stroke-linejoin="round"/>
          <line x1="12" y1="18" x2="12" y2="12" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="9 15 12 12 15 15" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p class="drop-title">Drag & Drop your PDF</p>
        <span class="drop-divider">— or —</span>
        <div class="btn btn-primary btn-choose">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
          </svg>
          Choose PDF File
        </div>
        <span class="drop-formats">PDF files only</span>
        <input ${ref(this._fileInputRef)} type="file" accept=".pdf,application/pdf" @change=${this._onChange} hidden>
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