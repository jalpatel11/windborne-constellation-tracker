import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { fetchConstellationHistory } from './services/constellationApi';
import type { ConstellationData, BalloonPosition } from './services/constellationApi';
import { fetchWeatherForPositions, getRateLimitInfo } from './services/weatherApi';
import type { WeatherData } from './services/weatherApi';
import 'leaflet/dist/leaflet.css';
import './App.css';

// Leaflet icon fix
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

L.Marker.prototype.options.icon = DefaultIcon;

// Update map center
function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [map, center]);
  return null;
}

function App() {
  const [history, setHistory] = useState<ConstellationData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedHour, setSelectedHour] = useState(0);
  const [weatherData, setWeatherData] = useState<Map<string, WeatherData>>(new Map());
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rateLimitInfo, setRateLimitInfo] = useState<{ isRateLimited: boolean; retryAfter?: number; resetTime?: Date }>({ isRateLimited: false });

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchConstellationHistory();
        setHistory(data);
        if (data.length === 0) {
          setError('No constellation data available.');
        }
      } catch (err) {
        console.error('Failed to load data:', err);
        setError('Failed to load data.');
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  const currentData = useMemo(() => {
    return history.find((d) => d.hour === selectedHour) || history[0] || null;
  }, [history, selectedHour]);

  useEffect(() => {
    if (!currentData?.positions.length) return;

    async function loadWeather() {
      setLoadingWeather(true);
      setWeatherData(new Map());
      
      try {
        await fetchWeatherForPositions(
          currentData.positions.map((p) => ({ latitude: p.latitude, longitude: p.longitude })),
          20,
          (batchData) => {
            // Update weather data incrementally as each batch completes
            setWeatherData((prev) => {
              const updated = new Map(prev);
              batchData.forEach((value, key) => {
                updated.set(key, value);
              });
              return updated;
            });
          }
        );
      } catch (err) {
        console.error('Weather load failed:', err);
      } finally {
        setLoadingWeather(false);
        // Check rate limit after loading
        const limitInfo = getRateLimitInfo();
        setRateLimitInfo(limitInfo);
      }
    }
    loadWeather();
  }, [currentData]);

  // Check rate limit status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const limitInfo = getRateLimitInfo();
      setRateLimitInfo(limitInfo);
    }, 1000);
    
    return () => clearInterval(interval);
  }, []);

  const mapCenter: [number, number] = useMemo(() => {
    if (!currentData?.positions.length) return [0, 0];
    const avgLat = currentData.positions.reduce((sum, p) => sum + p.latitude, 0) / currentData.positions.length;
    const avgLon = currentData.positions.reduce((sum, p) => sum + p.longitude, 0) / currentData.positions.length;
    return [avgLat, avgLon];
  }, [currentData]);

  const getWeather = (position: BalloonPosition): WeatherData | null => {
    const key = `${position.latitude.toFixed(2)},${position.longitude.toFixed(2)}`;
    const weather = weatherData.get(key);
    if (!weather) {
      // Try to find closest match (within 0.1 degree)
      for (const [mapKey, mapWeather] of weatherData.entries()) {
        const [lat, lon] = mapKey.split(',').map(Number);
        if (Math.abs(lat - position.latitude) < 0.1 && Math.abs(lon - position.longitude) < 0.1) {
          return mapWeather;
        }
      }
    }
    return weather || null;
  };

  const stats = useMemo(() => {
    if (!currentData) return null;

    const positions = currentData.positions;
    const altitudes = positions.map((p) => p.altitude);
    const avgAltitude = altitudes.reduce((sum, alt) => sum + alt, 0) / altitudes.length;
    const weatherValues = Array.from(weatherData.values());
    const avgTemp = weatherValues.length > 0
      ? weatherValues.reduce((sum, w) => sum + w.temperature, 0) / weatherValues.length
      : null;

    return {
      balloonCount: positions.length,
      avgAltitude: Math.round(avgAltitude),
      minAltitude: Math.round(Math.min(...altitudes)),
      maxAltitude: Math.round(Math.max(...altitudes)),
      avgTemp: avgTemp ? Math.round(avgTemp) : null,
    };
  }, [currentData, weatherData]);

  if (loading) {
    return (
      <div className="app-container">
        <div className="loading">
          <h1>WindBorne Constellation Tracker</h1>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (error || history.length === 0) {
    return (
      <div className="app-container">
        <div className="error">
          <h1>WindBorne Constellation Tracker</h1>
          <p>{error || 'No data available'}</p>
          <button onClick={() => window.location.reload()}>Retry</button>
        </div>
      </div>
    );
  }

  // Calculate wait time for rate limit
  const getWaitTime = (): string => {
    if (!rateLimitInfo.isRateLimited || !rateLimitInfo.resetTime) return '';
    
    const now = new Date();
    const reset = rateLimitInfo.resetTime;
    const diffMs = reset.getTime() - now.getTime();
    
    if (diffMs <= 0) return '';
    
    const minutes = Math.floor(diffMs / 60000);
    const seconds = Math.floor((diffMs % 60000) / 1000);
    
    if (minutes > 0) {
      return `${minutes} minute${minutes > 1 ? 's' : ''} and ${seconds} second${seconds !== 1 ? 's' : ''}`;
    }
    return `${seconds} second${seconds !== 1 ? 's' : ''}`;
  };

  return (
    <div className="app-container">
      {rateLimitInfo.isRateLimited && rateLimitInfo.resetTime && (
        <div className="rate-limit-popup">
          <div className="rate-limit-content">
            <h3>⚠️ API Rate Limit Reached</h3>
            <p>The weather API has reached its rate limit. Please wait before trying again.</p>
            <p className="wait-time">
              <strong>Wait time:</strong> {getWaitTime()}
            </p>
            <p className="reset-time">
              Resets at: {rateLimitInfo.resetTime.toLocaleTimeString()}
            </p>
            <button 
              onClick={() => {
                const limitInfo = getRateLimitInfo();
                if (!limitInfo.isRateLimited) {
                  setRateLimitInfo({ isRateLimited: false });
                }
              }}
              className="rate-limit-close"
            >
              Close
            </button>
          </div>
        </div>
      )}
      
      <header className="app-header">
        <h1>🌐 WindBorne Constellation Tracker</h1>
        <p className="subtitle">Real-time weather balloon tracking with live weather data</p>
      </header>

      <div className="controls-panel">
        <div className="time-control">
          <label htmlFor="hour-slider">
            Time: {selectedHour === 0 ? 'Now' : `${selectedHour} hour${selectedHour > 1 ? 's' : ''} ago`}
          </label>
          <input
            id="hour-slider"
            type="range"
            min="0"
            max={Math.max(...history.map((d) => d.hour))}
            value={selectedHour}
            onChange={(e) => setSelectedHour(Number(e.target.value))}
            className="slider"
          />
          <div className="time-labels">
            <span>Now</span>
            <span>{Math.max(...history.map((d) => d.hour))}h ago</span>
          </div>
        </div>

        {stats && (
          <div className="stats">
            <div className="stat-item">
              <span className="stat-label">Balloons:</span>
              <span className="stat-value">{stats.balloonCount}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Avg Altitude:</span>
              <span className="stat-value">{stats.avgAltitude}m</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Range:</span>
              <span className="stat-value">{stats.minAltitude}m - {stats.maxAltitude}m</span>
            </div>
            {stats.avgTemp !== null && (
              <div className="stat-item">
                <span className="stat-label">Avg Temp:</span>
                <span className="stat-value">{stats.avgTemp}°C</span>
              </div>
            )}
          </div>
        )}

        {loadingWeather && <div className="weather-loading">Loading weather...</div>}
      </div>

      <div className="map-container">
        <MapContainer center={mapCenter} zoom={2} style={{ height: '100%', width: '100%' }} scrollWheelZoom={true}>
          <MapUpdater center={mapCenter} />
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          
          <div className="map-legend">
            <h4>Temperature</h4>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#ff6b6b' }}></span>
              <span>&gt; 20°C</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#4ecdc4' }}></span>
              <span>0-20°C</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#95a5a6' }}></span>
              <span>&lt;= 0°C</span>
            </div>
            <div className="legend-item">
              <span className="legend-color" style={{ backgroundColor: '#ffa500' }}></span>
              <span>Loading...</span>
            </div>
          </div>
          
          {currentData?.positions.map((position, index) => {
            const weather = getWeather(position);
            const hasWeather = weather !== null;
            const weatherKey = hasWeather ? `${weather!.temperature.toFixed(1)}-${weather!.latitude.toFixed(2)}-${weather!.longitude.toFixed(2)}` : 'loading';
            const color = hasWeather
              ? weather!.temperature > 20 ? '#ff6b6b'
              : weather!.temperature > 0 ? '#4ecdc4'
              : '#95a5a6'
              : '#ffa500';

            return (
              <CircleMarker
                key={`${position.latitude}-${position.longitude}-${index}-${weatherKey}-${weatherData.size}`}
                center={[position.latitude, position.longitude]}
                radius={6}
                pathOptions={{ color, fillColor: color, fillOpacity: 0.7, weight: 2 }}
              >
                <Popup>
                  <div className="popup-content">
                    <h3>Balloon #{index + 1}</h3>
                    <p><strong>Position:</strong> {position.latitude.toFixed(4)}°, {position.longitude.toFixed(4)}°</p>
                    <p><strong>Altitude:</strong> {Math.round(position.altitude)}m</p>
                    {weather ? (
                      <>
                        <hr />
                        <h4>Weather</h4>
                        <p><strong>Temp:</strong> {weather.temperature.toFixed(1)}°C</p>
                        <p><strong>Wind:</strong> {weather.windSpeed.toFixed(1)} km/h @ {weather.windDirection.toFixed(0)}°</p>
                        <p><strong>Humidity:</strong> {weather.humidity.toFixed(0)}%</p>
                        <p><strong>Pressure:</strong> {weather.pressure.toFixed(0)} hPa</p>
                      </>
                    ) : (
                      <p className="no-weather">Weather unavailable</p>
                    )}
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      </div>

      <footer className="app-footer">
        <p>
          Data from <a href="https://windbornesystems.com" target="_blank" rel="noopener noreferrer">WindBorne Systems</a> + 
          {' '}<a href="https://open-meteo.com" target="_blank" rel="noopener noreferrer">Open-Meteo</a>
        </p>
      </footer>
    </div>
  );
}

export default App;
