const express = require('express');
const router = express.Router();
const multer = require('multer');
const app = express();
const path = require('path');
const { auth } = require('../middlewares/jwtAuthentication');


// Controllers
const {
  createNewUser,
  userLogin,
  userSendOtp,
  userPasswordReset,
  existUserVerifyOtp, 
  newUserVerifyOtp,
  userlogOut,
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
} = require('../controllers/feedControllers/feedsController');

const {
  newAdmin,
  adminLogin,
  adminSendOtp,
  existAdminVerifyOtp,
  newAdminVerifyOtp,
  adminPasswordReset,
} = require('../controllers/authenticationControllers/adminAuthController');

const {
  getUserDetailWithId,
  setAppLanguage ,
  getAppLanguage,
  getFeedLanguage,
  setFeedLanguage,
} = require('../controllers/userControllers/userDetailController');

const{
  userSelectCategory,
  userNotInterestedCategory,
  userInterestedCategory,
}=require('../controllers/userControllers/userCategoryController')

const {
  getCategoryWithId,
  getAllCategories,
  getContentCategories,
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
  getUserStatus,
  getUsersByDate,
  getAllUserDetails,
  getAnaliticalCountforUser,
  getUserLikedFeeds,
} = require('../controllers/adminControllers/adminUserControllers');

const {
  likeFeed,
  saveFeed,
  downloadFeed,
  postComment,
  getUserSavedFeeds,
  getUserDownloadedFeeds,
  shareFeed,
  commentLike,
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
} = require('../controllers/adminControllers/adminfeedController');

const {
  getCreatorDetailWithId,
  getAllCreatorDetails,
} = require('../controllers/creatorControllers/creatorDetailController');

const {
  followAccount,
  unfollowAccount,
  getAccountFollowers,
  getCreatorFollowers,
} = require('../controllers/followersControllers.js/followerDetailController');

const {
  adminAddCategory,
  deleteCategory,
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

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, "./uploads/images");
    } else if (file.mimetype.startsWith("video/")) {
      cb(null, "./uploads/videos");
    } else {
      cb(new Error("Only image/video files are allowed"), null);
    }
  },
  filename: (req, file, cb) => {
    const sanitizedName = file.originalname.replace(/\s+/g, "_");
    cb(null, Date.now() + "_" + sanitizedName);
  }
});

const upload = multer({ storage });

// Serve static files from 'uploads' folder
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  next();
}, express.static(path.join(__dirname, 'uploads')));

/* --------------------- User Authentication --------------------- */
router.post('/auth/user/register', createNewUser);
router.post('/auth/user/login', userLogin);
router.post('/auth/user/otp-send', userSendOtp);
router.post('/auth/exist/user/verify-otp', existUserVerifyOtp);
router.post('/auth/new/user/verify-otp', newUserVerifyOtp);
router.post('/auth/user/reset-password', userPasswordReset);
router.post('/auth/user/logout', userlogOut);

/* --------------------- Fresh Users API --------------------- */
router.post('/app/language', auth, setAppLanguage );
router.get('/get/app/language',auth,getAppLanguage);
router.post('/feed/language', auth, setFeedLanguage );
router.get('/feed/language', auth, getFeedLanguage );
router.get('/get/content/catagories', getContentCategories);
router.post('/user/select/category',auth, userSelectCategory);

/* --------------------- User Feed Actions --------------------- */
router.post('/user/feed/like',auth, likeFeed);
router.post('/user/comment/like',auth,commentLike);
router.post('/user/feed/save',auth, saveFeed);
router.post('/user/feed/download',auth,  downloadFeed);
router.post('/user/feed/comment',auth, postComment);
router.post('/user/feed/share',auth, shareFeed);
router.post('/user/select/category',auth,userSelectCategory);
router.get('/user/get/saved/feeds',auth,getUserSavedFeeds);
router.get('/user/get/feeds',auth,getUserSavedFeeds);
router.post('/user/not/intrested',auth,userNotInterestedCategory);
router.post('/user/interested/feed',auth,userInterestedCategory);

/* --------------------- User Feed Get Actions --------------------- */
router.get('/user/saved/feeds', auth, getUserSavedFeeds);
router.get('/user/saved/download', auth, getUserDownloadedFeeds);

/* --------------------- User Subscription --------------------- */
router.post('/user/plan/subscription', auth, subscribePlan);
router.post('/user/cancel/subscription', auth, cancelSubscription);
router.get('/user/user/subscriptions', auth, getUserSubscriptionPlanWithId);


// /* --------------------- User Subscription --------------------- */
// router.get('/user/left/tree/referals',getUserReferralTree);
router.get('/user/right/tree/referals',getUserReferralTree);
// router.get('/user/user/subscriptions', auth, getUserSubscriptionPlanWithId);

/*---------------------- User Feed API -------------------------*/
router.get('/get/all/feeds/user',auth,getAllFeedsByUserId);

