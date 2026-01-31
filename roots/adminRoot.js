const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/jwtAuthentication');
const {
    upload: adminUploadFeed,
    processUploadedFiles: attachAdminFeedFiles
} = require('../middlewares/uploadMiddleware');

const {
    newAdmin,
    adminLogin,
    adminSendOtp,
    existAdminVerifyOtp,
    newAdminVerifyOtp,
    adminPasswordReset,
    verifyToken,
    checkAvailability,
    adminLogout,
} = require('../controllers/authenticationControllers/adminAuthController');

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
    getUserProfileDetailforAdmin,
} = require('../controllers/adminControllers/adminUserControllers');

const {
    createPlan,
    updatePlan,
    deletePlan,
    getAllPlans
} = require('../controllers/adminControllers/adminSubscriptionController');

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
    adminGetTrendingFeeds,
} = require('../controllers/creatorControllers/creatorDetailController');

const {
    adminAddCategory,
    deleteCategory,
    updateCategory,
} = require('../controllers/adminControllers/adminCatagoryController');

const {
    getDashboardMetricCount,
    getDashUserRegistrationRatio,
    getDashUserSubscriptionRatio,
} = require('../controllers/adminControllers/dashboardController');

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

const {
    sendAdminNotification,
} = require('../controllers/adminControllers/notificationController');

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

const { getPostVolumeWeekly,
    getPostVolumeDaily,
    getPostVolumeMonthly,
} = require('../controllers/feedControllers/feedVolumController');

const { getDriveDashboard, driveCommand } = require('../controllers/adminControllers/driverStatusController');

const {
    getHelpFAQ,
    createHelpSection,
    updateHelpSection,
    deleteHelpSection,
    bulkCreateHelpFAQ,
} = require("../controllers/adminControllers/adminHelpController");

const { getAllUserFeedback, updateFeedbackStatus } = require('../controllers/feedBackController');

const {
    adminProfileDetailUpdate,
    getAdminProfileDetail,
    getUserProfileDetail,
} = require('../controllers/profileControllers/profileController');

const {
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
} = require('../controllers/userControllers/userFeedController');

const { getAllCategories } = require('../controllers/categoriesController');
const { deleteFeed } = require('../controllers/feedControllers/feedsController');

/* --------------------- Admin Authentication --------------------- */
router.post('/auth/admin/register', auth, newAdmin); // This was CHILD_ADMIN_REGISTER probably
router.post('/auth/admin/login', adminLogin);
router.post('/auth/admin/sent-otp', adminSendOtp);
router.post('/auth/exist/admin/verify-otp', existAdminVerifyOtp);
router.post('/auth/new/admin/verify-otp', newAdminVerifyOtp);
router.post('/auth/admin/reset-password', adminPasswordReset);
router.get('/admin/verify-token', auth, verifyToken);
router.get("/auth/check-availability", checkAvailability);
router.post('/auth/admin/logout', auth, adminLogout);

/* --------------------- Admin Profile API --------------------- */
router.get('/admin/profile', auth, getAdminProfileDetail);

/* --------------------- Admin Feed API --------------------- */
router.post(
    '/admin/feed-upload',
    auth,
    adminUploadFeed.fields([
        { name: "files", maxCount: 20 },
        { name: "audio", maxCount: 1 }
    ]),
    attachAdminFeedFiles,
    adminFeedUpload
);
router.get("/admin/get/all/feed", getAllFeedAdmin);
router.get("/admin/get/trending/creator", adminGetTrendingFeeds); // Match key ADMIN_GET_TRENDING_CREATOR
router.delete("/delete/feed", deleteFeed);

/* --------------------- Admin Category API --------------------- */
router.post('/admin/add/feed/category', adminAddCategory);
router.delete('/admin/feed/category/:id', deleteCategory);
router.get('/admin/get/feed/category', getAllCategories);
router.put('/admin/update/category', updateCategory);

/* --------------------- Admin Subscription API --------------------- */
router.post('/subscription/create', createPlan);
router.put('/subscription/update/:id', updatePlan);
router.delete('/subscription/delete/:id', deletePlan);
router.get('/subscription/all', getAllPlans);

