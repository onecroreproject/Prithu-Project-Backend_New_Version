const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/jwtAuthentication');
const { adminUploadProfile,
  attachAdminProfileFile,


  // Feed Uploada
  adminUploadFeed,
  adminProcessFeedFile,
  attachAdminFeedFiles,



} = require('../middlewares/services/googleDriveMedia/adminGooleDriveUpload');


const {
  creatorFeedUpload,
  creatorFeedDelete,
  creatorFeedScheduleUpload,

} = require('../controllers/feedControllers/creatorFeedController');

const {
  getAllFeedsByUserId,
  getFeedsByAccountId,
  getUserInfoAssociatedFeed,
  getUserHidePost,
  getTrendingFeeds,
  deleteFeed,

} = require('../controllers/feedControllers/feedsController');

const {
  newAdmin,
  adminLogin,
  adminSendOtp,
  existAdminVerifyOtp,
  newAdminVerifyOtp,
  adminPasswordReset,
  verifyToken,
  checkAvailability,
} = require('../controllers/authenticationControllers/adminAuthController');

const {
  getUserDetailWithId,
  setAppLanguage,
  getAppLanguage,
  getFeedLanguage,
  setFeedLanguage,
  checkUsernameAvailability,
  getUserReferalCode,
  checkEmailAvailability,
  blockUserById,
} = require('../controllers/userControllers/userDetailController');

const {
  userSelectCategory,
  userNotInterestedCategory,
  userInterestedCategory,
} = require('../controllers/userControllers/userCategoryController')

const {
  getfeedWithCategoryWithId,
  getAllCategories,
  getUserContentCategories,
  searchCategories,
  getCategoriesWithFeeds,
  saveInterestedCategory,
  getFeedLanguageCategories,
  getUserPostCategories,
  getFeedWithCategoryId,
} = require('../controllers/categoriesController');

const {
  userProfileDetailUpdate,
  getUserProfileDetail,
  childAdminProfileDetailUpdate,
  adminProfileDetailUpdate,
  getAdminProfileDetail,
  getChildAdminProfileDetail,
  toggleFieldVisibility,
  getVisibilitySettings,
  updateCoverPhoto,
  deleteCoverPhoto,
  getProfileOverview,
  getVisibilitySettingsWeb,
  updateFieldVisibilityWeb,
  getProfileCompletion,
} = require('../controllers/profileControllers/profileController');

const {
  getUsersStatus,
  getUsersByDate,
  getAllUserDetails,
  searchAllUserDetails,
  getAnaliticalCountforUser,
  getUserLikedFeedsforAdmin,
  getUserSocialMeddiaDetailWithIdForAdmin,
  getUserAnalyticalData,
  getUserLevelWithEarnings,
  getUserProfileDashboardMetricCount,
  deleteUserAndAllRelated,
} = require('../controllers/adminControllers/adminUserControllers');

const {
  getUserSavedFeeds,
  getUserDownloadedFeeds,
  getUserLikedFeeds,
  userHideFeed,
  getUserCategory,
  requestDownloadFeed,
  getDownloadJobStatus,
} = require('../controllers/feedControllers/userActionsFeedController');





const {
  createPlan,
  updatePlan,
  deletePlan,
  getAllPlans
} = require('../controllers/adminControllers/adminSubcriptionController');

const {
  subscribePlan,
  cancelSubscription,
  getAllSubscriptionPlans,
  getUserSubscriptionPlanWithId,
  userTrailPlanActive,
  checkUserActiveSubscription,
} = require('../controllers/userControllers/userSubcriptionController');

const {
  adminFeedUpload,
  childAdminFeedUpload,
  getAllFeedAdmin,
  getUsersWillingToPost,
  updateUserPostPermission,
  bulkFeedUpload,
  getUploadProgress,
} = require('../controllers/adminControllers/adminfeedController');

const {
  getCreatorDetailWithId,
  getAllCreatorDetails,
  getAllTrendingCreators,
  adminGetTrendingFeeds,
} = require('../controllers/creatorControllers/creatorDetailController');

const {
  followAccount,
  unFollowAccount,
  getAccountFollowers,
  getUserFollowersData,
} = require('../controllers/followersControllers.js/followerDetailController');

