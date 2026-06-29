import { css } from 'lit';

/**
 * Shared keyframe animations.
 * Import and spread into any component that needs them.
 */
export const animations = css`
  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes fadeInUp {
    from { opacity: 0; transform: translateY(16px); }
    to { opacity: 1; transform: translateY(0); }
  }

  @keyframes scaleIn {
    from { opacity: 0; transform: scale(0.95); }
    to { opacity: 1; transform: scale(1); }
  }

  @keyframes slideUp {
    from { transform: translateY(100%); }
    to { transform: translateY(0); }
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  @keyframes app-loader-spin {
    to { transform: rotate(360deg); }
  }
`;

/**
 * Unstyled component reset — strips default host display so the
 * component can be used inline. Apply to any component that should
 * not force a block-level display.
 */
export const hostReset = css`
  :host {
    display: block;
  }
`;

/**
 * Button base styles — shared across any component that renders
 * buttons matching the app's design language.
 */
export const buttonBase = css`
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 0.6rem 1.25rem;
    border-radius: var(--radius-sm);
    font-family: 'Inter', sans-serif;
    font-weight: 600;
    font-size: 0.85rem;
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    white-space: nowrap;
    line-height: 1;
    user-select: none;
    -webkit-user-select: none;
    text-decoration: none;
    min-height: 38px;
  }

  .btn svg {
    width: 18px;
    height: 18px;
    flex-shrink: 0;
  }

  .btn-sm {
    padding: 0.4rem 0.85rem;
    font-size: 0.8rem;
    min-height: 32px;
    gap: 6px;
  }

  .btn-sm svg {
    width: 16px;
    height: 16px;
  }

  .btn-primary {
    background: var(--color-primary);
    color: var(--text-inverse);
  }

  .btn-primary:hover {
    background: var(--color-primary-hover);
    transform: translateY(-1px);
    box-shadow: 0 4px 12px var(--color-primary-glow);
  }

  .btn-primary:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .btn-primary:active {
    transform: translateY(0);
  }

  .btn-secondary {
    background: var(--bg-surface-raised);
    color: var(--text-secondary);
    border: 1px solid var(--border-color);
    box-shadow: var(--shadow-sm);
  }

  .btn-secondary:hover {
    background: var(--bg-surface-hover);
    color: var(--text-primary);
    border-color: var(--border-color-strong);
    transform: translateY(-1px);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
  }

  .btn-secondary:active {
    transform: translateY(0);
    box-shadow: none;
  }

  .btn-secondary:focus-visible {
    outline: 2px solid var(--color-primary);
    outline-offset: 2px;
  }

  .btn-ghost {
    background: transparent;
    color: var(--text-muted);
    border: none;
  }

  .btn-ghost:hover {
    background: var(--bg-overlay);
    color: var(--text-secondary);
  }

  .btn-ghost:focus-visible {
    outline: 2px solid var(--border-color-strong);
    outline-offset: 2px;
  }
`;

/**
 * Utility classes (hidden, sr-only).
 */
export const utilities = css`
  .hidden {
    display: none !important;
  }

  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border: 0;
  }

  .animate-fade-in {
    animation: fadeIn 0.3s ease forwards;
  }

  .animate-fade-in-up {
    animation: fadeInUp 0.4s ease forwards;
  }

  .animate-scale-in {
    animation: scaleIn 0.3s ease forwards;
  }
`;
