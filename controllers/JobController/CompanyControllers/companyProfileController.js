const CompanyProfile = require("../../../models/Job/CompanyModel/companyProfile");
const CompanyLogin = require("../../../models/Job/CompanyModel/companyLoginSchema");
const JobPost=require("../../../models/Job/JobPost/jobSchema");
const { deleteLocalCompanyFile } = require("../../../middlewares/services/companyUploadSpydy");
const CompanyProfileVisibility = require("../../../models/Job/CompanyModel/companyProfileVisibilitySchema");
const path = require("path");
const mongoose=require("mongoose")
const JobApplication =require("../../../models/userModels/job/userJobApplication")

exports.updateCompanyProfile = async (req, res) => {
  try {
    const companyId = req.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    const data = req.body;

    // Handle potential array values for string fields
    const stringFields = [
      'companyEmail', 'companyPhone', 'phone', 'companyName',
      'description', 'address', 'city', 'state', 'country',
      'pincode', 'yearEstablished', 'employeeCount',
      'workingHours', 'workingDays', 'registrationCertificate',
      'gstNumber', 'panNumber', 'cinNumber', 'hiringEmail',
      'hrName', 'hrPhone', 'businessCategory'
    ];

    // Convert any array values to strings (take first element)
    stringFields.forEach(field => {
      if (data[field] && Array.isArray(data[field])) {
        data[field] = data[field][0] || '';
      }
    });

    // Handle socialLinks if it's a string (JSON)
    if (typeof data.socialLinks === 'string') {
      try {
        data.socialLinks = JSON.parse(data.socialLinks);
      } catch (e) {
        data.socialLinks = {};
      }
    }

    // Handle array fields
    const arrayFields = ['servicesOffered', 'clients', 'awards', 'hiringProcess', 'galleryImages'];
    arrayFields.forEach(field => {
      if (typeof data[field] === 'string') {
        try {
          data[field] = JSON.parse(data[field]);
        } catch (e) {
          data[field] = [];
        }
      }
    });

    // Handle googleLocation
    if (typeof data.googleLocation === 'string') {
      try {
        data.googleLocation = JSON.parse(data.googleLocation);
      } catch (e) {
        data.googleLocation = null;
      }
    }

    // Fetch existing profile
    const existing = await CompanyProfile.findOne({ companyId });

    // Host for generating URLs
    const host = `https://${req.get("host")}`;

    /* ------------------------------------------------------
     * LOGO
     * ------------------------------------------------------ */
    if (req.files?.logo?.length > 0) {
      const file = req.files.logo[0];

      if (existing?.logo) {
        const oldPath = path.join(
          __dirname,
          "../../",
          existing.logo.replace(host, "")
        );
        deleteLocalCompanyFile(oldPath);
      }

      data.logo = `${host}/media/company/${companyId}/logo/${file._savedName}`;
    }

    /* ------------------------------------------------------
     * COVER IMAGE
     * ------------------------------------------------------ */
    if (req.files?.coverImage?.length > 0) {
      const file = req.files.coverImage[0];

      if (existing?.coverImage) {
        const oldPath = path.join(
          __dirname,
          "../../",
          existing.coverImage.replace(host, "")
        );
        deleteLocalCompanyFile(oldPath);
      }

      data.coverImage = `${host}/media/company/${companyId}/cover/${file._savedName}`;
      console.log("cover", data.coverImage);
    }

    /* ------------------------------------------------------
     * GALLERY IMAGES (REPLACE MODE – MAX 5)
     * ------------------------------------------------------ */
    if (req.files?.galleryImages?.length > 0) {
      const galleryFiles = req.files.galleryImages;

      // delete old gallery images
      if (existing?.galleryImages?.length > 0) {
        for (const oldUrl of existing.galleryImages) {
          const oldPath = path.join(
            __dirname,
            "../../",
            oldUrl.replace(host, "")
          );
          deleteLocalCompanyFile(oldPath);
        }
      }

      // save new gallery URLs
      data.galleryImages = galleryFiles
        .slice(0, 5)
        .map(
          (file) =>
            `${host}/media/company/${companyId}/gallery/${file._savedName}`
        );
    }

    /* ------------------------------------------------------
     * PROFILE AVATAR (SAVE TO COMPANY LOGIN)
     * ------------------------------------------------------ */
    if (req.files?.profileAvatar?.length > 0) {
      const file = req.files.profileAvatar[0];

      await CompanyLogin.findByIdAndUpdate(companyId, {
        profileAvatar: `${host}/media/company/${companyId}/avatar/${file._savedName}`,
      });
    }

    /* ------------------------------------------------------
     * GOOGLE LOCATION
     * ------------------------------------------------------ */
    // Use latitude/longitude if provided
    if (data.latitude && data.longitude) {
      data.googleLocation = {
        type: "Point",
        coordinates: [Number(data.longitude), Number(data.latitude)],
      };
    }
    // Or use googleLocation from JSON
    else if (data.googleLocation && data.googleLocation.coordinates) {
      // Ensure coordinates are numbers
      data.googleLocation.coordinates = data.googleLocation.coordinates.map(Number);
    }

    /* ------------------------------------------------------
     * SYNC BASIC FIELDS WITH COMPANY LOGIN
     * ------------------------------------------------------ */
    const syncMap = {
      companyName: "companyName",
      companyEmail: "companyEmail",
      companyPhone: "phone",
    };

    const loginUpdates = {};
    Object.keys(syncMap).forEach((key) => {
      if (data[key] !== undefined && data[key] !== '') {
        loginUpdates[syncMap[key]] = data[key];
      }
    });

    if (Object.keys(loginUpdates).length > 0) {
      await CompanyLogin.findByIdAndUpdate(companyId, loginUpdates);
    }

    /* ------------------------------------------------------
     * SAVE / UPDATE PROFILE
     * ------------------------------------------------------ */
    let profile;

    if (!existing) {
      data.companyId = companyId;
      profile = await CompanyProfile.create(data);
    } else {
      // Clean up undefined/null values to avoid overwriting with null
      Object.keys(data).forEach(key => {
        if (data[key] === undefined || data[key] === null) {
          delete data[key];
        }
      });
      
      await CompanyProfile.updateOne({ companyId }, { $set: data });
      profile = await CompanyProfile.findOne({ companyId });
    }

    return res.status(200).json({
      success: true,
      message: "Company profile updated successfully",
      profile,
    });

  } catch (error) {
    console.error("❌ UPDATE COMPANY PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while updating profile",
      error: error.message,
    });
  }
};





