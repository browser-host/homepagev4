var modal;
var organizeModal;

document.addEventListener("DOMContentLoaded", () => mainSetup());

function mainSetup() {
  setupSearchBar();
  createLinksList();
  createToolsLinks();

  modal = document.getElementById('modal');
  organizeModal = document.getElementById('organize-modal');
}



// * * * * * * * * * * * * *
//          Search
// * * * * * * * * * * * * *

const searchEngineData = [
  {
    title: 'ask the librarian',
    name: 'google',
    link: 'https://www.google.com/search?q='
  },
  {
    title: 'consult the oracle',
    name: 'chatgpt',
    link: 'https://chatgpt.com?q='
  }
];

function setupSearchBar() {
  const title = document.getElementById('search-bar-title');
  const searchBar = document.getElementById('searchBarInput');
  var engineIndex = 0;
  title.innerHTML = searchEngineData[engineIndex].title;

  document.onkeyup = (event) => {
    if (event.key === " " && event.ctrlKey) {
      searchBar.focus();
    }
  }

  searchBar.onkeyup = (event) => {
    if (event.key === " " && event.ctrlKey) {
      title.click();
    }
    if (event.key === "Enter") {
      search(event.ctrlKey);
    }
  }

  title.onclick = () => {
    engineIndex++;
    if (engineIndex > searchEngineData.length - 1) engineIndex = 0;
    title.dataset.engineIndex = engineIndex;
    title.innerHTML = searchEngineData[engineIndex].title;
  }
}

const search = (newTab) => {
  const searchWord = document.getElementById('searchBarInput').value;
  if (!(searchWord == "" || searchWord == null)) {
    const title = document.getElementById("search-bar-title");
    const searchEngine = title.dataset.engineIndex;
    const targetUrl = getTargetUrl(searchWord, searchEngine);
    window.open(targetUrl, newTab ? "_blank" : "_self").focus();
  }
}

function getTargetUrl(value, engine) {
  if (isWebUrl(value)) return value;
  if (lookup[value]) return lookup[value];
  return searchEngineData[engine].link + value;
}

const isWebUrl = value => {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch { return false; }
}

const lookup = { "imdb": "/", "deepl": "https://deepl.com/", "reddit": "https://reddit.com/", "maps": "https://maps.google.com/" }



// * * * * * * * * * * * * *
//          Links
// * * * * * * * * * * * * *

function createLinksList() {
  const container = document.querySelector('#links-list-container');

  // Remove all existing link groups, leaving only the sidebar-header
  container.querySelectorAll('.link-group').forEach(el => el.remove());

  var tabIndexCounter = 2;
  var linksData = JSON.parse(localStorage.getItem('links-data'));

  if (!linksData) {
    linksData = {};
    localStorage.setItem('links-data', '{}');
  }

  // Respect saved category order, fall back to alpha sort
  let categoryOrder = JSON.parse(localStorage.getItem('links-category-order')) || [];
  categoryOrder = categoryOrder.filter(c => linksData[c]);
  Object.keys(linksData).forEach(c => { if (!categoryOrder.includes(c)) categoryOrder.push(c); });

  categoryOrder.forEach((group) => {
    const links = linksData[group];
    if (!links) return;

    const groupEl = document.createElement('div');
    groupEl.classList.add('link-group');

    const header = document.createElement('div');
    header.classList.add('link-group__header');
    header.textContent = group;
    groupEl.appendChild(header);

    links.forEach((link) => {
      const a = document.createElement('a');
      a.classList.add('link');
      a.href = link.href;
      a.tabIndex = tabIndexCounter++;
      a.textContent = link.title;
      groupEl.appendChild(a);
    });

    container.appendChild(groupEl);
  });
}



// * * * * * * * * * * * * *
//          Tools
// * * * * * * * * * * * * *

function createToolsLinks() {
  const container = document.getElementById("tools-list-container");

  Object.entries(toolData).forEach(([category, tools]) => {
    const categoryDiv = document.createElement("div");
    categoryDiv.classList.add("tool-category");

    const label = document.createElement("div");
    label.classList.add("tool-category__label");
    label.textContent = category;
    categoryDiv.appendChild(label);

    const cards = document.createElement("div");
    cards.classList.add("tool-category__cards");

    tools.forEach(({ title, url, icon }) => {
      const card = document.createElement("a");
      card.href = url;
      card.rel = "noopener noreferrer";
      card.classList.add("tool-card");

      const iconEl = document.createElement("img");
      iconEl.classList.add("tool-card__icon");
      iconEl.src = `icons/${icon}.svg`;
      iconEl.alt = title;

      const text = document.createElement("div");
      text.classList.add("tool-card__name");
      text.textContent = title;

      card.appendChild(iconEl);
      card.appendChild(text);
      cards.appendChild(card);
    });

    categoryDiv.appendChild(cards);
    container.appendChild(categoryDiv);
  });
}