const {
  adminAddCategory,
  deleteCategory,
  updateCategory,
} = require('../controllers/adminControllers/adminCatagoryController');




const {
  getCommentsByFeed,
  getRepliesForComment,
} = require('../controllers/conmmentController')


const {
  userVideoViewCount,
  userImageViewCount,
  fetchUserFeeds,
  fetchUserFollowing,
  fetchUserInterested,
  fetchUserHidden,
  fetchUserLiked,
  fetchUserDisliked,
  fetchUserCommented,
  fetchUserShared,
  fetchUserDownloaded,
  getUserAnalyticsSummary,
  fetchUserNonInterested,
  getUserdetailWithinTheFeed,
  getUserPost,
} = require('../controllers/userControllers/userFeedController');

const {
  getDashboardMetricCount,
  getDashUserRegistrationRatio,
  getDashUserSubscriptionRatio,
} = require('../controllers/adminControllers/dashboardController');



const {
  getStartQuestion,
  getNextQuestion,
  getReportTypes,
  createFeedReport,
} = require('../controllers/adminControllers/userReportController');

const {
  sendAdminNotification,
  notifyUserFollow,
  getNotifications,
  markNotificationAsRead,
  saveToken,
  markAllRead,
  clearAllNotifications,
  deleteNotification,
} = require('../controllers/adminControllers/notificationController');

const {
  refreshAccessToken,
  heartbeat,
} = require('../controllers/sessionController')

const {
  getChildAdmins,
  getChildAdminPermissions,
  updateChildAdminPermissions,
  getChildAdminById,
  blockChildAdmin,
  deleteChildAdmin,

} = require('../controllers/adminControllers/adminChildAdminController');

const {
  getAnalytics,
  getRecentSubscriptionUsers,
  getTopReferralUsers,
  getUserAndSubscriptionCountsDaily,
} = require("../controllers/adminControllers/SalesDashboard/salesDashboardMetricksController");

const {
  uploadFrames,
  getAllFrames,
  deleteFrame,
} = require("../controllers/adminControllers/frameController");

const { frameUpload } = require("../middlewares/helper/frameUpload");



const { getUserEarnings } = require("../controllers/userControllers/userEarningsController");

const { saveUserLocation,
  getUserLocation,
} = require("../controllers/userControllers/userLoactionController");


/*-----------------Web Controller ------------------*/
const {
  getUserFeedsWeb,
} = require("../WebController/UserController/userFeedControllerWeb");

const {
  getUserFollowing,
  getUserFollowers,
} = require("../WebController/UserController/userFolloweController");


const {
  addReportQuestion,
  getQuestionsByType,
  createReportType,
  adminGetReportTypes,
  updateReportStatus,
  getReportLogs,
  getQuestionById,
  deleteQuestion,
  toggleReportType,
  deleteReportType,
  getReports,
  linkNextQuestion,
  adminTakeActionOnReport,
  getAllQuestions,
  getAllReports
} = require("../controllers/adminControllers/adminReportController");
const { getPostVolumeWeekly,
  getPostVolumeDaily,
  getPostVolumeMonthly,
} = require('../controllers/feedControllers/feedVolumController');



const {
  getDashboardStats,
  getSystemStatus,
  getRecentTests,
  getUpcomingTests,
  exportTestResults,
  getTopPerformers,
  createTestSchedule,
  getAllTestSchedules,
  getSingleTestSchedule,
  updateTestSchedule,
  deleteTestSchedule,
  getUpcomingTestInterestedCandidates,
} = require("../controllers/aptitudeController");
const { getJobDashboardStats } = require('../controllers/companyDashboardController');
const { getAllCompanies,
  getCompanyById,
  inactivateCompany,
  removeCompany,
  activateCompany,
} = require('../controllers/adminCompany/adminCompanyController');
const { getAllJobs,
  approveJob,
  rejectJob,
  deleteJob,
  suspendJob,
  getJobByIdforAdmin,
} = require('../controllers/adminCompany/adminJobController');
const { getDriveDashboard, driveCommand } = require('../controllers/adminControllers/driverStatusController');

