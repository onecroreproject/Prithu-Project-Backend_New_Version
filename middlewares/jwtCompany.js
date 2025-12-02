const jwt = require("jsonwebtoken");

exports.companyAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        message: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1];

    // 🔹 Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
console.log(decoded)
    // 🔹 Attach companyId to request
    req.companyId = decoded.companyId;  // Since your generateToken stores { id: company._id }

    next();

  } catch (error) {
    console.error("❌ Auth Error:", error);
    return res.status(401).json({
      success: false,
      message: "Invalid or expired token",
    });
  }
};