// * * * * * * * * * * * * *
//       Organize Modal
// * * * * * * * * * * * * *

function openOrganizeModal() {
  openModal(organizeModal);
  buildOrganizeUI();
}

function closeOrganizeModal() {
  closeModal(organizeModal);
}

function buildOrganizeUI() {
  const list = document.getElementById('organize-list');
  list.innerHTML = '';

  const linksData = JSON.parse(localStorage.getItem('links-data')) || {};

  // Get category order from storage, or use current sorted order
  let categoryOrder = JSON.parse(localStorage.getItem('links-category-order')) || 
    Object.keys(linksData).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));

  // Filter to only existing categories
  categoryOrder = categoryOrder.filter(c => linksData[c]);
  // Add any new categories not in the order list
  Object.keys(linksData).forEach(c => { if (!categoryOrder.includes(c)) categoryOrder.push(c); });

  categoryOrder.forEach(category => {
    const links = linksData[category] || [];
    const catEl = createOrganizeCategoryEl(category, links);
    list.appendChild(catEl);
  });

  setupCategoryDrag();
}

function createOrganizeCategoryEl(category, links) {
  const catEl = document.createElement('div');
  catEl.classList.add('org-category');
  catEl.dataset.category = category;

  catEl.innerHTML = `
    <div class="org-category__header" draggable="true">
      <span class="org-drag-handle org-drag-handle--category">
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><circle cx="3" cy="2" r="1.2" fill="currentColor"/><circle cx="9" cy="2" r="1.2" fill="currentColor"/><circle cx="3" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="3" cy="10" r="1.2" fill="currentColor"/><circle cx="9" cy="10" r="1.2" fill="currentColor"/></svg>
      </span>
      <span class="org-category__name">${category}</span>
      <span class="org-category__count">${links.length}</span>
    </div>
    <div class="org-links-list"></div>
  `;

  const linksList = catEl.querySelector('.org-links-list');

  links.forEach(link => {
    const linkEl = createOrganizeLinkEl(link);
    linksList.appendChild(linkEl);
  });

  // Setup link drag within and between categories
  setupLinkDrag(linksList);

  return catEl;
}

function createOrganizeLinkEl(link) {
  const el = document.createElement('div');
  el.classList.add('org-link');
  el.draggable = true;
  el.dataset.href = link.href;
  el.dataset.title = link.title;

  el.innerHTML = `
    <span class="org-drag-handle">
      <svg width="10" height="10" viewBox="0 0 12 12" fill="none"><circle cx="3" cy="2" r="1.2" fill="currentColor"/><circle cx="9" cy="2" r="1.2" fill="currentColor"/><circle cx="3" cy="6" r="1.2" fill="currentColor"/><circle cx="9" cy="6" r="1.2" fill="currentColor"/><circle cx="3" cy="10" r="1.2" fill="currentColor"/><circle cx="9" cy="10" r="1.2" fill="currentColor"/></svg>
    </span>
    <span class="org-link__title">${link.title}</span>
    <span class="org-link__href">${link.href}</span>
  `;

  return el;
}

// ── Category drag ──

let draggedCategory = null;

function setupCategoryDrag() {
  const list = document.getElementById('organize-list');

  list.querySelectorAll('.org-category__header').forEach(header => {
    header.addEventListener('dragstart', onCategoryDragStart);
    header.addEventListener('dragend', onCategoryDragEnd);
  });

  list.querySelectorAll('.org-category').forEach(cat => {
    cat.addEventListener('dragover', onCategoryDragOver);
    cat.addEventListener('drop', onCategoryDrop);
    cat.addEventListener('dragleave', onCategoryDragLeave);
  });
}

