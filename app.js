const API_BASE = "https://api.open-meteo.com/v1/forecast";
const GEO_BASE = "https://geocoding-api.open-meteo.com/v1/search";
const AIR_BASE = "https://air-quality-api.open-meteo.com/v1/air-quality";
const STORAGE_KEYS = { unit: "sunshine-unit", favorites: "sunshine-favorites", place: "sunshine-last-place" };

const state = {
  unit: readStorage(STORAGE_KEYS.unit, "celsius"),
  place: readStorage(STORAGE_KEYS.place, null),
  selectedPlace: null,
  weather: null,
  air: null,
  favorites: Array.isArray(readStorage(STORAGE_KEYS.favorites, []))
    ? readStorage(STORAGE_KEYS.favorites, [])
    : [],
  requestId: 0,
};

const weatherCodes = {
  0: ["Clear sky", "☀️"], 1: ["Mostly clear", "🌤️"], 2: ["Partly cloudy", "⛅"],
  3: ["Overcast", "☁️"], 45: ["Foggy", "🌫️"], 48: ["Icy fog", "🌫️"],
  51: ["Light drizzle", "🌦️"], 53: ["Drizzle", "🌦️"], 55: ["Heavy drizzle", "🌧️"],
  56: ["Freezing drizzle", "🌧️"], 57: ["Freezing drizzle", "🌧️"],
  61: ["Light rain", "🌦️"], 63: ["Rain", "🌧️"], 65: ["Heavy rain", "🌧️"],
  66: ["Freezing rain", "🌧️"], 67: ["Heavy freezing rain", "🌧️"],
  71: ["Light snow", "🌨️"], 73: ["Snow", "🌨️"], 75: ["Heavy snow", "❄️"],
  77: ["Snow grains", "🌨️"], 80: ["Rain showers", "🌦️"], 81: ["Showers", "🌧️"],
  82: ["Heavy showers", "⛈️"], 85: ["Snow showers", "🌨️"], 86: ["Heavy snow showers", "❄️"],
  95: ["Thunderstorm", "⛈️"], 96: ["Thunder & hail", "⛈️"], 99: ["Thunder & hail", "⛈️"],
};

const $ = (selector) => document.querySelector(selector);
const elements = {
  currentCity: $("#current-city"),
  currentDate: $("#current-date"),
  currentTemperature: $("#current-temperature"),
  currentCondition: $("#current-condition"),
  feelsLike: $("#feels-like"),
  weatherArt: $("#weather-art"),
  todayHigh: $("#today-high"),
  todayLow: $("#today-low"),
  currentSummary: $("#current-summary"),
  hourlyList: $("#hourly-list"),
  weekList: $("#week-list"),
  status: $("#status-message"),
  favoriteButton: $("#favorite-button"),
};

function readStorage(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function writeStorage(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    elements.status.textContent = "Your browser could not save this preference.";
  }
}

function showError(message) {
  elements.status.classList.remove("loading");
  elements.status.textContent = message;
}

function clearError() {
  elements.status.classList.remove("loading");
  elements.status.textContent = "";
}

function temperatureUnit() {
  return state.unit === "fahrenheit" ? "fahrenheit" : "celsius";
}

function formatTemperature(value) {
  return `${Math.round(value)}°`;
}

function getWeather(code) {
  return weatherCodes[code] || ["Variable conditions", "🌤️"];
}

function formatHour(dateValue) {
  const date = new Date(dateValue);
  return new Intl.DateTimeFormat(undefined, { hour: "numeric" }).format(date);
}

function formatClock(dateValue) {
  return new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(new Date(dateValue));
}

