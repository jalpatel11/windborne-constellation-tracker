exports.handler = async (event, context) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
      },
      body: '',
    };
  }

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Method not allowed' }),
    };
  }

  const { latitude, longitude } = event.queryStringParameters || {};

  if (!latitude || !longitude) {
    return {
      statusCode: 400,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Missing latitude or longitude' }),
    };
  }

  try {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,surface_pressure&timezone=auto`;
    
    const response = await fetch(url);
    const data = await response.json();

    // Forward rate limit headers if present
    const headers = {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json',
    };

    if (response.headers.get('Retry-After')) {
      headers['Retry-After'] = response.headers.get('Retry-After');
    }

    if (response.headers.get('X-RateLimit-Remaining')) {
      headers['X-RateLimit-Remaining'] = response.headers.get('X-RateLimit-Remaining');
    }

    if (response.headers.get('X-RateLimit-Reset')) {
      headers['X-RateLimit-Reset'] = response.headers.get('X-RateLimit-Reset');
    }

    return {
      statusCode: response.status,
      headers,
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Weather API error:', error);
    return {
      statusCode: 500,
      headers: {
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({ error: 'Failed to fetch weather data' }),
    };
  }
};

