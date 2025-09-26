const express = require('express');
const router = express.Router();
const multer = require('multer');
const app = express();
const path = require('path');
const { auth } = require('../middlewares/jwtAuthentication');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const{ upload, uploadToCloudinary,processFeedFile,deleteFromCloudinary, updateOnCloudinary }=require('../middlewares/services/cloudnaryUpload')


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
  createNewCreator,
  creatorLogin,
  creatorSendOtp,
  existCreatorVerifyOtp,
  newCreatorVerifyOtp,
  creatorPasswordReset,
} = require('../controllers/authenticationControllers/creatorAuthController');

const {
  createNewBusinessUser,
  businessLogin,
  businessSendOtp,
  businessPasswordReset,
  existBusinessVerifyOtp,
  newBusinessVerifyOtp,
} = require('../controllers/authenticationControllers/businessAuthController');

const {
  creatorFeedUpload,
  creatorFeedDelete,
  getCreatorFeeds,
  creatorFeedScheduleUpload,
  getCreatorPost,
} = require('../controllers/feedControllers/creatorFeedController');

const {
  feedsWatchByUser,
  mostWatchedFeeds,
  getAllFeedsByUserId,
  getFeedsByAccountId,
  getUserInfoAssociatedFeed,
  getUserHidePost,
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
} = require('../controllers/userControllers/userDetailController');

const{
  userSelectCategory,
  userNotInterestedCategory,
  userInterestedCategory,
}=require('../controllers/userControllers/userCategoryController')

const {
  getCategoryWithId,
  getAllCategories,
  getUserContentCategories,
  searchCategories,

} = require('../controllers/categoriesController');

const {
  userProfileDetailUpdate,
  getUserProfileDetail,
  childAdminProfileDetailUpdate,
  adminProfileDetailUpdate,
  getAdminProfileDetail,
  getChildAdminProfileDetail,
  
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
  commentLike,
  getUserLikedFeeds,
  userHideFeed,
  getUserCategory,
} = require('../controllers/feedControllers/userActionsFeedController');

const{
  getLeftReferrals,
  getRightReferrals,
  getUserReferralTree,
}=require('../controllers/userControllers/userRefferalController')


const {
creatorlikeFeed,
creatorsaveFeed,
creatordownloadFeed,
creatorshareFeed,
creatorpostComment,
creatorpostView,
creatorcommentLike,
}=require('../controllers/creatorActionController')

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
  getUserSubscriptionPlanWithId
} = require('../controllers/userControllers/userSubcriptionController');

const {
  adminFeedUpload,
  childAdminFeedUpload,
  getAllFeedAdmin,
} = require('../controllers/adminControllers/adminfeedController');

const {
  getCreatorDetailWithId,
  getAllCreatorDetails,
} = require('../controllers/creatorControllers/creatorDetailController');

const {
  followAccount,
  unFollowAccount,
  getAccountFollowers,
  getCreatorFollowers,
  getUserFollowersData,
} = require('../controllers/followersControllers.js/followerDetailController');

const {
  adminAddCategory,
  deleteCategory,
  updateCategory,
} = require('../controllers/adminControllers/adminCatagoryController');

const {
  addAccount,
  switchToCreator,
  switchToBusiness,
  switchToUserAccount,
  checkAccountStatus,
  getAllAccounts
} = require('../controllers/accountController');


const{
  creatorSelectCategory,
  creatorUnSelectCategory,
}=require('../controllers/creatorControllers/creatorCategoryController')

const{
  applyReferralCode,
}=require('../controllers/userControllers/userReferralController')

const{
  getCommentsByFeed,
  getRepliesByComment,
}=require('../controllers/conmmentController')


const{
  userVideoViewCount,
  userImageViewCount,
}=require('../controllers/userControllers/userFeedController');

const{
  getDashboardMetricCount,
  getDashUserRegistrationRatio,
  getDashUserSubscriptionRatio,
}=require('../controllers/adminControllers/dashboardController');

const{
  getUserTreeWithProfiles,
  getUserEarnings,
}=require("../controllers/userControllers/userReferralControllers/referralControllers")

const{
  addReportQuestion,
  createReportType,
  getStartQuestion,
  getNextQuestion,
getReportTypes,
createFeedReport,
updateReportStatus,
getReportLogs,
}=require('../controllers/adminControllers/addReportController');

const{
  notificationRegister,
  switchNotification,
  adminSentNotification,
}=require('../controllers/adminControllers/notificationController')


/* --------------------- User Authentication --------------------- */
router.post('/auth/user/register', createNewUser);
router.post('/auth/user/login', userLogin);
router.post('/auth/user/otp-send', userSendOtp);
router.post('/auth/exist/user/verify-otp', existUserVerifyOtp);
router.post('/auth/new/user/verify-otp', newUserVerifyOtp);
router.post('/auth/user/reset-password', userPasswordReset);
router.post('/auth/user/logout', userLogOut);

