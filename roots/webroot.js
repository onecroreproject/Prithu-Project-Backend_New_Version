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
    newAdmin,
    adminLogin,
    adminSendOtp,
    existAdminVerifyOtp,
    newAdminVerifyOtp,
    adminPasswordReset,
    verifyToken,
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
    getNonInterestedCategories,
    removeNonInterestedCategory
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
    getProfileByUsername,
    getUserVisibilityByUserId,
} = require('../controllers/profileControllers/profileController');

const {
    getUsersStatus,
    getUsersByDate,
    getAllUserDetails,
    getAnaliticalCountforUser,
    getUserLikedFeedsforAdmin,
    getUserDetailWithIdForAdmin,
    getUserAnalyticalData,
    getUserLevelWithEarnings,
    getUserProfileDashboardMetricCount,
    getReports,
    deleteUserAndAllRelated,
    getUpcomingBirthdays,
} = require('../controllers/adminControllers/adminUserControllers');

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
    sharePostOG,
    getDownloadJobStatus,
    directDownloadFeed,
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
    checkTrialEligibility,
    createSubscriptionOrder,
    verifySubscriptionPayment,
} = require('../controllers/userControllers/userSubscriptionController');

const {
    adminFeedUpload,
    childAdminFeedUpload,
    getAllFeedAdmin,
} = require('../controllers/adminControllers/adminfeedController');

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
    removeFollower
    , checkFollowStatus
} = require('../controllers/followersControllers.js/followerDetailController');

const {
    adminAddCategory,
    deleteCategory,
    updateCategory,
} = require('../controllers/adminControllers/adminCatagoryController');



const {
    creatorSelectCategory,
    creatorUnSelectCategory,
} = require('../controllers/creatorControllers/creatorCategoryController')


const {
    getCommentsByFeed,
    getRepliesForComment,
    getNestedReplies,
    deleteComment,
    deleteReply
    ,
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
} = require('../controllers/userControllers/userFeedController');

const {
    getDashboardMetricCount,
    getDashUserRegistrationRatio,
    getDashUserSubscriptionRatio,
} = require('../controllers/adminControllers/dashboardController');



