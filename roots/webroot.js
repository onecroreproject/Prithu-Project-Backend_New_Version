const express = require('express');
const router = express.Router();
const { auth } = require('../middlewares/jwtAuthentication');
const {feedUpload,
  userProcessFeedFile,
  attachFeedFile,}=require("../middlewares/services/googleDriveMedia/feedgoogleConfig");
const {userUpload,attachUserFile}=require("../middlewares/services/userprofileUploadSpydy");



// Controllers
const {
  createNewUser,
  userLogin,
  userSendOtp,
  userPasswordReset,
  existUserVerifyOtp, 
  newUserVerifyOtp,
  userLogOut,
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
  setAppLanguage ,
  getAppLanguage,
  getFeedLanguage,
  setFeedLanguage,
  checkUsernameAvailability,
  getUserReferalCode,
  checkEmailAvailability,
  blockUserById,
} = require('../controllers/userControllers/userDetailController');

const{
  userSelectCategory,
  userNotInterestedCategory,
  userInterestedCategory,
  getNonInterestedCategories,
  removeNonInterestedCategory
}=require('../controllers/userControllers/userCategoryController')

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
  getReports ,
  deleteUserAndAllRelated,
  getUpcomingBirthdays,
} = require('../controllers/adminControllers/adminUserControllers');

const {
  likeFeed,
  toggleSaveFeed,
  downloadFeed,
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
,checkFollowStatus
} = require('../controllers/followersControllers.js/followerDetailController');

const {
  adminAddCategory,
  deleteCategory,
  updateCategory,
} = require('../controllers/adminControllers/adminCatagoryController');



const{
  creatorSelectCategory,
  creatorUnSelectCategory,
}=require('../controllers/creatorControllers/creatorCategoryController')


const{
  getCommentsByFeed,
  getRepliesForComment,
  getNestedReplies,
  deleteComment,
  deleteReply
,
}=require('../controllers/conmmentController')


const{
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
  getUserPost ,
}=require('../controllers/userControllers/userFeedController');

const{
  getDashboardMetricCount,
  getDashUserRegistrationRatio,
  getDashUserSubscriptionRatio,
}=require('../controllers/adminControllers/dashboardController');



const{
addReportQuestion,
createReportType,
getStartQuestion,
getNextQuestion,
getReportTypes,
createFeedReport,
updateReportStatus,
getReportLogs,
adminTakeActionOnReport,
}=require('../controllers/adminControllers/userReportController');

const{
 sendAdminNotification,
  notifyUserFollow,
  getNotifications,
  markNotificationAsRead,
  saveToken,
  markAllRead,
  clearAllNotifications,
  deleteNotification,
}=require('../controllers/adminControllers/notificationController');

const{
  refreshAccessToken,
  heartbeat,
  userPresence,
}=require('../controllers/sessionController')

const {
  getChildAdmins,
  getChildAdminPermissions,
  updateChildAdminPermissions,
  getChildAdminById,
  blockChildAdmin,
  deleteChildAdmin,

}=require('../controllers/adminControllers/adminChildAdminController');

const{
  getAnalytics,
  getRecentSubscriptionUsers,
  getTopReferralUsers,
  getUserAndSubscriptionCountsDaily,
}=require("../controllers/adminControllers/SalesDashboard/salesDashboardMetricksController");

const {
uploadFrames,
getAllFrames,
deleteFrame,
}=require("../controllers/adminControllers/frameController");



const {getUserEarnings}=require("../controllers/userControllers/userEarningsController");

const {saveUserLocation,
  getUserLocation,
  getUpcomingEvents,
}=require("../controllers/userControllers/userLoactionController");


/*-----------------Web Controller ------------------*/
const {
  getUserFeedsWeb,
}=require("../WebController/UserController/userFeedControllerWeb");

const{
  getUserFollowing,
  getUserFollowers,
}=require("../WebController/UserController/userFolloweController");
const User=require("../models/userModels/userModel")
const{
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
}=require("../controllers/userControllers/userCurriculamController");


const{
togglePublish,
getPublicResume,
getPublicPortfolio,
}=require("../controllers/userControllers/userResumeController");

const{
  getMyActivities,
}=require("../controllers/userControllers/userActivitController");

