
var paused = false;

var timeInterval;
var targetTime = 0;
var targetTimeCounter = 0;

// create timezone elements
var timezones = [
  { zone: 'America/Toronto', label: 'EST' },
  { zone: 'Etc/UTC', label: 'UTC' },
  { zone: 'America/Edmonton', label: 'MST' },
  { zone: 'America/Winnipeg', label: 'CDT' },
  { zone: 'America/Vancouver', label: 'PDT' },
  { zone: 'America/St_Johns', label: 'NDT' }
];

let grid = document.getElementById('grid');

timezones.forEach((timezone) => {
  // create container
  var container = document.createElement('div');
  container.classList.add('timezone-container');
  container.id = timezone.label;

  // time display/input
  var time = document.createElement('input');
  time.classList.add('time');
  time.dataset['zone'] = timezone.zone;
  let formattedTime = new Date().toLocaleTimeString('en-US',
    { timeZone: timezone.zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
  );
  time.value = formattedTime;

  // input listeners
  time.addEventListener('focus', () => {
    clearInterval(timeInterval);
  });

  time.addEventListener('blur', () => {
    timeInterval = setInterval(incrementTime, 1000);
  })

  time.addEventListener('change', (e) => {
    setTime(e.target);
  });

  // label display
  var zone = document.createElement('div');
  zone.classList.add('zone');
  zone.textContent = timezone.label;

  container.appendChild(time);
  container.appendChild(zone);

  grid.appendChild(container);
});


// update time display every second
function incrementTime(){
  targetTimeCounter += 1000;
  timezones.forEach((timezone) => {
    let time = targetTime === 0 ? new Date() : new Date(targetTime + targetTimeCounter);
    let formattedTime = time.toLocaleTimeString('en-US', 
      { timeZone: timezone.zone, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
    );

    document.querySelector(`#${timezone.label} .time`).value = formattedTime;
  });
}

function roundTime(){
  var time = new Date();
  const todayStr = time.toISOString().slice(0, 10);
  var localOffsetHours = Math.round(time.getTimezoneOffset()/60);
  const utcISOString = `${todayStr}T${time.getHours()}:00:00${localOffsetHours > 0 ? '-' : '+'}0${Math.abs(localOffsetHours)}:00`;
  const utcDate = new Date(utcISOString);
  
  targetTime = utcDate.getTime();
  targetTimeCounter = 0;
}

function setTime(input){
  targetTime = timeInZoneToUtcMs(input.value, input.dataset['zone']);
  targetTimeCounter = 0;
}


function timeInZoneToUtcMs(timeStr, timeZone) {
  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const UtcOffset = getOffsetFromUTCHours(timeZone);
  const utcISOString = `${todayStr}T${timeStr}${UtcOffset < 0 ? '-' : '+'}0${Math.abs(UtcOffset)}:00`;

  const utcDate = new Date(utcISOString);
  return utcDate.getTime(); // UTC timestamp in ms
}

// offset from UTC
function getOffsetFromUTCHours(timeZone) {
  var date = new Date();
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const parts = dtf.formatToParts(date);
  const map = Object.fromEntries(parts.map(p => [p.type, p.value]));
  const localDate = new Date(`${map.year}-${map.month}-${map.day}T${map.hour}:${map.minute}:${map.second}Z`);

  return Math.round((localDate - date) / (60 * 60 * 1000));
}


function pause(){
  var btnText = paused ? "Pause" : "Resume";
  document.getElementById('button-pause').innerHTML = btnText;

  if (paused){
    timeInterval = setInterval(incrementTime, 1000);
  } else {
    clearInterval(timeInterval);
  }

  paused = !paused;
}


// setup incrementing time
timeInterval = setInterval(incrementTime, 1000);