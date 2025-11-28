import User from "../models/User.model.js";
import cloudinary from "../config/cloudinary.js";
import badgeSvc from "../services/badge.service.js";
const { checkAndAwardBadges } = badgeSvc;
import { compare, genSalt, hash } from "bcryptjs";

const uploadToCloudinary = (buffer, folder) => {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );
    uploadStream.end(buffer);
  });
};

export async function getUserProfile(req, res) {
  try {
    await checkAndAwardBadges(req.user.id);
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Get User Profile Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
}

export async function updateUserProfile(req, res) {
  try {
    await checkAndAwardBadges(req.user.id);
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (req.body.name) {
      user.name = req.body.name;
    }
    if (req.file) {
      const result = await uploadToCloudinary(req.file.buffer, "user-avatars");
      user.avatarUrl = result.secure_url;
    }
    const updatedUser = await user.save();
    res.json({
      id: updatedUser._id,
      name: updatedUser.name,
      email: updatedUser.email,
      avatarUrl: updatedUser.avatarUrl,
      role: updatedUser.role,
    });
  } catch (error) {
    console.error("Update User Profile Error:", error);
    res.status(500).json({ message: "Server Error" });
  }
}

export async function changePassword(req, res) {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword || newPassword.length < 8) {
      return res
        .status(400)
        .json({
          message: "Please provide valid passwords (new password min 6 chars).",
        });
    }
    const user = await User.findById(req.user.id);
    if (!user || !user.password) {
      return res
        .status(400)
        .json({ message: "User not found or uses social login." });
    }
    const isMatch = await compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Incorrect current password." });
    }
    const salt = await genSalt(10);
    user.password = await hash(newPassword, salt);
    await user.save();
    res.json({ message: "Password updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Server Error" });
  }
}
