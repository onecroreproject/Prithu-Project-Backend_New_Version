const express = require("express");
const router = express.Router();
const { createOrUpdateJob, getAllJobs, getJobById ,getJobsByCompany,deleteJobs,getRankedJobs,getAllJobsForAdmin, getTopRankedJobs} = require("../controllers/JobController/jobpostController");
const { updateEngagement, getJobEngagementStats,getUserEngagements} = require("../controllers/JobController/engagementController");
const {companyJobUpload}=require("../middlewares/services/JobsService/jobImageUploadSpydy.js");
const {auth}=require("../middlewares/jwtAuthentication.js");
const {getAllJobPostsAdmin}=require("../controllers/adminControllers/JobPost/adminJobPostController.js")
const {deleteJob,approveJob}=require("../controllers/ChildAdminControllers/childAdminJobsController.js");
const {
registerCompany,
loginCompany,
sendOtp,
verifyOtp,
resetPassword,
checkAvailability
}=require("../controllers/authenticationControllers/companyAuthController.js")
const {companyAuth}=require("../middlewares/jwtCompany.js")
const {companyUpload}=require("../middlewares/services/JobsService/companyUploadSpydy.js");
const {updateCompanyProfile,getRecentDrafts,getDraftById,
    getCompanyProfile,getSingleCompanyProfile
}=require("../controllers/JobController/CompanyControllers/companyProfileController.js");
const { getCompanyApplicants, updateApplicationStatus, getRecentCompanyActivities, getCompanyJobStats, getTopPerformingJobs } = require("../controllers/JobController/CompanyControllers/companyJobCotroller.js");


//CompanyLogin API
router.post("/company/register",registerCompany);
router.post("/company/login",loginCompany);
router.post("/company/send-otp",sendOtp);
router.post("/company/verify-otp",verifyOtp);
router.post("/company/reset-password",resetPassword);
router.get("/avilability/check", checkAvailability);


//CompanyProfileUpdate
router.put(
  "/update/company/profile",
  companyAuth,
  companyUpload.fields([
    { name: "logo", maxCount: 1 },
    { name: "coverImage", maxCount: 1 },
    { name: "profileAvatar", maxCount: 1 }
  ]),
  updateCompanyProfile
);

router.post(
  "/company/create/job",
  companyAuth,
  companyJobUpload.single("jobImage"),
  createOrUpdateJob
);

 router.get("/get/jobs/by/company/",companyAuth,getJobsByCompany);
router.get("/get/draft/jobs/:id",getDraftById);
 router.delete("/delete/jobs/:jobId",companyAuth,deleteJobs);
router.get("/get/company/profile",companyAuth,getCompanyProfile);
router.get("/get/single/company/profile/:companyId",getSingleCompanyProfile);
 router.get("/get/recent/drafts",companyAuth,getRecentDrafts);
router.get("/get/company/applicatns",companyAuth,getCompanyApplicants);
router.put("/update/application/status",companyAuth,updateApplicationStatus);
router.get("/company/activity/status",companyAuth,getRecentCompanyActivities);
router.get("/get/company/stats",companyAuth,getCompanyJobStats);
router.get("/get/top/performing/job",companyAuth,getTopPerformingJobs);


// User routes
 router.get("/user/get/all",auth,getAllJobs);
 router.get("/get/jobs/by/id/:id",auth,getJobById);
 router.get("/top/ranked/jobs", auth,getTopRankedJobs);

//User Action API
router.post("/update", auth, updateEngagement);
router.get("/stats/:jobId",auth, getJobEngagementStats);
router.get("/user/:userId", auth, getUserEngagements);


//Admin Roots
router.get("/admin/get/all", getAllJobPostsAdmin);
router.get("/admin/get/job/:id", getJobById);
router.post("/childadmin/job/approval",auth,approveJob);
router.post("/chiladmin/job/delete",auth,deleteJob);

// Engagement
module.exports = router;
