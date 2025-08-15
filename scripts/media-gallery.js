// scripts/media-gallery.js
// MediaGallery v1 — reusable image/video lightbox gallery
// Usage: new MediaGallery(container|selector, options)
// Or add data-gallery attribute to an element and call MediaGallery.autoInit()

(function (global) {
  class MediaGallery {
    /**
     * @param {HTMLElement|string} container - element or selector for the gallery container
     * @param {Object} options
     *    items: [{src, type: 'image'|'video', poster?}],  // optional if you have data attributes
     *    preload: 'none'|'current'|'buffer'  // buffer preloads prev/next
     *    modalId: optional id for modal element
     */
    constructor(container, options = {}) {
      this.container =
        typeof container === 'string'
          ? document.querySelector(container)
          : container;
      if (!this.container) throw new Error('MediaGallery: container not found');

      this.items = options.items || this._readItemsFromDOM() || [];
      this.preload = options.preload || 'none';
      this.modalId = options.modalId || 'mg-modal';
      this.currentIndex = 0;

      this._buildModalIfNeeded();
      this._wireThumbClicks();
      this._bindModalEvents();
      if (options.autoPreloadAfter) {
        setTimeout(() => this._maybePreloadAll(), options.autoPreloadAfter);
      }
    }

    // scan container for .gallery-thumb (or data attributes) to assemble items
    _readItemsFromDOM() {
      const thumbs = this.container.querySelectorAll('[data-mg-src]');
      if (!thumbs.length) return null;
      const out = [];
      thumbs.forEach((t) => {
        out.push({
          src: t.dataset.mgSrc,
          type: t.dataset.mgType || (/\.(mp4|webm|ogg)$/i.test(t.dataset.mgSrc) ? 'video' : 'image'),
          poster: t.dataset.mgPoster || ''
        });
        // set index on element
        t.dataset.mgIndex = out.length - 1;
      });
      return out;
    }

    // create a single shared modal if it doesn't exist
    _buildModalIfNeeded() {
      if (document.getElementById(this.modalId)) {
        this.modal = document.getElementById(this.modalId);
        this.modalImageWrap = this.modal.querySelector('.mg-content');
        this.modalImageEl = this.modal.querySelector('.mg-media');
        return;
      }

      const modal = document.createElement('div');
      modal.id = this.modalId;
      modal.className = 'mg-modal fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center hidden z-50';
      modal.innerHTML = `
        <div class="relative w-full max-w-4xl mx-4">
          <button class="mg-close absolute top-2 right-2 text-white text-3xl leading-none">&times;</button>
          <div class="mg-viewer bg-black p-4 rounded-lg relative">
            <div class="mg-content flex items-center justify-center">
              <div class="mg-media-container w-full flex justify-center items-center">
                <!-- media inserted here -->
              </div>
            </div>
            <div class="mg-controls mt-3 flex items-center justify-between text-white">
              <button class="mg-prev px-4 py-2" aria-label="Previous">Prev</button>
              <div class="mg-nav-text"></div>
              <button class="mg-next px-4 py-2" aria-label="Next">Next</button>
            </div>
          </div>
        </div>
      `;
      document.body.appendChild(modal);

      this.modal = modal;
      this.modalImageWrap = modal.querySelector('.mg-media-container');
      this.closeBtn = modal.querySelector('.mg-close');
      this.prevBtn = modal.querySelector('.mg-prev');
      this.nextBtn = modal.querySelector('.mg-next');
      this.navText = modal.querySelector('.mg-nav-text');

      // accessibility
      modal.setAttribute('role', 'dialog');
      modal.setAttribute('aria-modal', 'true');
    }

    _wireThumbClicks() {
      // Accept .gallery-thumb inside container or element with data-mg-index
      const thumbs = this.container.querySelectorAll('[data-mg-index], .gallery-thumb');
      thumbs.forEach((t, idx) => {
        // if the element doesn't have a data-mg-index but we have items from JS, set it
        if (!t.dataset.mgIndex && this.items.length) t.dataset.mgIndex = idx;
        t.style.cursor = 'pointer';
        t.addEventListener('click', (ev) => {
          const index = parseInt(t.dataset.mgIndex ?? t.getAttribute('data-mg-index'), 10);
          this.open(index || 0);
        });
      });
    }

    _bindModalEvents() {
      this.closeBtn?.addEventListener('click', () => this.close());
      this.prevBtn?.addEventListener('click', () => this.prev());
      this.nextBtn?.addEventListener('click', () => this.next());
      // click outside media closes
      this.modal.addEventListener('click', (e) => {
        const inside = this.modal.querySelector('.mg-viewer').contains(e.target);
        if (!inside) this.close();
      });
      // keyboard
      document.addEventListener('keydown', (e) => {
        if (this.modal.classList.contains('hidden')) return;
        if (e.key === 'ArrowRight') this.next();
        else if (e.key === 'ArrowLeft') this.prev();
        else if (e.key === 'Escape') this.close();
      });

      // touch swipe on the media wrapper
      let startX = 0, startY = 0, endX = 0, endY = 0;
      this.modalImageWrap.addEventListener('touchstart', (e) => {
        startX = e.changedTouches[0].screenX;
        startY = e.changedTouches[0].screenY;
      }, { passive: true });

      this.modalImageWrap.addEventListener('touchend', (e) => {
        endX = e.changedTouches[0].screenX;
        endY = e.changedTouches[0].screenY;
        const dx = endX - startX;
        const dy = Math.abs(endY - startY);
        const threshold = 50;
        if (Math.abs(dx) > threshold && Math.abs(dx) > dy) {
          if (dx < 0) this.next();
          else this.prev();
        }
      }, { passive: true });
    }

    open(index = 0) {
      if (!this.items.length) return;
      this.currentIndex = ((index % this.items.length) + this.items.length) % this.items.length;
      this._show(this.currentIndex);
      this.modal.classList.remove('hidden');
      // optionally preload neighbors
      if (this.preload === 'buffer') {
        this._preloadIndex(this.currentIndex - 1);
        this._preloadIndex(this.currentIndex + 1);
      } else if (this.preload === 'current') {
        this._preloadIndex(this.currentIndex);
      }
    }

    close() {
      this.modal.classList.add('hidden');
      // clear media to release resources / stop video
      this._clearMedia();
    }

    next() {
      this._setIndex(this.currentIndex + 1);
    }

    prev() {
      this._setIndex(this.currentIndex - 1);
    }

    _setIndex(i) {
      this.currentIndex = ((i % this.items.length) + this.items.length) % this.items.length;
      this._show(this.currentIndex);
      if (this.preload === 'buffer') {
        this._preloadIndex(this.currentIndex + 1);
        this._preloadIndex(this.currentIndex - 1);
      }
    }

    _clearMedia() {
      // remove children & stop video if present
      const c = this.modalImageWrap;
      if (!c) return;
      const vids = c.querySelectorAll('video');
      vids.forEach(v => {
        try {
          v.pause();
          v.removeAttribute('src');
          v.load();
        } catch (err) { /* ignore */ }
      });
      c.innerHTML = '';
      this._updateNavText();
    }

    _show(idx) {
      if (!this.modalImageWrap) return;
      this._clearMedia();
      const item = this.items[idx];
      if (!item) return;
      if (item.type === 'video') {
        const video = document.createElement('video');
        video.className = 'mg-media max-h-[80vh] max-w-full';
        video.setAttribute('controls', '');
        video.setAttribute('playsinline', '');
        video.setAttribute('preload', 'metadata'); // don't download full file unless needed
        video.src = item.src;
        if (item.poster) video.poster = item.poster;
        video.autoplay = true;
        this.modalImageWrap.appendChild(video);
        // small attempt to play (some browsers block autoplay without interaction)
        video.play().catch(()=>{/* autoplay blocked; user must click */});
      } else {
        const img = document.createElement('img');
        img.className = 'mg-media max-h-[80vh] max-w-full rounded';
        img.setAttribute('alt', item.alt || '');
        img.loading = 'lazy';
        img.src = item.src;
        this.modalImageWrap.appendChild(img);
      }
      this._updateNavText();
    }

    _updateNavText() {
      if (!this.navText) return;
      this.navText.textContent = `${this.currentIndex + 1} / ${this.items.length}`;
    }

    // preloading helper
    _preloadIndex(i) {
      if (!this.items.length) return;
      const idx = ((i % this.items.length) + this.items.length) % this.items.length;
      const item = this.items[idx];
      if (!item) return;
      if (item.type === 'image') {
        const img = new Image();
        if (item.poster) img.alt = item.poster;
        img.src = item.src;
      } else if (item.type === 'video') {
        // preload small amount of metadata; don't download full video in background
        const v = document.createElement('video');
        v.preload = 'metadata';
        v.src = item.src;
        // don't add to DOM
      }
    }

    _maybePreloadAll() {
      // use with care: preloads meta only for videos and full for images
      this.items.forEach((_, i) => this._preloadIndex(i));
    }

    // static convenience: auto init all galleries that have data-mg-auto attribute
    static autoInit() {
      const nodes = document.querySelectorAll('[data-mg-auto]');
      nodes.forEach((n) => {
        // read items if present on children or via JSON in data-mg-items
        let items = null;
        if (n.dataset.mgItems) {
          try { items = JSON.parse(n.dataset.mgItems); } catch (e) { items = null; }
        }
        const preload = n.dataset.mgPreload || 'none';
        const modalId = n.dataset.mgModalId || null;
        new MediaGallery(n, { items, preload, modalId });
      });
    }
  }

  // expose
  global.MediaGallery = MediaGallery;

  // auto-init on domready for elements that opted in
  document.addEventListener('DOMContentLoaded', () => {
    const auto = document.querySelectorAll('[data-mg-auto]');
    if (auto.length) MediaGallery.autoInit();
  });
})(window);
