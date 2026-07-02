import jwt from "jsonwebtoken";

const authMiddleware = (req, res, next) => {
console.log("Authorization Header:", req.header("Authorization"));

  if (!authHeader) {
    return res.status(401).json({
      msg: "No token, authorization denied",
    });
  }

  const parts = authHeader.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    return res.status(401).json({
      msg: "Token format is invalid",
    });
  }

  const token = parts[1];

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "supersecretjwtkeyforinvestorriskanalyzer"
    );

    req.user = decoded.user;

    next();
  } catch (err) {
    return res.status(401).json({
      msg: "Token is not valid",
    });
  }
};

export default authMiddleware;