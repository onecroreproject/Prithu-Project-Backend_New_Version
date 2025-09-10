const Account = require('../models/accountSchemaModel');
const User = require('../models/userModels/userModel');
const jwt = require('jsonwebtoken');


// Add a new account (User → Business/Creator)
exports.addAccount = async (req, res) => {
  try {
    const userId = req.Id; // from auth middleware
   
    const { type } = req.body;
 
    if (!type) return res.status(400).json({ message: "Account type is required" });
 
    const formattedType = type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
   
    // Check if account already exists
    let account = await Account.findOne({ userId, type: formattedType });
    if (account) return res.status(400).json({ message: `${formattedType} account already exists` });
 
    // Create new account
    account = new Account({ userId, type: formattedType });
     await account.save();
 
    // Update user's roles array and activeAccount
    const user = await User.findById(userId);
    if (!user.roles.includes(formattedType)) user.roles.push(formattedType);
    user.activeAccount = account._id;
     await user.save();
 
    // Generate token for the new account
   
     const token = jwt.sign(
           { userId, role: formattedType, accountId: account._id, userName: user.userName },
           process.env.JWT_SECRET,
           { expiresIn: '32d' }
         );
 
     res.status(201).json({ message: `${formattedType} account created`, account, token });
  } catch (err) {
    console.error("AddAccount Error:", err);
    res.status(500).json({ message: "Error creating account", error: err.message });
  }
};
 
 
 
exports.switchToCreator = async (req, res) => {
  try {
    const userId = req.Id || req.body.userId;
    console.log(userId)
 
    let account = await Account.findOne({ userId, type: "Creator" });
    if (!account) return res.status(404).json({ message: "Creator account not found" });
 
    // Update activeAccount
    const user = await User.findById(userId);
    user.activeAccount = account._id;
    await user.save();
 
    const token = jwt.sign(
          {userId, role:"Creator",accountId: account._id},
          process.env.JWT_SECRET,
          { expiresIn: '32d' }
        );
 
    res.status(200).json({ message: "Switched to Creator account", account, token });
  } catch (err) {
    console.error("SwitchToCreator Error:", err);
    res.status(500).json({ message: "Error switching account", error: err.message });
  }
};
 
 
 
exports.switchToUserAccount = async (req, res) => {
  try {
    const userId = req.Id;
console.log(userId)
 
    // Clear activeAccount
    await User.findByIdAndUpdate(userId, { activeAccount: null });
 
    // Generate user token
 
  const token = jwt.sign(
        { userId,
      role: "User",},
        process.env.JWT_SECRET,
        { expiresIn: '32d' }
      );
 
    return res.status(200).json({
      message: "Switched back to User account",
      token,
    });
  } catch (err) {
    console.error("switchToUserAccount Error:", err);
    res.status(500).json({ message: "Error switching to user account", error: err.message });
  }
};
 
// ✅ Check account status (for frontend button logic)
// Controller
 
exports.checkAccountStatus = async (req, res) => {
  try {
    const userId =  req.Id// support auth middleware or body
   console.log(userId)
    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }
 
    // Fetch user with activeAccount
    const user = await User.findById(userId).populate({
      path: "activeAccount",
      model: "Account",
      select: "type",
    });
 
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
 
    // Fetch all accounts for the user
    const accounts = await Account.find({ userId }).select("type");
   
 
    const roles = accounts.map(acc => acc.type); // ["Creator"], ["Business"], etc.
 
    // Determine active account type
    let activeAccountType = null;
    if (user.activeAccount) {
      activeAccountType = user.activeAccount.type;
    }
 
    res.status(200).json({
      message: "Account status fetched successfully",
      roles,                 // all account types the user has
      activeAccountType,     // current active account (null if none)
      hasAccounts: accounts.length > 0, // true if user has any accounts
    });
  } catch (err) {
    console.error("CheckAccountStatus Error:", err);
    res.status(500).json({ message: "Server error", error: err.message });
  }
};




// // ✅ Get all accounts linked to user
// exports.getAllAccounts = async (req, res) => {
//   try {
//     const userId = req.Id;

//     const user = await User.findById(userId).populate("activeAccount");
//     if (!user) return res.status(404).json({ message: "User not found" });

//     const accounts = await Account.find({ userId });

//     return res.status(200).json({
//       activeAccount: user.activeAccount,
//       accounts,
//     });
//   } catch (err) {
//     console.error("getAllAccounts Error:", err);
//     res.status(500).json({ message: "Error fetching accounts", error: err.message });
//   }
// };



// exports.switchToBusiness = async (req, res) => {



