import User from "../models/User.model.js";

const roleMiddleware = (allowedRoles) => {
  return async (req, res, next) => {
    if (process.env.DEBUG_ROLE === "true" && req.user && req.user.id) {
      console.log("Checking role for user ID:", req.user.id);
    }
    try {
      if (!req.user || !req.user.id) {
        return res
          .status(401)
          .json({ message: "Authorization failed, user not found." });
      }
      const user = await User.findById(req.user.id).select("role");
      if (!user) {
        return res
          .status(401)
          .json({ message: "Authorization failed, user does not exist." });
      }
      if (allowedRoles.includes(user.role)) {
        next();
      } else {
        res
          .status(403)
          .json({
            message: "Forbidden: You do not have the required permissions.",
          });
      }
    } catch (error) {
      console.error("Error in role middleware:", error);
      res.status(500).send("Server Error");
    }
  };
};

export default roleMiddleware;
