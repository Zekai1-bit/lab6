'use strict';

const API_URL = 'https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=62.4540&lon=-114.3718';

const FETCH_TIMEOUT_MS = 10000;
const UNAVAILABLE_TEXT = 'Data unavailable';
const STAR_COUNT = 60;
const FLAKE_COUNT = 36;

const COLDEST_C = -40;
const WARMEST_C = 25;
const COLD_HUE = 190;
const WARM_HUE = 45;
const MAX_WIND_MS = 20;

const CONDITION_LABELS = {
  clearsky: 'Clear sky',
  fair: 'Fair',
  partlycloudy: 'Partly cloudy',
  cloudy: 'Cloudy',
  fog: 'Fog',
  lightrain: 'Light rain',
  rain: 'Rain',
  heavyrain: 'Heavy rain',
  lightrainshowers: 'Light rain showers',
  rainshowers: 'Rain showers',
  heavyrainshowers: 'Heavy rain showers',
  lightsleet: 'Light sleet',
  sleet: 'Sleet',
  heavysleet: 'Heavy sleet',
  lightsleetshowers: 'Light sleet showers',
  sleetshowers: 'Sleet showers',
  heavysleetshowers: 'Heavy sleet showers',
  lightsnow: 'Light snow',
  snow: 'Snow',
  heavysnow: 'Heavy snow',
  lightsnowshowers: 'Light snow showers',
  snowshowers: 'Snow showers',
  heavysnowshowers: 'Heavy snow showers'
};

const rootElement = document.documentElement;
const refreshButton = document.querySelector('#refreshBtn');
const unitButton = document.querySelector('#unitBtn');
const soundButton = document.querySelector('#soundBtn');
const retryButton = document.querySelector('#retryBtn');
const loadingElement = document.querySelector('#loading');
const errorCard = document.querySelector('#errorCard');
const errorMessage = document.querySelector('#errorMessage');
const temperatureElement = document.querySelector('#temperature');
const conditionElement = document.querySelector('#condition');
const windElement = document.querySelector('#wind');
const cloudElement = document.querySelector('#cloud');
const humidityElement = document.querySelector('#humidity');
const dataTimeElement = document.querySelector('#dataTime');
const lastUpdatedElement = document.querySelector('#lastUpdated');
const starsLayer = document.querySelector('#stars');
const snowLayer = document.querySelector('#snow');

let isLoading = false;
let currentReadings = null;
let temperatureUnit = 'C';
let isSoundOn = false;
let chimeSound = null;
let ambientSound = null;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function toNumberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

async function fetchForecast() {
  const abortController = new AbortController();
  const timeoutId = setTimeout(() => abortController.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, { signal: abortController.signal });
    if (!response.ok) {
      throw new Error(`The weather service answered with status ${response.status}.`);
    }
    return await response.json();
  } finally {
    clearTimeout(timeoutId);
  }
}

function extractReadings(forecast) {
  const firstEntry = forecast?.properties?.timeseries?.[0];
  if (!firstEntry || typeof firstEntry !== 'object') {
    throw new Error('The weather service sent a reply with no forecast in it.');
  }

  const details = firstEntry.data?.instant?.details ?? {};
  const symbolCode = firstEntry.data?.next_1_hours?.summary?.symbol_code;

  const dataTime = typeof firstEntry.time === 'string' ? new Date(firstEntry.time) : null;

  return {
    temperatureC: toNumberOrNull(details.air_temperature),
    cloudPercent: toNumberOrNull(details.cloud_area_fraction),
    windSpeed: toNumberOrNull(details.wind_speed),
    humidityPercent: toNumberOrNull(details.relative_humidity),
    symbolCode: typeof symbolCode === 'string' ? symbolCode : null,
    dataTime: dataTime === null || Number.isNaN(dataTime.getTime()) ? null : dataTime
  };
}

function describeError(error) {
  if (error?.name === 'AbortError') {
    return 'The weather service took too long to answer. Check your connection and try again.';
  }
  if (error instanceof TypeError) {
    return 'The weather service could not be reached. Check your connection and try again.';
  }
  if (error instanceof SyntaxError) {
    return 'The weather service sent a reply that could not be read. Try again in a moment.';
  }
  return error?.message || 'Something went wrong while loading the weather.';
}

