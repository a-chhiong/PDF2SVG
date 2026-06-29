import { LitElement, html, css } from 'lit';

export class ThemeToggle extends LitElement {
  static properties = {
    theme: { type: String, reflect: true },
  };

  static styles = css`
    :host {
      display: inline-flex;
    }

    .theme-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: var(--radius-sm);
      border: 1px solid var(--border-color);
      background: var(--bg-surface);
      color: var(--text-secondary);
      cursor: pointer;
      transition: all 0.25s ease;
      position: relative;
      overflow: hidden;
    }

    .theme-btn:hover {
      background: var(--bg-surface-hover);
      color: var(--text-primary);
      border-color: var(--border-color-strong);
      transform: translateY(-1px);
      box-shadow: var(--shadow-sm);
    }

    .theme-btn:active {
      transform: translateY(0);
    }

    .theme-btn:focus-visible {
      outline: 2px solid var(--color-primary);
      outline-offset: 2px;
    }

    .theme-btn svg {
      width: 20px;
      height: 20px;
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .theme-btn .sun {
      transform: rotate(0deg) scale(1);
      opacity: 1;
      filter: drop-shadow(0 0 4px rgba(255, 200, 50, 0.3));
    }

    .theme-btn .moon {
      position: absolute;
      opacity: 0;
      transform: rotate(90deg) scale(0);
    }

    :host([theme="dark"]) .theme-btn .sun {
      transform: rotate(-90deg) scale(0);
      opacity: 0;
      filter: none;
    }

    :host([theme="dark"]) .theme-btn .moon {
      transform: rotate(0deg) scale(1);
      opacity: 1;
      filter: drop-shadow(0 0 4px rgba(200, 180, 255, 0.2));
    }
  `;

  constructor() {
    super();
    this.theme = document.documentElement.getAttribute('data-theme') || 'light';
  }

  render() {
    return html`
      <button class="theme-btn" @click=${this._toggle} aria-label="Toggle theme" title="Toggle theme">
        <svg class="sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <circle cx="12" cy="12" r="5"/>
          <line x1="12" y1="1" x2="12" y2="3"/>
          <line x1="12" y1="21" x2="12" y2="23"/>
          <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
          <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
          <line x1="1" y1="12" x2="3" y2="12"/>
          <line x1="21" y1="12" x2="23" y2="12"/>
          <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
          <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
        </svg>
        <svg class="moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
        </svg>
      </button>
    `;
  }

  _toggle() {
    const newTheme = this.theme === 'light' ? 'dark' : 'light';
    this.theme = newTheme;
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('pdf2svg-theme', newTheme);
    this.dispatchEvent(new CustomEvent('theme-changed', {
      detail: { theme: newTheme },
      bubbles: true,
      composed: true,
    }));
  }
}

customElements.define('theme-toggle', ThemeToggle);