function currentDayIndex(times, currentTime) {
  const exactIndex = times.indexOf(currentTime);
  if (exactIndex !== -1) return exactIndex;
  const current = new Date(currentTime).getTime();
  let nearest = 0;
  for (let i = 1; i < times.length; i += 1) {
    if (Math.abs(new Date(times[i]).getTime() - current) < Math.abs(new Date(times[nearest]).getTime() - current)) nearest = i;
  }
  return nearest;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Weather service returned ${response.status}.`);
  return response.json();
}

function geocodeUrl(name) {
  const params = new URLSearchParams({ name, count: "8", language: "en", format: "json" });
  return `${GEO_BASE}?${params}`;
}

async function searchCity(name) {
  const cleanName = name.trim();
  if (!cleanName) {
    showError("Type a city name to search.");
    return;
  }
  clearError();
  $("#city-search").disabled = true;
  try {
    const result = await fetchJson(geocodeUrl(cleanName));
    if (!result.results?.length) {
      showError(`We couldn't find "${cleanName}". Try another city.`);
      return;
    }
    await loadPlace(result.results[0]);
  } catch (error) {
    showError(`Couldn't search for that city. ${error.message}`);
  } finally {
    $("#city-search").disabled = false;
  }
}

async function loadPlace(place) {
  const requestId = ++state.requestId;
  clearError();
  state.selectedPlace = place;
  elements.status.textContent = `Loading forecast for ${place.name}...`;
  elements.status.classList.add("loading");

  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: "auto",
    temperature_unit: temperatureUnit(),
    wind_speed_unit: state.unit === "fahrenheit" ? "mph" : "kmh",
    precipitation_unit: state.unit === "fahrenheit" ? "inch" : "mm",
    current: "temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m",
    hourly: "temperature_2m,precipitation_probability,weather_code,uv_index",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max",
    forecast_days: "7",
  });

  try {
    const weather = await fetchJson(`${API_BASE}?${params}`);
    if (requestId !== state.requestId) return;
    state.place = place;
    state.selectedPlace = place;
    state.weather = weather;
    writeStorage(STORAGE_KEYS.place, place);
    clearError();
    renderWeather(weather, place);
    loadAirQuality(place, requestId);
  } catch (error) {
    if (requestId === state.requestId) {
      state.selectedPlace = state.place;
      showError(`Couldn't load the forecast. Check your connection and try again. ${error.message}`);
    }
  }
}

async function loadAirQuality(place, requestId) {
  const params = new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    timezone: "auto",
    current: "us_aqi",
  });
  try {
    const data = await fetchJson(`${AIR_BASE}?${params}`);
    if (requestId !== state.requestId) return;
    state.air = data;
    renderAirQuality(data);
  } catch {
    if (requestId === state.requestId) {
      $("#air-quality").textContent = "Unavailable";
      $("#air-caption").textContent = "Air quality data unavailable";
      $("#air-index").textContent = "--";
    }
  }
}

function renderWeather(weather, place) {
  const current = weather.current;
  const today = weather.daily;
  const dayIndex = currentDayIndex(weather.hourly.time, current.time);
  const [condition, icon] = getWeather(current.weather_code);
  const isFavorite = state.favorites.some((item) => item.id === place.id || (item.name === place.name && item.latitude === place.latitude));

  elements.currentCity.textContent = place.name;
  elements.currentDate.textContent = new Intl.DateTimeFormat(undefined, {
    weekday: "long", month: "long", day: "numeric", timeZone: weather.timezone,
  }).format(new Date(current.time));
  elements.currentTemperature.innerHTML = `${Math.round(current.temperature_2m)}<span>°</span>`;
  elements.currentCondition.textContent = condition;
  elements.feelsLike.textContent = `Feels like ${formatTemperature(current.apparent_temperature)}`;
  elements.weatherArt.textContent = icon;
  elements.todayHigh.textContent = formatTemperature(today.temperature_2m_max[0]);
  elements.todayLow.textContent = formatTemperature(today.temperature_2m_min[0]);
  elements.currentSummary.textContent = summaryFor(current.weather_code, current.is_day);
  elements.favoriteButton.classList.toggle("saved", isFavorite);
  elements.favoriteButton.textContent = isFavorite ? "♥" : "♡";
  elements.favoriteButton.setAttribute("aria-label", isFavorite ? "Remove saved city" : "Save this city");

  $("#humidity-value").textContent = `${current.relative_humidity_2m}%`;
  $("#humidity-note").textContent = current.relative_humidity_2m >= 65 ? "A little humid" : "Feels comfortable";
  $("#wind-value").textContent = `${Math.round(current.wind_speed_10m)} ${state.unit === "fahrenheit" ? "mph" : "km/h"}`;
  const uv = today.uv_index_max[0];
  $("#uv-value").textContent = Number(uv).toFixed(1);
  $("#uv-note").textContent = uv < 3 ? "Low — enjoy outside" : uv < 6 ? "Moderate — take care" : uv < 8 ? "High — wear SPF" : "Very high — stay shaded";
  const rain = Math.max(...weather.hourly.precipitation_probability.slice(dayIndex, dayIndex + 24));
  $("#rain-value").textContent = `${rain}%`;
  $("#sunrise-time").textContent = formatClock(today.sunrise[0]);
  $("#sunset-time").textContent = formatClock(today.sunset[0]);
  const daylightMinutes = Math.max(0, Math.round((new Date(today.sunset[0]) - new Date(today.sunrise[0])) / 60000));
  $("#daylight-duration").textContent = `${Math.floor(daylightMinutes / 60)}h ${daylightMinutes % 60}m`;

  renderHourly(weather, dayIndex);
  renderWeek(weather);
  updateQuickPlaces();
}

