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

// Helper: Escape text for FFmpeg drawtext filter
const escapeDrawText = (txt = "") => {
    return String(txt)
        .replace(/\\/g, "\\\\")
        .replace(/:/g, "\\:")
        .replace(/'/g, "\\'")
        .replace(/,/g, "\\,")
        .replace(/\n/g, " ")
        .replace(/\[/g, "\\[")
        .replace(/\]/g, "\\]")
        .replace(/\{/g, "\\{")
        .replace(/\}/g, "\\}")
        .trim();
};

// Helper: Convert rgba() to ffmpeg color format
const normalizeFfmpegColor = (c) => {
    if (!c) return "black@0.6";

    // Already in ffmpeg format
    if (c.includes("@")) return c;

    // Check for rgba format: rgba(0,0,0,0.7) or rgb(0,0,0)
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (m) {
        const r = Number(m[1]);
        const g = Number(m[2]);
        const b = Number(m[3]);
        const a = m[4] !== undefined ? Number(m[4]) : 1;

        const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
        return `0x${hex}@${a}`;
    }

    // Check for hex format: #RRGGBB or #RRGGBBAA
    const hexMatch = c.match(/^#?([A-Fa-f0-9]{6})([A-Fa-f0-9]{2})?$/);
    if (hexMatch) {
        const hex = hexMatch[1];
        const alpha = hexMatch[2] ? (parseInt(hexMatch[2], 16) / 255).toFixed(2) : "1.0";
        return `0x${hex}@${alpha}`;
    }

    // Support named colors (white, red, etc.)
    if (/^[a-zA-Z]+$/.test(c)) return c;

    // Default fallback
    return "black@0.6";
};

downloadQueue.process(async (job) => {
    const { feed, userId, viewer, designMetadata } = job.data;
    const jobId = job.id;
    const OUT_W = 1080;
    const OUT_H = 1920;

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

        // 1. GET SOURCE MEDIA
        let mediaUrl = feed.mediaUrl || feed.files?.[0]?.url;
        if (!mediaUrl) throw new Error("No media source found for feed");

        // Ensure absolute URL
        if (!mediaUrl.startsWith("http")) {
            mediaUrl = `${BACKEND_URL}${mediaUrl.startsWith("/") ? "" : "/"}${mediaUrl}`;
        }

        // Determine post type - FIXED: Use only postType, not uploadType
        const postType = feed.postType || "image";
        const isVideoPost = postType === "video";
        const isImagePost = postType === "image" || postType === "image+audio";

        const tempSourcePath = path.join(tempDir, isVideoPost ? "source.mp4" : "source.jpg");
        await downloadFile(mediaUrl, tempSourcePath);

        const sourcePath = tempSourcePath;
        const isSourceImage = isImagePost;

        job.progress(30);

        // 2. GET MEDIA METADATA & CALCULATE DIMENSIONS
        const sourceMeta = await getVideoMetadata(sourcePath);
        const sourceW = sourceMeta.width;
        const sourceH = sourceMeta.height;

        const footerConfig = designMetadata?.footerConfig;
        const footerEnabled = !!footerConfig?.enabled;
        const footerH = footerEnabled ? Math.round((footerConfig.heightPercent / 100) * OUT_H) : 0;
        const mediaH = OUT_H - footerH;

        // Calculate actual scaled dimensions of media
        const scaleFactor = Math.min(OUT_W / sourceW, mediaH / sourceH);
        const actualMediaW = Math.round(sourceW * scaleFactor);
        const actualMediaH = Math.round(sourceH * scaleFactor);
        const paddingX = (OUT_W - actualMediaW) / 2;
        const paddingY = (mediaH - actualMediaH) / 2;

        // Normalize footer background color
        const footerBgColor = normalizeFfmpegColor(footerConfig?.backgroundColor);

        // 3. BUILD BASE CANVAS
        let currentBase = "base";
        const combinedFilters = [];

        // Scale and pad media to fit media area
        combinedFilters.push({
            filter: "scale",
            options: `w=${OUT_W}:h=${mediaH}:force_original_aspect_ratio=decrease`,
            inputs: "0:v",
            outputs: "scaled_base"
        });

        combinedFilters.push({
            filter: "pad",
            options: `w=${OUT_W}:h=${mediaH}:x=(ow-iw)/2:y=(oh-ih)/2:color=black@0.0`,
            inputs: "scaled_base",
            outputs: "padded_base"
        });

        // Extend canvas to full OUT_H (add footer space)
        combinedFilters.push({
            filter: "pad",
            options: `w=${OUT_W}:h=${OUT_H}:x=0:y=0:color=black@0.0`,
            inputs: "padded_base",
            outputs: currentBase
        });

        // 4. PREPARE OVERLAYS
        const overlayInputs = [];
        let inputIndex = 1; // 0 is source video
        let filterIndex = 1; // For unique filter output labels

        // Sort overlays by z-index
        const overlayElements = [...(designMetadata?.overlayElements || []).filter(el => el.visible !== false)]
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        // Animation helper
        const getStartXY = (direction, endX, endY) => {
            const dir = (direction || "").toLowerCase();
            let startX = endX;
            let startY = endY;
            if (dir.includes("left")) startX = -OUT_W;
            if (dir.includes("right")) startX = OUT_W * 2;
            if (dir.includes("top")) startY = -mediaH;
            if (dir.includes("bottom")) startY = mediaH * 2;
            return { startX, startY };
        };

        const buildFreezeExpr = (start, end, dur) => {
            const s = Number(start).toFixed(2);
            const e = Number(end).toFixed(2);
            const d = Number(dur).toFixed(2);
            // Wrap values in parens to avoid negative sign issues like --
            return `if(lt(t,${d}),(${s})+(${e}-(${s}))*(t/${d}),(${e}))`;
        };

        for (const el of overlayElements) {
            let overlayMediaUrl = null;
            if (el.type === 'avatar') overlayMediaUrl = viewer?.profileAvatar || el.mediaConfig?.url;
            else if (el.type === "logo") overlayMediaUrl = el.mediaConfig?.url || `${BACKEND_URL}/logo/prithulogo.png`;

            if (overlayMediaUrl) {
                if (!overlayMediaUrl.startsWith('http')) overlayMediaUrl = `${BACKEND_URL}/${overlayMediaUrl}`;
                const imgPath = path.join(tempDir, `overlay_${inputIndex}.png`);

                try {
                    await downloadFile(overlayMediaUrl, imgPath);
                    overlayInputs.push(imgPath);

                    const xRaw = (el.xPercent / 100) * OUT_W;
                    const yRaw = (el.yPercent / 100) * mediaH;
                    const wPercentValue = el.wPercent || 20;
                    const scaleW = Math.max(10, Math.round((wPercentValue / 100) * OUT_W));

                    let xExpr = `${xRaw}`, yExpr = `${yRaw}`;
                    if (el.animation?.enabled && el.animation.direction !== "none") {
                        const dur = Number(el.animation.speed || 1);
                        const { startX, startY } = getStartXY(el.animation.direction, xRaw, yRaw);
                        xExpr = buildFreezeExpr(startX, xRaw, dur);
                        yExpr = buildFreezeExpr(startY, yRaw, dur);
                    }

                    const rawLabel = `raw${filterIndex}`;
                    const fmtLabel = `fmt${filterIndex}`;
                    const maskedLabel = `masked${filterIndex}`;
                    const overlayLabel = `over${filterIndex}`;

                    // Masking logic for avatar
                    if (el.type === 'avatar') {
                        const shape = el.avatarConfig?.shape || el.shape || 'circle';
                        const isRound = shape === 'circle' || shape === 'round';

                        // 1. Scale and Crop to square
                        const scaledLabel = `scaled_sq${filterIndex}`;
                        combinedFilters.push({
                            filter: 'scale',
                            options: `${scaleW}:${scaleW}:force_original_aspect_ratio=increase`,
                            inputs: `${inputIndex}:v`,
                            outputs: scaledLabel
                        });

                        combinedFilters.push({
                            filter: 'crop',
                            options: `${scaleW}:${scaleW}`,
                            inputs: scaledLabel,
                            outputs: rawLabel
                        });

                        // 2. Format to RGBA
                        combinedFilters.push({
                            filter: 'format',
                            options: 'rgba',
                            inputs: rawLabel,
                            outputs: fmtLabel
                        });

                        // 3. Apply Alpha Mask (Circle + Soft Bottom Fade)
                        const alphaExpr = isRound
                            ? `if(lt(sqrt(pow(x-w/2,2)+pow(y-h/2,2)),w/2),if(gt(y,h*0.75),255*(1-(y-h*0.75)/(h*0.25)),255),0)`
                            : `if(gt(y,h*0.8),255*(1-(y-h*0.8)/(h*0.2)),255)`;

                        combinedFilters.push({
                            filter: 'geq',
                            options: {
                                r: 'r(x,y)',
                                g: 'g(x,y)',
                                b: 'b(x,y)',
                                a: alphaExpr
                            },
                            inputs: fmtLabel,
                            outputs: maskedLabel
                        });
                    } else {
                        combinedFilters.push({
                            filter: 'scale',
                            options: { w: scaleW, h: -1 },
                            inputs: `${inputIndex}:v`,
                            outputs: maskedLabel
                        });
                    }

                    combinedFilters.push({
                        filter: 'overlay',
                        options: `x='${xExpr}':y='${yExpr}'`,
                        inputs: [currentBase, maskedLabel],
                        outputs: overlayLabel
                    });

                    currentBase = overlayLabel;
                    inputIndex++;
                    filterIndex++;
                } catch (e) { console.error(`Failed overlay: ${overlayMediaUrl}`, e.message); }
            }

            if (el.type === 'username' || el.type === 'text') {
                const content = el.type === 'username' ? (viewer?.userName || "User") : (el.textConfig?.content || "");
                if (content) {
                    const x = (el.xPercent / 100) * OUT_W;
                    const y = (el.yPercent / 100) * mediaH;
                    const fontSize = Math.round((el.textConfig?.fontSize || 24) * 2.5);

                    const textLabel = `text${filterIndex}`;
                    combinedFilters.push({
                        filter: 'drawtext',
                        options: {
                            text: escapeDrawText(content),
                            x: Math.round(x), y: Math.round(y),
                            fontsize: fontSize, fontcolor: normalizeFfmpegColor(el.textConfig?.color || "white"),
                            fontfile: process.platform === 'win32' ? 'C\\\\:/Windows/Fonts/arial.ttf' : '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'
                        },
                        inputs: currentBase,
                        outputs: textLabel
                    });
                    currentBase = textLabel;
                    filterIndex++;
                }
            }
        }

        // 5. ADD FOOTER (Centered to Media Width)
        if (footerEnabled) {
            const footerY = mediaH;
            const footerX = paddingX;
            const footerW = actualMediaW;

            combinedFilters.push({
                filter: "drawbox",
                options: {
                    x: Math.round(footerX), y: Math.round(footerY),
                    w: Math.round(footerW), h: footerH,
                    c: footerBgColor, t: "fill"
                },
                inputs: currentBase,
                outputs: "footer_bg"
            });
            currentBase = "footer_bg";

            const showElements = footerConfig?.showElements || {};
            const socialIcons = footerConfig?.socialIcons || [];
            const visibleSocialIcons = socialIcons.filter(i => i.visible);

            const FONT_SIZE_USER = 32;
            const FONT_SIZE_INFO = 36;
            const PADDING_INNER = 40;
            const ROW_1_Y = Math.round(footerY + (footerH * 0.33) - (FONT_SIZE_USER / 2));
            const ROW_2_Y = Math.round(footerY + (footerH * 0.66) - (FONT_SIZE_INFO / 2));
            const fontPath = process.platform === "win32" ? "C\\\\:/Windows/Fonts/arial.ttf" : "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf";

            if (showElements.name) {
                const centerName = visibleSocialIcons.length === 0;
                const nameLabel = `footer_name`;
                combinedFilters.push({
                    filter: "drawtext",
                    options: {
                        text: escapeDrawText(viewer.userName || "User"),
                        x: centerName ? `(w-text_w)/2` : Math.round(footerX + PADDING_INNER),
                        y: ROW_1_Y, fontsize: FONT_SIZE_USER,
                        fontcolor: normalizeFfmpegColor(footerConfig?.textColor || "white"), fontfile: fontPath
                    },
                    inputs: currentBase,
                    outputs: nameLabel
                });
                currentBase = nameLabel;
            }

            if (visibleSocialIcons.length > 0) {
                const iconSize = 40;
                const iconGap = 20;
                let currentIconX = footerX + footerW - PADDING_INNER - iconSize;

                for (let i = 0; i < visibleSocialIcons.length; i++) {
                    const icon = visibleSocialIcons[i];
                    const platform = (icon.platform || "").toLowerCase();
                    const iconUrl = `https://cdn.simpleicons.org/${platform}`;
                    const iconPath = path.join(tempDir, `social_${i}.png`);

                    try {
                        await downloadFile(iconUrl, iconPath);
                        overlayInputs.push(iconPath);

                        const iconInputIndex = inputIndex;
                        const iconNegatedLabel = `social_neg${i}`;
                        const iconScaledLabel = `social_scaled_${i}`;
                        const iconOverlayLabel = `social_overlay_${i}`;

                        // Invert color (SimpleIcons are black by default, we need white)
                        combinedFilters.push({
                            filter: 'negate',
                            inputs: `${iconInputIndex}:v`,
                            outputs: iconNegatedLabel
                        });

                        combinedFilters.push({
                            filter: 'scale',
                            options: `${iconSize}:${iconSize}`,
                            inputs: iconNegatedLabel,
                            outputs: iconScaledLabel
                        });

                        combinedFilters.push({
                            filter: 'overlay',
                            options: `x=${Math.round(currentIconX)}:y=${ROW_1_Y - 5}`,
                            inputs: [currentBase, iconScaledLabel],
                            outputs: iconOverlayLabel
                        });

                        currentBase = iconOverlayLabel;
                        currentIconX -= (iconSize + iconGap);
                        inputIndex++;
                    } catch (e) { console.error(`Social icon failed: ${iconUrl}`, e.message); }
                }
            }

            if (showElements.email || showElements.phone) {
                if (showElements.email) {
                    const emailLabel = `footer_email`;
                    combinedFilters.push({
                        filter: "drawtext",
                        options: {
                            text: escapeDrawText(viewer.email || ""),
                            x: Math.round(footerX + PADDING_INNER), y: ROW_2_Y,
                            fontsize: FONT_SIZE_INFO, fontcolor: normalizeFfmpegColor(footerConfig?.textColor || "white"), fontfile: fontPath
                        },
                        inputs: currentBase,
                        outputs: emailLabel
                    });
                    currentBase = emailLabel;
                }
                if (showElements.phone) {
                    const phoneLabel = `footer_phone`;
                    combinedFilters.push({
                        filter: "drawtext",
                        options: {
                            text: escapeDrawText(viewer.phone || viewer.phoneNumber || ""),
                            x: `${Math.round(footerX + footerW - PADDING_INNER)} - text_w`,
                            y: ROW_2_Y, fontsize: FONT_SIZE_INFO,
                            fontcolor: normalizeFfmpegColor(footerConfig?.textColor || "white"), fontfile: fontPath
                        },
                        inputs: currentBase,
                        outputs: phoneLabel
                    });
                    currentBase = phoneLabel;
                }
            }
        }

        job.progress(50);

        // 6. BUILD FFMPEG COMMAND
        let command = ffmpeg();

        if (isSourceImage) {
            // Make image into video (8 seconds default)
            command = command
                .input(sourcePath)
                .inputOptions(["-loop 1"])
                .outputOptions(["-t 8"]);
        } else {
            command = command.input(sourcePath);
        }

        // Add overlay inputs
        overlayInputs.forEach(input => command.input(input));

        // Set up complex filters
        console.log(`[Job ${jobId}] Combined Filters:`, JSON.stringify(combinedFilters, null, 2));
        command.complexFilter(combinedFilters, currentBase);

        // Configure output - FIXED: Always map audio from source
        const outputOptions = [
            "-map", "0:a?",  // FIXED: Map audio from source (if exists)
            "-c:v", "libx264",
            "-c:a", "aac",   // FIXED: Always use AAC for audio
            "-b:a", "128k",
            "-pix_fmt", "yuv420p",
            "-preset", "veryfast",
            "-movflags", "+faststart"
        ];

        // Handle audio for image+audio posts
        if (postType === "image+audio" && feed.audioFile?.url) {
            let audioUrl = feed.audioFile.url;
            if (!audioUrl.startsWith("http")) {
                audioUrl = `${BACKEND_URL}${audioUrl.startsWith("/") ? "" : "/"}${audioUrl}`;
            }

            const tempAudioPath = path.join(tempDir, "audio.mp3");
            await downloadFile(audioUrl, tempAudioPath);

            command.input(tempAudioPath);

            const audioInputIndex = 1 + overlayInputs.length;

            // Remove the default "0:a?" mapping and replace it cleanly
            outputOptions[2] = "-map";
            outputOptions[3] = `${audioInputIndex}:a`;
        }

        command.outputOptions(outputOptions);

        // 7. RUN FFMPEG
        await new Promise((resolve, reject) => {
            command
                .output(finalOutputPath)
                .on('start', (cmdLine) => {
                    console.log(`[Job ${jobId}] FFmpeg command: ${cmdLine}`);
                    console.log(`[Job ${jobId}] FFmpeg started`);
                })
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

        // 8. CLEANUP & RETURN
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