function onCategoryDragStart(e) {
  draggedCategory = this.closest('.org-category');
  draggedCategory.classList.add('org-dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('type', 'category');
}

function onCategoryDragEnd() {
  if (draggedCategory) draggedCategory.classList.remove('org-dragging');
  draggedCategory = null;
  document.querySelectorAll('.org-category').forEach(el => {
    el.classList.remove('org-drop-above', 'org-drop-below');
  });
}

function onCategoryDragOver(e) {
  if (!draggedCategory) return;
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';

  const target = this;
  if (target === draggedCategory) return;

  const rect = target.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;

  document.querySelectorAll('.org-category').forEach(el => el.classList.remove('org-drop-above', 'org-drop-below'));

  if (e.clientY < midY) {
    target.classList.add('org-drop-above');
  } else {
    target.classList.add('org-drop-below');
  }
}

function onCategoryDragLeave() {
  this.classList.remove('org-drop-above', 'org-drop-below');
}

function onCategoryDrop(e) {
  e.preventDefault();
  const target = this;
  if (!draggedCategory || target === draggedCategory) return;

  const list = document.getElementById('organize-list');
  const rect = target.getBoundingClientRect();
  const midY = rect.top + target.getBoundingClientRect().height / 2;

  if (e.clientY < midY) {
    list.insertBefore(draggedCategory, target);
  } else {
    list.insertBefore(draggedCategory, target.nextSibling);
  }

  target.classList.remove('org-drop-above', 'org-drop-below');
}

// ── Link drag (within and between categories) ──

let draggedLink = null;
let draggedLinkOriginCategory = null;

function setupLinkDrag(linksList) {
  linksList.querySelectorAll('.org-link').forEach(link => {
    link.addEventListener('dragstart', onLinkDragStart);
    link.addEventListener('dragend', onLinkDragEnd);
  });

  linksList.addEventListener('dragover', onLinkDragOver);
  linksList.addEventListener('drop', onLinkDrop);
  linksList.addEventListener('dragleave', onLinkListDragLeave);
}

function onLinkDragStart(e) {
  draggedLink = this;
  draggedLinkOriginCategory = this.closest('.org-category').dataset.category;
  this.classList.add('org-dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('type', 'link');
  e.stopPropagation(); // don't trigger category drag
}

function onLinkDragEnd() {
  if (draggedLink) draggedLink.classList.remove('org-dragging');
  draggedLink = null;
  draggedLinkOriginCategory = null;
  document.querySelectorAll('.org-link').forEach(el => el.classList.remove('org-drop-above', 'org-drop-below'));
  document.querySelectorAll('.org-links-list').forEach(el => el.classList.remove('org-drop-target'));
}

function onLinkDragOver(e) {
  if (!draggedLink) return;
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';

  const list = this;
  const links = [...list.querySelectorAll('.org-link:not(.org-dragging)')];

  // Clear indicators
  document.querySelectorAll('.org-link').forEach(el => el.classList.remove('org-drop-above', 'org-drop-below'));
  document.querySelectorAll('.org-links-list').forEach(el => el.classList.remove('org-drop-target'));

  if (links.length === 0) {
    list.classList.add('org-drop-target');
    return;
  }

  let closestLink = null;
  let closestPos = 'below';
  let closestDist = Infinity;

  links.forEach(link => {
    const rect = link.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const dist = Math.abs(e.clientY - midY);

    if (dist < closestDist) {
      closestDist = dist;
      closestLink = link;
      closestPos = e.clientY < midY ? 'above' : 'below';
    }
  });

  if (closestLink) {
    closestLink.classList.add(closestPos === 'above' ? 'org-drop-above' : 'org-drop-below');
  }
}

function onLinkListDragLeave(e) {
  if (!this.contains(e.relatedTarget)) {
    this.classList.remove('org-drop-target');
    this.querySelectorAll('.org-link').forEach(el => el.classList.remove('org-drop-above', 'org-drop-below'));
  }
}

function onLinkDrop(e) {
  e.preventDefault();
  e.stopPropagation();

  if (!draggedLink) return;

  const list = this;
  const links = [...list.querySelectorAll('.org-link:not(.org-dragging)')];

  let insertBefore = null;

  if (links.length === 0) {
    // Drop into empty category
    list.appendChild(draggedLink);
  } else {
    let closestLink = null;
    let closestPos = 'below';
    let closestDist = Infinity;

    links.forEach(link => {
      const rect = link.getBoundingClientRect();
      const midY = rect.top + rect.height / 2;
      const dist = Math.abs(e.clientY - midY);

      if (dist < closestDist) {
        closestDist = dist;
        closestLink = link;
        closestPos = e.clientY < midY ? 'above' : 'below';
      }
    });

    if (closestLink) {
      insertBefore = closestPos === 'above' ? closestLink : closestLink.nextSibling;
    }

    list.insertBefore(draggedLink, insertBefore);
  }

  // Update count on both affected categories
  document.querySelectorAll('.org-category').forEach(cat => {
    const count = cat.querySelector('.org-category__count');
    const linkCount = cat.querySelectorAll('.org-link').length;
    if (count) count.textContent = linkCount;
  });

  // Re-attach drag events to this list
  setupLinkDrag(list);

  list.classList.remove('org-drop-target');
  document.querySelectorAll('.org-link').forEach(el => el.classList.remove('org-drop-above', 'org-drop-below'));
}

// ── Save organized data ──

function saveOrganized() {
  const list = document.getElementById('organize-list');
  const categories = list.querySelectorAll('.org-category');
  const newLinksData = {};
  const categoryOrder = [];

  categories.forEach(catEl => {
    const catName = catEl.dataset.category;
    categoryOrder.push(catName);
    newLinksData[catName] = [];

    catEl.querySelectorAll('.org-link').forEach(linkEl => {
      newLinksData[catName].push({
        title: linkEl.dataset.title,
        href: linkEl.dataset.href,
        icon: 'x'
      });
    });
  });

  localStorage.setItem('links-data', JSON.stringify(newLinksData));
  localStorage.setItem('links-category-order', JSON.stringify(categoryOrder));

  closeOrganizeModal();
  createLinksList();
}



// * * * * * * * * * * * * *
//          JSON
// * * * * * * * * * * * * *

var toolData = {
  "Web Design": [
    { "title": "Color Picker", "id": "color-picker", "url": "./tools/color picker/index.html", "icon": "color-picker" },
    { "title": "Gradients", "id": "gradients", "url": "./tools/background gradient gen/gradients.html", "icon": "picture" },
    { "title": "Grid Maker", "id": "grid-maker", "url": "./tools/GridMaker/grid-maker.html", "icon": "picture" },
  ],
  "Data Transformation": [
    { "title": "Base64 to Mp3", "id": "base64", "url": "./tools/base64 to mp3/base64.html", "icon": "computer-download" },
    { "title": "Clipboard to Image", "id": "clipboard-to-image", "url": "./tools/clipboard to image/clipboardToImage.html", "icon": "clipboard" },
    { "title": "Cyberchef", "id": "cyberchef", "url": "./tools/CyberChef_v10.19.4/CyberChef_v10.19.4.html", "icon": "code" }
  ],
  "Information": [
    { "title": "Timezones", "id": "timezone-viewer", "url": "./tools/timezones/timezones.html", "icon": "clock" },
    { "title": "Whats My IP?", "id": "whats-my-ip", "url": "./tools/WhatsMyIP/index.html", "icon": "location" }
  ]
}



// * * * * * * * * * * * * *
//          Forms
// * * * * * * * * * * * * *

function handleNewLinkSubmit(e) {
  e.preventDefault();
  var formData = new FormData(e.target);

  var title = formData.get('input-link-title') ?? 'No Name';
  var href = formData.get('input-link-href');
  var category = formData.get('input-link-category');

  if (!title || title == '' || !href || href == '') return;

  if (!category || category == '')
    category = formData.get('select-link-category') ?? title[0];

  const linksData = JSON.parse(localStorage.getItem('links-data'));

  if (!linksData.hasOwnProperty(category))
    linksData[category] = [];

  linksData[category].push({ 'title': title, 'href': href, 'icon': 'x' });
  localStorage.setItem('links-data', JSON.stringify(linksData));

  closeLinkModal();
  createLinksList();
  e.target.reset();
}

function setupNewLinkForm() {
  const linksData = JSON.parse(localStorage.getItem('links-data'));
  var selectCategory = document.getElementById('select-link-category');
  selectCategory.innerHTML = '';

  Object.keys(linksData).forEach((category) => {
    var option = `<option value='${category}'>${category}</option>`;
    selectCategory.insertAdjacentHTML("beforeend", option);
  });
}



// * * * * * * * * * * * * *
//          Modal
// * * * * * * * * * * * * *

function openLinkModal() {
  openModal(modal);
  setupNewLinkForm();
}

function closeLinkModal() {
  closeModal(modal);
}