const {
  createHelpSection,
  updateHelpSection,
  deleteHelpSection,
  getHelpFAQ,
  bulkCreateHelpFAQ,
} = require("../controllers/adminControllers/adminHelpController");
const { getAllUserFeedback, updateFeedbackStatus } = require('../controllers/feedBackController');


const {
  upsertPrithuCompany,
  getPrithuCompany,
  togglePrithuCompanyStatus,
} = require("../controllers/adminControllers/companyDetailController");



// /* --------------------- User Referral API Actions --------------------- */
router.get('/user/referal/code', auth, getUserReferalCode);


// /* --------------------- Fresh Users API --------------------- */
router.post('/user/app/language', auth, setAppLanguage);
router.get('/user/get/app/language', auth, getAppLanguage);
router.post('/user/feed/language', auth, setFeedLanguage);
router.get('/user/get/feed/language', auth, getFeedLanguage);
router.get('/user/get/content/catagories', auth, getUserContentCategories);
router.post('/user/select/category', auth, userSelectCategory);
router.get("/check/username/availability", checkUsernameAvailability);
router.get("/check/email/availability", checkEmailAvailability);



// /* --------------------- User Feed Get Actions --------------------- */
router.get('/user/get/saved/feeds', auth, getUserSavedFeeds);


router.get('/user/liked/feeds', auth, getUserLikedFeeds);

router.post('/get/comments/for/feed', auth, getCommentsByFeed);
router.post('/get/comments/relpy/for/feed', auth, getRepliesForComment);
router.post('/user/hide/feed', auth, userHideFeed);
router.get("/user/notintrested/category", auth, getUserCategory);
router.get("/get/user/detail/at/feed/icon", auth, getUserdetailWithinTheFeed);

// /* --------------------- User Subscription --------------------- */
router.post('/user/plan/subscription', auth, subscribePlan);
router.put('/user/cancel/subscription', auth, cancelSubscription);
router.get('/user/getall/subscriptions', getAllPlans);
router.get('/user/user/subscriptions', auth, getUserSubscriptionPlanWithId);
router.post('/user/activate/trial/plan', auth, userTrailPlanActive);
router.get('/user/check/active/subcription', auth, checkUserActiveSubscription);

/*----------------------User Report -----------------------------*/
router.get("/report-questions/start", getStartQuestion);
router.post("/report-questions/next", getNextQuestion);
router.get("/report-types", getReportTypes);
router.post("/report-post", auth, createFeedReport);
router.get("/report-logs/:reportId", getReportLogs);


/*-------------------------User Session API ---------------------*/
router.post("/refresh-token", refreshAccessToken);
router.post("/heartbeat", auth, heartbeat);

/* --------------------- User Subscription --------------------- */
router.get('/user/user/subscriptions', auth, getUserSubscriptionPlanWithId);

/*---------------------- User Feed API -------------------------*/

router.get("/get/trending/feed", auth, getTrendingFeeds);
router.get('/get/all/feeds/user', auth, getAllFeedsByUserId);
router.post('/user/watching/vidoes', auth, userVideoViewCount);
router.post('/user/image/view/count', auth, userImageViewCount);
router.get('/user/get/feed/with/cat/:id', auth, getfeedWithCategoryWithId);
router.get('/user/get/feed/with/search/cat/:categoryId', getFeedWithCategoryId);
router.get('/get/creator/detail/feed/:feedId', auth, getUserInfoAssociatedFeed);
router.get('/get/user/hide/post', auth, getUserHidePost);

router.get("/user/list/willingtopost", getUsersWillingToPost);
router.put("/update/user/post/status/:userId", updateUserPostPermission);





router.post('/user/get/post', getUserPost);
router.get('/user/get/feed/category', auth, getFeedLanguageCategories);
router.get('/user/get/all/category', getUserPostCategories);

/* --------------------- User Follower API --------------------- */
router.post('/user/follow/creator', followAccount);
router.post('/user/unfollow/creator', unFollowAccount);
router.get('/user/following/data', auth, getUserFollowersData);

/* --------------------- User Notifiction API --------------------- */
router.post("/admin/send/notification", sendAdminNotification)


