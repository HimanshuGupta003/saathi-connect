import { get } from 'axios';

export async function isRainForecasted(city = 'Mumbai') {
    try {
        const apiKey = process.env.WEATHER_API_KEY;
        if (!apiKey) {
            console.warn('⚠️ Weather API Key not found. Skipping weather check.');
            return false;
        }

        const url = `http://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}`;
        const response = await get(url);
        
        const forecasts = response.data.list.slice(0, 8);

        const willRain = forecasts.some(forecast => 
            forecast.weather[0].main.toLowerCase().includes('rain')
        );

        return willRain;

    } catch (error) {
        console.error('❌ Error fetching weather data:', error.response ? error.response.data.message : error.message);
        return false;
    }
}