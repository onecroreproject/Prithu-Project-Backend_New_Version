const mongoose = require("mongoose");
const { prithuDB } = require("../database");

// Sub-permission
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

// Main permission group
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

// Child Admin Schema
const childAdminSchema = new mongoose.Schema(
  {
    userName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },

    passwordHash: { type: String, required: true },

    parentAdminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
      index: true,
    },

    childAdminId: {
      type: String,
      unique: true,
      default: () => new mongoose.Types.ObjectId().toString(),
      index: true,
    },

    menuPermissions: { type: [menuPermissionSchema], default: [] },

    grantedPermissions: { type: [String], default: [] },
    ungrantedPermissions: { type: [String], default: [] },

    isActive: { type: Boolean, default: true },
    isApprovedByParent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

childAdminSchema.set("toJSON", { virtuals: true });
childAdminSchema.set("toObject", { virtuals: true });

module.exports = prithuDB.model("Child_Admin", childAdminSchema, "ChildAdmins");