function formatValue(value, digits, suffix) {
  return value === null ? UNAVAILABLE_TEXT : `${value.toFixed(digits)}${suffix}`;
}

function formatTemperature(temperatureC, unit) {
  if (temperatureC === null) {
    return UNAVAILABLE_TEXT;
  }
  const value = unit === 'F' ? temperatureC * 9 / 5 + 32 : temperatureC;
  return `${value.toFixed(1)} °${unit}`;
}

function formatCondition(symbolCode) {
  if (!symbolCode) {
    return 'Condition unavailable';
  }
  const withoutTimeOfDay = symbolCode.replace(/_(day|night|polartwilight)$/, '');
  const hasThunder = withoutTimeOfDay.includes('andthunder');
  const baseCode = withoutTimeOfDay.replace('andthunder', '');
  const label = CONDITION_LABELS[baseCode];
  if (!label) {
    return 'Condition unavailable';
  }
  return hasThunder ? `${label} and thunder` : label;
}

function formatYellowknifeTime(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) {
    return UNAVAILABLE_TEXT;
  }
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Yellowknife',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'shortOffset'
  }).format(date);
}

function renderTemperature() {
  const text = formatTemperature(currentReadings?.temperatureC ?? null, temperatureUnit);
  temperatureElement.textContent = text;
  temperatureElement.classList.toggle('is-unavailable', text === UNAVAILABLE_TEXT);
}

function renderReadings(readings, fetchedAt) {
  renderTemperature();
  conditionElement.textContent = formatCondition(readings.symbolCode);
  windElement.textContent = formatValue(readings.windSpeed, 1, ' m/s');
  cloudElement.textContent = formatValue(readings.cloudPercent, 0, ' %');
  humidityElement.textContent = formatValue(readings.humidityPercent, 0, ' %');
  dataTimeElement.textContent = formatYellowknifeTime(readings.dataTime);
  lastUpdatedElement.textContent = formatYellowknifeTime(fetchedAt);
}

function renderUnitButton() {
  const otherUnit = temperatureUnit === 'C' ? 'F' : 'C';
  unitButton.textContent = `Show °${otherUnit}`;
  unitButton.setAttribute('aria-pressed', String(temperatureUnit === 'F'));
  unitButton.setAttribute('aria-label',
    `Show temperature in ${otherUnit === 'F' ? 'Fahrenheit' : 'Celsius'}`);
}

function showLoading() {
  loadingElement.classList.remove('is-hidden');
  errorCard.classList.add('is-hidden');
}

function hideLoading() {
  loadingElement.classList.add('is-hidden');
}

function showError(message) {
  errorMessage.textContent = message;
  errorCard.classList.remove('is-hidden');
}

function setControlsDisabled(isDisabled) {
  [refreshButton, unitButton, soundButton, retryButton].forEach((button) => {
    button.disabled = isDisabled;
  });
}

function temperatureToHue(temperatureC) {
  const share = (clamp(temperatureC, COLDEST_C, WARMEST_C) - COLDEST_C) / (WARMEST_C - COLDEST_C);
  return COLD_HUE + share * (WARM_HUE - COLD_HUE);
}

function updateVisibleStars(cloudPercent) {
  const visibleCount = Math.round(STAR_COUNT * (1 - clamp(cloudPercent, 0, 100) / 100));
  starsLayer.querySelectorAll('.star').forEach((star, index) => {
    star.classList.toggle('is-clouded', index >= visibleCount);
  });
}

function applyVisuals(readings) {
  if (readings.temperatureC !== null) {
    rootElement.style.setProperty('--temp-hue', temperatureToHue(readings.temperatureC).toFixed(1));
  }
  if (readings.cloudPercent !== null) {
    const cloudShare = clamp(readings.cloudPercent, 0, 100) / 100;
    rootElement.style.setProperty('--aurora-opacity', (1 - 0.85 * cloudShare).toFixed(3));
    rootElement.style.setProperty('--cloud-opacity', cloudShare.toFixed(3));
    updateVisibleStars(readings.cloudPercent);
  }
  if (readings.windSpeed !== null) {
    rootElement.style.setProperty('--wind-speed', clamp(readings.windSpeed, 0, MAX_WIND_MS).toFixed(1));
  }
}