function summaryFor(code, isDay) {
  if (code >= 95) return "Thunder rolling through today";
  if (code >= 51) return "Keep a little umbrella close";
  if ([45, 48].includes(code)) return "A softly misty kind of day";
  if (code >= 71 && code <= 86) return "A little wonder in the air";
  if (code === 0 && isDay) return "A lovely day to get outside";
  if (code === 0) return "A clear and peaceful night";
  return "A fresh look at the sky";
}

function renderHourly(weather, startIndex) {
  const { hourly } = weather;
  const endIndex = Math.min(startIndex + 24, hourly.time.length);
  const markup = [];
  for (let i = startIndex; i < endIndex; i += 3) {
    const [label, icon] = getWeather(hourly.weather_code[i]);
    const hourLabel = i === startIndex ? "Now" : formatHour(hourly.time[i]);
    markup.push(`<div class="hour-item" title="${label}">
      <span class="hour-time">${hourLabel}</span>
      <span class="hour-icon" aria-hidden="true">${icon}</span>
      <span class="hour-temp">${formatTemperature(hourly.temperature_2m[i])}</span>
      <span class="hour-rain">${hourly.precipitation_probability[i]}% rain</span>
    </div>`);
  }
  elements.hourlyList.innerHTML = markup.join("");
}

function renderWeek(weather) {
  const { daily } = weather;
  elements.weekList.innerHTML = daily.time.map((day, index) => {
    const [label, icon] = getWeather(daily.weather_code[index]);
    const dayName = index === 0 ? "Today" : new Intl.DateTimeFormat(undefined, { weekday: "short", timeZone: weather.timezone }).format(new Date(`${day}T12:00:00`));
    const rain = daily.precipitation_probability_max[index];
    return `<div class="day-row" title="${label}${rain ? `, ${rain}% chance of rain` : ""}">
      <span class="day-name">${dayName}</span>
      <span class="day-icon" aria-hidden="true">${icon}</span>
      <span class="day-condition">${index === 0 ? "Today" : label}</span>
      <span class="day-temps"><strong>${formatTemperature(daily.temperature_2m_max[index])}</strong><span>${formatTemperature(daily.temperature_2m_min[index])}</span></span>
    </div>`;
  }).join("");
}

function renderAirQuality(data) {
  const aqi = data.current.us_aqi;
  const quality = aqi <= 50 ? ["Good", "Enjoy the fresh air"] :
    aqi <= 100 ? ["Moderate", "Sensitive groups take care"] :
      aqi <= 150 ? ["Unhealthy for some", "Sensitive groups limit exposure"] :
        aqi <= 200 ? ["Unhealthy", "Consider staying indoors"] :
          aqi <= 300 ? ["Very unhealthy", "Reduce outdoor activity"] : ["Hazardous", "Stay indoors if possible"];
  $("#air-index").textContent = Math.round(aqi);
  $("#air-quality").textContent = quality[0];
  $("#air-caption").textContent = quality[1];
  $("#air-dot").classList.add("visible");
  const color = aqi <= 50 ? "#5bb782" : aqi <= 100 ? "#d6ae4d" : aqi <= 150 ? "#e58f52" : "#d46b6b";
  $("#air-quality").style.color = color;
  $("#air-dot").style.backgroundColor = color;
  $("#air-index").style.color = color;
}

