/**
 * ZoomController — A Lit Reactive Controller that manages
 * zoom state, touch pinch gestures, Spacebar modifiers,
 * trackpad wheel pinch gestures, and grab/drag panning.
 */
export class ZoomController {
  constructor(host) {
    this.host = host;
    host.addController(this);

    // Reactive states
    this.zoom = 1.0;
    this.panMode = false;
    this.isSpacePressed = false;
    this.isDragging = false;

    // Mouse drag anchor coordinates
    this._startX = 0;
    this._startY = 0;
    this._scrollLeftStart = 0;
    this._scrollTopStart = 0;

    // Mobile touch drag anchors
    this._touchStartX = 0;
    this._touchStartY = 0;
    this._isTouchDragging = false;
    this._isPinching = false;
    this._initialTouchDistance = 0;
    this._initialZoom = 1.0;
  }

  hostConnected() {
    window.addEventListener('keydown', this._handleKeyDown);
    window.addEventListener('keyup', this._handleKeyUp);
  }

  hostDisconnected() {
    window.removeEventListener('keydown', this._handleKeyDown);
    window.removeEventListener('keyup', this._handleKeyUp);
  }

  _handleKeyDown = (e) => {
    if (e.code === 'Space' && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
      e.preventDefault();
      if (!this.isSpacePressed) {
        this.isSpacePressed = true;
        this.host.requestUpdate();
      }
    }
  };

  _handleKeyUp = (e) => {
    if (e.code === 'Space') {
      this.isSpacePressed = false;
      this.host.requestUpdate();
    }
  };

  handleMouseDown = (e) => {
    const isMiddleClick = e.button === 1;
    const isPanActive = this.panMode || this.isSpacePressed || isMiddleClick;

    if (!isPanActive) return;

    e.preventDefault();
    this.isDragging = true;
    this._startX = e.clientX;
    this._startY = e.clientY;

    const container = e.currentTarget;
    this._scrollLeftStart = container.scrollLeft;
    this._scrollTopStart = container.scrollTop;

    this.host.requestUpdate();
  };

  handleMouseMove = (e) => {
    if (!this.isDragging) return;

    e.preventDefault();
    const container = e.currentTarget;
    const dx = e.clientX - this._startX;
    const dy = e.clientY - this._startY;

    container.scrollLeft = this._scrollLeftStart - dx;
    container.scrollTop = this._scrollTopStart - dy;
  };

  handleMouseUp = () => {
    if (this.isDragging) {
      this.isDragging = false;
      this.host.requestUpdate();
    }
  };

  handleTouchStart = (e) => {
    if (e.touches.length === 1) {
      const isPanActive = this.panMode || this.isSpacePressed || this.zoom > 1;
      if (!isPanActive) return;

      this._isTouchDragging = true;
      this._touchStartX = e.touches[0].clientX;
      this._touchStartY = e.touches[0].clientY;

      const container = e.currentTarget;
      this._scrollLeftStart = container.scrollLeft;
      this._scrollTopStart = container.scrollTop;
    } else if (e.touches.length === 2) {
      this._isPinching = true;
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      this._initialTouchDistance = Math.sqrt(dx * dx + dy * dy);
      this._initialZoom = this.zoom;
    }
  };

  handleTouchMove = (e) => {
    if (this._isPinching && e.touches.length === 2) {
      e.preventDefault();
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (this._initialTouchDistance > 0) {
        const factor = distance / this._initialTouchDistance;
        this.setZoom(this._initialZoom * factor);
      }
    } else if (this._isTouchDragging && e.touches.length === 1) {
      e.preventDefault();
      const container = e.currentTarget;
      const dx = e.touches[0].clientX - this._touchStartX;
      const dy = e.touches[0].clientY - this._touchStartY;

      container.scrollLeft = this._scrollLeftStart - dx;
      container.scrollTop = this._scrollTopStart - dy;
    }
  };

  handleTouchEnd = () => {
    this._isTouchDragging = false;
    this._isPinching = false;
  };

  handleWheel = (e) => {
    if (e.ctrlKey) {
      e.preventDefault();
      const factor = 1 - e.deltaY * 0.01;
      this.setZoom(this.zoom * factor);
    }
  };

  zoomIn = () => {
    this.setZoom(this.zoom + 0.25);
  };

  zoomOut = () => {
    this.setZoom(this.zoom - 0.25);
  };

  zoomReset = () => {
    this.setZoom(1.0);
  };

  setPanMode = (val) => {
    if (this.panMode !== val) {
      this.panMode = val;
      this.host.requestUpdate();
    }
  };

  setZoom(val) {
    const nextZoom = Math.min(Math.max(val, 0.25), 4);
    if (this.zoom !== nextZoom) {
      this.zoom = nextZoom;
      this.host.requestUpdate();
    }
  }
}
