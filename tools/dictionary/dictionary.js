const input = document.getElementById('word-input');
const btn = document.getElementById('search-btn');
const result = document.getElementById('result');
const recentsRow = document.getElementById('recents-row');
const favoritesRow = document.getElementById('favorites-row');
const modal = document.getElementById('modal');
const modalList = document.getElementById('modal-list');
const modalClear = document.getElementById('modal-clear');

const RECENTS_KEY = 'dictionary_recents';
const FAVORITES_KEY = 'dictionary_favorites';
const VISIBLE_LIMIT = 8;

function loadList(key) {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  return raw.split(',').map(w => w.trim()).filter(Boolean);
}

function saveList(key, list) {
  localStorage.setItem(key, list.join(','));
}

function escapeHtml(s) {
  if (!s) return '';
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function addToRecents(word) {
  word = word.toLowerCase();
  let list = loadList(RECENTS_KEY);
  list = list.filter(w => w.toLowerCase() !== word);
  list.unshift(word);
  if (list.length > 50) list = list.slice(0, 50);
  saveList(RECENTS_KEY, list);
  renderLists();
}

function toggleFavorite(word) {
  word = word.toLowerCase();
  let list = loadList(FAVORITES_KEY);
  const idx = list.findIndex(w => w.toLowerCase() === word);
  if (idx >= 0) list.splice(idx, 1);
  else list.unshift(word);
  saveList(FAVORITES_KEY, list);
  renderLists();
  updateStarButton(word);
}

function isFavorite(word) {
  return loadList(FAVORITES_KEY).some(w => w.toLowerCase() === word.toLowerCase());
}

function updateStarButton(word) {
  const star = document.getElementById('star-btn');
  if (!star) return;
  const icon = star.querySelector('sp-icon');
  if (icon) icon.setAttribute('name', isFavorite(word) ? 'star-filled' : 'star');
}

function makeWordTag(word) {
  const tag = document.createElement('sp-tag');
  tag.className = 'word-tag';
  tag.textContent = word;
  return tag;
}

function renderRow(rowEl, list, kind) {
  const label = rowEl.querySelector('.list-label');
  rowEl.innerHTML = '';
  rowEl.appendChild(label);

  if (list.length === 0) {
    const empty = document.createElement('span');
    empty.className = 'empty-list';
    empty.textContent = kind === 'recent' ? 'No recent searches' : 'No saved words';
    rowEl.appendChild(empty);
    return;
  }

  list.slice(0, VISIBLE_LIMIT).forEach(word => {
    const tag = makeWordTag(word);
    tag.addEventListener('click', () => {
      input.value = word;
      lookup(word);
    });
    rowEl.appendChild(tag);
  });

  const all = document.createElement('sp-button');
  all.setAttribute('variant', 'dashed');
  all.setAttribute('size', 'sm');
  all.textContent = list.length > VISIBLE_LIMIT ? 'Show all (' + list.length + ')' : 'Show all';
  all.addEventListener('click', () => openModal(kind));
  rowEl.appendChild(all);
}

function renderLists() {
  renderRow(recentsRow, loadList(RECENTS_KEY), 'recent');
  renderRow(favoritesRow, loadList(FAVORITES_KEY), 'favorite');
}

function openModal(kind) {
  const key = kind === 'recent' ? RECENTS_KEY : FAVORITES_KEY;
  const list = loadList(key);
  modal.heading = kind === 'recent' ? 'All recent searches' : 'All saved words';
  modalList.innerHTML = '';
  list.forEach(word => {
    const tag = makeWordTag(word);
    tag.addEventListener('click', () => {
      input.value = word;
      closeModal();
      lookup(word);
    });
    modalList.appendChild(tag);
  });
  modalClear.onclick = () => {
    if (confirm('Clear all ' + (kind === 'recent' ? 'recent searches' : 'saved words') + '?')) {
      localStorage.removeItem(key);
      renderLists();
      closeModal();
    }
  };
  modal.show();
}

function closeModal() {
  modal.close();
}

async function lookup(word) {
  word = word.trim();
  if (!word) return;
  result.innerHTML = '<div class="status"><span class="loading"></span>Looking up "' + escapeHtml(word) + '"...</div>';
  try {
    const res = await fetch('https://api.dictionaryapi.dev/api/v2/entries/en/' + encodeURIComponent(word));
    if (!res.ok) {
      result.innerHTML = '<div class="error"><strong>No definitions found</strong><br/>We couldn\'t find a definition for "' + escapeHtml(word) + '". Check the spelling and try again.</div>';
      return;
    }
    const data = await res.json();
    addToRecents(word);
    render(data);
  } catch (err) {
    result.innerHTML = '<div class="error"><strong>Something went wrong</strong><br/>' + escapeHtml(err.message || String(err)) + '</div>';
  }
}

function render(entries) {
  const entry = entries[0];
  const phoneticText = entry.phonetic || (entry.phonetics.find(p => p.text) || {}).text || '';
  const audioObj = entry.phonetics.find(p => p.audio);
  const audioUrl = audioObj ? audioObj.audio : '';
  const word = entry.word;

  let html = '<div class="word-header">';
  html += '<h2 class="word-title">' + escapeHtml(word) + '</h2>';
  if (phoneticText) html += '<span class="phonetic">' + escapeHtml(phoneticText) + '</span>';
  if (audioUrl) {
    html += '<button class="icon-btn" id="play-audio" aria-label="Play pronunciation" title="Play pronunciation">';
    html += '<sp-icon name="speaker" size="sm"></sp-icon>';
    html += '</button>';
  }
  html += '<button class="icon-btn star-btn" id="star-btn" aria-label="Save word" title="Save word">';
  html += '<sp-icon name="star" size="sm"></sp-icon>';
  html += '</button>';
  html += '</div>';

  if (entry.origin) {
    html += '<p style="color:var(--color-text-subtle);font-size:14px;margin:0 0 0.5rem;"><strong style="font-weight:500;">Origin:</strong> ' + escapeHtml(entry.origin) + '</p>';
  }

  const allMeanings = [];
  entries.forEach(e => e.meanings.forEach(m => allMeanings.push(m)));

  allMeanings.forEach(meaning => {
    html += '<div class="meaning">';
    html += '<div class="pos">' + escapeHtml(meaning.partOfSpeech) + '</div>';
    html += '<ol class="definitions">';
    meaning.definitions.forEach(def => {
      html += '<li>' + escapeHtml(def.definition);
      if (def.example) html += '<span class="example">"' + escapeHtml(def.example) + '"</span>';
      html += '</li>';
    });
    html += '</ol>';
    if (meaning.synonyms && meaning.synonyms.length) {
      html += '<div class="section-label">Synonyms</div><div class="related">';
      meaning.synonyms.slice(0, 12).forEach(s => {
        html += '<sp-tag class="word-tag" style="cursor:pointer" data-word="' + escapeHtml(s) + '">' + escapeHtml(s) + '</sp-tag>';
      });
      html += '</div>';
    }
    if (meaning.antonyms && meaning.antonyms.length) {
      html += '<div class="section-label">Antonyms</div><div class="related">';
      meaning.antonyms.slice(0, 12).forEach(a => {
        html += '<sp-tag class="word-tag" style="cursor:pointer" data-word="' + escapeHtml(a) + '">' + escapeHtml(a) + '</sp-tag>';
      });
      html += '</div>';
    }
    html += '</div>';
  });

  if (entry.sourceUrls && entry.sourceUrls.length) {
    html += '<div class="source">Source: <a href="' + escapeHtml(entry.sourceUrls[0]) + '" target="_blank" rel="noopener">' + escapeHtml(entry.sourceUrls[0]) + '</a></div>';
  }

  result.innerHTML = html;

  const audioBtn = document.getElementById('play-audio');
  if (audioBtn && audioUrl) {
    const audio = new Audio(audioUrl);
    audioBtn.addEventListener('click', () => audio.play().catch(() => {}));
  }

  const starBtn = document.getElementById('star-btn');
  updateStarButton(word);
  starBtn.addEventListener('click', () => toggleFavorite(word));

  document.querySelectorAll('sp-tag[data-word]').forEach(tag => {
    tag.addEventListener('click', () => {
      const w = tag.getAttribute('data-word');
      input.value = w;
      lookup(w);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  });
}

btn.addEventListener('click', () => lookup(input.value));
input.addEventListener('keydown', e => { if (e.key === 'Enter') lookup(input.value); });

renderLists();
