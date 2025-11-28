import { genSalt, hash, compare } from "bcryptjs";
import jwt from "jsonwebtoken";
const { sign, verify } = jwt;
import User from "../models/User.model.js";

const generateTokens = (user) => {
  const accessToken = sign(
    { user: { id: user.id, role: user.role } },
    process.env.JWT_SECRET,
    { expiresIn: "15m" }
  );
  const refreshToken = sign(
    { user: { id: user.id } },
    process.env.REFRESH_TOKEN_SECRET,
    { expiresIn: "7d" }
  );
  return { accessToken, refreshToken };
};

const sendTokens = (user, res) => {
  const { accessToken, refreshToken } = generateTokens(user);
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  res.json({
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      department: user.department,
      avatarUrl: user.avatarUrl,
    },
  });
};

export async function register(req, res) {
  try {
    const { name, email, phoneNumber, password, address } = req.body;
    if (!name || !email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide name, email, and password." });
    }
    if (password.length < 8) {
      return res
        .status(400)
        .json({ message: "Password must be at least 8 characters long." });
    }

    let user = await User.findOne({ email });
    if (user) {
      return res
        .status(400)
        .json({ message: "User with this email already exists." });
    }
    user = new User({
      name,
      email,
      phoneNumber,
      password,
      address,
      role: "citizen",
    });
    const salt = await genSalt(10);
    user.password = await hash(password, salt);
    await user.save();
    sendTokens(user, res);
  } catch (err) {
    console.error("Register Error:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Please provide email and password." });
    }
    const user = await User.findOne({ email }).populate("department", "name");
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials." });
    }
    if (user.googleId && !user.password) {
      return res.status(400).json({ message: "Please log in with Google." });
    }
    const isMatch = await compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }
    sendTokens(user, res);
  } catch (err) {
    console.error("Login Error:", err.message);
    res.status(500).send("Server Error");
  }
}

export async function refreshToken(req, res) {
  try {
    const tokenFromCookie = req.cookies.refreshToken;
    const tokenFromBody = req.body ? req.body.token : null;
    const refreshToken = tokenFromCookie || tokenFromBody;
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided." });
    }
    const decoded = verify(refreshToken, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decoded.user.id);
    if (!user) {
      return res.status(403).json({ message: "User not found." });
    }
    const { accessToken } = generateTokens(user);
    res.json({ accessToken });
  } catch (err) {
    return res.status(403).json({ message: "Invalid refresh token." });
  }
}

export function googleCallback(req, res) {
  sendTokens(req.user, res);
}

export async function updateFcmToken(req, res) {
  try {
    const { fcmToken } = req.body;
    if (!fcmToken) {
      return res.status(400).json({ message: "FCM token is required." });
    }
    await User.findByIdAndUpdate(req.user.id, { fcmToken: fcmToken });
    res.status(200).json({ message: "FCM token updated successfully." });
  } catch (err) {
    res.status(500).send("Server Error");
  }
}
