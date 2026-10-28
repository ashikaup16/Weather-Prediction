# Sunshine Weather

A colorful, responsive weather dashboard for searching forecasts around the world. It uses the free Open-Meteo forecast, geocoding, and air-quality APIs; no API key or account is required.

## Live demo

[Open Sunshine Weather](https://weather-prediction-eosin.vercel.app)

## Features

- Live current conditions, apparent temperature, and daily high/low
- Search for cities and quick links for New York, London, Tokyo, and Sydney
- Optional browser geolocation
- Hourly and seven-day forecasts
- Humidity, wind, UV index, rain chance, sunrise/sunset, and daylight duration
- Current local air-quality index
- Celsius/Fahrenheit toggle, saved in the browser
- Favorite the current city, with the preference saved locally
- Responsive layout for desktop, tablet, and mobile

## Run it

1. Install Node.js if it is not already installed.
2. Open this folder in a terminal and run:

   ```powershell
   node server.js
   ```

3. Open `http://localhost:8000`.

The project has no package install step or runtime dependencies. Browser geolocation requires a secure context such as `localhost` or HTTPS. Live weather data requires an internet connection.

## Data and privacy

Weather is fetched from Open-Meteo in the browser. The app has no backend and stores only the selected unit, last viewed place, and saved cities in local browser storage. Location is requested only after selecting the location button.