const{
  globalSearch
}=require("../controllers/searchController");


const{
  deactivateUser,
deleteUserNow

}=require("../controllers/userControllers/userDeleteController")


const{
  getTrendingHashtags,
}=require("../controllers/hashTagController");



const{
  getHiddenPosts,
  removeHiddenPost,
}=require("../controllers/userControllers/hiddenPostController");
const { applyForJob, getAppliedJobsByUser, getSavedJobsByUser } = require('../controllers/userControllers/userJobController');
const { startAptitudeTest ,
  aptitudeCallback,
  getLatestAptitudeResult,
  addInterestedUser,
  getInterestedUsers,
  getAllUserTestSchedules,
  getTopAptitudePerformers,
} = require('../controllers/aptitudeController');
const { getManiBoardStats } = require('../controllers/mainHomeControlle');
const { getPostInterestStatus ,
  requestPostInterest
} = require('../controllers/postIntrestedController');
const { getAllCompanies } = require('../controllers/adminCompany/adminCompanyController');
const { getJobWithResolvedLocation, getAllActiveJobLocations, getPlatformStats } = require('../controllers/JobController/jobpostController');




// /* --------------------- User Authentication --------------------- */
router.post('/auth/user/register', createNewUser);
router.post('/auth/user/login', userLogin);
router.post('/auth/user/otp-send', userSendOtp);
router.post('/auth/exist/user/verify-otp', existUserVerifyOtp);
router.post('/auth/new/user/verify-otp', newUserVerifyOtp);
router.post('/auth/user/reset-password', userPasswordReset);
router.post('/auth/user/logout',auth, userLogOut);

// /* --------------------- User Referral API Actions --------------------- */
router.get('/user/referal/code',auth,getUserReferalCode);


// /* --------------------- Fresh Users API --------------------- */
router.post('/user/app/language',auth, setAppLanguage );
router.get('/user/get/app/language',auth,getAppLanguage);
router.post('/user/feed/language',auth, setFeedLanguage );
router.get('/user/get/feed/language', auth, getFeedLanguage );
router.get('/user/get/content/catagories',auth,getUserContentCategories);
router.post('/user/select/category',auth, userSelectCategory);
router.get("/check/username/availability",checkUsernameAvailability);
router.get("/check/email/availability",checkEmailAvailability);


// /* --------------------- User Feed Actions --------------------- */
router.post('/user/feed/like',auth, likeFeed);
router.post("/user/feed/dislike",auth,toggleDislikeFeed);
router.post('/user/feed/save',auth, toggleSaveFeed);
router.post('/user/feed/download',auth, downloadFeed);
router.post('/user/feed/share',auth, shareFeed);
router.get('/feed/share/:feedId', generateShareLink);
router.get('/feed/video-thumbnail/:feedId', getVideoThumbnail);
router.post('/user/select/category',auth,userSelectCategory);
router.post('/user/not/intrested',auth,userNotInterestedCategory);
router.post('/user/interested/feed',auth,userInterestedCategory);
router.post("/user/intrested/category/begin",auth,saveInterestedCategory);

// /* --------------------- User Feed Get Actions --------------------- */
router.get('/user/get/saved/feeds',auth, getUserSavedFeeds);
router.get('/user/download/feeds', auth, getUserDownloadedFeeds);
router.get('/user/liked/feeds',auth, getUserLikedFeeds);
router.post('/user/hide/feed',auth,userHideFeed);
router.get("/user/notintrested/category",auth,getUserCategory);
router.get("/get/user/detail/at/feed/icon",auth,getUserdetailWithinTheFeed);

/* User Comment API */
router.post('/user/comment/like',auth,likeMainComment);
router.post('/user/replycomment/like',auth,likeReplyComment);
router.post('/user/feed/comment',auth,postComment);
router.post('/user/feed/reply/comment',auth,postReplyComment);


router.delete("/user/delete/comment/:commentId",auth,deleteComment);
router.delete("/user/delete/reply/comment/:replyId",auth,deleteReply);
router.post('/get/replies/for/comment', auth, getRepliesForComment);
router.post('/get/comments/for/feed',auth,getCommentsByFeed);
router.post('/get/nested/replies',auth,getNestedReplies);


