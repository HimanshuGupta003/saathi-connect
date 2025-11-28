import jwt from "jsonwebtoken";
const { verify } = jwt;
import User from "../models/User.model.js";

const authMiddleware = async (req, res, next) => {
  let token;

  if (
    req.header("Authorization") &&
    req.header("Authorization").startsWith("Bearer")
  ) {
    try {
      token = req.header("Authorization").split(" ")[1];
      const decoded = verify(token, process.env.JWT_SECRET);
      req.user = await User.findById(decoded.user.id).select("-password");

      if (!req.user) {
        return res
          .status(401)
          .json({ message: "Authorization failed, user not found." });
      }
      next();
    } catch (err) {
      console.error("Token verification failed:", err.message);
      return res.status(401).json({ message: "Token is not valid" });
    }
  }

  if (!token) {
    res.status(401).json({ message: "No token, authorization denied" });
  }
};

export default authMiddleware;
