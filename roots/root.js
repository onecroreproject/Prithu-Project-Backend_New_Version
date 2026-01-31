const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/jwtAuthentication');
const {
    upload: adminUploadFeed,
    processUploadedFiles: attachAdminFeedFiles
} = require('../middlewares/uploadMiddleware');


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
    adminLogout,
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
} = require('../controllers/adminControllers/adminSubscriptionController');

const {
    subscribePlan,
    cancelSubscription,
    getAllSubscriptionPlans,
    getUserSubscriptionPlanWithId,
    userTrialPlanActive,
    checkUserActiveSubscription,
} = require('../controllers/userControllers/userSubscriptionController');

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




const { getDriveDashboard, driveCommand } = require('../controllers/adminControllers/driverStatusController');

const {
    createHelpSection,
    updateHelpSection,
    deleteHelpSection,
    getHelpFAQ,
    bulkCreateHelpFAQ,
} = require("../controllers/adminControllers/adminHelpController");
const { getAllUserFeedback, updateFeedbackStatus } = require('../controllers/feedBackController');





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
router.post('/user/subscription/subscribe', auth, subscribePlan);
router.put('/user/subscription/cancel', auth, cancelSubscription);
router.get('/user/subscription/plans', getAllSubscriptionPlans);
router.get('/user/subscription/active', auth, getUserSubscriptionPlanWithId);
router.post('/user/subscription/activate-trial', auth, userTrialPlanActive);
router.get('/user/subscription/check-active', auth, checkUserActiveSubscription);

/*----------------------User Report -----------------------------*/
router.get("/report-questions/start", getStartQuestion);
router.post("/report-questions/next", getNextQuestion);
router.get("/report-types", getReportTypes);
router.post("/report-post", auth, createFeedReport);
router.get("/report-logs/:reportId", getReportLogs);


/*-------------------------User Session API ---------------------*/
router.post("/refresh-token", refreshAccessToken);
router.post("/heartbeat", auth, heartbeat);



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

















// Migrated to adminRoot.js

// Migrated to userRoot.js and adminRoot.js








/*---------------------Website----------------------------------*/
router.get("/get/profile/overview", auth, getProfileOverview);
router.post("/user/update/visibility/settings", auth, updateFieldVisibilityWeb);
router.get("/user/update/visibility/settings", auth, getVisibilitySettingsWeb);



router.get("/get/user/post", auth, getUserFeedsWeb);
router.get("/user/following", auth, getUserFollowing);
router.get("/user/followers", auth, getUserFollowers);
router.get("/user/profile/completion", auth, getProfileCompletion);







module.exports = router;
