import axios from "axios";
import colors from "colors";
import { createClient } from "redis";

let CITY = process.env.CITY;
let API_KEY = process.env.API_KEY;
let DEFAULT_CACHE_EXPIRATION = parseInt(process.env.DEFAULT_CACHE_EXPIRATION);

axios.defaults.baseURL = `https://weather.visualcrossing.com/VisualCrossingWebServices/rest/services/timeline`;
axios.defaults.params = {
    unitGroup: "metric",
    key: `${API_KEY}`,
};

let redisClient = await createClient()
    .on("error", (error) => console.log(`Error: `, error))
    .connect();

displayWeatherDetails();

async function displayWeatherDetails() {
    let weatherCondition;
    console.log("Getting weather conditions for:", CITY);
    let isCached = await getWeatherConditionFromCache();
    if (!isCached) {
        weatherCondition = await getWeatherConditionFromApi();
        redisClient.set(`${CITY}`, JSON.stringify(weatherCondition), {
            EX: DEFAULT_CACHE_EXPIRATION,
        });
        console.log(`took from api:`.blue);
        console.log(weatherCondition);
    } else {
        weatherCondition = JSON.parse(isCached);
        console.log(`took from cached:`.yellow);
        console.log(weatherCondition);
    }
}

async function getWeatherConditionFromCache() {
    let cachedCity = await redisClient.get(`${CITY}`);
    if (cachedCity !== null) {
        return cachedCity;
    } else {
        return false;
    }
}

async function getWeatherConditionFromApi() {
    try {
        let response = await axios({
            method: "get",
            url: `/${CITY}`,
        });
        return response.data.currentConditions;
    } catch (error) {
        let status = error.response?.status;
        switch (status) {
            case 400:
                throw new Error(`Invalid location.`.red);
            case 401:
                throw new Error(`Authorization failed.`.red);
            case 404:
                throw new Error(`Not Found`.red);
            case 429:
                throw new Error(`Too many requests`.red);
        }
    }
}
