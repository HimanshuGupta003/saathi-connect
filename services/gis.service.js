import Report from "../models/Report.model.js";

export async function getReportsAsGeoJson(query = {}) {
  try {
    const reports = await Report.find(query).lean();

    const features = reports.map((report) => ({
      type: "Feature",
      geometry: {
        type: "Point",
        coordinates: report.location.coordinates,
      },
      properties: {
        id: report._id,
        category: report.category,
        priority: report.priority,
        upvotes: report.upvotes,
        status: report.status,
      },
    }));

    return {
      type: "FeatureCollection",
      features: features,
    };
  } catch (error) {
    console.error("Error creating GeoJSON:", error);
    throw new Error("Failed to generate GIS data.");
  }
}
