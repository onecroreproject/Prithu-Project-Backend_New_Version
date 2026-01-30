const Template = require("../../models/templateModel");
const Feed = require("../../models/feedModel");
const Categories = require("../../models/categorySchema");
const { uploadToDrive } = require("../../middlewares/services/googleDriveMedia/googleDriveUploader");
const { getAdminTemplateFolder } = require("../../middlewares/services/googleDriveMedia/googleDriveFolderStructure");
const { oAuth2Client } = require("../../middlewares/services/googleDriveMedia/googleDriverAuth");
const fs = require("fs");
const path = require("path");

// Ensure local storage directory exists
const MASKFILE_DIR = path.join(__dirname, "../../media/template/maskfile");
if (!fs.existsSync(MASKFILE_DIR)) {
    fs.mkdirSync(MASKFILE_DIR, { recursive: true });
}

function getBackendUrl(req) {
    return process.env.BACKEND_URL || `${req.protocol}://${req.get("host")}`;
}

const uploadAsset = async (file, req, folderId) => {
    if (!file || !file.buffer) {
        console.error(`❌ Missing buffer for field: ${file?.fieldname || 'unknown'}`);
        throw new Error(`MISSING_BUFFER_${file?.fieldname || 'unknown'}`);
    }

    const ext = path.extname(file.originalname).toLowerCase();
    const maskFields = ["avatarMaskVideo", "usernameMaskVideo", "footerMaskVideo", "previewImage"];

    // Check if it's a .webm file and belongs to one of the specified mask fields
    if (ext === '.webm' && maskFields.includes(file.fieldname)) {
        console.log(`📂 Saving Asset Locally: ${file.fieldname} (${file.originalname})`);

        const now = new Date();
        const timestamp = now.getFullYear().toString() +
            (now.getMonth() + 1).toString().padStart(2, '0') +
            now.getDate().toString().padStart(2, '0') + "_" +
            now.getHours().toString().padStart(2, '0') +
            now.getMinutes().toString().padStart(2, '0') +
            now.getSeconds().toString().padStart(2, '0');

        const fileName = `${timestamp}.webm`;
        const filePath = path.join(MASKFILE_DIR, fileName);
        fs.writeFileSync(filePath, file.buffer);

        const backendUrl = getBackendUrl(req);
        return {
            driveFileId: null, // No drive ID for local files
            previewUrl: `${backendUrl}/media/template/maskfile/${fileName}`,
            mimeType: file.mimetype,
            originalName: file.originalname,
            storageType: "local"
        };
    }

    console.log(`📤 Uploading Asset to Drive: ${file.fieldname} (${file.originalname}), Size: ${file.buffer.length} bytes`);

    const result = await uploadToDrive(file.buffer, file.originalname, file.mimetype, folderId);
    const backendUrl = getBackendUrl(req);
    return {
        driveFileId: result.fileId,
        previewUrl: `${backendUrl}/media/${result.fileId}`,
        mimeType: file.mimetype,
        originalName: file.originalname,
        storageType: "gdrive"
    };
};

exports.createTemplate = async (req, res) => {
    try {
        const { name, templateJson } = req.body;
        const files = req.files;

        if (!files || !files.backgroundVideo) {
            return res.status(400).json({ message: "Background video is required" });
        }

        // Check for existing template name
        const existingTemplate = await Template.findOne({ name: name.trim() });
        if (existingTemplate) {
            return res.status(400).json({ message: `A template with the name "${name}" already exists. Please choose a different name.` });
        }

        const templateData = {
            name: name.trim(),
            templateJson: typeof templateJson === 'string' ? JSON.parse(templateJson) : templateJson,
            createdBy: req.Id
        };

        const folderId = await getAdminTemplateFolder(oAuth2Client);

        templateData.backgroundVideo = await uploadAsset(files.backgroundVideo[0], req, folderId);

        if (files.avatarMaskVideo) {
            templateData.avatarMaskVideo = await uploadAsset(files.avatarMaskVideo[0], req, folderId);
        }
        if (files.usernameMaskVideo) {
            templateData.usernameMaskVideo = await uploadAsset(files.usernameMaskVideo[0], req, folderId);
        }
        if (files.footerMaskVideo) {
            templateData.footerMaskVideo = await uploadAsset(files.footerMaskVideo[0], req, folderId);
        }
        if (files.previewImage) {
            templateData.previewImage = await uploadAsset(files.previewImage[0], req, folderId);
        }

        const { categoryId, isScheduled, scheduleDate } = req.body;
        const template = await Template.create(templateData);

        // Automatically create a global Feed record for this Template
        const feedData = {
            uploadType: "template",
            uploadMode: "template",
            postType: "video",
            category: categoryId,
            templateId: template._id,
            mediaUrl: "", // No physical media initially
            postedBy: {
                userId: req.Id,
                role: "Admin"
            },
            roleRef: "Admin",
            isApproved: true,
            status: isScheduled === 'true' || isScheduled === true ? "scheduled" : "published",
            isScheduled: isScheduled === 'true' || isScheduled === true,
            scheduleDate: scheduleDate ? new Date(scheduleDate) : null
        };

        const newFeed = await Feed.create(feedData);

        // Link feed to category if provided
        if (categoryId) {
            await Categories.findByIdAndUpdate(categoryId, {
                $addToSet: { feedIds: newFeed._id }
            });
        }

        console.log(`✨ Template Created Successfully: ${template.name}`);
        res.status(201).json({ template, feedId: newFeed._id });
    } catch (error) {
        console.error("❌ Error creating template:", error);
        if (error.code === 11000) {
            return res.status(400).json({
                message: `Duplicate key error: A template with this ${Object.keys(error.keyValue)[0]} already exists.`
            });
        }
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};

exports.getAllTemplates = async (req, res) => {
    try {
        const templates = await Template.find({ isActive: true }).sort({ createdAt: -1 });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        await Template.findByIdAndUpdate(req.params.id, { isActive: false });
        res.json({ message: "Template deleted successfully" });
    } catch (error) {
        res.status(500).json({ message: "Internal server error" });
    }
};
