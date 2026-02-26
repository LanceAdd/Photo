// context-menu.js — Right-click context menu for photos

const ContextMenu = (() => {
  let menuEl = null;

  function _ensureMenu() {
    if (menuEl) return;
    menuEl = document.createElement('div');
    menuEl.id = 'context-menu';
    menuEl.className = 'context-menu hidden';
    document.body.appendChild(menuEl);

    // Close on outside click
    document.addEventListener('click', () => hide(), true);
    document.addEventListener('contextmenu', () => hide(), true);
  }

  function show(x, y, photo, index) {
    _ensureMenu();
    menuEl.innerHTML = '';

    // Rating shortcuts
    [1, 2, 3, 4, 5].forEach((n) => {
      const item = document.createElement('div');
      item.className = 'cm-item';
      item.textContent = `评级 ${'★'.repeat(n)}`;
      item.addEventListener('click', () => {
        hide();
        Ratings.setRating(index, n);
      });
      menuEl.appendChild(item);
    });

    const clearItem = document.createElement('div');
    clearItem.className = 'cm-item';
    clearItem.textContent = '清除评级';
    clearItem.addEventListener('click', () => {
      hide();
      Ratings.setRating(index, 0);
    });
    menuEl.appendChild(clearItem);

    // Position
    menuEl.classList.remove('hidden');
    const rect = menuEl.getBoundingClientRect();
    const vw = window.innerWidth, vh = window.innerHeight;
    menuEl.style.left = (x + rect.width > vw ? vw - rect.width - 4 : x) + 'px';
    menuEl.style.top = (y + rect.height > vh ? vh - rect.height - 4 : y) + 'px';
  }

  function hide() {
    if (menuEl) menuEl.classList.add('hidden');
  }

  return { show, hide };
})();
