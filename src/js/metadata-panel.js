// metadata-panel.js — Right sidebar EXIF + rating display

const MetadataPanel = (() => {
  const panel = document.getElementById('metadata-panel');
  const mainLayout = document.getElementById('main-layout');
  const exifDiv = document.getElementById('exif-display');
  const ratingDiv = document.getElementById('rating-control');
  const exifCache = new Map();

  async function show(photo) {
    if (!photo) return;
    const idx = AppState.currentPhotos.indexOf(photo);
    panel.classList.remove('hidden');
    mainLayout.classList.add('show-metadata');

    _renderControls(photo, idx);

    exifDiv.innerHTML = '<div class="exif-loading">读取元数据…</div>';
    let exif = exifCache.get(photo.path);
    if (!exif) {
      try {
        exif = await API.getExifData(photo.path);
        exifCache.set(photo.path, exif);
      } catch (e) {
        exif = null;
      }
    }
    _renderExif(photo, exif);
  }

  function _renderControls(photo, idx) {
    // Use folderMeta for current state (more authoritative than stale photo object)
    const meta = AppState.folderMeta[photo.filename] || {};
    const rating = meta.rating !== undefined ? meta.rating : photo.rating || 0;
    const label = meta.label !== undefined ? meta.label : (photo.label || photo.color_label || '');

    ratingDiv.innerHTML = `
      <div class="meta-section-title">评级</div>
      <div class="star-row" data-index="${idx}">
        ${[1,2,3,4,5].map(i =>
          `<span class="star ${i <= rating ? 'filled' : ''}" data-value="${i}">★</span>`
        ).join('')}
        <span class="star-clear" title="清除评级">✕</span>
      </div>
      <div class="meta-section-title" style="margin-top:12px;">颜色标签</div>
      <div class="label-swatches" data-index="${idx}">
        ${Object.entries(LABEL_COLORS).map(([key, color]) =>
          `<span class="label-swatch ${label === key ? 'active' : ''}"
                 data-label="${key}"
                 title="${LABEL_NAMES[key]}"
                 style="background:${color || '#555'}"></span>`
        ).join('')}
      </div>
    `;

    ratingDiv.querySelectorAll('.star[data-value]').forEach((star) => {
      star.addEventListener('click', () => {
        Ratings.setRating(idx, parseInt(star.dataset.value));
        _renderControls(AppState.currentPhotos[idx], idx);
      });
    });
    ratingDiv.querySelector('.star-clear').addEventListener('click', () => {
      Ratings.setRating(idx, 0);
      _renderControls(AppState.currentPhotos[idx], idx);
    });

    ratingDiv.querySelectorAll('.label-swatch').forEach((swatch) => {
      swatch.addEventListener('click', () => {
        Ratings.setLabel(idx, swatch.dataset.label);
        _renderControls(AppState.currentPhotos[idx], idx);
      });
    });
  }

  function _renderExif(photo, exif) {
    const row = (label, value) =>
      value ? `<div class="exif-row"><span class="exif-label">${label}</span><span class="exif-value">${value}</span></div>` : '';

    exifDiv.innerHTML = `
      <div class="meta-section-title">文件信息</div>
      ${row('文件名', photo.filename)}
      ${row('大小', formatFileSize(photo.size))}
      ${row('修改时间', formatDate(photo.modified))}
      ${exif ? `
        <div class="meta-section-title" style="margin-top:12px;">相机信息</div>
        ${row('拍摄时间', exif.date_taken)}
        ${row('品牌', exif.camera_make)}
        ${row('型号', exif.camera_model)}
        <div class="meta-section-title" style="margin-top:12px;">拍摄参数</div>
        ${row('ISO', exif.iso)}
        ${row('光圈', exif.aperture)}
        ${row('快门', exif.shutter_speed)}
        ${row('焦距', exif.focal_length)}
        ${exif.width && exif.height ? row('尺寸', `${exif.width} × ${exif.height}`) : ''}
        ${exif.gps_lat != null ? row('GPS', `${exif.gps_lat.toFixed(5)}, ${exif.gps_lon.toFixed(5)}`) : ''}
      ` : '<div class="exif-empty">无 EXIF 数据</div>'}
    `;
  }

  function hide() {
    panel.classList.add('hidden');
    mainLayout.classList.remove('show-metadata');
  }

  // Close button
  document.getElementById('btn-close-meta').addEventListener('click', hide);

  // Click on empty grid background to deselect
  document.getElementById('photo-grid').addEventListener('click', (e) => {
    if (e.target === document.getElementById('photo-grid')) {
      document.querySelectorAll('.thumb-item.selected').forEach((el) => el.classList.remove('selected'));
      hide();
    }
  });

  return { show, hide };
})();
