const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/jwtAuthentication');
const {
    upload: feedUpload,
    processUploadedFiles: attachFeedFile
} = require("../middlewares/uploadMiddleware");
const { userUpload, attachUserFile } = require("../middlewares/services/userprofileUploadSpydy");

// Controllers
const {
    createNewUser,
    userLogin,
    userSendOtp,
    userPasswordReset,
    existUserVerifyOtp,
    newUserVerifyOtp,
    userLogOut,
    validateReferralCode,
} = require('../controllers/authenticationControllers/userAuthController');

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
    getSingleFeedById,
    getFeedsByCreator,
    deleteFeed,
    getFeedsByHashtag,
    singleFeedById,
} = require('../controllers/feedControllers/feedsController');

const {
    getUserDetailWithId,
    setAppLanguage,
    getAppLanguage,
    getFeedLanguage,
    setFeedLanguage,
    checkUsernameAvailability,
    getUserReferalCode,
    checkEmailAvailability,
} = require('../controllers/userControllers/userDetailController');

const {
    userSelectCategory,
    userNotInterestedCategory,
    userInterestedCategory,
    getNonInterestedCategories,
    removeNonInterestedCategory,
} = require('../controllers/userControllers/userCategoryController');

const {
    getfeedWithCategoryWithId,
    getUserContentCategories,
    searchCategories,
    getCategoriesWithFeeds,
    getFeedLanguageCategories,
    getUserPostCategories,
    getFeedWithCategoryId,
    saveInterestedCategory
} = require('../controllers/categoriesController');

const {
    userProfileDetailUpdate,
    getUserProfileDetail,
    toggleFieldVisibility,
    getVisibilitySettings,
    updateCoverPhoto,
    deleteCoverPhoto,
    getProfileOverview,
    getVisibilitySettingsWeb,
    updateFieldVisibilityWeb,
    getProfileCompletion,
    getProfileByUsername,
    getUserVisibilityByUserId,
} = require('../controllers/profileControllers/profileController');

const {
    likeFeed,
    toggleSaveFeed,
    requestDownloadFeed,
    postComment,
    postReplyComment,
    getUserSavedFeeds,
    getUserDownloadedFeeds,
    shareFeed,
    likeMainComment,
    likeReplyComment,
    getUserLikedFeeds,
    userHideFeed,
    getUserCategory,
    toggleDislikeFeed,
    generateShareLink,
    getVideoThumbnail,
    getDownloadJobStatus,
    directDownloadFeed,
} = require('../controllers/feedControllers/userActionsFeedController');

const {
    subscribePlan,
    cancelSubscription,
    getAllSubscriptionPlans,
    getUserSubscriptionPlanWithId,
    userTrialPlanActive,
    checkUserActiveSubscription,
    checkTrialEligibility,
    createSubscriptionOrder,
    verifySubscriptionPayment,
} = require('../controllers/userControllers/userSubscriptionController');

const {
    getCreatorDetailWithId,
    getAllCreatorDetails,
    getAllTrendingCreators,
} = require('../controllers/creatorControllers/creatorDetailController');

const {
    followAccount,
    unFollowAccount,
    getAccountFollowers,
    getUserFollowersData,
    removeFollower,
    checkFollowStatus
} = require('../controllers/followersControllers.js/followerDetailController');

const {
    creatorSelectCategory,
    creatorUnSelectCategory,
} = require('../controllers/creatorControllers/creatorCategoryController');

const {
    getCommentsByFeed,
    getRepliesForComment,
    getNestedReplies,
    deleteComment,
    deleteReply
} = require('../controllers/conmmentController');

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
    getStartQuestion,
    getNextQuestion,
    getReportTypes,
    createFeedReport,
} = require('../controllers/adminControllers/userReportController');

const {
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
    userPresence,
} = require('../controllers/sessionController');

const {
    getUserEarnings,
    getUserBalance
} = require("../controllers/userControllers/userEarningsController");

const {
    logReferralActivity,
    getReferredPeople,
    getRecentActivities
} = require("../controllers/userControllers/userReferralActivityController");

const {
    getWithdrawalHistory
} = require("../controllers/userControllers/userWithdrawalController");