// router.post("/user/follow", auth, notifyUserFollow);
router.put("/mark/all/notification/read", auth, markAllRead);
router.get("/get/user/all/notification", auth, getNotifications);
router.delete("/user/delete/notification", auth, deleteNotification);
router.delete("/user/delete/all/notification", auth, clearAllNotifications);
router.put("/user/read", auth, markNotificationAsRead);
router.post("/notifications/save-token", auth, saveToken);
router.delete("/user/cover/photo/delete", auth, deleteCoverPhoto);
router.get('/get/profile/detail', auth, getUserProfileDetail);

/* --------------------- User Earnings API --------------------- */

router.get('/get/userearnigs/referrals', getUserEarnings);

/*-----------------------User Location API ---------------------*/
router.post("/save/user/location", auth, saveUserLocation);
router.get("/get/user/location", auth, getUserLocation);
















/* --------------------- Admin Authentication --------------------- */
router.post('/auth/admin/register', auth, newAdmin);
router.post('/auth/admin/login', adminLogin);
router.post('/auth/admin/sent-otp', adminSendOtp);
router.post('/auth/exist/admin/verify-otp', existAdminVerifyOtp);
router.post('/auth/new/admin/verify-otp', newAdminVerifyOtp);
router.post('/auth/admin/reset-password', adminPasswordReset);
router.get('/api/admin/verify-token', auth, verifyToken);
router.get("/auth/check-availability", checkAvailability);


/* --------------------- Admin Profile API --------------------- */
// router.put(
//   "/admin/profile/detail/update",
//   auth,
//   adminUploadProfile.single("file"),
//   attachAdminProfileFile,
//   adminProfileDetailUpdate
// );

// router.get('/get/admin/profile',auth,getAdminProfileDetail);

/* --------------------- Admin Feed API --------------------- */
// Admin feed upload with design metadata
router.post(
  "/admin/feed-upload",
  auth,
  adminUploadFeed.fields([
    { name: "files", maxCount: 20 },  // image/video
    { name: "audio", maxCount: 1 }    // optional audio
  ])
  , // Accept multiple files
  adminProcessFeedFile,
  attachAdminFeedFiles,
  adminFeedUpload
);

// // Bulk feed upload endpoint
// router.post(
//   "/admin/feed/bulk-upload",
//   auth,
//   adminUploadFeed.array("files", 50),
//   adminProcessFeedFile,
//   attachAdminFeedFiles,
//   bulkFeedUpload
// );

// Get upload progress
// router.get("/admin/upload/progress/:uploadId", auth,getUploadProgress);


// router.post(
//   "/admin/schedule-feed",
//   auth,
//   adminUploadFeed.array("file"),
//   (req, res, next) => {
//     req.baseUrl = "/feed";
//     next();
//   },
//   adminProcessFeedFile,
//   attachAdminFeedFiles,
//   adminFeedUpload 
// );

router.get("/admin/get/all/feed", getAllFeedAdmin);
router.delete("/delete/feed", deleteFeed);

/* --------------------- Admin Category API --------------------- */
router.post('/admin/add/feed/category', adminAddCategory);
router.delete('/admin/feed/category/:id', deleteCategory);
router.get('/admin/get/feed/category', getAllCategories);
router.put('/admin/update/category', updateCategory);

/* --------------------- Admin Subscription API --------------------- */
router.post('/admin/create/subscription', createPlan);
router.put('/admin/update/subscription/:id', updatePlan);
router.delete('/admin/delete/subscription/:id', deletePlan);
router.get('/admin/getall/subscriptions', getAllPlans);

/* --------------------- Admin User API --------------------- */
router.get('/admin/getall/users', getAllUserDetails);
router.get("/admin/search/user", searchAllUserDetails);
router.get('/admin/get/user/social/media/profile/detail/:id', getUserSocialMeddiaDetailWithIdForAdmin);
router.get("/admin/users/status", getUsersStatus);
router.get("/admin/user/detail/by-date", getUsersByDate);
router.get('/admin/user/action/intersection/count/:userId', getAnaliticalCountforUser);
router.get('/admin/get/user/analytical/data/:userId', getUserAnalyticalData);
router.get("/admin/user/tree/level/:userId", getUserLevelWithEarnings);
router.patch("/admin/block/user/:userId", blockUserById);
router.get('/admin/user/profile/metricks', getUserProfileDashboardMetricCount);
router.get('/admin/user/likes/:userId', getUserLikedFeedsforAdmin);
router.delete('/admin/delete/user/:userId', deleteUserAndAllRelated);

