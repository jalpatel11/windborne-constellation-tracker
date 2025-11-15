# WindBorne Constellation Tracker

Interactive web app that visualizes WindBorne Systems' weather balloon constellation combined with real-time weather data.

**Live Demo:** https://windborne-constellation-tracker.netlify.app

## What It Does

- Fetches live balloon positions from WindBorne's API (24-hour history)
- Combines with weather data from Open-Meteo
- Interactive map with time slider to view positions over time
- Click balloons to see position, altitude, and weather conditions

## Tech Stack

- React + TypeScript
- Vite
- Leaflet for maps
- Open-Meteo API (free, no key required)
- Netlify Functions for CORS proxy

## Setup

```bash
npm install
npm run dev
```

Visit `http://localhost:5173`

## Build

```bash
npm run build
```

Output goes to `dist/`

## Deploy

Deploy to Netlify:

```bash
npm run build
netlify deploy --prod --dir=dist
```

The Netlify function in `netlify/functions/constellation.js` handles CORS for the WindBorne API.

## Why Open-Meteo?

Free weather API with no key required. Combining balloon positions with atmospheric conditions shows global weather patterns, directly relevant to WindBorne's mission.

