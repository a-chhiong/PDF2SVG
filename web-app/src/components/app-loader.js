import { LitElement, html, css } from 'lit';
import { animations } from '../styles/shared-styles.js';

/**
 * AppLoader — Initial loading indicator.
 *
 * Renders a themed spinner + text inside the app card.
 * Hidden by <app-root> when the controller signals readiness via the
 * `ready` property (triggers a CSS opacity transition, then DOM removal).
 */
export class AppLoader extends LitElement {
  static properties = {
    ready: { type: Boolean, reflect: true },
  };

  static styles = [
    animations,
    css`
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: clamp(0.5rem, 1vw, 1rem);
      padding: clamp(1rem, 3.5vw, 3rem) clamp(0.75rem, 1.5vw, 1.5rem);
      opacity: 1;
      transition: opacity 0.35s ease;
    }

    :host([ready]) {
      opacity: 0;
      pointer-events: none;
    }

    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid var(--border-color, #d4d6dd);
      border-top-color: var(--color-primary, #4f6ef7);
      border-radius: 50%;
      animation: app-loader-spin 0.7s linear infinite;
    }

    .loader-text {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 0.85rem;
      color: var(--text-muted, #6b6f7a);
      font-weight: 500;
    }
  `];

  constructor() {
    super();
    this.ready = false;
  }

  render() {
    return html`
      <div class="spinner"></div>
      <div class="loader-text">Loading PDF2SVG…</div>
    `;
  }
}

customElements.define('app-loader', AppLoader);
