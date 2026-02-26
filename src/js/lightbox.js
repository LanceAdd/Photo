// lightbox.js — Full-screen photo viewer with zoom / pan / rotate / EXIF info

const Lightbox = (() => {
  const overlay = document.getElementById('lightbox');
  const img = document.getElementById('lb-image');
  const counter = document.getElementById('lb-counter');
  const filenameEl = document.getElementById('lb-filename');
  const exifPanel = document.getElementById('lb-exif-panel');
  let currentIndex = 0;

  // ── Transform state ────────────────────────────────────────────────────────
  let scale = 1, translateX = 0, translateY = 0, rotation = 0;
  let isDragging = false, dragStartX = 0, dragStartY = 0, dragTX = 0, dragTY = 0;
  let infoVisible = false;

  function _applyTransform() {
    img.style.transform =
      `translate(${translateX}px, ${translateY}px) scale(${scale}) rotate(${rotation}deg)`;
    img.style.cursor = scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default';
  }

  function _resetTransform() {
    scale = 1; translateX = 0; translateY = 0; rotation = 0;
    _applyTransform();
  }

  // ── Open / close ───────────────────────────────────────────────────────────

  function open(index) {
    currentIndex = index;
    _show();
    overlay.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
  }

  function close() {
    overlay.classList.add('hidden');
    img.src = '';
    document.body.style.overflow = '';
    _resetTransform();
    infoVisible = false;
    exifPanel.classList.add('hidden');
    exifPanel.innerHTML = '';
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function next() {
    const photos = AppState.currentPhotos;
    currentIndex = (currentIndex + 1) % photos.length;
    _show();
  }

  function prev() {
    const photos = AppState.currentPhotos;
    currentIndex = (currentIndex - 1 + photos.length) % photos.length;
    _show();
  }

  function _show() {
    const photos = AppState.currentPhotos;
    const photo = photos[currentIndex];
    if (!photo) return;

    _resetTransform();
    img.src = API.toImageUrl(photo.path);
    counter.textContent = `${currentIndex + 1} / ${photos.length}`;
    filenameEl.textContent = photo.filename;
    MetadataPanel.show(photo);

    // Refresh EXIF panel if currently open
    if (infoVisible) {
      _loadExifPanel(photo);
    }
  }

  // ── Zoom (scroll wheel) ────────────────────────────────────────────────────

  overlay.addEventListener('wheel', (e) => {
    if (overlay.classList.contains('hidden')) return;
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.15 : 0.87;
    scale = Math.max(0.2, Math.min(8, scale * factor));
    _applyTransform();
  }, { passive: false });

  // ── Pan (drag when zoomed) ─────────────────────────────────────────────────

  img.addEventListener('mousedown', (e) => {
    if (scale <= 1) return;
    e.preventDefault();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragTX = translateX;
    dragTY = translateY;
    _applyTransform();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    translateX = dragTX + (e.clientX - dragStartX);
    translateY = dragTY + (e.clientY - dragStartY);
    _applyTransform();
  });

  document.addEventListener('mouseup', () => {
    if (isDragging) {
      isDragging = false;
      _applyTransform();
    }
  });

  // ── Rotate ─────────────────────────────────────────────────────────────────

  document.getElementById('lb-rotate').addEventListener('click', () => {
    rotation = (rotation + 90) % 360;
    _applyTransform();
  });

  // ── EXIF info panel ────────────────────────────────────────────────────────

  document.getElementById('lb-info-toggle').addEventListener('click', _toggleInfo);

  function _toggleInfo() {
    infoVisible = !infoVisible;
    if (!infoVisible) {
      exifPanel.classList.add('hidden');
      return;
    }
    const photo = AppState.currentPhotos[currentIndex];
    if (photo) _loadExifPanel(photo);
  }

  async function _loadExifPanel(photo) {
    exifPanel.classList.remove('hidden');
    exifPanel.innerHTML = '<div class="lb-exif-loading">读取中…</div>';
    try {
      const exif = await API.getExifData(photo.path);
      exifPanel.innerHTML = _renderExifHtml(photo, exif);
    } catch {
      exifPanel.innerHTML = '<div class="lb-exif-empty">无 EXIF 数据</div>';
    }
  }

  function _renderExifHtml(photo, exif) {
    const row = (label, value) =>
      value
        ? `<div class="exif-row"><span class="exif-label">${label}</span><span class="exif-value">${value}</span></div>`
        : '';

    return `
      <div class="meta-section-title">文件信息</div>
      ${row('文件名', photo.filename)}
      ${row('大小', formatFileSize(photo.size))}
      ${row('修改时间', formatDate(photo.modified))}
      ${exif ? `
        <div class="meta-section-title" style="margin-top:10px;">相机信息</div>
        ${row('拍摄时间', exif.date_taken)}
        ${row('品牌', exif.camera_make)}
        ${row('型号', exif.camera_model)}
        <div class="meta-section-title" style="margin-top:10px;">拍摄参数</div>
        ${row('ISO', exif.iso)}
        ${row('光圈', exif.aperture)}
        ${row('快门', exif.shutter_speed)}
        ${row('焦距', exif.focal_length)}
        ${exif.width && exif.height ? row('尺寸', `${exif.width} × ${exif.height}`) : ''}
        ${exif.gps_lat != null ? row('GPS', `${exif.gps_lat.toFixed(5)}, ${exif.gps_lon.toFixed(5)}`) : ''}
      ` : '<div class="lb-exif-empty">无 EXIF 数据</div>'}
    `;
  }

  // ── Buttons ────────────────────────────────────────────────────────────────

  document.getElementById('lb-close').addEventListener('click', close);
  document.getElementById('lb-prev').addEventListener('click', prev);
  document.getElementById('lb-next').addEventListener('click', next);

  // Click backdrop to close
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });

  // ── Keyboard navigation ────────────────────────────────────────────────────

  document.addEventListener('keydown', (e) => {
    if (overlay.classList.contains('hidden')) return;
    switch (e.key) {
      case 'ArrowRight': next(); break;
      case 'ArrowLeft': prev(); break;
      case 'Escape': close(); break;
      case '[': rotation = (rotation + 90) % 360; _applyTransform(); break;
      case ']': rotation = (rotation - 90 + 360) % 360; _applyTransform(); break;
      case 'i': case 'I': _toggleInfo(); break;
      case '=': case '+':
        scale = Math.min(8, scale * 1.25); _applyTransform(); break;
      case '-':
        scale = Math.max(0.2, scale * 0.8); _applyTransform(); break;
      case '0':
        _resetTransform(); break;
      case '1': case '2': case '3': case '4': case '5':
        Ratings.setRating(currentIndex, parseInt(e.key));
        break;
      case 'r': Ratings.setLabel(currentIndex, 'red'); break;
      case 'y': Ratings.setLabel(currentIndex, 'yellow'); break;
      case 'g': Ratings.setLabel(currentIndex, 'green'); break;
      case 'b': Ratings.setLabel(currentIndex, 'blue'); break;
      case 'p': Ratings.setLabel(currentIndex, 'purple'); break;
      case 'c': Ratings.setLabel(currentIndex, ''); break;
    }
  });

  return { open, close, next, prev };
})();
