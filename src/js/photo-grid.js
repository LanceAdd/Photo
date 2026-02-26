// photo-grid.js — Photo thumbnail grid with IntersectionObserver lazy loading

const PhotoGrid = (() => {
  const grid = document.getElementById('photo-grid');
  let observer = null;

  function init() {
    observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const img = entry.target.querySelector('img[data-src]');
            if (img) {
              img.src = img.dataset.src;
              delete img.dataset.src;
              observer.unobserve(entry.target);
            }
          }
        });
      },
      { rootMargin: '200px' }
    );
  }

  function render(photos) {
    if (observer) observer.disconnect();
    grid.innerHTML = '';

    if (photos.length === 0) {
      grid.innerHTML = '<div class="empty-state">此文件夹中没有照片</div>';
      return;
    }

    photos.forEach((photo, index) => {
      const fig = document.createElement('figure');
      fig.className = 'thumb-item';
      fig.dataset.path = photo.path;
      fig.dataset.index = index;

      // Color label border (field renamed from color_label → label)
      const labelVal = photo.label || photo.color_label || '';
      if (labelVal) {
        fig.style.setProperty('--label-color', LABEL_COLORS[labelVal] || 'transparent');
        fig.classList.add('has-label');
      }

      const img = document.createElement('img');
      img.dataset.src = API.toImageUrl(photo.path);
      img.alt = photo.filename;
      img.loading = 'lazy';

      const overlay = document.createElement('div');
      overlay.className = 'thumb-overlay';
      if (photo.rating > 0) {
        overlay.innerHTML = `<span class="star-badge">${'★'.repeat(photo.rating)}</span>`;
      }

      // Flag / reject badges
      if (photo.flagged) {
        const badge = document.createElement('div');
        badge.className = 'thumb-flag-badge flag';
        badge.textContent = '♥';
        fig.appendChild(badge);
      }
      if (photo.rejected) {
        const badge = document.createElement('div');
        badge.className = 'thumb-flag-badge';
        badge.textContent = '✗';
        fig.appendChild(badge);
      }

      fig.appendChild(img);
      fig.appendChild(overlay);
      grid.appendChild(fig);

      fig.addEventListener('click', (e) => {
        e.stopPropagation();
        selectPhoto(fig, index);
      });

      fig.addEventListener('dblclick', () => {
        Lightbox.open(index);
      });

      fig.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        ContextMenu.show(e.clientX, e.clientY, photo, index);
      });

      if (observer) observer.observe(fig);
    });
  }

  function selectPhoto(fig, index) {
    document.querySelectorAll('.thumb-item.selected').forEach((el) => el.classList.remove('selected'));
    fig.classList.add('selected');
    AppState.selectedIndex = index;
    MetadataPanel.show(AppState.currentPhotos[index]);
  }

  function refreshItem(index) {
    const photo = AppState.currentPhotos[index];
    const fig = grid.querySelector(`[data-index="${index}"]`);
    if (!fig) return;

    // Label border
    fig.classList.remove('has-label');
    fig.style.removeProperty('--label-color');
    const labelVal = photo.label || photo.color_label || '';
    if (labelVal) {
      fig.style.setProperty('--label-color', LABEL_COLORS[labelVal] || 'transparent');
      fig.classList.add('has-label');
    }

    // Star badge
    const overlay = fig.querySelector('.thumb-overlay');
    if (overlay) {
      overlay.innerHTML = photo.rating > 0
        ? `<span class="star-badge">${'★'.repeat(photo.rating)}</span>`
        : '';
    }

    // Flag/reject badges
    fig.querySelectorAll('.thumb-flag-badge').forEach((b) => b.remove());
    if (photo.flagged) {
      const b = document.createElement('div');
      b.className = 'thumb-flag-badge flag'; b.textContent = '♥';
      fig.insertBefore(b, fig.querySelector('img'));
    }
    if (photo.rejected) {
      const b = document.createElement('div');
      b.className = 'thumb-flag-badge'; b.textContent = '✗';
      fig.insertBefore(b, fig.querySelector('img'));
    }
  }

  init();
  return { render, refreshItem };
})();
