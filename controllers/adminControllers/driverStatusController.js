const { google } = require("googleapis");
const { oAuth2Client } = require("../../middlewares/services/googleDriveMedia/googleDriverAuth");
const { getFeedUploadFolder } = require("../../middlewares/services/googleDriveMedia/googleDriveFolderStructure");
const Feed = require("../../models/feedModel");

const drive = google.drive({
  version: "v3",
  auth: oAuth2Client,
});

/* --------------------------------------------------
   HELPER: GET FOLDER SIZE + COUNT
-------------------------------------------------- */
async function getFolderStats(folderId) {
  let totalSize = 0;
  let totalFiles = 0;
  let pageToken = null;

  do {
    const res = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields: "nextPageToken, files(size, mimeType)",
      pageToken,
    });

    for (const file of res.data.files) {
      if (file.size) totalSize += Number(file.size);
      totalFiles++;
    }

    pageToken = res.data.nextPageToken;
  } while (pageToken);

  return { totalSize, totalFiles };
}

/* --------------------------------------------------
   CONTROLLER
-------------------------------------------------- */
exports.getDriveDashboard = async (req, res) => {
  try {
    /* ---------------------------
       1️⃣ DRIVE ACCOUNT STATUS
    --------------------------- */
    const about = await drive.about.get({
      fields: "storageQuota,user",
    });

    const quota = about.data.storageQuota;

    /* ---------------------------
       2️⃣ RESOLVE ALL FOLDERS
    --------------------------- */
    const adminImages = await getFeedUploadFolder(oAuth2Client, "Admin", "image");
    const adminVideos = await getFeedUploadFolder(oAuth2Client, "Admin", "video");

    const childImages = await getFeedUploadFolder(oAuth2Client, "Child_Admin", "image");
    const childVideos = await getFeedUploadFolder(oAuth2Client, "Child_Admin", "video");

    const userImages = await getFeedUploadFolder(oAuth2Client, "User", "image");
    const userVideos = await getFeedUploadFolder(oAuth2Client, "User", "video");

    /* ---------------------------
       3️⃣ CALCULATE USAGE
    --------------------------- */
    const adminImg = await getFolderStats(adminImages);
    const adminVid = await getFolderStats(adminVideos);

    const childImg = await getFolderStats(childImages);
    const childVid = await getFolderStats(childVideos);

    const userImg = await getFolderStats(userImages);
    const userVid = await getFolderStats(userVideos);

    const imageBytes =
      adminImg.totalSize + childImg.totalSize + userImg.totalSize;

    const videoBytes =
      adminVid.totalSize + childVid.totalSize + userVid.totalSize;

    /* ---------------------------
       4️⃣ RECENT FILES
    --------------------------- */
    const recent = await drive.files.list({
      q: "trashed=false",
      orderBy: "createdTime desc",
      pageSize: 10,
      fields: "files(id,name,size,mimeType,createdTime)",
    });

    /* ---------------------------
       5️⃣ RESPONSE
    --------------------------- */
    return res.json({
      success: true,

      driveAccount: about.data.user.emailAddress,

      storage: {
        limitGB: quota.limit
          ? (quota.limit / 1024 ** 3).toFixed(2)
          : "Unlimited",
        usedGB: (quota.usage / 1024 ** 3).toFixed(2),
        freeGB: quota.limit
          ? ((quota.limit - quota.usage) / 1024 ** 3).toFixed(2)
          : null,
        usagePercent: quota.limit
          ? ((quota.usage / quota.limit) * 100).toFixed(2)
          : null,
      },

      usage: {
        imagesGB: (imageBytes / 1024 ** 3).toFixed(2),
        videosGB: (videoBytes / 1024 ** 3).toFixed(2),
      },

      roles: {
        admin: {
          imagesGB: (adminImg.totalSize / 1024 ** 3).toFixed(2),
          videosGB: (adminVid.totalSize / 1024 ** 3).toFixed(2),
          files: adminImg.totalFiles + adminVid.totalFiles,
        },
        childAdmin: {
          imagesGB: (childImg.totalSize / 1024 ** 3).toFixed(2),
          videosGB: (childVid.totalSize / 1024 ** 3).toFixed(2),
          files: childImg.totalFiles + childVid.totalFiles,
        },
        users: {
          imagesGB: (userImg.totalSize / 1024 ** 3).toFixed(2),
          videosGB: (userVid.totalSize / 1024 ** 3).toFixed(2),
          files: userImg.totalFiles + userVid.totalFiles,
        },
      },

      recentUploads: recent.data.files.map((f) => ({
        id: f.id,
        name: f.name,
        sizeMB: f.size ? (f.size / 1024 / 1024).toFixed(2) : 0,
        type: f.mimeType.startsWith("video") ? "video" : "image",
        createdAt: f.createdTime,
      })),

      oauth: {
        status: "active",
        mode: "testing",
        lastChecked: new Date(),
      },
    });

  } catch (err) {
    console.error("❌ Drive dashboard error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to load Drive dashboard",
      error: err.message,
    });
  }
};






