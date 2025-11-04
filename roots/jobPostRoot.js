const express = require("express");
const router = express.Router();
const { createJobPost, getAllJobs, getJobById ,getJobsByUserId,deleteJobPost,getRankedJobs} = require("../controllers/JobController/jobpostController");
const { recordEngagement } = require("../controllers/JobController/engagementController");
const upload=require("../middlewares/helper/MulterSetups/jobPostMulterSetup.js");
const {auth}=require("../middlewares/jwtAuthentication.js")


// User routes
router.post("/user/job/create",auth,upload.single("image"),createJobPost);
router.get("/user/get/all",getAllJobs);
router.get("/get/job/:id", getJobById);
router.delete("/delete/jobs/:jobId",auth,deleteJobPost);
router.get("/get/jobs/by/userId",auth,getJobsByUserId);
router.get("/top/ranked/jobs", getRankedJobs);

//User Action API
router.post("/user/action/engage",recordEngagement);


//Admin Roots
router.get("/admin/get/all", getAllJobs);
router.get("/admin/get/job/:id", getJobById);

// Engagement
module.exports = router;
