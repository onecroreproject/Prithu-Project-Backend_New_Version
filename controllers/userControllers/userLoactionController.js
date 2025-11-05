const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const Location = require("../../models/userModels/userLoactionSchema");
const dotenv = require("dotenv");

dotenv.config();

exports.saveUserLocation = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    const { latitude, longitude, permissionStatus } = req.body;

    if (!userId) {
      return res.status(400).json({ success: false, message: "User ID required" });
    }



    // 1️⃣ Handle permission denied
    if (permissionStatus === "denied") {
     
      return res.status(200).json({
        success: false,
        message: "User denied location permission.",
      });
    }

    // 2️⃣ Validate coordinates
    if (permissionStatus === "granted" && (!latitude || !longitude)) {
      return res.status(400).json({ success: false, message: "Latitude and Longitude are required" });
    }

    // 3️⃣ Fetch existing location (if any)
    const existingLocation = await Location.findOne({ userId });

    // 4️⃣ Skip update if same lat & lon
    if (
      existingLocation &&
      existingLocation.latitude === latitude &&
      existingLocation.longitude === longitude &&
      existingLocation.permissionStatus === permissionStatus
    ) {

      return res.status(200).json({
        success: true,
        message: "Location unchanged — no update needed",
        data: existingLocation,
      });
    }

    // 5️⃣ Reverse geocode only if coordinates exist
    let address = "Location not available";
    if (latitude && longitude) {
      try {
        const apiKey = process.env.OPENCAGE_API_KEY;
        const url = `https://api.opencagedata.com/geocode/v1/json?q=${latitude},${longitude}&key=${apiKey}`;
        const geoRes = await fetch(url);
        const data = await geoRes.json();
        address = data?.results?.[0]?.formatted || "Address not found";
      } catch (geoErr) {
        console.warn("⚠️ Reverse geocoding failed:", geoErr.message);
      }
    }

    // 6️⃣ Prepare location data
    const locationData = {
      userId,
      latitude,
      longitude,
      address,
      permissionStatus,
      updatedAt: new Date(),
    };

    // 7️⃣ Save or update the user's location
    const updatedLocation = await Location.findOneAndUpdate(
      { userId },
      locationData,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    console.log(`✅ Location updated for user ${userId}: ${address}`);

    return res.status(200).json({
      success: true,
      message: "Location saved successfully",
      data: updatedLocation,
    });
  } catch (err) {
    console.error("❌ saveUserLocation Error:", err);
    res.status(500).json({ success: false, message: "Server error", error: err.message });
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
