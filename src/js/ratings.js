// ratings.js — Star rating + color label mutations + filter bar logic

const Ratings = (() => {
  function setRating(index, value) {
    const photo = AppState.currentPhotos[index];
    if (!photo) return;
    AppState.updatePhotoMeta(photo.filename, { rating: value });
    PhotoGrid.refreshItem(index);
  }

  function setLabel(index, label) {
    const photo = AppState.currentPhotos[index];
    if (!photo) return;
    AppState.updatePhotoMeta(photo.filename, { label });
    PhotoGrid.refreshItem(index);
  }

  function setFlag(index, flagged) {
    const photo = AppState.currentPhotos[index];
    if (!photo) return;
    AppState.updatePhotoMeta(photo.filename, { flagged });
    PhotoGrid.refreshItem(index);
  }

  function setRejected(index, rejected) {
    const photo = AppState.currentPhotos[index];
    if (!photo) return;
    AppState.updatePhotoMeta(photo.filename, { rejected });
    PhotoGrid.refreshItem(index);
  }

  return { setRating, setLabel, setFlag, setRejected };
})();

// ─── Filter bar (left panel) ──────────────────────────────────────────────────

const FilterBar = (() => {
  const starFilter = document.getElementById('star-filter');
  const labelFilter = document.getElementById('label-filter');

  const starOptions = [
    { value: 0, label: '全部' },
    { value: 1, label: '★' },
    { value: 2, label: '★★' },
    { value: 3, label: '★★★' },
    { value: 4, label: '★★★★' },
    { value: 5, label: '★★★★★' },
  ];

  starOptions.forEach(({ value, label }) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (value === 0 ? ' active' : '');
    btn.textContent = label;
    btn.dataset.rating = value;
    btn.addEventListener('click', () => {
      starFilter.querySelectorAll('.filter-btn').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      AppState.filterRating = value;
      AppState.applyFilters();
    });
    starFilter.appendChild(btn);
  });

  const labelOptions = [
    { value: '', label: '全部' },
    ...Object.entries(LABEL_NAMES)
      .filter(([k]) => k !== '')
      .map(([k, v]) => ({ value: k, label: v })),
  ];

  labelOptions.forEach(({ value, label }) => {
    const pill = document.createElement('span');
    pill.className = 'label-pill' + (value === '' ? ' active' : '');
    pill.textContent = label;
    pill.dataset.label = value;
    if (value) pill.style.setProperty('--pill-color', LABEL_COLORS[value]);
    pill.addEventListener('click', () => {
      labelFilter.querySelectorAll('.label-pill').forEach((p) => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.filterLabel = value;
      AppState.applyFilters();
    });
    labelFilter.appendChild(pill);
  });

  // Flagged checkbox
  document.getElementById('filter-flagged-check').addEventListener('change', (e) => {
    AppState.filterFlagged = e.target.checked;
    AppState.applyFilters();
  });

  // Reset button
  document.getElementById('btn-reset-filter').addEventListener('click', () => reset());

  // ── Public API ─────────────────────────────────────────────────────────────

  // Update DOM to reflect default filter state (no applyFilters call)
  function resetUI() {
    starFilter.querySelectorAll('.filter-btn').forEach((b) =>
      b.classList.toggle('active', b.dataset.rating === '0')
    );
    labelFilter.querySelectorAll('.label-pill').forEach((p) =>
      p.classList.toggle('active', p.dataset.label === '')
    );
    document.getElementById('filter-flagged-check').checked = false;
  }

  // Full reset: clear state + update DOM + re-apply filters
  function reset() {
    AppState.filterRating = 0;
    AppState.filterLabel = '';
    AppState.filterFlagged = false;
    resetUI();
    AppState.applyFilters();
  }

  return { reset, resetUI };
})();
