import { get } from 'axios';

const getCoordsFromAddress = async (address) => {
    if (!address) return null;

    try {
        const apiKey = process.env.LOCATIONIQ_API_KEY;
        if (!apiKey) {
            console.error("[Geocoding] LocationIQ API key is missing from .env file.");
            return null;
        }

        const url = `https://us1.locationiq.com/v1/search?key=${apiKey}&q=${encodeURIComponent(address)}&format=json`;
        
        const response = await get(url);

        if (response.data && response.data.length > 0) {
            const { lat, lon } = response.data[0];
            console.log(`[Geocoding] LocationIQ found coordinates: Lat ${lat}, Lng ${lon}`);
            return [parseFloat(lon), parseFloat(lat)];
        } else {
            console.warn(`[Geocoding] LocationIQ API could not find the address.`);
            return null;
        }
    } catch (error) {
        if (error.response && error.response.status === 404) {
            console.warn(`[Geocoding] LocationIQ API could not find the address: ${address}`);
        } else {
            console.error("LocationIQ Geocoding service error:", error.message);
        }
        return null;
    }
};

export default { getCoordsFromAddress };