exports.getRecentDrafts = async (req, res) => {
  try {
    const companyId = req.companyId; // from auth middleware

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized: No companyId found",
      });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch draft jobs
    const drafts = await JobPost.find(
      {
        companyId,
        status: "draft",
      },
      {
        jobTitle: 1,
        jobRole: 1,
        jobCategory: 1,
        jobSubCategory: 1,
        updatedAt: 1,
        createdAt: 1,
        employmentType: 1,
        city: 1,
        state: 1,
        salaryMin: 1,
        salaryMax: 1,
      }
    )
      .sort({ updatedAt: -1 }) // Recent drafts first
      .skip(skip)
      .limit(limit)
      .lean();

    // Count total drafts
    const totalDrafts = await JobPost.countDocuments({
      companyId,
      status: "draft",
    });

    return res.status(200).json({
      success: true,
      message: "Recent draft jobs fetched successfully",
      page,
      limit,
      totalDrafts,
      totalPages: Math.ceil(totalDrafts / limit),
      drafts,
    });
  } catch (error) {
    console.error("Get Recent Drafts Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching drafts",
      error: error.message,
    });
  }
};



exports.getDraftById = async (req, res) => {
  try {
    const companyId = req.companyId;   // from auth middleware
    const jobId = req.params.id;       // from URL params

    if (!companyId || !jobId) {
      return res.status(400).json({
        success: false,
        message: "companyId and jobId are required",
      });
    }

    // ✅ Validate Mongo ObjectId
    if (!mongoose.Types.ObjectId.isValid(jobId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid jobId",
      });
    }

    /* --------------------------------------------------
     * 🔍 FETCH DRAFT JOB (SCHEMA SAFE)
     * -------------------------------------------------- */
    const draft = await JobPost.findOne({
      _id: jobId,
      companyId,

    }).lean();

    if (!draft) {
      return res.status(404).json({
        success: false,
        message: "Draft job not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Draft job fetched successfully",
      draft,
    });

  } catch (error) {
    console.error("❌ Get Draft By ID Error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error while fetching draft job",
      error: error.message,
    });
  }
};