// /* --------------------- User Subscription --------------------- */
router.post('/user/plan/subscription',auth,subscribePlan);
router.put('/user/cancel/subscription',auth,cancelSubscription);
router.get('/user/getall/subscriptions', getAllPlans);
router.get('/user/user/subscriptions', auth,getUserSubscriptionPlanWithId);
router.post('/user/activate/trial/plan',auth,userTrailPlanActive);
router.get('/user/check/active/subcription',auth,checkUserActiveSubscription);

/*----------------------User Report -----------------------------*/
router.get("/report-questions/start", getStartQuestion);
router.post("/report-questions/:id", getNextQuestion);
router.get("/report-types", getReportTypes);
router.post("/report-post",auth,createFeedReport);


/*-------------------------User Session API ---------------------*/
 router.post("/refresh-token", refreshAccessToken);
 router.post("/heartbeat",auth, heartbeat);
 router.post("/user/session/presence",auth,userPresence );

 /* --------------------- User Subscription --------------------- */
router.get('/user/user/subscriptions', auth, getUserSubscriptionPlanWithId);

/*---------------------- User Feed API -------------------------*/
router.post(
  "/creator/feed/upload",
  auth,
  feedUpload.single("file"),
  userProcessFeedFile,
  attachFeedFile,
  creatorFeedUpload
);

router.post(
  "/creator/feed/ScheduleUpload",
  auth,
  feedUpload.single("file"),
  userProcessFeedFile,
  attachFeedFile,
  creatorFeedScheduleUpload
);
router.get("/get/trending/feed",auth,getTrendingFeeds);
router.get('/get/all/feeds/user',auth,getAllFeedsByUserId);
router.post('/user/watching/vidoes',auth,userVideoViewCount);
router.post('/user/image/view/count',auth,userImageViewCount);
router.get('/user/get/feed/with/cat/:id',auth,getfeedWithCategoryWithId);
router.get('/user/get/feed/with/search/cat/:categoryId',getFeedWithCategoryId);
 router.get('/get/creator/detail/feed/:feedId',auth,getUserInfoAssociatedFeed);
 router.get('/get/user/hide/post',auth,getUserHidePost);


router.post('/user/get/post',getUserPost);
router.get('/user/get/feed/category',auth,getFeedLanguageCategories);
router.get('/get/all/feed/for/Creator',auth,getFeedsByAccountId);
router.get('/user/get/all/category', getUserPostCategories);

/* --------------------- User Follower API --------------------- */
 router.post('/user/follow/creator',auth,followAccount);
 router.post('/user/unfollow/creator',auth,unFollowAccount);
 router.get('/user/following/data',auth,getUserFollowersData);


 /*----------------------UserAptitude---------------------------*/
router.post("/aptitude/start-test",auth,startAptitudeTest);
router.post("/aptitude/callback", aptitudeCallback);
router.get("/aptitude/latest/results", auth, getLatestAptitudeResult);
router.get("/aptitude/schedule",auth,getAllUserTestSchedules);
router.get("/aptitude/intrested/:scheduleId",getInterestedUsers);
router.post("/aptitude/user/intrest",auth,addInterestedUser);
router.get("/top/aptitude/performers",getTopAptitudePerformers);


 /*_______________________User JOB API_____________________________*/
 router.post("/apply/job",auth,applyForJob);
 router.get("/get/job/locations",getAllActiveJobLocations);
 router.get("/company/platform/status",getPlatformStats);
 router.get("/job-applications/applied-jobs",auth,getAppliedJobsByUser);
 router.get("/get/user/saved/jobs",auth,getSavedJobsByUser);

 /* --------------------- User Notifiction API --------------------- */
 router.post("/admin/send/notification", sendAdminNotification )
// router.post("/user/follow", auth, notifyUserFollow);
router.put("/mark/all/notification/read",auth,markAllRead);
router.get("/get/user/all/notification",auth,getNotifications);
router.delete("/user/delete/notification",auth,deleteNotification);
router.delete("/user/delete/all/notification",auth,clearAllNotifications);
router.put("/user/read", auth, markNotificationAsRead);
router.post("/notifications/save-token",auth,saveToken);


/*--------------UserPostController--------------------------*/
router.get("/post/allowed/status",auth,getPostInterestStatus);
router.post("/post/intrested",auth,requestPostInterest);

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


