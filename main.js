document.addEventListener("DOMContentLoaded", () => mainSetup() );

function mainSetup(){
  setupSearchBar();
  createLinksList();
  createToolsLinks();
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

function setupSearchBar(){
  // set initial text
  const title = document.getElementById('search-bar-title');
  const searchBar = document.getElementById('searchBarInput');
  var engineIndex = 0;
  title.innerHTML = searchEngineData[engineIndex].title;

  // set listeners
  document.onkeyup = (event) => {
    if(event.key === " " && event.ctrlKey){
      searchBar.focus();
    }
  }

  searchBar.onkeyup = (event) => {
    if(event.key === " " && event.ctrlKey){
      title.click();
    }
    if( event.key === "Enter" ){
      search(event.ctrlKey);
    }
  }

  title.onclick = () => {
    // increment/loop
    engineIndex++;
    if(engineIndex > searchEngineData.length - 1){
      engineIndex = 0;
    }

    // update data
    title.dataset.engineIndex = engineIndex;
    title.innerHTML = searchEngineData[engineIndex].title;
  }
}

// search bar callback
const search = (newTab) => {
  // get searchword
  const searchWord = document.getElementById('searchBarInput').value;

  if ( !(searchWord == "" || searchWord == null) ){
    // get selected search engine
    const title = document.getElementById("search-bar-title");
    const searchEngine = title.dataset.engineIndex;

    // get url
    const targetUrl = getTargetUrl(searchWord, searchEngine);

    // navigate to new search
    window.open(targetUrl, newTab ? "_blank" : "_self").focus();
  }
}

function getTargetUrl(value, engine){
  // check to see if input is already a valid URL
  if (isWebUrl(value)) return value
  // check for a custom shortform input
  if (lookup[value]) return lookup[value]
  // else search it on engine -> google default
  return searchEngineData[engine].link + value
}

// search functionality
const isWebUrl = value => {
  try {
    // attempt to make new url with the input
    // if this fails its not a url
    const url = new URL(value)
    // return a check to seet if the protocol is one of the two:
    return url.protocol === "http:" || url.protocol === "https:"
  } catch {
    return false
  }
}

// custom shortform searches
const lookup = {"imdb":"/","deepl":"https://deepl.com/","reddit":"https://reddit.com/","maps":"https://maps.google.com/"}



// * * * * * * * * * * * * *
//          Links
// * * * * * * * * * * * * *

function createLinksList(){
  var linksContent = "";
  var tabIndexCounter = 2;

  const linksData = JSON.parse(localStorage.getItem('links-data'));

  Object.keys(linksData).forEach((group) => {
    linksContent += `
      <div class="link-group">
        <div class="header">${group}</div>
    `;
    
    linksData[group].forEach((link) => {
      linksContent += `<a class="link" href="${link.href}" tabindex=${tabIndexCounter}>${link.title}</a>`;
      tabIndexCounter++;
    });

    linksContent += '</div>';
  });

  document.querySelector('#links-list-container').insertAdjacentHTML("beforeend", linksContent);
}



// * * * * * * * * * * * * *
//          Tools
// * * * * * * * * * * * * *

function createToolsLinks(){    
  const toolData = JSON.parse(localStorage.getItem('tools-data'));
  const container = document.getElementById("tools-list-container");

  Object.entries(toolData).forEach(([category, tools]) => {
    const categoryDiv = document.createElement("div");
    categoryDiv.classList.add("category");

    const title = document.createElement("h2");
    title.classList.add("category-title");
    title.textContent = category;
    categoryDiv.appendChild(title);

    const grid = document.createElement("div");
    grid.classList.add("grid");

    tools.forEach(({ title, url, icon }) => {
      const card = document.createElement("a");
      card.href = url;
      card.rel = "noopener noreferrer";
      card.classList.add("card");

      const iconEl = document.createElement("img");
      iconEl.classList.add("icon");
      iconEl.src = `icons/${icon}.svg`;
      iconEl.alt = title;

      const text = document.createElement("div");
      text.classList.add("link-title");
      text.textContent = title;

      card.appendChild(iconEl);
      card.appendChild(text);
      grid.appendChild(card);
    });

    categoryDiv.appendChild(grid);
    container.appendChild(categoryDiv);
  });
}


// * * * * * * * * * * * * *
//          Util
// * * * * * * * * * * * * *

const debounce = (callback, wait) => {
  let timeoutId = null;
  return (...args) => {
    window.clearTimeout(timeoutId);
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
}
