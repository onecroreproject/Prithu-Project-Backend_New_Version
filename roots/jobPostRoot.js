const express = require("express");
const router = express.Router();
const { createJobPost, getAllJobs, getJobById } = require("../controllers/JobController/jobpostController");
const { recordEngagement } = require("../controllers/JobController/engagementController");


// User routes
router.post("/user/job/create",createJobPost);
router.get("/user/get/all", getAllJobs);
router.get("/get/job/:id", getJobById);

//User Action API
router.post("/user/action/engage",recordEngagement);


//Admin Roots
router.get("/admin/get/all", getAllJobs);
router.get("/admin/get/job/:id", getJobById);

// Engagement
module.exports = router;
