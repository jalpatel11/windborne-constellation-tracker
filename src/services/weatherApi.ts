// Open-Meteo weather API

export interface WeatherData {
  latitude: number;
  longitude: number;
  temperature: number;
  windSpeed: number;
  windDirection: number;
  humidity: number;
  pressure: number;
  timestamp?: number;
}

// Simple in-memory cache (5 minute TTL)
const weatherCache = new Map<string, { data: WeatherData; expires: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// Get weather for location (with caching)
export async function fetchWeatherData(
  latitude: number,
  longitude: number
): Promise<WeatherData | null> {
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`;
  
  // Check cache
  const cached = weatherCache.get(cacheKey);
  if (cached && cached.expires > Date.now()) {
    return cached.data;
  }
  
  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure&timezone=auto`;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    
    if (response.status === 429) {
      console.warn('Rate limit exceeded for Open-Meteo API');
      return null;
    }
    
    if (!response.ok) return null;
    
    const data = await response.json();
    const current = data.current;
    if (!current) return null;
    
    const weather: WeatherData = {
      latitude,
      longitude,
      temperature: current.temperature_2m || 0,
      windSpeed: current.wind_speed_10m || 0,
      windDirection: current.wind_direction_10m || 0,
      humidity: current.relative_humidity_2m || 0,
      pressure: current.surface_pressure || 0,
      timestamp: Date.now(),
    };
    
    // Cache the result
    weatherCache.set(cacheKey, {
      data: weather,
      expires: Date.now() + CACHE_TTL,
    });
    
    return weather;
  } catch (error) {
    if (error instanceof Error && error.name !== 'AbortError') {
      console.warn(`Weather fetch failed for ${latitude}, ${longitude}:`, error.message);
    }
    return null;
  }
}

// Fetch weather for multiple positions
export async function fetchWeatherForPositions(
  positions: Array<{ latitude: number; longitude: number }>,
  maxConcurrent: number = 20,
  onBatchComplete?: (batchData: Map<string, WeatherData>) => void
): Promise<Map<string, WeatherData>> {
  const weatherMap = new Map<string, WeatherData>();
  
  // Deduplicate positions (same lat/lon rounded to 2 decimals)
  const uniquePositions = new Map<string, { latitude: number; longitude: number }>();
  positions.forEach((pos) => {
    const key = `${pos.latitude.toFixed(2)},${pos.longitude.toFixed(2)}`;
    if (!uniquePositions.has(key)) {
      uniquePositions.set(key, pos);
    }
  });
  
  const deduplicated = Array.from(uniquePositions.values());
  
  // Process batches sequentially so colors update incrementally
  for (let i = 0; i < deduplicated.length; i += maxConcurrent) {
    const batch = deduplicated.slice(i, i + maxConcurrent);
    
    const results = await Promise.allSettled(
      batch.map(async (pos) => {
        const key = `${pos.latitude.toFixed(2)},${pos.longitude.toFixed(2)}`;
        const weather = await fetchWeatherData(pos.latitude, pos.longitude);
        return weather ? { key, weather } : null;
      })
    );
    
    const batchMap = new Map<string, WeatherData>();
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        weatherMap.set(result.value.key, result.value.weather);
        batchMap.set(result.value.key, result.value.weather);
      }
    });
    
    // Call callback immediately as each batch completes
    if (onBatchComplete) {
      onBatchComplete(batchMap);
    }
  }
  
  // Map results back to all original positions (including duplicates)
  const finalMap = new Map<string, WeatherData>();
  positions.forEach((pos) => {
    const key = `${pos.latitude.toFixed(2)},${pos.longitude.toFixed(2)}`;
    const weather = weatherMap.get(key);
    if (weather) {
      finalMap.set(key, weather);
    }
  });
  
  return finalMap;
}
