# WindBorne Constellation Tracker

Interactive map showing WindBorne Systems' weather balloon positions with live weather data overlay.

**Live:** https://windborne-constellation-tracker.netlify.app

## Features

- Fetches 24-hour balloon position history from WindBorne API
- Overlays real-time weather data (temperature, wind, humidity, pressure)
- Time slider to view positions across different hours
- Color-coded markers by temperature (red >20°C, teal 0-20°C, gray <0°C)
- Click markers for detailed position and weather info
- Rate limit detection with countdown popup
- Weather data caching and deduplication

## Tech Stack

- React + TypeScript + Vite
- Leaflet for map visualization
- Open-Meteo API for weather data
- Netlify Functions for API proxying (CORS handling)

## Setup

```bash
npm install
npm run dev
```

Runs on `http://localhost:5173`

## Build

```bash
npm run build
```

Output in `dist/`

## Deploy

```bash
npm run build
netlify deploy --prod --dir=dist
```

Netlify functions:
- `netlify/functions/constellation.js` - Proxies WindBorne API
- `netlify/functions/weather.js` - Proxies Open-Meteo API

## API Details

**WindBorne API:** Fetches from `https://a.windbornesystems.com/treasure/00.json` through `23.json` (24 hours). Handles corrupted/malformed data gracefully.

**Open-Meteo API:** Free weather API, no key required. Used for temperature, wind speed/direction, humidity, and pressure. Includes:
- 5-minute caching per location
- Position deduplication
- Rate limit detection with user notification
- Batch processing for performance

## Project Structure

```
src/
  services/
    constellationApi.ts  # WindBorne API client
    weatherApi.ts        # Open-Meteo API client with caching
  App.tsx               # Main component
netlify/functions/
  constellation.js      # WindBorne proxy
  weather.js            # Open-Meteo proxy
```
