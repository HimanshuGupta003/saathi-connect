import Zone from "../models/Zone.model.js";

export async function getAllZones(req, res) {
  try {
    const zones = await Zone.find({});
    res.status(200).json(zones);
  } catch (err) {
    console.error(err.message);
    res.status(500).send("Server Error");
  }
}