router.get("/feeds/:userId", fetchUserFeeds);
router.get("/following/:userId", fetchUserFollowing);
router.get("/interested/:userId", fetchUserInterested);
router.get("/hidden/:userId", fetchUserHidden);
router.get("/liked/:userId", fetchUserLiked);
router.get("/disliked/:userId", fetchUserDisliked);
router.get("/commented/:userId", fetchUserCommented);
router.get("/shared/:userId", fetchUserShared);
router.get("/downloaded/:userId", fetchUserDownloaded);
router.get("/summary/:userId", getUserAnalyticsSummary);
router.get("/nonInterested/:userId", fetchUserNonInterested);



// /*-------------------Admin Report API -------------------------*/
router.post("/admin/add/report/questions", addReportQuestion);
router.get("/admin/get/Questions/ByType", getQuestionsByType);
router.patch("/admin/linkNextQuestion", linkNextQuestion);
router.get("/admin/get/QuestionById", getQuestionById);
router.get("/admin/getAllQuestions", getAllQuestions);
router.post("/admin/report-type", createReportType);
router.get("/admin/get/ReportTypes", adminGetReportTypes);
router.patch("/admin/toggleReportType", toggleReportType);
router.delete("/admin/deleteReportType", deleteReportType);
router.delete("/admin/deleteQuestion", deleteQuestion);
router.put("/:reportId/status", updateReportStatus);
router.get("/:reportId/logs", auth, getReportLogs);
router.get('/admin/user/report', getAllReports);
router.put("/admin/report/action/update/:reportId", auth, adminTakeActionOnReport);


/*---------------------Admin DashBoard API---------------------*/
router.get("/admin/dashboard/metricks/counts", getDashboardMetricCount);
router.get("/admin/users/monthly-registrations", getDashUserRegistrationRatio);
router.get('/posts/daily', getPostVolumeDaily);

// GET /api/metrics/posts/weekly
router.get('/posts/weekly', getPostVolumeWeekly);
router.get('/posts/monthly', getPostVolumeMonthly);
router.get("/admin/user/subscriptionration", getDashUserSubscriptionRatio)

// /* --------------------- Admin Creator API --------------------- */
router.get('/admin/getall/creators', getAllCreatorDetails);
router.get('/admin/get/user/detail', getUserProfileDetail);
router.get('/admin/get/trending/creator', getAllTrendingCreators);
// router.get("/admin/users/status", getUserStatus);
// router.get("/admin/user/detail/by-date", getUsersByDate);


/*---------------------------Admin Feed ________________________*/
router.get("/admin/get/trending/feed", adminGetTrendingFeeds)

/*----------------------Admin Sales Dashboard------------------*/
router.get("/sales/dashboard/analytics", getAnalytics);
router.get("/get/recent/subscribers", getRecentSubscriptionUsers);
router.get("/top/referral/users", getTopReferralUsers);
router.get("/dashboard/user-subscription-counts", getUserAndSubscriptionCountsDaily);


/*---------------------Admin Frame Management-----------------*/
router.post("/upload/frame", frameUpload.array("frame"), uploadFrames);
router.get("/get/allframe", getAllFrames);
router.delete("/delete/frame/:id", deleteFrame)

/*-------------------AdminCompny---------------------------*/
router.get("/get/comapany/status", getJobDashboardStats);
router.get("/get/all/companies", getAllCompanies);
router.delete('/companies/:companyId', removeCompany);
router.put('/companies/:companyId/suspend', inactivateCompany);
router.put('/companies/:companyId/activate', activateCompany);
router.get('/companies/:companyId', getCompanyById);


/*----------------AdminJos--------------------------------- */
router.get("/get/all/company/jobs", getAllJobs)
router.put('/jobs/:jobId/approve', approveJob);
router.put('/jobs/:jobId/suspend', suspendJob);
router.put("/jobs/:jobId/reject", rejectJob);
router.get("/admin/get/job/:jobId", getJobByIdforAdmin);




