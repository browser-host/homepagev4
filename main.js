document.addEventListener("DOMContentLoaded", () => mainSetup() );

function mainSetup(){
  createLinksList();
  setupSearchBar();
  setupScrolling();
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
var pageIndex = 0;

// scrolling effects
function setupScrolling(){
  
  // setup tools links
  var toolsList = document.getElementById('iframe-links-list');
  var iframeList = document.getElementById('iframe-scroller');
  
  var toolsData = JSON.parse(localStorage.getItem('tools-list'));
  
  toolsData.forEach((tool, index) => {
    var link = `<div class="iframe-link"><a href="#${tool.id}">${tool.title}</a></div>`;
    toolsList.insertAdjacentHTML("beforeend", link);

    var iframe = `<div class="iframe-container iframe_${index}" id="${tool.id}" data-index='${index}'><iframe src="${tool.url}"></iframe></div>`;
    iframeList.insertAdjacentHTML('beforeend', iframe);
  });
  
  // keep track of current index of scrolling
  const sections = document.querySelectorAll('.iframe-container');
  const observer = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          pageIndex = parseInt(entry.target.dataset.index);
          console.log('Current Index:', pageIndex);
        }
      });
    },
    {
      root: null,
      threshold: 0.8 
    }
  );

  sections.forEach(section => observer.observe(section));

  document.addEventListener('keydown', function(e){
    console.log(e);
    if(e.key - 1 <= sections.length && e.ctrlKey){
      scrollToChild(parseInt(e.key)-1, 0);
    }

    if(e.key == "ArrowLeft" && e.ctrlKey && pageIndex > 0){
      scrollToChild(pageIndex-1, 0);
    }

    if(e.key == "ArrowRight" && e.ctrlKey && pageIndex < sections.length){
      scrollToChild(pageIndex+1, 0);
    }
  });
}


function scrollToChild(index, duration = 1) {
  console.log('scrolling to ' + index);
  var container = document.getElementById('iframe-scroller');
  var iframe = document.querySelector(`.iframe_${index}`);
  
  if (!container || !iframe) return;

  const end = iframe.offsetLeft;

  // If duration is 0, scroll instantly
  if (duration === 0) {
    container.scrollTo({left: end, behavior: "instant"});
    return;
  }

  const start = container.scrollLeft;
  const change = end - start;
  const startTime = performance.now();

  function animateScroll(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1); // Linear easing

    container.scrollLeft = start + change * progress;

    if (elapsed < duration) {
      requestAnimationFrame(animateScroll);
    }
  }

  requestAnimationFrame(animateScroll);
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
