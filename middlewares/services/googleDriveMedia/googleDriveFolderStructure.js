// const { google } = require("googleapis");

// const drive = google.drive({ version: "v3" });

// Simple in-memory cache (fast & safe)
const folderCache = new Map();

/**
 * Get or create folder under a parent
 */
async function getOrCreateFolder(auth, name, parentId = null) {
  drive.context._options.auth = auth;

  const cacheKey = `${parentId || "root"}:${name}`;
  if (folderCache.has(cacheKey)) {
    return folderCache.get(cacheKey);
  }

  const q = [
    `name='${name}'`,
    `mimeType='application/vnd.google-apps.folder'`,
    `trashed=false`,
    parentId ? `'${parentId}' in parents` : null,
  ]
    .filter(Boolean)
    .join(" and ");

  const res = await drive.files.list({
    q,
    fields: "files(id, name)",
    spaces: "drive",
  });

  if (res.data.files.length > 0) {
    const id = res.data.files[0].id;
    folderCache.set(cacheKey, id);
    return id;
  }

  const folderRes = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.folder",
      parents: parentId ? [parentId] : undefined,
    },
    fields: "id",
  });

  folderCache.set(cacheKey, folderRes.data.id);
  return folderRes.data.id;
}

/**
 * Resolve final upload folder based on role + type
 */
exports.getFeedUploadFolder = async (auth, roleRef, mediaType) => {
  const root = await getOrCreateFolder(auth, "Prithu_App_Feeds");

  // Normalize role
  let roleFolderName = "users";
  if (roleRef === "Admin") roleFolderName = "Admin";
  if (roleRef === "Child_Admin") roleFolderName = "ChildAdmin";

  const roleFolder = await getOrCreateFolder(auth, roleFolderName, root);

  const typeFolderName = mediaType === "video" ? "videos" : "images";
  const typeFolder = await getOrCreateFolder(
    auth,
    typeFolderName,
    roleFolder
  );

  return typeFolder;
};