router.delete("/user/cover/photo/delete",auth,deleteCoverPhoto);
router.get('/get/profile/detail',auth,getUserProfileDetail);
router.get('/get/single/profile/detail',getUserProfileDetail);

/* --------------------- User Earnings API --------------------- */

router.get('/get/userearnigs/referrals',getUserEarnings);

/*-----------------------User Location API ---------------------*/
router.post("/save/user/location",auth,saveUserLocation);
router.get("/get/user/location",auth,getUserLocation);


router.get("/get/upcomming/events",auth,getUpcomingEvents);
















/* --------------------- Admin Authentication --------------------- */
router.post('/auth/admin/register',auth,newAdmin);
router.post('/auth/admin/login', adminLogin);
router.post('/auth/admin/sent-otp', adminSendOtp);
router.post('/auth/exist/admin/verify-otp', existAdminVerifyOtp);
router.post('/auth/new/admin/verify-otp', newAdminVerifyOtp);
router.post('/auth/admin/reset-password', adminPasswordReset);
router.get('/api/admin/verify-token',auth, verifyToken);




/* --------------------- Admin Category API --------------------- */
router.post('/admin/add/feed/category', adminAddCategory);
router.delete('/admin/feed/category/:id', deleteCategory);
router.get('/admin/get/feed/category', getAllCategories);
router.put('/admin/update/category',updateCategory);

/* --------------------- Admin Subscription API --------------------- */
router.post('/admin/create/subscription', createPlan);
router.put('/admin/update/subscription/:id', updatePlan);
router.delete('/admin/delete/subscription/:id', deletePlan);
router.get('/admin/getall/subscriptions', getAllPlans);

/* --------------------- Admin User API --------------------- */
router.get('/admin/getall/users', getAllUserDetails);

router.get("/admin/users/status", getUsersStatus);
router.get("/admin/user/detail/by-date", getUsersByDate);
router.get ('/admin/user/action/intersection/count/:userId',getAnaliticalCountforUser);
router.get('/admin/get/user/analytical/data/:userId',getUserAnalyticalData);
router.get("/admin/user/tree/level/:userId",getUserLevelWithEarnings);
router.patch("/admin/block/user/:userId",blockUserById);
router.get('/admin/user/profile/metricks',getUserProfileDashboardMetricCount);
router.get('/admin/user/likes/:userId',getUserLikedFeedsforAdmin);
router.delete('/admin/delete/user/:userId',deleteUserAndAllRelated);

router.get("/feeds/:userId",fetchUserFeeds);
router.get("/following/:userId",fetchUserFollowing);
router.get("/interested/:userId",fetchUserInterested);
router.get("/hidden/:userId", fetchUserHidden);
router.get("/liked/:userId", fetchUserLiked);
router.get("/disliked/:userId", fetchUserDisliked);
router.get("/commented/:userId", fetchUserCommented);
router.get("/shared/:userId", fetchUserShared);
router.get("/downloaded/:userId", fetchUserDownloaded);
router.get("/summary/:userId", getUserAnalyticsSummary);
router.get("/nonInterested/:userId", fetchUserNonInterested);





/*---------------------Admin DashBoard API---------------------*/
router.get("/admin/dashboard/metricks/counts",getDashboardMetricCount);
router.get("/admin/users/monthly-registrations",getDashUserRegistrationRatio);
router.get("/admin/user/subscriptionration",getDashUserSubscriptionRatio)

/* --------------------- Admin Creator API --------------------- */
router.get('/admin/getall/creators', getAllCreatorDetails);
router.get('/admin/get/user/detail', getUserProfileDetail);
router.get ('/admin/get/trending/creator',getAllTrendingCreators);
// router.get("/admin/users/status", getUserStatus);
// router.get("/admin/user/detail/by-date", getUsersByDate);

/*----------------------Admin Sales Dashboard------------------*/
router.get("/sales/dashboard/analytics", getAnalytics);
router.get("/get/recent/subscribers",getRecentSubscriptionUsers);
router.get("/top/referral/users",getTopReferralUsers);
router.get("/dashboard/user-subscription-counts",getUserAndSubscriptionCountsDaily);







