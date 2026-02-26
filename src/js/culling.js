// culling.js — Culling mode: single photo review with filmstrip

const Culling = (() => {
  const img = document.getElementById('cull-image');
  const counter = document.getElementById('cull-counter');
  const filenameEl = document.getElementById('cull-filename');
  const filmstrip = document.getElementById('cull-filmstrip');
  const controlsEl = document.getElementById('cull-controls');

  let currentIndex = 0;
  let active = false;
  let cullSubMode = 'mark'; // 'mark' | 'filter'

  // ── Transform state (zoom / pan / rotate) ────────────────────────────────
  let scale = 1, translateX = 0, translateY = 0, rotation = 0;
  let isDragging = false, dragStartX = 0, dragStartY = 0, dragTX = 0, dragTY = 0;

  function _applyTransform() {
    img.style.transform =
      `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`;
    img.style.cursor = scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default';
  }

  function _resetTransform() {
    scale = 1; translateX = 0; translateY = 0; rotation = 0;
    isDragging = false;
    _applyTransform();
  }

  // ── Entry / exit ──────────────────────────────────────────────────────────

  function enter(startIndex) {
    active = true;
    currentIndex = startIndex || 0;
    _render();
  }

  function exit() {
    active = false;
  }

  // Reset sub-mode to 'mark' and remove filter body class
  function resetMode() {
    cullSubMode = 'mark';
    document.body.classList.remove('cull-filter-mode');
  }

  // Re-render culling view with current photos (clamps index if needed)
  function refresh() {
    if (!active) return;
    const photos = AppState.currentPhotos;
    if (photos.length === 0) {
      currentIndex = 0;
    } else if (currentIndex >= photos.length) {
      currentIndex = 0;
    }
    _render();
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function next() {
    const photos = AppState.currentPhotos;
    if (!photos.length) return;
    currentIndex = (currentIndex + 1) % photos.length;
    _render();
  }

  function prev() {
    const photos = AppState.currentPhotos;
    if (!photos.length) return;
    currentIndex = (currentIndex - 1 + photos.length) % photos.length;
    _render();
  }

  function goTo(index) {
    currentIndex = index;
    _render();
  }

  // ── Render ────────────────────────────────────────────────────────────────

  function _render() {
    const photos = AppState.currentPhotos;
    if (!photos.length) {
      img.src = '';
      counter.textContent = '0 / 0';
      filenameEl.textContent = '';
      filmstrip.innerHTML = '';
      controlsEl.innerHTML = '';
      return;
    }

    const photo = photos[currentIndex];
    _resetTransform();
    img.src = API.toImageUrl(photo.path);
    counter.textContent = `${currentIndex + 1} / ${photos.length}`;
    filenameEl.textContent = photo.filename;

    _renderControls(photo);
    _renderFilmstrip(photos);
  }

  function _renderControls(photo) {
    const meta = AppState.folderMeta[photo.filename] || {};
    const rating = meta.rating || 0;
    const label = meta.label || '';
    const flagged = meta.flagged || false;

    controlsEl.innerHTML = `
      <div class="cull-controls-inner">
        ${cullSubMode === 'mark' ? `
          <div class="cull-stars">
            ${[1,2,3,4,5].map(i =>
              `<span class="star ${i <= rating ? 'filled' : ''}" data-value="${i}" title="${i}星 (按键${i})">★</span>`
            ).join('')}
            <span class="star-clear" title="清除 (按键0)">✕</span>
          </div>
          <div class="cull-labels">
            ${Object.entries(LABEL_COLORS).map(([key, color]) =>
              `<span class="label-swatch ${label === key ? 'active' : ''}"
                     data-label="${key}"
                     title="${LABEL_NAMES[key]}"
                     style="background:${color || '#555'}"></span>`
            ).join('')}
          </div>
          <button class="cull-flag-btn ${flagged ? 'active' : ''}" id="cull-flag-btn" title="标记保留 (F/Enter)">
            ♥ ${flagged ? '已标记' : '标记'}
          </button>
        ` : `
          <span class="cull-filter-hint">筛选模式 — 使用左侧筛选栏调整显示范围</span>
        `}
        <div class="cull-mode-tabs">
          <button class="cull-tab-btn ${cullSubMode === 'mark' ? 'active' : ''}" data-mode="mark" title="标注模式：对照片打分和标记">♥ 标注</button>
          <button class="cull-tab-btn ${cullSubMode === 'filter' ? 'active' : ''}" data-mode="filter" title="筛选模式：用左侧筛选栏过滤照片">⊞ 筛选</button>
        </div>
      </div>
    `;

    if (cullSubMode === 'mark') {
      // Star click handlers
      controlsEl.querySelectorAll('.star[data-value]').forEach((star) => {
        star.addEventListener('click', () => {
          AppState.updatePhotoMeta(photo.filename, { rating: parseInt(star.dataset.value) });
          _renderControls(AppState.currentPhotos[currentIndex]);
          _updateFilmstripItem(currentIndex);
        });
      });
      controlsEl.querySelector('.star-clear').addEventListener('click', () => {
        AppState.updatePhotoMeta(photo.filename, { rating: 0 });
        _renderControls(AppState.currentPhotos[currentIndex]);
        _updateFilmstripItem(currentIndex);
      });

      // Label swatch click handlers
      controlsEl.querySelectorAll('.label-swatch').forEach((swatch) => {
        swatch.addEventListener('click', () => {
          AppState.updatePhotoMeta(photo.filename, { label: swatch.dataset.label });
          _renderControls(AppState.currentPhotos[currentIndex]);
          _updateFilmstripItem(currentIndex);
        });
      });

      // Flag button handler
      document.getElementById('cull-flag-btn').addEventListener('click', () => {
        const current = (AppState.folderMeta[photo.filename] || {}).flagged || false;
        AppState.updatePhotoMeta(photo.filename, { flagged: !current });
        _renderControls(AppState.currentPhotos[currentIndex]);
        _updateFilmstripItem(currentIndex);
      });
    }

    // Mode tab handlers
    controlsEl.querySelectorAll('.cull-tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        cullSubMode = btn.dataset.mode;
        if (cullSubMode === 'filter') {
          document.body.classList.add('cull-filter-mode');
        } else {
          document.body.classList.remove('cull-filter-mode');
        }
        _renderControls(AppState.currentPhotos[currentIndex]);
      });
    });
  }

  // ── Filmstrip ─────────────────────────────────────────────────────────────

  function _renderFilmstrip(photos) {
    filmstrip.innerHTML = '';
    const VISIBLE = 11; // show ±5 around current
    const half = Math.floor(VISIBLE / 2);
    const start = Math.max(0, currentIndex - half);
    const end = Math.min(photos.length - 1, start + VISIBLE - 1);

    for (let i = start; i <= end; i++) {
      const p = photos[i];
      const meta = AppState.folderMeta[p.filename] || {};
      const thumb = document.createElement('div');
      thumb.className = 'filmstrip-thumb' + (i === currentIndex ? ' current' : '');
      thumb.dataset.index = i;

      const thumbImg = document.createElement('img');
      thumbImg.src = API.toImageUrl(p.path);
      thumbImg.alt = p.filename;

      if (meta.flagged) {
        const badge = document.createElement('span');
        badge.className = 'filmstrip-badge flag';
        badge.textContent = '♥';
        thumb.appendChild(badge);
      }
      if (meta.rejected) {
        const badge = document.createElement('span');
        badge.className = 'filmstrip-badge reject';
        badge.textContent = '✗';
        thumb.appendChild(badge);
      }
      if (meta.rating > 0) {
        const badge = document.createElement('span');
        badge.className = 'filmstrip-badge rating';
        badge.textContent = '★'.repeat(meta.rating);
        thumb.appendChild(badge);
      }

      thumb.appendChild(thumbImg);
      thumb.addEventListener('click', () => goTo(i));
      filmstrip.appendChild(thumb);
    }

    // Scroll current into view
    const currentThumb = filmstrip.querySelector('.filmstrip-thumb.current');
    if (currentThumb) currentThumb.scrollIntoView({ inline: 'center', behavior: 'smooth' });
  }

  function _updateFilmstripItem(index) {
    const thumb = filmstrip.querySelector(`[data-index="${index}"]`);
    if (!thumb) return;
    // Re-render just the badges on this thumb
    thumb.querySelectorAll('.filmstrip-badge').forEach((b) => b.remove());
    const photo = AppState.currentPhotos[index];
    const meta = AppState.folderMeta[photo.filename] || {};
    if (meta.flagged) {
      const b = document.createElement('span');
      b.className = 'filmstrip-badge flag'; b.textContent = '♥';
      thumb.insertBefore(b, thumb.querySelector('img'));
    }
    if (meta.rejected) {
      const b = document.createElement('span');
      b.className = 'filmstrip-badge reject'; b.textContent = '✗';
      thumb.insertBefore(b, thumb.querySelector('img'));
    }
    if (meta.rating > 0) {
      const b = document.createElement('span');
      b.className = 'filmstrip-badge rating'; b.textContent = '★'.repeat(meta.rating);
      thumb.insertBefore(b, thumb.querySelector('img'));
    }
  }

  // ── Keyboard shortcuts ────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (AppState.currentView !== 'cull') return;
    const photo = AppState.currentPhotos[currentIndex];
    if (!photo) return;

    switch (e.key) {
      case 'ArrowRight':
      case ' ':
        e.preventDefault();
        next();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        prev();
        break;
      case 'Escape':
        // Switch back to grid
        document.querySelector('.view-btn[data-view="grid"]').click();
        break;
      case '1': case '2': case '3': case '4': case '5':
        AppState.updatePhotoMeta(photo.filename, { rating: parseInt(e.key) });
        _renderControls(AppState.currentPhotos[currentIndex]);
        _updateFilmstripItem(currentIndex);
        break;
      case '0':
        AppState.updatePhotoMeta(photo.filename, { rating: 0 });
        _renderControls(AppState.currentPhotos[currentIndex]);
        _updateFilmstripItem(currentIndex);
        break;
      case '[':
        rotation = (rotation - 90 + 360) % 360;
        _applyTransform();
        break;
      case ']':
        rotation = (rotation + 90) % 360;
        _applyTransform();
        break;
      case 'r':
        AppState.updatePhotoMeta(photo.filename, { label: 'red' });
        _renderControls(AppState.currentPhotos[currentIndex]);
        break;
      case 'y':
        AppState.updatePhotoMeta(photo.filename, { label: 'yellow' });
        _renderControls(AppState.currentPhotos[currentIndex]);
        break;
      case 'g':
        AppState.updatePhotoMeta(photo.filename, { label: 'green' });
        _renderControls(AppState.currentPhotos[currentIndex]);
        break;
      case 'b':
        AppState.updatePhotoMeta(photo.filename, { label: 'blue' });
        _renderControls(AppState.currentPhotos[currentIndex]);
        break;
      case 'p':
        AppState.updatePhotoMeta(photo.filename, { label: 'purple' });
        _renderControls(AppState.currentPhotos[currentIndex]);
        break;
      case 'c':
        AppState.updatePhotoMeta(photo.filename, { label: '' });
        _renderControls(AppState.currentPhotos[currentIndex]);
        break;
      case 'f':
      case 'Enter': {
        const flagged = (AppState.folderMeta[photo.filename] || {}).flagged || false;
        AppState.updatePhotoMeta(photo.filename, { flagged: !flagged });
        _renderControls(AppState.currentPhotos[currentIndex]);
        _updateFilmstripItem(currentIndex);
        break;
      }
      case 'x': {
        const rejected = (AppState.folderMeta[photo.filename] || {}).rejected || false;
        AppState.updatePhotoMeta(photo.filename, { rejected: !rejected });
        _renderControls(AppState.currentPhotos[currentIndex]);
        _updateFilmstripItem(currentIndex);
        break;
      }
    }
  });

  // ── Navigation buttons ────────────────────────────────────────────────────

  document.getElementById('cull-prev').addEventListener('click', prev);
  document.getElementById('cull-next').addEventListener('click', next);

  // ── Zoom (scroll wheel on cull view) ─────────────────────────────────────
  document.getElementById('cull-view').addEventListener('wheel', (e) => {
    if (AppState.currentView !== 'cull') return;
    e.preventDefault();
    scale = Math.max(0.2, Math.min(8, scale * (e.deltaY < 0 ? 1.15 : 0.87)));
    _applyTransform();
  }, { passive: false });

  // ── Pan (drag when zoomed) ────────────────────────────────────────────────
  img.addEventListener('mousedown', (e) => {
    if (scale <= 1) return;
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX; dragStartY = e.clientY;
    dragTX = translateX; dragTY = translateY;
    _applyTransform();
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    translateX = dragTX + (e.clientX - dragStartX);
    translateY = dragTY + (e.clientY - dragStartY);
    _applyTransform();
  });
  document.addEventListener('mouseup', () => {
    if (isDragging) { isDragging = false; _applyTransform(); }
  });

  // ── Rotate buttons ────────────────────────────────────────────────────────
  document.getElementById('cull-rotate-cw').addEventListener('click', () => {
    rotation = (rotation + 90) % 360;
    _applyTransform();
  });
  document.getElementById('cull-rotate-ccw').addEventListener('click', () => {
    rotation = (rotation - 90 + 360) % 360;
    _applyTransform();
  });

  return { enter, exit, next, prev, refresh, resetMode };
})();