/*--------------------Admin Aptitude--------------------------*/
router.get("/aptitude/dashboard/stats", getDashboardStats);
router.get("/aptitude/system/status", getSystemStatus);
router.get("/aptitude/tests/recent", getRecentTests);
router.get("/aptitude/tests/upcoming", getUpcomingTests);
router.get("/aptitude/tests/:testId/export", exportTestResults);
router.get("/aptitude/results/top-performers", getTopPerformers);
router.post("/aptitude/create/test/schedule", createTestSchedule);
router.get("/get/all/aptitude/test", getAllTestSchedules);
router.put("/aptitude/test/update/:scheduleId", updateTestSchedule);
router.delete("/delete/aptitude/test/:scheduleId", deleteTestSchedule);
router.get("/get/single/schedule/:scheduleId", getSingleTestSchedule);
router.get("/analitycal/detail/for/test/:scheduleId", getUpcomingTestInterestedCandidates);


/*---------------------Admin Notification API-------------------*/
// router.post("/admin/post/notification",adminSentNotification);

/* --------------------- Child Admin Profile API --------------------- */
router.get("/admin/childadmin/list", auth, getChildAdmins);
router.get("/admin/childadmin/permissions/:childAdminId", getChildAdminPermissions);
router.put("/admin/childadmin/permissions/:id", updateChildAdminPermissions);
// router.put(
//   "/child/admin/profile/detail/update",
//   auth,
//   adminUploadProfile.single("file"),
//   attachAdminProfileFile,
//   childAdminProfileDetailUpdate
// );

router.get("/child/admin/:id", getChildAdminById);
router.patch("/block/child/admin/:id", blockChildAdmin);
router.delete("/delete/child/admin/:id", deleteChildAdmin);


/* --------------------- Category API --------------------- */
router.post('/search/all/category', searchCategories)
router.get("/get/feed/category", getCategoriesWithFeeds);


/*----------------------ProfileUpdate-------------------*/
router.put("/profile/toggle-visibility", auth,
  toggleFieldVisibility
);

router.get(
  "/profile/visibility", auth,
  getVisibilitySettings
);


/*---------------Admin Driver API----------------------*/
router.get("/admin/drive/dashboard", auth, getDriveDashboard);
router.post("/admin/drive/command", auth, driveCommand);



// Admin
router.post("/admin/help", createHelpSection);
router.put("/admin/help/:id", updateHelpSection);
router.delete("/admin/help/:id", deleteHelpSection);
router.post("/admin/help/bulk", bulkCreateHelpFAQ);
router.get("/help", getHelpFAQ);


// Admin
router.get("/admin/feedback", getAllUserFeedback);
router.put("/admin/feedback/:id", updateFeedbackStatus);



router.post("/admin/company", upsertPrithuCompany);
router.patch("/admin/company/status", togglePrithuCompanyStatus);
router.get("/company", getPrithuCompany);





/*---------------------Website----------------------------------*/
router.get("/get/profile/overview", auth, getProfileOverview);
router.post("/user/update/visibility/settings", auth, updateFieldVisibilityWeb);
router.get("/user/update/visibility/settings", auth, getVisibilitySettingsWeb);



router.get("/get/user/post", auth, getUserFeedsWeb);
router.get("/user/following", auth, getUserFollowing);
router.get("/user/followers", auth, getUserFollowers);
router.get("/user/profile/completion", auth, getProfileCompletion);




// const Users=require("../models/userModels/userModel")



// // Set all users isOnline = false
// const setAllUsersOffline = async () => {
//   try {
//     const result = await Users.updateMany(
//       {},                     // match ALL documents
//       { $set: { isOnline: false } } // update field
//     );



//   } catch (error) {
//     console.error("Error updating users:", error);
//     return res.status(500).json({
//       success: false,
//       message: "Failed to update users",
//       error: error.message,
//     });
//   }
// };



// setAllUsersOffline()



// const computeTrendingCreators = require("../middlewares/computeTreandingCreators");

// computeTrendingCreators()






// // encode.js
// const fs = require("fs");

// const json = fs.readFileSync("../be/token.json", "utf8");
// const encoded = Buffer.from(json).toString("base64");

// console.log(encoded);



module.exports = router;