/* --------------------- User Follower API --------------------- */
router.post('/user/follow/creator', auth, followAccount);
router.post('/user/unfollow/creator', auth, unfollowAccount);
router.get('/user/get/followers', auth, getAccountFollowers);

/* --------------------- User Profile API --------------------- */
router.post('/user/profile/detail/update',auth,upload.single('file'), userProfileDetailUpdate);
router.get('/get/profile/detail',auth,getUserProfileDetail);

/* --------------------- Creator Feed API --------------------- */
router.post("/creator/feed/upload",auth, upload.single('file'), creatorFeedUpload);
router.post("/creator/feed/schedule", auth, upload.single('file'), creatorFeedScheduleUpload);
router.delete('/creator/delete/feeds', auth, creatorFeedDelete);
router.get('/creator/getall/feeds',auth,getCreatorFeeds);
router.get('/creator/get/post',auth,getCreatorPost);
router.get('/creator/get/feed/category', getAllCategories);
router.get('/get/all/feed/for/Creator',auth,getFeedsByAccountId);

/* --------------------- Cretor Feed Actions --------------------- */
router.post('/creator/feed/like', auth,likeFeed);
router.post('/creator/comment/like',auth,commentLike);
router.post('/creator/feed/save', auth, saveFeed);
router.post('/creator/feed/download', auth, downloadFeed);
router.post('/creator/feed/comment', auth,postComment);
router.post('/creator/feed/share', auth, shareFeed);
// router.post('/user/not/intrested')
// router.post('/user/interested')

/* --------------------- Creator Follower API --------------------- */
router.get('/creator/get/followers', auth,getCreatorFollowers);


/* --------------------- Admin Authentication --------------------- */
router.post('/auth/admin/register',auth,newAdmin);
router.post('/auth/admin/login', adminLogin);
router.post('/auth/admin/sent-otp', adminSendOtp);
router.post('/auth/exist/admin/verify-otp', existAdminVerifyOtp);
router.post('/auth/new/admin/verify-otp', newAdminVerifyOtp);
router.post('/auth/admin/reset-password', adminPasswordReset);

/* --------------------- Admin Profile API --------------------- */
router.post('/admin/profile/detail/update',auth,upload.single('file'), adminProfileDetailUpdate);
router.get('/get/admin/profile',auth,getAdminProfileDetail)

/* --------------------- Admin Feed API --------------------- */
router.post('/admin/feed', upload.array('file'),auth, adminFeedUpload);

/* --------------------- Admin Category API --------------------- */
router.post('/admin/feed/category', adminAddCategory);
router.delete('/admin/feed/category', deleteCategory);
router.get('/admin/feed/category', getAllCategories);

/* --------------------- Admin Subscription API --------------------- */
router.post('/admin/create/subscription', createPlan);
router.put('/admin/update/subscription/:id', updatePlan);
router.delete('/admin/delete/subscription/:id', deletePlan);
router.get('/admin/getall/subscriptions', getAllPlans);

/* --------------------- Admin User API --------------------- */
router.get('/admin/getall/users', getAllUserDetails);
router.get('/admin/get/user/profile/detail',auth,getUserDetailWithId)
router.get("/admin/users/status", getUserStatus);
router.get("/admin/user/detail/by-date", getUsersByDate);
router.get ('/admin/user/action/intersection/count/:userId',getAnaliticalCountforUser)
// router.get('/admin/user/followers/count')
// router.get('/admin/user/followers/detail')
// router.get('/admin/user/interest/categories')
 router.get('/amin/user/likes/:userId',getUserLikedFeeds)
// router.get('/amin/user/share')
// router.get('/amin/user/dwonload')
// router.get('/amin/user/comment')

/* --------------------- Admin Creator API --------------------- */
router.get('/admin/getall/creators', getAllCreatorDetails);
router.get('/admin/get/user/detail', getUserProfileDetail);
// router.get("/admin/users/status", getUserStatus);
// router.get("/admin/user/detail/by-date", getUsersByDate);


/* --------------------- Child Admin Profile API --------------------- */
router.post('/child/admin/profile/detail/update',auth, upload.single('file'), childAdminProfileDetailUpdate);
router.get('/get/child/admin/profile',auth,getChildAdminProfileDetail)

/* --------------------- Child Admin Feed API --------------------- */
router.post('/admin/feed', upload.array('file'),auth,childAdminFeedUpload);


/* --------------------- Feeds API --------------------- */
 router.get('/get/creator/detail/feed/:feedId',getUserInfoAssociatedFeed)
// router.post('/feeds/watchedbyuser', feedsWatchByUser);

/* --------------------- Tags API --------------------- */
router.get('/get/content/catagories', getContentCategories);
router.get('/all/catagories/:id', getCategoryWithId);



/* --------------------- Account API --------------------- */
router.post('/account/add', auth, addAccount);
router.post('/account/switch/creator', auth,switchToCreator);
router.post('/account/switch/user', auth, switchToUserAccount);
router.post('/account/status', auth, checkAccountStatus);

module.exports = router;