exports.getCompanyProfile = async (req, res) => {
  try {
    const companyId = req.companyId; // from middleware / JWT
    

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    /* --------------------------------------------------
     * 1️⃣ FETCH COMPANY LOGIN INFORMATION
     * -------------------------------------------------- */
    const companyLogin = await CompanyLogin.findById(companyId)
      .select("-password -otp -otpExpiry") // remove sensitive fields
      .lean();

    if (!companyLogin) {
      return res.status(404).json({
        success: false,
        message: "Company login not found",
      });
    }

    /* --------------------------------------------------
     * 2️⃣ FETCH COMPANY PROFILE
     * -------------------------------------------------- */
    const companyProfile = await CompanyProfile.findOne({ companyId })
      .lean();

    // Profile may not exist if company hasn't filled it yet
    if (!companyProfile) {
      return res.status(200).json({
        success: true,
        profileCompleted: false,
        company: companyLogin,
        profile: null,
      });
    }

    /* --------------------------------------------------
     * 3️⃣ SEND COMPLETE COMPANY INFO
     * -------------------------------------------------- */
    return res.status(200).json({
      success: true,
      profileCompleted: true,
      company: companyLogin,
      profile: companyProfile,
    });

  } catch (error) {
    console.error("GET COMPANY PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};



exports.getSingleCompanyProfile = async (req, res) => {
  try {
    const { companyId } = req.params;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    const companyObjectId = new mongoose.Types.ObjectId(companyId);

    /* --------------------------------------------------
     * 1️⃣ FETCH COMPANY LOGIN
     * -------------------------------------------------- */
    const companyLogin = await CompanyLogin.findById(companyId)
      .select("-password -otp -otpExpiry")
      .lean();

    if (!companyLogin) {
      return res.status(404).json({
        success: false,
        message: "Company login not found",
      });
    }

    /* --------------------------------------------------
     * 2️⃣ FETCH VISIBILITY SETTINGS
     * -------------------------------------------------- */
    const visibility = await CompanyProfileVisibility.findOne({
      companyId,
    }).lean();

    /* --------------------------------------------------
     * 3️⃣ FETCH COMPANY PROFILE
     * -------------------------------------------------- */
    const companyProfile = await CompanyProfile.findOne({
      companyId,
    }).lean();

    /* --------------------------------------------------
     * 4️⃣ FETCH ACTIVE JOBS
     * -------------------------------------------------- */
    const companyJobs = await JobPost.find({
      companyId,
      status: "active",
    })
      .sort({ createdAt: -1 })
      .lean();

    /* --------------------------------------------------
     * 5️⃣ JOB COUNTS (ACTIVE + EXPIRED)
     * -------------------------------------------------- */
    const jobCountAgg = await JobPost.aggregate([
      {
        $match: {
          companyId: companyObjectId,
          status: { $in: ["active", "expired"] },
        },
      },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
        },
      },
    ]);

    let activeJobs = 0;
    let expiredJobs = 0;

    jobCountAgg.forEach((j) => {
      if (j._id === "active") activeJobs = j.count;
      if (j._id === "expired") expiredJobs = j.count;
    });

    const totalJobsPosted = activeJobs + expiredJobs;

    /* --------------------------------------------------
     * 6️⃣ SHORTLISTED APPLICATION COUNT
     * -------------------------------------------------- */
    const shortlistedApplicationsCount =
      await JobApplication.countDocuments({
        companyId,
        status: "shortlisted",
      });

    /* --------------------------------------------------
     * 🔐 APPLY VISIBILITY (COMPANY LOGIN)
     * -------------------------------------------------- */
    const companySafe = { ...companyLogin };

    if (visibility) {
      if (visibility.hrName === "private") {
        delete companySafe.name;
      }

      if (visibility.hiringEmail === "private") {
        delete companySafe.email;
        delete companySafe.companyEmail;
      }

      if (visibility.hrPhone === "private") {
        delete companySafe.phone;
        delete companySafe.whatsAppNumber;
      }
    }

    /* --------------------------------------------------
     * 🔐 APPLY VISIBILITY (COMPANY PROFILE)
     * -------------------------------------------------- */
    let profileSafe = companyProfile;

    if (companyProfile && visibility) {
      profileSafe = { ...companyProfile };

      if (visibility.address === "private") {
        delete profileSafe.address;
        delete profileSafe.pincode;
      }

      if (visibility.hiringEmail === "private") {
        delete profileSafe.companyEmail;
      }

      if (visibility.hrPhone === "private") {
        delete profileSafe.companyPhone;
        delete profileSafe.phone;
        delete profileSafe.whatsAppNumber;
      }

      if (visibility.city === "private") delete profileSafe.city;
      if (visibility.state === "private") delete profileSafe.state;
      if (visibility.country === "private") delete profileSafe.country;

      if (visibility.googleLocation === "private") {
        delete profileSafe.googleLocation;
        delete profileSafe.latitude;
        delete profileSafe.longitude;
      }

      if (visibility.yearEstablished === "private")
        delete profileSafe.yearEstablished;

      if (visibility.employeeCount === "private")
        delete profileSafe.employeeCount;

      if (visibility.workingDays === "private")
        delete profileSafe.workingDays;

      if (visibility.workingHours === "private")
        delete profileSafe.workingHours;

      if (visibility.socialLinks && profileSafe.socialLinks) {
        profileSafe.socialLinks = { ...profileSafe.socialLinks };

        Object.keys(visibility.socialLinks).forEach((key) => {
          if (visibility.socialLinks[key] === "private") {
            delete profileSafe.socialLinks[key];
          }
        });
      }
    }

    /* --------------------------------------------------
     * PROFILE NOT CREATED YET
     * -------------------------------------------------- */
    if (!companyProfile) {
      return res.status(200).json({
        success: true,
        profileCompleted: false,
        company: companySafe,
        profile: null,
        jobs: companyJobs,
        jobCounts: {
          totalPosted: totalJobsPosted,
          active: activeJobs,
          expired: expiredJobs,
        },
        shortlistedApplicationsCount,
      });
    }

    /* --------------------------------------------------
     * FINAL RESPONSE
     * -------------------------------------------------- */
    return res.status(200).json({
      success: true,
      profileCompleted: true,
      company: companySafe,
      profile: profileSafe,
      jobs: companyJobs,
      jobCounts: {
        totalPosted: totalJobsPosted,
        active: activeJobs,
        expired: expiredJobs,
      },
      shortlistedApplicationsCount,
    });
  } catch (error) {
    console.error("❌ GET COMPANY PROFILE ERROR:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};





exports.companyLocation = async (req, res) => {
  try {
    const companyId = req.companyId; // from auth middleware
    const { latitude, longitude } = req.body || {};

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    /* -------------------------------------------------
     * 1️⃣ UPDATE LOCATION (if lat & lng provided)
     * ------------------------------------------------- */
    if (latitude !== undefined && longitude !== undefined) {
      if (isNaN(latitude) || isNaN(longitude)) {
        return res.status(400).json({
          success: false,
          message: "latitude and longitude must be numbers",
        });
      }

      const profile = await CompanyProfile.findOneAndUpdate(
        { companyId },
        {
          $set: {
            googleLocation: {
              type: "Point",
              coordinates: [Number(longitude), Number(latitude)], // [lng, lat]
            },
          },
        },
        { new: true }
      );

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: "Company profile not found",
        });
      }

      return res.status(200).json({
        success: true,
        action: "UPDATED",
        message: "Location updated successfully",
        coordinates: {
          latitude: Number(latitude),
          longitude: Number(longitude),
        },
      });
    }

    /* -------------------------------------------------
     * 2️⃣ CHECK LOCATION STATUS (no lat & lng)
     * ------------------------------------------------- */
    const profile = await CompanyProfile.findOne({ companyId })
      .select("googleLocation")
      .lean();

    if (!profile || !profile.googleLocation) {
      return res.status(200).json({
        success: true,
        action: "STATUS",
        isLocationUpdated: false,
        coordinates: null,
      });
    }

    const [lng, lat] = profile.googleLocation.coordinates || [];

    const isLocationUpdated =
      lat !== undefined &&
      lng !== undefined &&
      lat !== 0 &&
      lng !== 0;

    return res.status(200).json({
      success: true,
      action: "STATUS",
      isLocationUpdated,
      coordinates: isLocationUpdated
        ? { latitude: lat, longitude: lng }
        : null,
    });
  } catch (error) {
    console.error("COMPANY LOCATION ERROR:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to process company location",
    });
  }
};






