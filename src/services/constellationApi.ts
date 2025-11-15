// WindBorne constellation API

export interface BalloonPosition {
  latitude: number;
  longitude: number;
  altitude: number;
  timestamp: number; // hours ago
}

export interface ConstellationData {
  hour: number;
  positions: BalloonPosition[];
  timestamp: Date;
}

// Check if position is valid [lat, lon, alt]
function isValidPosition(arr: unknown): arr is [number, number, number] {
  if (!Array.isArray(arr) || arr.length !== 3) return false;
  
  const [lat, lon, alt] = arr;
  return (
    typeof lat === 'number' && !isNaN(lat) && lat >= -90 && lat <= 90 &&
    typeof lon === 'number' && !isNaN(lon) && lon >= -180 && lon <= 180 &&
    typeof alt === 'number' && !isNaN(alt) && alt >= -500 && alt <= 50000
  );
}

// Parse response and filter invalid data
function parseConstellationResponse(data: unknown, hoursAgo: number): BalloonPosition[] {
  if (!Array.isArray(data)) return [];
  
  return data
    .filter(isValidPosition)
    .map(([lat, lon, alt]) => ({
      latitude: lat,
      longitude: lon,
      altitude: alt,
      timestamp: hoursAgo,
    }));
}

// Fetch data for one hour
async function fetchConstellationHour(hoursAgo: number): Promise<BalloonPosition[]> {
  try {
    const proxyUrl = '/.netlify/functions/constellation?hour=' + hoursAgo;
    const directUrl = `https://a.windbornesystems.com/treasure/${String(hoursAgo).padStart(2, '0')}.json`;
    
    let url = proxyUrl;
    let response = await fetch(url);
    
    if (!response.ok && response.status === 404) {
      url = directUrl;
      response = await fetch(url);
    }
    
    if (!response.ok) {
      console.warn(`Failed to fetch hour ${hoursAgo}: ${response.status}`);
      return [];
    }
    const data = await response.json();
    return parseConstellationResponse(data, hoursAgo);
  } catch (error) {
    console.error(`Error fetching hour ${hoursAgo}:`, error);
    return [];
  }
}

// Fetch 24 hours of history
export async function fetchConstellationHistory(): Promise<ConstellationData[]> {
  const hours = Array.from({ length: 24 }, (_, i) => i);
  
  const results = await Promise.all(
    hours.map(async (hour) => ({
      hour,
      positions: await fetchConstellationHour(hour),
      timestamp: new Date(Date.now() - hour * 60 * 60 * 1000),
    }))
  );
  
  return results
    .filter((data) => data.positions.length > 0)
    .sort((a, b) => a.hour - b.hour);
}