const {
    addReportQuestion,
    createReportType,
    getStartQuestion,
    getNextQuestion,
    getReportTypes,
    createFeedReport,
    updateReportStatus,
    getReportLogs,
    adminTakeActionOnReport,
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
    userPresence,
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


/*-----------------Web Controller ------------------*/
const {
} = require("../WebController/UserController/userFeedControllerWeb");

const {
    getUserFollowing,
    getUserFollowers,
} = require("../WebController/UserController/userFolloweController");
const User = require("../models/userModels/userModel")
const {
    createOrGetProfile,
    getFullProfile,
    addEducation,
    updateEducation,
    deleteEducation,
    addExperience,
    updateExperience,
    deleteExperience,
    addSkill,
    updateSkill,
    deleteSkill,
    addCertification,
    deleteCertification,
    updateCertification,
    addOrUpdateProject,
    getUserProjects,
    deleteProject,
    checkCurriculumStatus,
} = require("../controllers/userControllers/userCurriculamController");


const {
    togglePublish,
    getPublicResume,
    getPublicPortfolio,
} = require("../controllers/userControllers/userResumeController");

const {
    getMyActivities,
} = require("../controllers/userControllers/userActivitController");

const {
    globalSearch
} = require("../controllers/searchController");


const {
    deactivateUser,
    deleteUserNow

} = require("../controllers/userControllers/userDeleteController")


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




// /* --------------------- User Authentication --------------------- */
// Migrated to userRoot.js (Auth, Referral, Feed, Notification, Profile)


/*--------------UserPostController--------------------------*/
router.get("/post/allowed/status", auth, getPostInterestStatus);
router.post("/post/intrested", auth, requestPostInterest);

/* --------------------- User Profile API --------------------- */


router.post(
    "/user/profile/detail/update",
    auth,
    userUpload.single("file"),
    (req, res, next) => { req.baseUrl = "/profile"; next(); },
    attachUserFile,
    userProfileDetailUpdate
);





router.post(
    "/user/profile/cover/update",
    auth,
    userUpload.single("coverPhoto"),
    (req, res, next) => { req.baseUrl = "/cover"; next(); },
    attachUserFile,
    updateCoverPhoto
);


router.delete("/user/cover/photo/delete", auth, deleteCoverPhoto);
router.get('/get/profile/detail', auth, getUserProfileDetail);
router.get('/get/single/profile/detail', getUserProfileDetail);

/* --------------------- User Earnings API --------------------- */


/*-----------------------User Location API ---------------------*/
router.post("/save/user/location", auth, saveUserLocation);
router.get("/get/user/location", auth, getUserLocation);


router.get("/get/upcomming/events", auth, getUpcomingEvents);

















// Migrated to adminRoot.js






/*---------------------Website----------------------------------*/
router.get("/get/profile/overview", auth, getProfileOverview);
router.post("/single/get/profile/overview", getProfileOverview);
router.post("/user/update/visibility/settings", auth, updateFieldVisibilityWeb);
router.get("/user/get/visibility/settings", auth, getVisibilitySettingsWeb);
router.post("/individual/user/visibility/settings", getUserVisibilityByUserId);



router.get("/user/following", auth, getUserFollowing);
router.get("/user/followers", auth, getUserFollowers);
router.get("/single/user/following", getUserFollowing);
router.get("/single/user/followers", getUserFollowers);
router.get("/user/profile/completion", auth, getProfileCompletion);

// ✅ Profile
router.post("/create", createOrGetProfile);
router.get("/get/full/curriculam/profile", auth, getFullProfile);
router.get("/user/curicullam/status", auth, checkCurriculumStatus)

// ✅ Education
router.post("/profile/education", auth, addEducation);
router.put("/profile/education/:userId/:educationId", auth, updateEducation);
router.delete("/education/profile/delete/:userId/:educationId", auth, deleteEducation);

// ✅ Experience
router.post("/user/job/experience", auth, addExperience);
router.put("/user/job/experience/:userId/:experienceId", auth, updateExperience);
router.delete("/user/job/experience/detele/:userId/:experienceId", auth, deleteExperience);

// ✅ Skills
router.post("/user/education/skill", auth, addSkill);
router.put("/user/eduction/skill/:userId/:skillId", auth, updateSkill);
router.delete("/user/eduction/skill/delete/:userId/:skillId", auth, deleteSkill);

// ✅ Certifications
router.post("/user/education/certification", auth, addCertification);
router.put("/user/certification/update/:userId/:certificationId", auth, updateCertification)
router.delete("/user/eduction/certification/delete/:userId/:certificationId", auth, deleteCertification);

router.patch("/user/deactivate", auth, deactivateUser);
router.delete("/user/delete", auth, deleteUserNow);


router.post("/user/add/education/project", auth, addOrUpdateProject);
router.put("/user/update/projects/:projectId", auth, addOrUpdateProject)
router.delete("/user/delete/projects/:projectId", auth, deleteProject);


router.post("/profile/toggle-publish", auth, togglePublish);
router.get("/public/resume/:username", getPublicResume);
router.get("/user/portfolio/:username", getPublicPortfolio);

router.delete("/user/delete/feed", deleteFeed)
router.get("/get/user/activity", auth, getMyActivities);

router.get("/get/individual/profile/detail/:username", getProfileByUsername);
router.post("/individual/user/following", getUserFollowing);
router.post("/individual/user/followers", getUserFollowers);
router.post("/user/remove/follower", auth, removeFollower);

router.get("/get/single/feed/:feedId", auth, getSingleFeedById);

router.get("/feed/:feedId", singleFeedById)

router.get("/get/feeds/by/creator/:feedId", auth, getFeedsByCreator);

router.get("/global/search", globalSearch);

router.post("/check/follow/status", auth, checkFollowStatus);

router.get("/get/trending/hashtag", getTrendingHashtags);

router.get("/get/hidden-posts", auth, getHiddenPosts);
router.post("/remove/hidden-post", auth, removeHiddenPost);
router.post("/remove/non-interested-category", auth, removeNonInterestedCategory);
router.get("/get/non-interested-categories", auth, getNonInterestedCategories);

router.get("/get/feeds/by/hashtag/:tag", auth, getFeedsByHashtag);

router.get("/get/user/birthday", getUpcomingBirthdays);



router.get("/main/board/status", getManiBoardStats);



// Public
router.get("/help", getHelpFAQ);

router.post("/feedback", auth, submitUserFeedback);
router.get("/feedback/my", auth, getMyFeedbackAndReports);



module.exports = router;
