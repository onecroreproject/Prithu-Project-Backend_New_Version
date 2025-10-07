const mongoose = require("mongoose");

// ✅ Submenu permission schema
const subPermissionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // e.g. "User Analytics"
    permission: {
      type: String,
      required: true,
      enum: [
        "canManageChildAdminsCreation", // Admin
        "canManageChildAdminsPermissions",       // User Profile
        "canManageUsersDetail",    // Creator Profile
        "canManageUsersAnalytics",       // Feeds Info
        "canManageUsersFeedReports"     // Subscriptions Info
      ]
    }
  },
  { _id: false }
);

// ✅ Main menu permission schema
const menuPermissionSchema = new mongoose.Schema(
  {
    mainMenu: { type: String, required: true },       // e.g. "User Profile"
    mainPermission: {
      type: String,
      enum: [
        null,
        "canManageChildAdmins",
        "canManageUsers",
        "canManageCreators",
        "canManageFeeds",
        "canManageSettings"
      ],
      default: null
    },
    subPermissions: [subPermissionSchema]
  },
  { _id: false }
);

// ✅ Child Admin Schema (excerpt)
const childAdminSchema = new mongoose.Schema({
  userName: { type: String, required: true, unique: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  parentAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },

  // Menu permissions with submenu support
  menuPermissions: [menuPermissionSchema],

  // Flat permissions for fast access
  grantedPermissions: [String],
  ungrantedPermissions: [String],
  
  isActive: { type: Boolean, default: true },
  isApprovedByParent: { type: Boolean, default: false },
}, { timestamps: true });

module.exports = mongoose.model("ChildAdmin", childAdminSchema);