exports.driveCommand = async (req, res) => {
  try {
    const { action, fileId, feedId, targetFolderId } = req.body;

    if (!action) {
      return res.status(400).json({ message: "Action is required" });
    }

    switch (action) {
      /* ----------------------------------
         DELETE FILE FROM DRIVE
      ---------------------------------- */
      case "DELETE_FILE": {
        if (!fileId) {
          return res.status(400).json({ message: "fileId required" });
        }

        await drive.files.delete({ fileId });

        if (feedId) {
          await Feed.findByIdAndUpdate(feedId, {
            storageType: "deleted",
            driveFileId: null,
            contentUrl: null,
          });
        }

        return res.json({
          success: true,
          message: "Drive file deleted successfully",
        });
      }

      /* ----------------------------------
         MOVE FILE TO ANOTHER FOLDER
      ---------------------------------- */
      case "MOVE_FILE": {
        if (!fileId || !targetFolderId) {
          return res
            .status(400)
            .json({ message: "fileId & targetFolderId required" });
        }

        // Get current parents
        const file = await drive.files.get({
          fileId,
          fields: "parents",
        });

        await drive.files.update({
          fileId,
          addParents: targetFolderId,
          removeParents: file.data.parents.join(","),
        });

        return res.json({
          success: true,
          message: "File moved successfully",
        });
      }

      /* ----------------------------------
         MAKE FILE PRIVATE
      ---------------------------------- */
      case "MAKE_PRIVATE": {
        if (!fileId) {
          return res.status(400).json({ message: "fileId required" });
        }

        const perms = await drive.permissions.list({ fileId });

        for (const perm of perms.data.permissions) {
          if (perm.type === "anyone") {
            await drive.permissions.delete({
              fileId,
              permissionId: perm.id,
            });
          }
        }

        return res.json({
          success: true,
          message: "File is now private",
        });
      }

      /* ----------------------------------
         MAKE FILE PUBLIC
      ---------------------------------- */
      case "MAKE_PUBLIC": {
        if (!fileId) {
          return res.status(400).json({ message: "fileId required" });
        }

        await drive.permissions.create({
          fileId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });

        return res.json({
          success: true,
          message: "File is now public",
        });
      }

      /* ----------------------------------
         RESYNC FILE STATUS
      ---------------------------------- */
      case "RESYNC": {
        if (!fileId || !feedId) {
          return res
            .status(400)
            .json({ message: "fileId & feedId required" });
        }

        const file = await drive.files.get({
          fileId,
          fields: "id,name,trashed,size",
        });

        await Feed.findByIdAndUpdate(feedId, {
          driveFileId: file.data.id,
          storageType: file.data.trashed ? "deleted" : "gdrive",
        });

        return res.json({
          success: true,
          message: "Drive and DB resynced",
        });
      }

      default:
        return res.status(400).json({
          message: "Invalid action",
        });
    }

  } catch (err) {
    console.error("❌ Drive command error:", err);
    return res.status(500).json({
      success: false,
      message: "Drive command failed",
      error: err.message,
    });
  }
};

