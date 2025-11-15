// Open-Meteo weather API

export interface WeatherData {
  latitude: number;
  longitude: number;
  temperature: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  pressure: number;
}

// Get weather for location
export async function fetchWeatherData(
  latitude: number,
  longitude: number
): Promise<WeatherData | null> {
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure&timezone=auto`;
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const current = data.current;
    if (!current) return null;
    
    return {
      latitude,
      longitude,
      temperature: current.temperature_2m || 0,
      windSpeed: current.wind_speed_10m || 0,
      windDirection: current.wind_direction_10m || 0,
      humidity: current.relative_humidity_2m || 0,
      pressure: current.surface_pressure || 0,
    };
  } catch {
    return null;
  }
}

// Fetch weather for multiple positions
export async function fetchWeatherForPositions(
  positions: Array<{ latitude: number; longitude: number }>,
  maxConcurrent: number = 5
): Promise<Map<string, WeatherData>> {
  const weatherMap = new Map<string, WeatherData>();
  
  for (let i = 0; i < positions.length; i += maxConcurrent) {
    const batch = positions.slice(i, i + maxConcurrent);
    
    const results = await Promise.all(
      batch.map(async (pos) => {
        const key = `${pos.latitude.toFixed(2)},${pos.longitude.toFixed(2)}`;
        const weather = await fetchWeatherData(pos.latitude, pos.longitude);
        return weather ? { key, weather } : null;
      })
    );
    
    results.forEach((result) => {
      if (result) weatherMap.set(result.key, result.weather);
    });
    
    if (i + maxConcurrent < positions.length) {
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
  
  return weatherMap;
}
