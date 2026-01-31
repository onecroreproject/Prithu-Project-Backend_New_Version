const fs = require('fs');
const path = require('path');

const BASE_MEDIA_DIR = path.join(__dirname, '../media');

/**
 * Ensure directory exists
 */
const ensureDir = (dirPath) => {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
};

/**
 * Generate a timestamped filename
 */
const generateFilename = (originalName) => {
    const now = new Date();
    const timestamp = now.toISOString().replace(/[-:T]/g, '').split('.')[0]; // YYYYMMDDHHMMSS
    const random = Math.random().toString(36).substring(2, 8);
    const ext = path.extname(originalName);
    return `${timestamp}_${random}${ext}`;
};

/**
 * Save file to local storage based on the requested structure
 */
exports.saveFile = async (file, options = {}) => {
    const {
        type, // 'user', 'admin', 'child-admin', 'feed', 'upload', 'temp'
        id,   // userId, adminId, etc.
        subType, // 'avatar', 'video', 'image', etc.
        categorySlug, // for feeds
        jobId, // for temp
        isModify = false
    } = options;

    let targetDir = BASE_MEDIA_DIR;

    switch (type) {
        case 'user':
            targetDir = path.join(BASE_MEDIA_DIR, 'users', id, 'avatar', isModify ? 'modifyavatar' : 'original');
            break;
        case 'admin':
            targetDir = path.join(BASE_MEDIA_DIR, 'admins', id, 'avatar');
            break;
        case 'child-admin':
            targetDir = path.join(BASE_MEDIA_DIR, 'child-admins', id, 'avatar');
            break;
        case 'feed':
            const today = new Date().toISOString().split('T')[0];
            targetDir = path.join(BASE_MEDIA_DIR, 'feeds', categorySlug || 'uncategorized', today, subType || 'media');
            break;
        case 'upload':
            targetDir = path.join(BASE_MEDIA_DIR, 'uploads', subType === 'video' ? 'videos' : 'images');
            break;
        case 'temp':
            targetDir = path.join(BASE_MEDIA_DIR, 'temp', jobId || 'default');
            break;
        default:
            targetDir = path.join(BASE_MEDIA_DIR, 'uploads', 'others');
    }

    ensureDir(targetDir);

    const fileName = generateFilename(file.originalname);
    const filePath = path.join(targetDir, fileName);

    // If file has buffer (from memoryStorage)
    if (file.buffer) {
        fs.writeFileSync(filePath, file.buffer);
    } else if (file.path) {
        // If file is already on disk (from diskStorage) - move it
        fs.renameSync(file.path, filePath);
    } else {
        throw new Error('No file content found for saving');
    }

    // Generate relative path for URL (relative to the base media directory)
    const relativePath = path.relative(BASE_MEDIA_DIR, filePath).replace(/\\/g, '/');
    const dbPath = `/media/${relativePath}`;
    const backendUrl = process.env.BACKEND_URL || '';

    return {
        path: filePath, // Absolute FS path
        dbPath: dbPath,  // Path to store in DB (/media/...)
        url: exports.getMediaUrl(dbPath), // Full URL for immediate response
        filename: fileName,
        mimeType: file.mimetype,
        size: file.size
    };
};

exports.getMediaUrl = (path) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    const backendUrl = process.env.BACKEND_URL || '';
    const cleanBaseUrl = backendUrl.endsWith('/') ? backendUrl.slice(0, -1) : backendUrl;
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;

    return `${cleanBaseUrl}${normalizedPath}`;
};

exports.BASE_MEDIA_DIR = BASE_MEDIA_DIR;
