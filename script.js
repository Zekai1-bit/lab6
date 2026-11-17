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

