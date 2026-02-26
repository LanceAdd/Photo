// utils.js — Shared utilities and constants

const LABEL_COLORS = {
  '': 'transparent',
  red: '#e74c3c',
  yellow: '#f1c40f',
  green: '#2ecc71',
  blue: '#3498db',
  purple: '#9b59b6',
};

const LABEL_NAMES = {
  '': '无标签',
  red: '红色',
  yellow: '黄色',
  green: '绿色',
  blue: '蓝色',
  purple: '紫色',
};

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}

function formatDate(unixMs) {
  if (!unixMs) return '—';
  return new Date(unixMs).toLocaleDateString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
  });
}

function generateId() {
  return crypto.randomUUID();
}

function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

function starsHtml(rating, interactive = false) {
  let html = '';
  for (let i = 1; i <= 5; i++) {
    const filled = i <= rating ? 'filled' : '';
    html += interactive
      ? `<span class="star ${filled}" data-value="${i}">★</span>`
      : `<span class="star ${filled}">★</span>`;
  }
  return html;
}