/* --------------------- Category API --------------------- */
router.post('/search/all/category',searchCategories)
router.get("/get/feed/category",getCategoriesWithFeeds);


/*----------------------ProfileUpdate-------------------*/
router.put("/profile/toggle-visibility",auth,
  toggleFieldVisibility
);

router.get(
  "/profile/visibility",auth,
  getVisibilitySettings
);






/*---------------------Website----------------------------------*/
router.get("/get/profile/overview",auth,getProfileOverview);
router.post("/single/get/profile/overview",getProfileOverview);
router.post("/user/update/visibility/settings",auth,updateFieldVisibilityWeb);
router.get("/user/get/visibility/settings",auth,getVisibilitySettingsWeb);
router.post("/individual/user/visibility/settings",getUserVisibilityByUserId);



router.get("/get/user/post",auth,getUserFeedsWeb);
router.get("/get/single/user/post",getUserFeedsWeb);
router.get("/user/following", auth, getUserFollowing);
router.get("/user/followers", auth, getUserFollowers);
router.get("/single/user/following",getUserFollowing);
router.get("/single/user/followers",getUserFollowers);
router.get("/user/profile/completion",auth,getProfileCompletion);

// ✅ Profile
router.post("/create", createOrGetProfile);
router.get("/get/full/curriculam/profile",auth,getFullProfile);
router.get("/user/curicullam/status",auth,checkCurriculumStatus)

// ✅ Education
router.post("/profile/education",auth,addEducation);
router.put("/profile/education/:userId/:educationId",auth,updateEducation);
router.delete("/education/profile/delete/:userId/:educationId",auth,deleteEducation);

// ✅ Experience
router.post("/user/job/experience",auth,addExperience);
router.put("/user/job/experience/:userId/:experienceId",auth, updateExperience);
router.delete("/user/job/experience/detele/:userId/:experienceId",auth, deleteExperience);

// ✅ Skills
router.post("/user/education/skill",auth, addSkill);
router.put("/user/eduction/skill/:userId/:skillId",auth, updateSkill);
router.delete("/user/eduction/skill/delete/:userId/:skillId",auth, deleteSkill);

// ✅ Certifications
router.post("/user/education/certification",auth, addCertification);
router.put("/user/certification/update/:userId/:certificationId",auth,updateCertification)
router.delete("/user/eduction/certification/delete/:userId/:certificationId",auth, deleteCertification);

router.patch("/user/deactivate",auth, deactivateUser);
router.delete("/user/delete",auth, deleteUserNow);


router.post("/user/add/education/project",auth, addOrUpdateProject);
router.put("/user/update/projects/:projectId",auth,addOrUpdateProject)
router.delete("/user/delete/projects/:projectId",auth, deleteProject);


router.post("/profile/toggle-publish", auth,togglePublish);
router.get("/public/resume/:username", getPublicResume);
router.get("/user/portfolio/:username",getPublicPortfolio); 

router.delete("/user/delete/feed",deleteFeed)
router.get("/get/user/activity",auth,getMyActivities);

router.get("/get/individual/profile/detail/:username",getProfileByUsername);
router.post("/individual/user/following", getUserFollowing);
router.post("/individual/user/followers", getUserFollowers);
router.post("/user/remove/follower",auth,removeFollower);

router.get("/get/single/feed/:feedId", auth,getSingleFeedById);

router.get("/feed/:feedId",singleFeedById)

router.get("/get/feeds/by/creator/:feedId",auth,getFeedsByCreator);
            
router.get("/global/search",globalSearch);

router.post("/check/follow/status", auth,checkFollowStatus);

router.get("/get/trending/hashtag", getTrendingHashtags);

router.get("/get/hidden-posts", auth, getHiddenPosts);
router.post("/remove/hidden-post",auth,removeHiddenPost);
router.post("/remove/non-interested-category", auth, removeNonInterestedCategory);
router.get("/get/non-interested-categories", auth, getNonInterestedCategories);

router.get("/get/feeds/by/hashtag/:tag",auth, getFeedsByHashtag);

router.get("/get/user/birthday", getUpcomingBirthdays);



router.get("/main/board/status",getManiBoardStats);

router.get("/get/all/companies",getAllCompanies);



module.exports = router;