const { saveUserLocation,
    getUserLocation,
    getUpcomingEvents,
} = require("../controllers/userControllers/userLoactionController");

const {
    getUserFeedsWeb,
} = require("../WebController/UserController/userFeedControllerWeb");

const {
    getUserFollowing,
    getUserFollowers,
} = require("../WebController/UserController/userFolloweController");

const {
    getMyActivities,
} = require("../controllers/userControllers/userActivitController");

const {
    globalSearch
} = require("../controllers/searchController");

const {
    deactivateUser,
    deleteUserNow
} = require("../controllers/userControllers/userDeleteController");

const {
    getTrendingHashtags,
} = require("../controllers/hashTagController");

const {
    getHiddenPosts,
    removeHiddenPost,
} = require("../controllers/userControllers/hiddenPostController");

const { getManiBoardStats } = require('../controllers/mainHomeControlle');
const { getPostInterestStatus,
    requestPostInterest
} = require('../controllers/postIntrestedController');
const { getHelpFAQ } = require('../controllers/adminControllers/adminHelpController');
const { submitUserFeedback, getMyFeedbackAndReports } = require('../controllers/feedBackController');
const { getUpcomingBirthdays } = require('../controllers/adminControllers/adminUserControllers');

/* --------------------- User Authentication --------------------- */
router.post('/register', createNewUser);
router.post('/login', userLogin);
router.post('/sent-otp', userSendOtp);
router.post('/exist/verify-otp', existUserVerifyOtp);
router.post('/new/verify-otp', newUserVerifyOtp);
router.post('/reset-password', userPasswordReset);
router.post('/logout', auth, userLogOut);
router.get('/referral/validate/:code', validateReferralCode);

/* --------------------- User Profile --------------------- */
router.get('/get/profile/detail', auth, getUserProfileDetail);
router.get('/get/single/profile/detail', getUserProfileDetail);
router.post('/post/profile/detail/update', auth, userUpload.single("file"), (req, res, next) => { req.baseUrl = "/profile"; next(); }, attachUserFile, userProfileDetailUpdate);
router.post('/user/profile/cover/update', auth, userUpload.single("coverPhoto"), (req, res, next) => { req.baseUrl = "/cover"; next(); }, attachUserFile, updateCoverPhoto);
router.delete('/user/profile/cover/delete', auth, deleteCoverPhoto);
router.get("/get/profile/overview", auth, getProfileOverview);
router.post("/single/get/profile/overview", getProfileOverview);
router.get("/get/profile/completion", auth, getProfileCompletion);
router.put("/put/profile/visibility", auth, toggleFieldVisibility);
router.get("/get/profile/visibility-settings", auth, getVisibilitySettings);

/* --------------------- User Feed Actions --------------------- */
router.post('/feed/like', auth, likeFeed);
router.post("/feed/dislike", auth, toggleDislikeFeed);
router.post('/feed/save', auth, toggleSaveFeed);
router.post('/feed/share', auth, shareFeed);
router.get('/feed/share-link/:feedId', generateShareLink);
router.get('/feed/thumbnail/:feedId', getVideoThumbnail);
router.get('/feed/liked', auth, getUserLikedFeeds);
router.get('/feed/saved', auth, getUserSavedFeeds);
router.get('/feed/downloaded', auth, getUserDownloadedFeeds);
router.post('/feed/hide', auth, userHideFeed);
router.post('/feed/download-request/:feedId', auth, requestDownloadFeed);
router.get('/feed/direct-download/:feedId', directDownloadFeed);
router.get('/feed/download-status/:jobId', auth, getDownloadJobStatus);

/* --------------------- Categories --------------------- */
router.get('/categories/all', auth, getUserContentCategories);
router.post('/categories/select', auth, userSelectCategory);
router.post('/categories/not-interested', auth, userNotInterestedCategory);
router.post('/categories/interested', auth, userInterestedCategory);
router.post("/categories/begin", auth, saveInterestedCategory);
router.get("/categories/not-interested/list", auth, getUserCategory);

