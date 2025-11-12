const express = require("express");
const router = express.Router();
const { createJobPost, getAllJobs, getJobById ,getJobsByUserId,deleteJobPost,getRankedJobs,getAllJobsForAdmin} = require("../controllers/JobController/jobpostController");
const { updateEngagement, getJobEngagementStats,getUserEngagements} = require("../controllers/JobController/engagementController");
const upload=require("../middlewares/helper/MulterSetups/jobPostMulterSetup.js");
const {auth}=require("../middlewares/jwtAuthentication.js")
const {deleteJob,approveJob}=require("../controllers/ChildAdminControllers/childAdminJobsController.js");


// User routes
router.post("/user/job/create",auth,upload.single("image"),createJobPost);
router.get("/user/get/all",getAllJobs);
router.get("/get/job/:id", getJobById);
router.delete("/delete/jobs/:jobId",auth,deleteJobPost);
router.get("/get/jobs/by/userId",auth,getJobsByUserId);
router.get("/get/jobs/by/userId/params",getJobsByUserId);
router.get("/top/ranked/jobs", getRankedJobs);

//User Action API
router.post("/update", auth, updateEngagement);
router.get("/stats/:jobId", getJobEngagementStats);
router.get("/user/:userId", auth, getUserEngagements);


//Admin Roots
router.get("/admin/get/all", getAllJobsForAdmin);
router.get("/admin/get/job/:id", getJobById);
router.post("/childadmin/job/approval",auth,approveJob);
router.post("/chiladmin/job/delete",auth,deleteJob);

// Engagement
module.exports = router;