/* --------------------- User Referral API Actions --------------------- */
router.post('/user/later/referral',applyReferralCode);
router.get('/user/referal/code',auth,getUserReferalCode);
router.get ('/user/earning/card/data',getUserEarnings);
router.get('/user/both/tree/referals',getUserTreeWithProfiles);

/* --------------------- Fresh Users API --------------------- */
router.post('/user/app/language',auth, setAppLanguage );
router.get('/user/get/app/language',auth,getAppLanguage);
router.post('/user/feed/language',auth, setFeedLanguage );
router.get('/user/get/feed/language', auth, getFeedLanguage );
router.get('/user/get/content/catagories',auth,getUserContentCategories);
router.post('/user/select/category',auth, userSelectCategory);
router.get("/check/username/availability",checkUsernameAvailability);
router.get("/check/email/availability",checkEmailAvailability);


/* --------------------- User Feed Actions --------------------- */
router.post('/user/feed/like',auth, likeFeed);
router.post('/user/comment/like',auth,commentLike);
router.post('/user/feed/save',auth, toggleSaveFeed);
router.post('/user/feed/download',auth, downloadFeed);
router.post('/user/feed/comment',auth,postComment);
router.post('/user/feed/reply/comment',auth,postReplyComment);
router.post('/user/feed/share',auth, shareFeed);
router.post('/user/select/category',auth,userSelectCategory);
router.post('/user/not/intrested',auth,userNotInterestedCategory);
router.post('/user/interested/feed',auth,userInterestedCategory);

/* --------------------- User Feed Get Actions --------------------- */
router.get('/user/get/saved/feeds',auth, getUserSavedFeeds);
router.get('/user/download/feeds', auth, getUserDownloadedFeeds);
router.get('/user/liked/feeds',auth, getUserLikedFeeds);
router.post('/get/comments/for/feed',auth,getCommentsByFeed);
router.post('/get/comments/relpy/for/feed',auth,getRepliesByComment);
router.post('/user/hide/feed',auth,userHideFeed);
router.get("/user/notintrested/category",auth,getUserCategory);

/* --------------------- User Subscription --------------------- */
router.post('/user/plan/subscription', auth,subscribePlan);
router.post('/user/cancel/subscription', cancelSubscription);
router.get('/user/getall/subscriptions', getAllPlans);
router.get('/user/user/subscriptions', auth,getUserSubscriptionPlanWithId);

/*----------------------User Report -----------------------------*/
router.get("/report-questions/start", getStartQuestion);
router.get("/report-questions/:id", getNextQuestion);
router.get("/report-types", getReportTypes);
router.post("/report-post", auth,createFeedReport);


// /* --------------------- User Subscription --------------------- */
// router.get('/user/user/subscriptions', auth, getUserSubscriptionPlanWithId);

/*---------------------- User Feed API -------------------------*/
router.get('/get/all/feeds/user',auth,getAllFeedsByUserId);
router.post('/user/watching/vidoes',auth,userVideoViewCount);
router.post('/user/image/view/count',auth,userImageViewCount);

/* --------------------- User Follower API --------------------- */
 router.post('/user/follow/creator',auth, followAccount);
 router.post('/user/unfollow/creator',auth,unFollowAccount);
 router.get('/user/following/data',auth,getUserFollowersData);

 /* --------------------- User Notifiction API --------------------- */
 router.post("/user/notification/register",notificationRegister);
 router.post('/switch/notification',auth,switchNotification);

/* --------------------- User Profile API --------------------- */
router.post("/user/profile/detail/update",auth,upload.single("file"),(req, res, next) => { req.baseUrl = "/profile"; next(); },
  uploadToCloudinary,
  userProfileDetailUpdate
);
router.get('/get/profile/detail',auth,getUserProfileDetail);

/* --------------------- Creator Feed API --------------------- */
router.post("/creator/feed/upload",auth,upload.single("file"),(req, res, next) => { req.baseUrl = "/feed"; next(); },
   processFeedFile,
  uploadToCloudinary,
  creatorFeedUpload
);

router.delete('/creator/delete/feeds', auth, creatorFeedDelete);
router.get('/creator/getall/feeds',auth,getCreatorFeeds);
router.post('/creator/get/post',auth,getCreatorPost);
router.get('/creator/get/feed/category',getAllCategories);
router.get('/get/all/feed/for/Creator',auth,getFeedsByAccountId);

