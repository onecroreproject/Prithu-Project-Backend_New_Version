const multer = require("multer");
const path = require("path");
const crypto = require("crypto");
const { v4: uuidv4 } = require("uuid");

// Use memory storage so we can process the buffer and then decide where to save it
const storage = multer.memoryStorage();

const validateFile = (file) => {
    const allowedImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedVideoTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm', 'video/x-matroska'];
    const allowedAudioTypes = ['audio/mpeg', 'audio/mp3', 'audio/wav'];

    if (file.mimetype.startsWith('image/') && !allowedImageTypes.includes(file.mimetype)) throw new Error('Invalid image format');
    if (file.mimetype.startsWith('video/') && !allowedVideoTypes.includes(file.mimetype)) throw new Error('Invalid video format');
    if (file.mimetype.startsWith('audio/') && !allowedAudioTypes.includes(file.mimetype)) throw new Error('Invalid audio format');

    return true;
};

const upload = multer({
    storage,
    limits: { fileSize: 100 * 1024 * 1024 }, // 100MB max
    fileFilter: (req, file, cb) => {
        try {
            validateFile(file);
            cb(null, true);
        } catch (error) {
            cb(error);
        }
    }
});

/**
 * Middleware to attach basic file info and hash
 */
const processUploadedFiles = async (req, res, next) => {
    const files = req.files;
    if (!files) return next();

    try {
        const processFile = (file) => {
            const hash = crypto.createHash('md5').update(file.buffer).digest('hex');
            file.fileHash = hash;
            return file;
        };

        if (Array.isArray(files)) {
            req.localFiles = files.map(processFile);
        } else if (typeof files === 'object') {
            // For .fields() or .array()
            req.localFiles = {};
            for (const fieldname in files) {
                req.localFiles[fieldname] = files[fieldname].map(processFile);
            }

            // Flatten for controllers that expect req.localFiles as an array (like adminFeedUpload)
            // But we should be careful. Let's provide both or stay compatible.
            if (files['files']) {
                req.localFilesArr = files['files'].map(processFile);
            }
            if (files['audio']) {
                req.localAudioFile = processFile(files['audio'][0]);
            }
        } else if (req.file) {
            // For .single()
            req.localFile = processFile(req.file);
        }

        next();
    } catch (err) {
        next(err);
    }
};

module.exports = {
    upload,
    processUploadedFiles,
    validateFile
};