function updateQuickPlaces() {
  document.querySelectorAll(".place-item").forEach((button) => {
    const city = button.dataset.city;
    button.classList.toggle("selected", Boolean(city && state.place && city.toLowerCase() === state.place.name.toLowerCase()));
  });
  renderFavorites();
}

function renderFavorites() {
  const section = $("#saved-section");
  const list = $("#saved-places");
  section.hidden = state.favorites.length === 0;
  list.replaceChildren();
  state.favorites.forEach((place, index) => {
    const row = document.createElement("div");
    row.className = "saved-place";
    const loadButton = document.createElement("button");
    loadButton.type = "button";
    loadButton.className = "place-item";
    const icon = document.createElement("span");
    icon.className = "place-emoji";
    icon.setAttribute("aria-hidden", "true");
    icon.textContent = "♡";
    const name = document.createElement("span");
    name.textContent = place.name;
    loadButton.append(icon, name);
    loadButton.addEventListener("click", () => loadPlace(place));
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "remove-place";
    removeButton.textContent = "×";
    removeButton.setAttribute("aria-label", `Remove ${place.name} from saved cities`);
    removeButton.addEventListener("click", () => {
      state.favorites.splice(index, 1);
      writeStorage(STORAGE_KEYS.favorites, state.favorites);
      if (state.place) renderWeather(state.weather, state.place);
      else renderFavorites();
    });
    row.append(loadButton, removeButton);
    list.append(row);
  });
}

function toggleFavorite() {
  if (!state.place || !state.weather) return;
  const exists = state.favorites.some((item) => item.id === state.place.id || (item.name === state.place.name && item.latitude === state.place.latitude));
  state.favorites = exists
    ? state.favorites.filter((item) => !(item.id === state.place.id || (item.name === state.place.name && item.latitude === state.place.latitude)))
    : [...state.favorites, state.place];
  writeStorage(STORAGE_KEYS.favorites, state.favorites);
  renderWeather(state.weather, state.place);
}

function requestLocation() {
  if (!navigator.geolocation) {
    showError("Location is not supported by this browser. Search for a city instead.");
    return;
  }
  clearError();
  navigator.geolocation.getCurrentPosition(
    (position) => loadPlace({
      name: "Your location",
      country: "Current location",
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      id: `geo-${position.coords.latitude.toFixed(3)}-${position.coords.longitude.toFixed(3)}`,
    }),
    (error) => {
      const message = error.code === error.PERMISSION_DENIED
        ? "Location access was blocked. Allow location access or search for a city."
        : "Couldn't get your location. Search for a city instead.";
      showError(message);
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
}

$("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  searchCity($("#city-search").value);
});

$("#location-button").addEventListener("click", requestLocation);
elements.favoriteButton.addEventListener("click", toggleFavorite);

document.querySelectorAll(".unit-option").forEach((button) => {
  button.addEventListener("click", () => {
    if (state.unit === button.dataset.unit) return;
    state.unit = button.dataset.unit;
    writeStorage(STORAGE_KEYS.unit, state.unit);
    document.querySelectorAll(".unit-option").forEach((option) => {
      const active = option === button;
      option.classList.toggle("active", active);
      option.setAttribute("aria-pressed", String(active));
    });
    const place = state.selectedPlace || state.place;
    if (place) loadPlace(place);
  });
});

document.querySelectorAll(".place-item").forEach((button) => {
  if (button.dataset.city) button.addEventListener("click", () => searchCity(button.dataset.city));
});

document.querySelectorAll(".unit-option").forEach((button) => {
  const active = button.dataset.unit === state.unit;
  button.classList.toggle("active", active);
  button.setAttribute("aria-pressed", String(active));
});

if (state.place) {
  loadPlace(state.place);
} else {
  loadPlace({
    id: 5128581,
    name: "New York",
    admin1: "New York",
    country: "United States",
    latitude: 40.7128,
    longitude: -74.006,
  });
}
renderFavorites();