exports.getCompanyProfileStrength = async (req, res) => {
  try {
    const companyId = req.companyId || req.params.companyId;

    if (!companyId) {
      return res.status(400).json({
        success: false,
        message: "companyId is required",
      });
    }

    const profile = await CompanyProfile.findOne({ companyId }).lean();

    if (!profile) {
      return res.status(200).json({
        success: true,
        strength: 0,
        message: "Company profile not created yet",
      });
    }

    /* ----------------------------------------
     * 🧮 SCORING SYSTEM (100 POINTS)
     * -------------------------------------- */
    const scoring = {
      // Brand Identity (15)
      logo: 5,
      coverImage: 5,
      description: 5,

      // Contact & Location (20)
      companyPhone: 5,
      companyEmail: 5,
      address: 5,
      googleLocation: 5,

      // Business Info (15)
      yearEstablished: 5,
      employeeCount: 5,
      businessCategory: 5,

      // HR & Hiring (15)
      hiringEmail: 5,
      hrName: 5,
      hiringProcess: 5,

      // Documents (15)
      gstNumber: 5,
      panNumber: 5,
      registrationCertificate: 5,

      // Social & Media (10)
      socialLinks: 5,
      galleryImages: 5,

      // Work Details (10)
      workingHours: 5,
      workingDays: 5,
    };

    let earnedPoints = 0;
    const totalPoints = Object.values(scoring).reduce((a, b) => a + b, 0);

    /* ----------------------------------------
     * 🔍 FIELD CHECKER
     * -------------------------------------- */
    const isFilled = (val) => {
      if (Array.isArray(val)) return val.length > 0;
      if (typeof val === "object") return val && Object.keys(val).length > 0;
      return val !== undefined && val !== null && String(val).trim() !== "";
    };

    /* ----------------------------------------
     * 🧠 CALCULATE SCORE
     * -------------------------------------- */
    Object.entries(scoring).forEach(([field, score]) => {
      if (field === "googleLocation") {
        if (
          profile.googleLocation?.coordinates &&
          profile.googleLocation.coordinates.length === 2 &&
          !(profile.googleLocation.coordinates[0] === 0 &&
            profile.googleLocation.coordinates[1] === 0)
        ) {
          earnedPoints += score;
        }
      } else if (field === "socialLinks") {
        if (
          profile.socialLinks &&
          Object.values(profile.socialLinks).some(v => isFilled(v))
        ) {
          earnedPoints += score;
        }
      } else if (isFilled(profile[field])) {
        earnedPoints += score;
      }
    });

    const strengthPercentage = Math.round(
      (earnedPoints / totalPoints) * 100
    );

    /* ----------------------------------------
     * ✅ RESPONSE
     * -------------------------------------- */
    return res.json({
      success: true,
      strength: strengthPercentage,
      earnedPoints,
      totalPoints,
    });

  } catch (error) {
    console.error("Profile strength error:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to calculate company profile strength",
    });
  }
};