/* --------------------- Follow & Connections --------------------- */
router.post('/follow', auth, followAccount);
router.post('/unfollow', auth, unFollowAccount);
router.get('/following/data', auth, getUserFollowersData);
router.post("/remove-follower", auth, removeFollower);
router.post("/check-follow-status", auth, checkFollowStatus);

/* --------------------- Comments --------------------- */
router.post('/comment', auth, postComment);
router.post('/reply', auth, postReplyComment);
router.post('/comment/like', auth, likeMainComment);
router.post('/reply/like', auth, likeReplyComment);
router.delete("/comment/:commentId", auth, deleteComment);
router.delete("/reply/:replyId", auth, deleteReply);
router.post('/comments/list', auth, getCommentsByFeed);
router.post('/replies/list', auth, getRepliesForComment);
router.post('/replies/nested', auth, getNestedReplies);

/* --------------------- Feed Fetching --------------------- */
router.get("/get/trending/feeds", auth, getTrendingFeeds);
router.get('/get/all/feeds/user', auth, getAllFeedsByUserId);
router.get('/get/feed/with/category/:id', auth, getfeedWithCategoryWithId);
router.get('/get/user/info/associated/feed/:feedId', auth, getUserInfoAssociatedFeed);
router.get('/get/feed/:feedId', auth, getSingleFeedById);
router.get('/get/feeds/by/creator/:feedId', auth, getFeedsByCreator);
router.get('/get/feeds/by/hashtag/:tag', auth, getFeedsByHashtag);
router.post('/feed/view/video/:id', auth, userVideoViewCount);
router.post('/feed/view/image/:id', auth, userImageViewCount);

/* --------------------- Creator Specific --------------------- */
router.post("/creator/feed/upload", auth, feedUpload.single("file"), attachFeedFile, creatorFeedUpload);
router.post("/creator/feed/schedule", auth, feedUpload.single("file"), attachFeedFile, creatorFeedScheduleUpload);
router.get('/creator/feeds/all', auth, getFeedsByAccountId);

/* --------------------- Subscription --------------------- */
router.get('/subscription/plans', getAllSubscriptionPlans);
router.get('/subscription/active', auth, getUserSubscriptionPlanWithId);
router.post('/subscription/subscribe', auth, subscribePlan);
router.put('/subscription/cancel', auth, cancelSubscription);
router.post('/subscription/activate-trial', auth, userTrialPlanActive);
router.get('/subscription/check-active', auth, checkUserActiveSubscription);
router.get('/subscription/trial-eligible', auth, checkTrialEligibility);
router.post('/subscription/create-order', auth, createSubscriptionOrder);
router.post('/subscription/verify-payment', auth, verifySubscriptionPayment);

/* --------------------- Notifications --------------------- */
router.get("/notifications/all", auth, getNotifications);
router.put("/notifications/mark-all-read", auth, markAllRead);
router.put("/notifications/read", auth, markNotificationAsRead);
router.delete("/notifications/delete", auth, deleteNotification);
router.delete("/notifications/clear-all", auth, clearAllNotifications);
router.post("/notifications/save-token", auth, saveToken);

/* --------------------- Miscellaneous --------------------- */
router.get("/search/global", globalSearch);
router.get("/hashtags/trending", getTrendingHashtags);
router.post("/availability/username", checkUsernameAvailability);
router.post("/availability/email", checkEmailAvailability);
router.post("/session/heartbeat", auth, heartbeat);
router.post("/session/presence", auth, userPresence);
router.get("/events/upcoming", auth, getUpcomingEvents);
router.get("/birthdays", getUpcomingBirthdays);
router.post("/feedback/submit", auth, submitUserFeedback);
router.get("/feedback/my", auth, getMyFeedbackAndReports);
router.get("/help/faq", getHelpFAQ);
router.post('/search/all/category', searchCategories)
router.get("/get/feed/category", getCategoriesWithFeeds);
router.post("/save/user/location", auth, saveUserLocation);
router.get('/user/referral/recent-activities', auth, getRecentActivities);
/*--------------UserPostController--------------------------*/
router.get("/post/allowed/status", auth, getPostInterestStatus);
router.post("/post/intrested", auth, requestPostInterest);




module.exports = router;