/* --------------------- Cretor Feed Actions --------------------- */
router.post('/creator/feed/like', auth,likeFeed);
router.post('/creator/comment/like',auth,commentLike);
router.post('/creator/feed/save', auth, toggleSaveFeed);
router.post('/creator/feed/download', auth, downloadFeed);
router.post('/creator/feed/comment', auth,postComment);
router.post('/creator/feed/share', auth, shareFeed);
// router.post('/user/not/intrested')
// router.post('/user/interested')

/* --------------------- Creator Follower API --------------------- */
router.get('/creator/get/followers',auth,getCreatorFollowers);


/* --------------------- Admin Authentication --------------------- */
router.post('/auth/admin/register',auth,newAdmin);
router.post('/auth/admin/login', adminLogin);
router.post('/auth/admin/sent-otp', adminSendOtp);
router.post('/auth/exist/admin/verify-otp', existAdminVerifyOtp);
router.post('/auth/new/admin/verify-otp', newAdminVerifyOtp);
router.post('/auth/admin/reset-password', adminPasswordReset);
router.get('/api/admin/verify-token',auth, verifyToken);

/* --------------------- Admin Profile API --------------------- */
// router.post('/admin/profile/detail/update',auth,upload.single('file'),uploadToCloudinary,adminProfileDetailUpdate);
router.get('/get/admin/profile',auth,getAdminProfileDetail)

/* --------------------- Admin Feed API --------------------- */
router.post(
  "/admin/feed-upload",
  auth,
  upload.array("file"), // ✅ matches frontend append("file", file)
  (req, res, next) => {
    req.baseUrl = "/feed";
    next();
  },
  processFeedFile,
  uploadToCloudinary,
  adminFeedUpload
);
router.get("/admin/get/all/feed",getAllFeedAdmin);


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
router.get('/admin/get/user/profile/detail/:id',getUserDetailWithIdForAdmin);
router.get("/admin/users/status", getUsersStatus);
router.get("/admin/user/detail/by-date", getUsersByDate);
router.get ('/admin/user/action/intersection/count/:userId',getAnaliticalCountforUser);
router.get('/admin/get/user/analytical/data/:userId',getUserAnalyticalData);
router.get("/admin/user/tree/level/:userId",getUserLevelWithEarnings);
// router.get('/admin/user/followers/count')
// router.get('/admin/user/followers/detail')
// router.get('/admin/user/interest/categories')
 router.get('/admin/user/likes/:userId',getUserLikedFeedsforAdmin)
// router.get('/amin/user/share')
// router.get('/amin/user/dwonload')
// router.get('/amin/user/comment')

/*-------------------Admin Report API -------------------------*/
router.post("/admin/add/report/questions",addReportQuestion);
router.post("/admin/report-type", createReportType);
router.put("/:reportId/status", updateReportStatus);
router.get("/:reportId/logs", auth,getReportLogs);


/*---------------------Admin DashBoard API---------------------*/
router.get("/admin/dashboard/metricks/counts",getDashboardMetricCount);
router.get("/admin/users/monthly-registrations",getDashUserRegistrationRatio);
router.get("/admin/user/subscriptionration",getDashUserSubscriptionRatio)

/* --------------------- Admin Creator API --------------------- */
router.get('/admin/getall/creators', getAllCreatorDetails);
router.get('/admin/get/user/detail', getUserProfileDetail);
// router.get("/admin/users/status", getUserStatus);
// router.get("/admin/user/detail/by-date", getUsersByDate);


/*---------------------Admin Notification API-------------------*/
router.post("/admin/post/notification",adminSentNotification)

/* --------------------- Child Admin Profile API --------------------- */
// router.post('/child/admin/profile/detail/update',auth, upload.single('file'),uploadToCloudinary,childAdminProfileDetailUpdate);
router.get('/get/child/admin/profile',auth,getChildAdminProfileDetail)

/* --------------------- Child Admin Feed API --------------------- */
router.post('/child/admin/feed', upload.array('file'),auth,childAdminFeedUpload);


/* --------------------- Feeds API --------------------- */
 router.get('/get/creator/detail/feed/:feedId',auth,getUserInfoAssociatedFeed);
 router.get('/get/user/hide/post',auth,getUserHidePost);
// router.post('/feeds/watchedbyuser', feedsWatchByUser);

/* --------------------- Feed For Comments API --------------------- */



/* --------------------- Tags API --------------------- */
router.post('/search/all/category',searchCategories)
router.get('/all/catagories/:id', getCategoryWithId);



/* --------------------- Account API --------------------- */
router.post('/account/add', auth, addAccount);
router.post('/account/switch/creator',auth,switchToCreator);
router.post('/account/switch/user',auth, switchToUserAccount);
router.post('/account/status',auth, checkAccountStatus);

module.exports = router;
