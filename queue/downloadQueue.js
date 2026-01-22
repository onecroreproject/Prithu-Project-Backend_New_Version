const createQueue = require("../queue");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const { getIO } = require("../middlewares/webSocket");
const { v4: uuidv4 } = require('uuid');

const downloadQueue = createQueue("download-queue");

// Ensure temp directory exists
const ensureDir = (dir) => {
    try {
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    } catch (err) {
        console.error(`[FS] Failed to create directory ${dir}:`, err.message);
    }
};

const { pipeline } = require('stream/promises');

// Helper: Download file from URL
const downloadFile = async (url, dest) => {
    let writer;
    try {
        writer = fs.createWriteStream(dest);
        const response = await axios({
            url,
            method: 'GET',
            responseType: 'stream',
            timeout: 30000 // 30s timeout
        });

        await pipeline(response.data, writer);
        return true;
    } catch (err) {
        if (writer) {
            writer.destroy();
            // Try to delete partial file if it exists and is not locked
            if (fs.existsSync(dest)) {
                try { fs.unlinkSync(dest); } catch (e) { /* ignore locked file */ }
            }
        }
        throw new Error(`Failed to download file from ${url}: ${err.message}`);
    }
};

// Helper: Get video duration/dimensions to calculate percentages
const getVideoMetadata = (filePath) => {
    return new Promise((resolve, reject) => {
        ffmpeg.ffprobe(filePath, (err, metadata) => {
            if (err) return reject(err);
            const stream = metadata.streams.find(s => s.codec_type === 'video');
            resolve({
                width: stream.width,
                height: stream.height,
                duration: metadata.format.duration
            });
        });
    });
};