function createStar() {
  const star = document.createElement('span');
  star.classList.add('star');
  star.style.setProperty('--x', `${randomBetween(0, 100).toFixed(1)}%`);
  star.style.setProperty('--y', `${randomBetween(0, 55).toFixed(1)}%`);
  star.style.setProperty('--size', `${randomBetween(1, 3).toFixed(1)}px`);
  star.style.setProperty('--delay', `${randomBetween(-4, 0).toFixed(1)}s`);
  return star;
}

function createFlake() {
  const flake = document.createElement('span');
  flake.classList.add('flake');
  flake.style.setProperty('--x', `${randomBetween(-15, 95).toFixed(1)}%`);
  flake.style.setProperty('--y', `${randomBetween(0, 95).toFixed(1)}%`);
  flake.style.setProperty('--size', `${randomBetween(2, 5).toFixed(1)}px`);
  flake.style.setProperty('--fall-time', `${randomBetween(14, 28).toFixed(1)}s`);
  flake.style.setProperty('--delay', `${randomBetween(-28, 0).toFixed(1)}s`);
  return flake;
}

function buildSkyLayers() {
  for (let index = 0; index < STAR_COUNT; index += 1) {
    starsLayer.appendChild(createStar());
  }
  for (let index = 0; index < FLAKE_COUNT; index += 1) {
    snowLayer.appendChild(createFlake());
  }
}

function hideSoundButton() {
  isSoundOn = false;
  soundButton.classList.add('is-hidden');
  if (ambientSound) {
    ambientSound.pause();
  }
}

function setUpAudio() {
  try {

    chimeSound = new Audio('audio/chime.mp3');
    chimeSound.volume = 0.5;

    ambientSound = new Audio('audio/ambient.mp3');
    ambientSound.loop = true;

    chimeSound.addEventListener('error', hideSoundButton);
    ambientSound.addEventListener('error', hideSoundButton);
  } catch (error) {
    hideSoundButton();
  }
}

function updateAmbientVolume(cloudPercent) {
  if (!ambientSound) {
    return;
  }
  const cloudShare = cloudPercent === null ? 0.3 : clamp(cloudPercent, 0, 100) / 100;
  ambientSound.volume = 0.15 + 0.45 * cloudShare;
}

function renderSoundButton() {
  soundButton.textContent = isSoundOn ? 'Sound: on' : 'Sound: off';
  soundButton.setAttribute('aria-pressed', String(isSoundOn));
}

async function playChime() {
  if (!isSoundOn || !chimeSound) {
    return;
  }
  try {
    chimeSound.currentTime = 0;
    await chimeSound.play();
  } catch (error) {
    hideSoundButton();
  }
}

async function toggleSound() {
  if (!ambientSound) {
    hideSoundButton();
    return;
  }
  isSoundOn = !isSoundOn;
  renderSoundButton();

  if (!isSoundOn) {
    ambientSound.pause();
    return;
  }
  try {
    updateAmbientVolume(currentReadings?.cloudPercent ?? null);
    await ambientSound.play();
  } catch (error) {
    hideSoundButton();
  }
}

async function loadWeather({ shouldPlayChime = false } = {}) {
  if (isLoading) {
    return;
  }
  isLoading = true;
  setControlsDisabled(true);
  showLoading();

  try {
    const forecast = await fetchForecast();
    const readings = extractReadings(forecast);
    currentReadings = readings;
    renderReadings(readings, new Date());
    applyVisuals(readings);
    updateAmbientVolume(readings.cloudPercent);
    if (shouldPlayChime) {
      playChime();
    }
  } catch (error) {
    showError(describeError(error));
  } finally {
    isLoading = false;
    hideLoading();
    setControlsDisabled(false);
  }
}

function toggleTemperatureUnit() {
  temperatureUnit = temperatureUnit === 'C' ? 'F' : 'C';
  renderUnitButton();
  renderTemperature();
}

function handleRefreshClick() {
  loadWeather({ shouldPlayChime: true });
}

function addEventListeners() {
  refreshButton.addEventListener('click', handleRefreshClick);
  retryButton.addEventListener('click', handleRefreshClick);
  unitButton.addEventListener('click', toggleTemperatureUnit);
  soundButton.addEventListener('click', toggleSound);
}

function init() {
  buildSkyLayers();
  setUpAudio();
  addEventListeners();
  renderUnitButton();
  renderSoundButton();
  loadWeather();
}

init();