/* --------------------- Admin User API --------------------- */
router.get('/admin/getall/users', getAllUserDetails);
router.get("/admin/search/user", searchAllUserDetails);
router.get('/admin/get/user/social/media/profile/detail/:id', getUserSocialMeddiaDetailWithIdForAdmin);
router.get("/admin/users/status", getUsersStatus);
router.get("/admin/user/detail/by-date", getUsersByDate);
router.get('/admin/user/analytical-count/:userId', getAnaliticalCountforUser);
router.get('/admin/get/user/analytical/data/:userId', getUserAnalyticalData);
router.get("/admin/user/tree/level/:userId", getUserLevelWithEarnings);
router.patch("/admin/block/user/:userId", auth, (req, res, next) => {
    next();
}, require('../controllers/userControllers/userDetailController').blockUserById);
router.get('/admin/user/profile/metricks', getUserProfileDashboardMetricCount);
router.get('/admin/user/likes/:userId', getUserLikedFeedsforAdmin);
router.delete('/admin/delete/user/:userId', deleteUserAndAllRelated);

/* --------------------- User Analytics API --------------------- */
router.get("/summary/:userId", getUserAnalyticsSummary);
router.get("/feeds/:userId", fetchUserFeeds);
router.get("/following/:userId", fetchUserFollowing);
router.get("/interested/:userId", fetchUserInterested);
router.get("/hidden/:userId", fetchUserHidden);
router.get("/liked/:userId", fetchUserLiked);
router.get("/disliked/:userId", fetchUserDisliked);
router.get("/commented/:userId", fetchUserCommented);
router.get("/shared/:userId", fetchUserShared);
router.get("/downloaded/:userId", fetchUserDownloaded);
router.get("/nonInterested/:userId", fetchUserNonInterested);

/* --------------------- Admin DashBoard API --------------------- */
router.get("/admin/dashboard/metricks/counts", getDashboardMetricCount);
router.get("/admin/users/monthly-registrations", getDashUserRegistrationRatio);
router.get("/admin/user/subscriptionration", getDashUserSubscriptionRatio);
router.get('/admin/posts/daily', getPostVolumeDaily);
router.get('/admin/posts/weekly', getPostVolumeWeekly);
router.get('/admin/posts/monthly', getPostVolumeMonthly);

/* --------------------- Admin Creator API --------------------- */
router.get('/admin/getall/creators', require('../controllers/creatorControllers/creatorDetailController').getAllCreatorDetails);

/* --------------------- Admin Sales Dashboard ------------------ */
router.get("/sales/dashboard/analytics", getAnalytics);
router.get("/get/recent/subscribers", getRecentSubscriptionUsers);
router.get("/top/referral/users", getTopReferralUsers);
router.get("/dashboard/user-subscription-counts", getUserAndSubscriptionCountsDaily);

/* --------------------- Admin Report API --------------------- */
router.post("/add/report/questions", addReportQuestion);
router.get("/get/Questions/ByType", getQuestionsByType);
router.patch("/linkNextQuestion", linkNextQuestion);
router.get("/get/QuestionById", getQuestionById);
router.get("/getAllQuestions", getAllQuestions);
router.post("/report-type", createReportType);
router.get("/get/ReportTypes", adminGetReportTypes);
router.patch("/toggleReportType", toggleReportType);
router.delete("/deleteReportType", deleteReportType);
router.delete("/deleteQuestion", deleteQuestion);
router.put("/report/:reportId/status", updateReportStatus);
router.get("/report/:reportId/logs", auth, getReportLogs);
router.get('/user/report', getAllReports);
router.put("/report/action/:reportId", auth, adminTakeActionOnReport);

/* --------------------- Admin Frame Management ----------------- */
router.post("/upload/frame", frameUpload.array("frame"), uploadFrames);
router.get("/get/allframe", getAllFrames);
router.delete("/delete/frame/:id", deleteFrame);

/* --------------------- Admin Notification API ------------------- */
router.post("/send/notification", sendAdminNotification);

/* --------------------- Child Admin Profile API --------------------- */
router.get("/childadmin/list", auth, getChildAdmins);
router.get("/childadmin/permissions/:childAdminId", getChildAdminPermissions);
router.put("/childadmin/permissions/:id", updateChildAdminPermissions);
router.get("/childadmin/:id", getChildAdminById);
router.patch("/block/childadmin/:id", blockChildAdmin);
router.delete("/delete/childadmin/:id", deleteChildAdmin);

/* --------------------- Admin Driver API ---------------------- */
router.get("/drive/dashboard", auth, getDriveDashboard);
router.post("/drive/command", auth, driveCommand);

/* --------------------- Admin Help FAQ --------------------- */
router.post("/help", createHelpSection);
router.put("/help/:id", updateHelpSection);
router.delete("/help/:id", deleteHelpSection);
router.post("/help/bulk", bulkCreateHelpFAQ);
router.get("/help", getHelpFAQ);

/* --------------------- Admin Feedback --------------------- */
router.get("/feedback", getAllUserFeedback);
router.put("/feedback/:id", updateFeedbackStatus);


router.get('/admin/get/user/detail', getUserProfileDetailforAdmin);

module.exports = router;
