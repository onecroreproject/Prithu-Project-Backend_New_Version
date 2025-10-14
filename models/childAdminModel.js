const mongoose = require("mongoose");

// ✅ Submenu permission schema
const subPermissionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    permission: {
      type: String,
      required: true,
      enum: [
        "canManageChildAdminsCreation",
        "canManageChildAdminsPermissions",
        "canManageUsersDetail",
        "canManageUsersAnalytics",
        "canManageUsersFeedReports",
      ],
    },
  },
  { _id: false }
);

// ✅ Main menu permission schema
const menuPermissionSchema = new mongoose.Schema(
  {
    mainMenu: { type: String, required: true },
    mainPermission: {
      type: String,
      enum: [
        null,
        "canManageChildAdmins",
        "canManageUsers",
        "canManageCreators",
        "canManageFeeds",
        "canManageSettings",
      ],
      default: null,
    },
    subPermissions: {
      type: [subPermissionSchema],
      default: [],
    },
  },
  { _id: false }
);

// ✅ Child Admin Schema
const childAdminSchema = new mongoose.Schema(
  {
    userName: { type: String, required: true, unique: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    parentAdminId: { type: mongoose.Schema.Types.ObjectId, ref: "Admin", required: true },

    // Unique childAdminId (string) to prevent duplicates
    childAdminId: { 
      type: String, 
      unique: true, 
      default: () => new mongoose.Types.ObjectId().toString() 
    },

    menuPermissions: {
      type: [menuPermissionSchema],
      default: [],
    },

    grantedPermissions: { type: [String], default: [] },
    ungrantedPermissions: { type: [String], default: [] },

    isActive: { type: Boolean, default: true },
    isApprovedByParent: { type: Boolean, default: false },
  },
  { timestamps: true }
);



// Include virtuals in JSON output
childAdminSchema.set("toJSON", { virtuals: true });
childAdminSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("ChildAdmin", childAdminSchema, "ChildAdmins");
