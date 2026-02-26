// albums.js — Album management

const Albums = (() => {
  const albumList = document.getElementById('album-list');
  const albumPhotos = document.getElementById('album-photos');
  let currentAlbumId = null;

  function render() {
    albumList.innerHTML = '';
    const albums = AppState.data.albums;

    if (albums.length === 0) {
      albumList.innerHTML = '<div class="empty-state">还没有相册</div>';
    }

    albums.forEach((album) => {
      const count = AppState.data.photos.filter((p) => p.album_ids.includes(album.id)).length;
      const card = document.createElement('div');
      card.className = 'album-card' + (album.id === currentAlbumId ? ' active' : '');
      card.innerHTML = `
        <div class="album-name">${album.name}</div>
        <div class="album-count">${count} 张</div>
        <button class="album-delete" data-id="${album.id}" title="删除相册">✕</button>
      `;
      card.addEventListener('click', (e) => {
        if (e.target.classList.contains('album-delete')) return;
        openAlbum(album.id);
      });
      card.querySelector('.album-delete').addEventListener('click', (e) => {
        e.stopPropagation();
        deleteAlbum(album.id);
      });
      albumList.appendChild(card);
    });

    // "+ 新建相册" button
    const addBtn = document.createElement('button');
    addBtn.className = 'album-add-btn';
    addBtn.textContent = '+ 新建相册';
    addBtn.addEventListener('click', createAlbum);
    albumList.appendChild(addBtn);
  }

  function openAlbum(id) {
    currentAlbumId = id;
    render();
    const photos = AppState.data.photos.filter((p) => p.album_ids.includes(id));
    _renderAlbumPhotos(photos);
  }

  function _renderAlbumPhotos(photos) {
    albumPhotos.innerHTML = '';
    if (photos.length === 0) {
      albumPhotos.innerHTML = '<div class="empty-state">此相册为空</div>';
      return;
    }
    photos.forEach((photo) => {
      const fig = document.createElement('figure');
      fig.className = 'thumb-item';
      const img = document.createElement('img');
      img.src = API.toImageUrl(photo.path);
      img.alt = photo.filename;
      const removeBtn = document.createElement('button');
      removeBtn.className = 'album-photo-remove';
      removeBtn.title = '从相册移除';
      removeBtn.textContent = '✕';
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        removeFromAlbum(photo.path, currentAlbumId);
      });
      fig.appendChild(img);
      fig.appendChild(removeBtn);
      albumPhotos.appendChild(fig);
    });
  }

  function createAlbum() {
    const name = prompt('相册名称：');
    if (!name || !name.trim()) return;
    const album = {
      id: generateId(),
      name: name.trim(),
      created_at: Date.now(),
    };
    AppState.data.albums.push(album);
    AppState.saveState();
    render();
  }

  function deleteAlbum(id) {
    if (!confirm('确定删除此相册？（照片本身不会被删除）')) return;
    AppState.data.albums = AppState.data.albums.filter((a) => a.id !== id);
    // Clean up album_ids from photos
    AppState.data.photos.forEach((p) => {
      p.album_ids = p.album_ids.filter((aid) => aid !== id);
    });
    if (currentAlbumId === id) {
      currentAlbumId = null;
      albumPhotos.innerHTML = '';
    }
    AppState.saveState();
    render();
  }

  function addToAlbum(photoPath, albumId) {
    const photo = AppState.data.photos.find((p) => p.path === photoPath);
    if (!photo) return;
    if (!photo.album_ids.includes(albumId)) {
      photo.album_ids.push(albumId);
      AppState.saveState();
    }
    // Refresh current album view if open
    if (currentAlbumId === albumId) {
      const photos = AppState.data.photos.filter((p) => p.album_ids.includes(albumId));
      _renderAlbumPhotos(photos);
    }
    render();
  }

  function removeFromAlbum(photoPath, albumId) {
    const photo = AppState.data.photos.find((p) => p.path === photoPath);
    if (!photo) return;
    photo.album_ids = photo.album_ids.filter((id) => id !== albumId);
    AppState.saveState();
    render();
    if (currentAlbumId === albumId) {
      const photos = AppState.data.photos.filter((p) => p.album_ids.includes(albumId));
      _renderAlbumPhotos(photos);
    }
  }

  return { render, addToAlbum, removeFromAlbum };
})();
