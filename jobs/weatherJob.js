import cron from "node-cron";
import axios from "axios";
import Report from "../models/Report.model.js";

global.weatherAlertStatus = {
  active: false,
  message: "",
};

const checkWeatherAndPrioritize = async () => {
  console.log("🌦️ Running Multi-City Smart Weather Alert Job...");
  try {
    const activeCitiesResult = await Report.aggregate([
      {
        $match: {
          status: { $nin: ["Resolved", "Rejected"] },
          "address.city": { $exists: true, $ne: null, $ne: "" },
        },
      },
      {
        $group: {
          _id: "$address.city",
        },
      },
    ]);

    if (!activeCitiesResult || activeCitiesResult.length === 0) {
      console.log(
        "☀️ No active reports with city data found. Skipping weather check."
      );
      global.weatherAlertStatus = { active: false, message: "" };
      return;
    }

    const citiesToCheck = activeCitiesResult.map((item) => item._id);
    console.log(
      `[Smart Weather] Found active reports in the following cities: ${citiesToCheck.join(
        ", "
      )}`
    );

    let rainFound = false;
    let rainCity = "";

    for (const city of citiesToCheck) {
      try {
        const apiKey = process.env.WEATHER_API_KEY;
        const url = `http://api.openweathermap.org/data/2.5/forecast?q=${city}&appid=${apiKey}`;
        const response = await axios.get(url);
        const forecasts = response.data.list;
        const willRain = forecasts
          .slice(0, 8)
          .some((f) => f.weather[0].main.toLowerCase() === "rain");

        if (willRain) {
          rainFound = true;
          rainCity = city;
          console.log(
            `💧 Rain forecasted for ${city}. Boosting priority for relevant issues in this city.`
          );
          await Report.updateMany(
            {
              "address.city": city,
              category: { $in: ["Pothole", "Drainage"] },
              priority: { $in: ["Low", "Medium"] },
            },
            { $set: { priority: "High" } }
          );
        }
      } catch (cityError) {
        if (cityError.response && cityError.response.status === 404) {
          console.warn(
            `[Smart Weather] Could not find weather data for city: ${city}. It may be misspelled in a report.`
          );
        } else {
          console.error(
            `❌ Error checking weather for ${city}:`,
            cityError.message
          );
        }
      }
    }
    if (rainFound) {
      global.weatherAlertStatus = {
        active: true,
        message: `Heavy rain expected in ${rainCity} and other areas. Monitor relevant reports.`,
      };
    } else {
      console.log(`☀️ Clear weather forecasted for all active cities.`);
      global.weatherAlertStatus = { active: false, message: "" };
    }
  } catch (error) {
    console.error(
      "❌ A critical error occurred in the Weather Alert Job:",
      error.message
    );
    global.weatherAlertStatus = {
      active: false,
      message: "Failed to fetch weather data.",
    };
  }
};

export const startWeatherJob = () => {
  cron.schedule("0 */6 * * *", checkWeatherAndPrioritize);
  checkWeatherAndPrioritize();
  console.log("🌦️ Multi-City Smart Weather Alert Job has been scheduled.");
};
export default { startWeatherJob };
