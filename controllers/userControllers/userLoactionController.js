const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Location = require("../../models/userModels/userLoactionSchema");
const dotenv = require("dotenv");

dotenv.config();

exports.saveUserLocation = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId; 
    const { latitude, longitude, permissionStatus } = req.body;

    console.log({ latitude, longitude, permissionStatus })

    // 1️⃣ Handle permission denied
    if (permissionStatus === "denied") {
      console.log(`⚠️ User ${userId || "unknown"} denied location access`);
      return res.status(200).json({
        success: false,
        message: "User denied location permission.",
      });
    }

    // 2️⃣ Validate coordinates (only if permission granted)
    if (permissionStatus === "granted" && (!latitude || !longitude)) {
      return res.status(400).json({ message: "Latitude and Longitude are required" });
    }

    let address = "Location not available";

    // 3️⃣ Reverse geocode only if coordinates exist
    if (latitude && longitude) {
      const apiKey = process.env.OPENCAGE_API_KEY;
      const url = `https://api.opencagedata.com/geocode/v1/json?q=${latitude},${longitude}&key=${apiKey}`;
      const geoRes = await fetch(url);
      const data = await geoRes.json();
      address = data?.results?.[0]?.formatted || "Address not found";
    }

    // 4️⃣ Save or update user's latest location
    const locationData = {
      userId,
      latitude,
      longitude,
      address,
      permissionStatus,
    };

    console.log("📩 locationData before DB:", locationData);

const updatedLocation = await Location.findOneAndUpdate(
  { userId },
  locationData,
  { upsert: true, new: true, setDefaultsOnInsert: true }
);

console.log("🧾 MongoDB response:", updatedLocation);

    console.log(`✅ Location updated for user ${userId}: ${address}`);

    return res.status(200).json({
      success: true,
      message: "Location saved successfully",
      data: updatedLocation,
    });
  } catch (err) {
    console.error("❌ saveUserLocation Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};



exports.getUserLocation = async (req, res) => {
  try {
    const userId = req.Id || req.query.userId || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required to fetch location",
      });
    }

    // Fetch the latest location entry
    const userLocation = await Location.findOne({ userId }).sort({ updatedAt: -1 });

    if (!userLocation) {
      return res.status(404).json({
        success: false,
        message: "No location found for this user",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User location fetched successfully",
      data: userLocation,
    });
  } catch (err) {
    console.error("getUserLocation Error:", err);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching user location",
      error: err.message,
    });
  }
};