downloadQueue.process(async (job) => {
    const { feed, userId, viewer, designMetadata } = job.data;
    const jobId = job.id;

    console.log(`[Job ${jobId}] Starting video processing for Feed ID: ${feed._id}`);
    console.log(`[Job ${jobId}] Viewer:`, viewer);
    job.progress(10); // STARTED

    // Unique temp folder for this job
    const tempDir = path.join(__dirname, "../uploads/temp_processing", jobId);
    ensureDir(tempDir);

    const finalOutputName = `processed_${jobId}.mp4`;
    const finalOutputPath = path.join(__dirname, "../uploads", finalOutputName);

    const BACKEND_URL = process.env.BACKEND_URL || 'https://prithubackend.1croreprojects.com';

    try {
        const io = getIO();
        if (io) io.to(userId).emit("download-progress", { jobId, progress: 10, status: "processing" });

        // 1. GET SOURCE VIDEO
        let videoPath = "";
        if (feed.files && feed.files.length > 0 && feed.files[0].localPath && fs.existsSync(feed.files[0].localPath)) {
            videoPath = feed.files[0].localPath;
        }

        if (!videoPath) {
            let videoUrl = feed.contentUrl || feed.files?.[0]?.url;
            if (!videoUrl) throw new Error("No video source found for feed");

            // Ensure absolute URL
            if (!videoUrl.startsWith('http')) videoUrl = `${BACKEND_URL}${videoUrl.startsWith('/') ? '' : '/'}${videoUrl}`;

            const tempVideoPath = path.join(tempDir, "source.mp4");
            await downloadFile(videoUrl, tempVideoPath);
            videoPath = tempVideoPath;
        }

        job.progress(30);

        // 2. PREPARE OVERLAYS
        const videoMeta = await getVideoMetadata(videoPath);
        const { width: VW, height: VH } = videoMeta;

        const overlayInputs = [];
        const combinedFilters = [];
        let inputIndex = 1;
        let currentBase = "0:v";
        let overlayInfos = [];

        if (designMetadata && designMetadata.overlayElements) {
            for (const el of designMetadata.overlayElements) {
                if (!el.visible) continue;

                let mediaUrl = null;

                // Handle Dynamic Avatar
                if (el.type === 'avatar') {
                    mediaUrl = viewer?.profileAvatar || el.mediaConfig?.url;
                }
                // Handle Logo with Fallback
                // Handle Logo with Fallback (Local Backend Logo)
                else if (el.type === "logo") {
                    mediaUrl = el.mediaConfig?.url || `${BACKEND_URL}/logo/prithulogo.png` || `http://localhost:5000/logo/prithulogo.png`;
                }


                if (mediaUrl) {
                    // Normalize URL
                    if (!mediaUrl.startsWith('http')) {
                        mediaUrl = `${BACKEND_URL}${mediaUrl.startsWith('/') ? '' : '/'}${mediaUrl}`;
                    }

                    const imgName = `overlay_${inputIndex}${path.extname(mediaUrl).split('?')[0] || '.png'}`;
                    const imgPath = path.join(tempDir, imgName);

                    try {
                        await downloadFile(mediaUrl, imgPath);
                        overlayInputs.push(imgPath);

                        const xRaw = (el.xPercent / 100) * VW;
                        const yRaw = (el.yPercent / 100) * VH;
                        const w = (el.wPercent / 100) * VW;

                        // Animation logic (simplified: linear move if enabled)
                        let xExpr = `${xRaw}`;
                        let yExpr = `${yRaw}`;

                        if (el.animation?.enabled && el.animation.direction !== 'none') {
                            const speed = el.animation.speed || 1;
                            const dist = 50 * speed; // pixels per second

                            switch (el.animation.direction) {
                                case 'left': xExpr = `${xRaw} - (t*${dist})`; break;
                                case 'right': xExpr = `${xRaw} + (t*${dist})`; break;
                                case 'top': yExpr = `${yRaw} - (t*${dist})`; break;
                                case 'bottom': yExpr = `${yRaw} + (t*${dist})`; break;
                            }
                        }

                        combinedFilters.push({
                            filter: 'scale',
                            options: `${Math.round(w)}:-1`,
                            inputs: `${inputIndex}:v`,
                            outputs: `scaled${inputIndex}`
                        });

                        overlayInfos.push({
                            label: `scaled${inputIndex}`,
                            x: xExpr,
                            y: yExpr
                        });

                        inputIndex++;
                    } catch (e) {
                        console.error(`[Job ${jobId}] Failed to fetch overlay: ${mediaUrl}`, e.message);
                    }
                }

                // Handle Dynamic Username / Text
                if (el.type === 'username' || el.type === 'text') {
                    const content = el.type === 'username' ? (viewer?.userName || "User") : (el.textConfig?.content || "");
                    if (content) {
                        const x = (el.xPercent / 100) * VW;
                        const y = (el.yPercent / 100) * VH;
                        const fontSize = Math.round((el.textConfig?.fontSize || 24) * (VH / 1080)); // scale font to resolution
                        const color = el.textConfig?.color || "white";

                        const outLabel = `v_txt_${inputIndex}`;
                        combinedFilters.push({
                            filter: 'drawtext',
                            options: {
                                text: content,
                                x: x,
                                y: y,
                                fontsize: fontSize,
                                fontcolor: color,
                                // fallback to common fonts if possible
                                fontfile: process.platform === 'win32' ? 'C\\:/Windows/Fonts/arial.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
                            },
                            inputs: currentBase,
                            outputs: outLabel
                        });
                        currentBase = outLabel;
                        inputIndex++;
                    }
                }
            }
        }

        // C. Footer (if enabled)
        if (designMetadata && designMetadata.footerConfig && designMetadata.footerConfig.enabled) {
            const footer = designMetadata.footerConfig;
            const h = (footer.heightPercent / 100) * VH;
            const y = VH - h;
            const bgColor = footer.backgroundColor || "black@0.6";
            const textColor = footer.textColor || "white";

            const footerBoxLabel = `footer_base`;
            combinedFilters.push({
                filter: 'drawbox',
                options: { y: y, width: VW, height: h, color: bgColor, t: 'fill' },
                inputs: currentBase,
                outputs: footerBoxLabel
            });
            currentBase = footerBoxLabel;

            // Footer Text Elements
            const elements = [];
            if (footer.showElements?.name && viewer?.name) elements.push(viewer.name);
            if (footer.showElements?.email && viewer?.email) elements.push(viewer.email);
            if (footer.showElements?.phone && viewer?.phone) elements.push(viewer.phone);

            if (elements.length > 0) {
                const footerText = elements.join(' | ');
                const fontSize = Math.round(18 * (VH / 1080));
                const outLabel = `footer_txt`;
                combinedFilters.push({
                    filter: 'drawtext',
                    options: {
                        text: footerText,
                        x: '(w-text_w)/2', // centered
                        y: y + (h - fontSize) / 2,
                        fontsize: fontSize,
                        fontcolor: textColor,
                        fontfile: process.platform === 'win32' ? 'C\\:/Windows/Fonts/arial.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
                    },
                    inputs: currentBase,
                    outputs: outLabel
                });
                currentBase = outLabel;
            }
        }

        // Apply Image Overlays sequentially
        overlayInfos.forEach((info, idx) => {
            const outLabel = `v_img_${idx}`;
            combinedFilters.push({
                filter: 'overlay',
                options: { x: info.x, y: info.y },
                inputs: [currentBase, info.label],
                outputs: outLabel
            });
            currentBase = outLabel;
        });

        // 3. BUILD FFMPEG COMMAND
        let command = ffmpeg(videoPath);
        overlayInputs.forEach(input => command.input(input));

        if (combinedFilters.length > 0) {
            command.complexFilter(combinedFilters, currentBase);
        }

        job.progress(50);

        // 4. RUN FFMPEG
        await new Promise((resolve, reject) => {
            command
                .output(finalOutputPath)
                .on('start', (cmdLine) => console.log(`[Job ${jobId}] FFmpeg started`))
                .on('progress', (p) => {
                    if (p.percent) {
                        const jobProg = 50 + (p.percent * 0.4);
                        job.progress(Math.floor(jobProg));
                        if (io) io.to(userId).emit("download-progress", { jobId, progress: Math.floor(jobProg), status: "processing" });
                    }
                })
                .on('error', (err) => reject(err))
                .on('end', () => resolve())
                .run();
        });

        job.progress(100);

        // 5. CLEANUP & RETURN
        try {
            if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupErr) {
            console.warn(`[Job ${jobId}] Cleanup warning:`, cleanupErr.message);
        }

        const downloadUrl = `${BACKEND_URL}/uploads/${finalOutputName}`;
        if (io) io.to(userId).emit("download-complete", { jobId, progress: 100, status: "ready", downloadUrl });

        return { downloadUrl, processedFilePath: finalOutputPath };

    } catch (err) {
        console.error(`[Job ${jobId}] Failed:`, err);
        const io = getIO();
        if (io) io.to(userId).emit("download-failed", { jobId, error: err.message });
        try {
            if (fs.existsSync(tempDir)) fs.rmSync(tempDir, { recursive: true, force: true });
        } catch (cleanupErr) {
            console.warn(`[Job ${jobId}] Failed-state cleanup warning:`, cleanupErr.message);
        }
        throw err;
    }
});

// Event Listeners (Global)
downloadQueue.on('completed', (job, result) => {
    console.log(`[Queue] Job ${job.id} completed! Result: ${result.downloadUrl}`);
});

downloadQueue.on('failed', (job, err) => {
    console.error(`[Queue] Job ${job.id} failed: ${err.message}`);
});

downloadQueue.on('active', (job) => {
    console.log(`[Queue] Job ${job.id} is now active.`);
});

module.exports = downloadQueue;
