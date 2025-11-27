const express = require("express");
const router = express.Router();
const { createOrUpdateJob, getAllJobs, getJobById ,getJobsByCompany,deleteJobs,getRankedJobs,getAllJobsForAdmin, getTopRankedJobs} = require("../controllers/JobController/jobpostController");
const { updateEngagement, getJobEngagementStats,getUserEngagements} = require("../controllers/JobController/engagementController");
const upload=require("../middlewares/helper/MulterSetups/jobPostMulterSetup.js");
const {auth}=require("../middlewares/jwtAuthentication.js");
const {getAllJobPostsAdmin}=require("../controllers/adminControllers/JobPost/adminJobPostController.js")
const {deleteJob,approveJob}=require("../controllers/ChildAdminControllers/childAdminJobsController.js");
const {
registerCompany,
loginCompany,
sendOtpAgain,
verifyOtp,
resetPassword,
checkAvailability
}=require("../controllers/authenticationControllers/companyAuthController.js")

const companyUpload=require("../middlewares/utils/jobMulter.js");
const {updateCompanyProfile}=require("../controllers/JobController/CompanyControllers/companyProfileController.js")


//CompanyLogin API
router.post("/company/register",registerCompany);
router.post("/company/login",loginCompany);
router.post("/company/send-otp",sendOtpAgain);
router.post("/company/verify-otp",verifyOtp);
router.post("/company/reset-password",resetPassword);
router.get("/avilability/check", checkAvailability);


//CompanyProfileUpdate
router.put("/update/company/profile",companyUpload.fields([{ name: "logo", maxCount: 1 },{ name: "coverImage", maxCount: 1 }]),updateCompanyProfile);


// User routes
 router.get("/user/get/all",getAllJobs);
 router.get("/get/job/:id", getJobById);
 router.delete("/delete/jobs/:jobId",auth,deleteJobs);
 router.get("/get/jobs/by/id",auth,getJobById);
 router.get("/get/jobs/by/company/params",getJobsByCompany);
 router.get("/top/ranked/jobs", getTopRankedJobs);

//User Action API
router.post("/update", auth, updateEngagement);
router.get("/stats/:jobId", getJobEngagementStats);
router.get("/user/:userId", auth, getUserEngagements);


//Admin Roots
router.get("/admin/get/all", getAllJobPostsAdmin);
router.get("/admin/get/job/:id", getJobById);
router.post("/childadmin/job/approval",auth,approveJob);
router.post("/chiladmin/job/delete",auth,deleteJob);

// Engagement
module.exports = router;
