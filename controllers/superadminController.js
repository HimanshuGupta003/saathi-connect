import Zone from "../models/Zone.model.js";
import User from "../models/User.model.js";
import { genSalt, hash } from "bcryptjs";

export async function createZone(req, res) {
  const { name, geometry } = req.body;
  if (!name || !geometry) {
    return res
      .status(400)
      .json({ message: "Please provide a name and GeoJSON geometry." });
  }

  try {
    const zone = await Zone.create({ name, geometry });
    res.status(201).json({ message: "Zone created successfully", zone });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
}

export async function createZoneAdmin(req, res) {
  const { name, email, password, zoneId } = req.body;
  if (!name || !email || !password || !zoneId) {
    return res
      .status(400)
      .json({ message: "Please provide name, email, password, and a zoneId." });
  }

  try {
    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ message: "User with this email already exists." });
    }

    user = new User({
      name,
      email,
      password,
      zone: zoneId, // Assign the Zone ID to the new admin
      role: "admin", // Set their role specifically to 'admin'
    });

    const salt = await genSalt(10);
    user.password = await hash(password, salt);
    await user.save();

    res.status(201).json({ message: "Zone Admin created successfully.", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server Error" });
  }
}
