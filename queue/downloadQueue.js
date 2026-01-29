const createQueue = require("../queue");
const ffmpeg = require("fluent-ffmpeg");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const sharp = require("sharp");
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
        console.log(`[FS] File downloaded successfully: ${dest}`);
        return true;
    } catch (err) {
        console.error(`[FS] Download failed for ${url}:`, err.message);
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
                width: stream?.width || 0,
                height: stream?.height || 0,
                duration: metadata.format.duration
            });
        });
    });
};

// Helper: Extract dominant color using FFmpeg (scale to 1x1)
const extractDominantColor = (filePath) => {
    return new Promise((resolve) => {
        const tempPath = filePath + "_1x1.png";
        ffmpeg(filePath)
            .frames(1)
            .seekInput(0)
            .videoFilters('scale=1:1')
            .on('end', () => {
                try {
                    const data = fs.readFileSync(tempPath);
                    // Simple PNG parsing for 1x1 pixel (RGBA)
                    // Png signature (8) + IHDR (25) + IDAT ... 
                    // For a 1x1 pixel, we can just use a simpler method or a small lib
                    // But FFmpeg can also output raw data
                    ffmpeg(filePath)
                        .frames(1)
                        .seekInput(0)
                        .videoFilters('scale=1:1')
                        .format('rawvideo')
                        .pix_fmt('rgb24')
                        .on('end', () => { /* done */ })
                        .on('error', () => resolve("#1a1a1a"))
                        .pipe(require('stream').Writable({
                            write(chunk, enc, next) {
                                if (chunk.length >= 3) {
                                    const r = chunk[0].toString(16).padStart(2, '0');
                                    const g = chunk[1].toString(16).padStart(2, '0');
                                    const b = chunk[2].toString(16).padStart(2, '0');
                                    resolve(`#${r}${g}${b}`);
                                }
                                next();
                            }
                        }));
                    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
                } catch (e) {
                    resolve("#1a1a1a");
                }
            })
            .on('error', (err) => {
                // Fallback to simpler method if pipe fails
                console.warn(`[FFmpeg] Dominant color extraction failed, falling back to default:`, err.message);
                resolve("#1a1a1a");
            })
            .save(tempPath);
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
        const aVal = hexMatch[2] ? (parseInt(hexMatch[2], 16) / 255) : 1;
        if (aVal >= 0.99) return `0x${hex}`;
        return `0x${hex}@${aVal.toFixed(2)}`;
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
    const FONT_PATH = path.join(__dirname, "../assets/arial.ttf").replace(/\\/g, "/").replace(":", "\\:");

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
        console.log(`[Job ${jobId}] Source Media URL: ${mediaUrl}`);

        // Determine post type - FIXED: Use only postType, not uploadType
        const postType = feed.postType || "image";
        const isVideoPost = postType === "video";
        const isImagePost = postType === "image" || postType === "image+audio";

        const tempSourcePath = path.join(tempDir, isVideoPost ? "source.mp4" : "source.jpg");
        console.log(`[Job ${jobId}] Downloading source media to: ${tempSourcePath}`);
        await downloadFile(mediaUrl, tempSourcePath);

        const sourcePath = tempSourcePath;
        const isSourceImage = isImagePost;

        job.progress(30);
        if (io) io.to(userId).emit("download-progress", { jobId, progress: 30, status: "processing" });

        // 2. GET MEDIA METADATA & CALCULATE DIMENSIONS
        console.log(`[Job ${jobId}] Fetching metadata for source: ${sourcePath}`);
        const sourceMeta = await getVideoMetadata(sourcePath);
        console.log(`[Job ${jobId}] Source Metadata:`, sourceMeta);




        const footerConfig = designMetadata?.footerConfig;
        const footerEnabled = !!footerConfig?.enabled;
        const footerH = footerEnabled ? Math.round((footerConfig.heightPercent / 100) * OUT_H) : 0;
        const mediaH = OUT_H - footerH;

        if (isSourceImage) {
            sourceMeta.width = sourceMeta.width || OUT_W;
            sourceMeta.height = sourceMeta.height || mediaH;
        }

        const sourceW = sourceMeta.width;
        const sourceH = sourceMeta.height;

        // 🔒 safety
        if (!sourceW || !sourceH) {
            throw new Error("Invalid source dimensions (width/height is zero)");
        }

        // Calculate actual scaled dimensions of media
        const scaleFactor = Math.min(OUT_W / sourceW, mediaH / sourceH);
        const actualMediaW = Math.round(sourceW * scaleFactor);
        const actualMediaH = Math.round(sourceH * scaleFactor);
        const paddingX = (OUT_W - actualMediaW) / 2;
        const paddingY = (mediaH - actualMediaH) / 2;
        console.log(`[Job ${jobId}] Calculated Dimensions - MediaH: ${mediaH}, FooterH: ${footerH}, ActualW: ${actualMediaW}, ActualH: ${actualMediaH}, PaddingX: ${paddingX}, PaddingY: ${paddingY}`);

        // Auto extract dominant color if requested
        let dominantColor = footerConfig?.backgroundColor || "#1a1a1a";
        if (footerConfig?.useDominantColor) {
            dominantColor = await extractDominantColor(sourcePath);
            console.log(`[Job ${jobId}] Extracted dominant color: ${dominantColor}`);
        }

        // Normalize footer background color
        const footerBgColor = normalizeFfmpegColor(dominantColor);

        // 3. INITIALIZE FFMPEG COMMAND
        const ffmpegCommand = ffmpeg();
        ffmpegCommand.input(sourcePath);

        // Handle image duration
        const duration = sourceMeta.duration && sourceMeta.duration !== 'N/A' ? sourceMeta.duration : 8; // Default 8s for images
        if (isSourceImage) {
            ffmpegCommand.inputOptions(["-loop 1", `-t ${duration}`]);
        }

        console.log(`[Job ${jobId}] Building base canvas filters...`);
        let currentBase = "base";
        const combinedFilters = [];
        let overlayInputIndex = 1; // Tracks extra inputs (overlays, audio)

        // Handle audio input for image+audio
        let audioInputIndex = null;
        if (postType === "image+audio") {
            const audioUrl = feed.audioFile?.url || designMetadata?.audioConfig?.url;
            if (audioUrl) {
                const audioDest = path.join(tempDir, "audio.mp3");
                try {
                    await downloadFile(audioUrl, audioDest);
                    ffmpegCommand.input(audioDest);
                    audioInputIndex = overlayInputIndex++;
                } catch (e) {
                    console.warn(`[Job ${jobId}] Failed to download audio, proceeding without it:`, e.message);
                }
            }
        }

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
        // const overlayInputs = []; // No longer needed as inputs are added directly to ffmpegCommand
        // let inputIndex = 1; // 0 is source video
        let filterIndex = 1; // For unique filter output labels

        // Sort overlays by z-index
        const overlayElements = [...(designMetadata?.overlayElements || []).filter(el => el.visible !== false)]
            .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

        console.log(`[Job ${jobId}] Processing ${overlayElements.length} overlay elements...`);

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

        const buildEaseExpr = (start, end, dur) => {
            const s = Number(start).toFixed(2);
            const e = Number(end).toFixed(2);
            const d = Number(dur).toFixed(2);
            // Cubic-bezier approximation: t/d is linear, but we can use t*t*(3-2*t) for smoothstep or just linear for now
            // To match CSS: cubic-bezier(0.2, 0.8, 0.2, 1) is roughly (t/d)^0.5 for fast start
            return `if(lt(t,${d}),(${s})+(${e}-(${s}))*(sqrt(t/${d})),(${e}))`;
        };

        for (const el of overlayElements) {
            console.log(`[Job ${jobId}] Processing overlay element: ${el.type} at ${el.xPercent}%, ${el.yPercent}%`);
            let overlayMediaUrl = null;
            if (el.type === 'avatar') overlayMediaUrl = viewer?.modifyAvatar || viewer?.profileAvatar || el.mediaConfig?.url;
            else if (el.type === "logo") overlayMediaUrl = el.mediaConfig?.url || `${BACKEND_URL}/logo/prithulogo.png`;

            if (overlayMediaUrl) {
                if (!overlayMediaUrl.startsWith('http')) overlayMediaUrl = `${BACKEND_URL}/${overlayMediaUrl}`;
                const overlayDest = path.join(tempDir, `overlay_${overlayInputIndex}.png`);

                try {
                    await downloadFile(overlayMediaUrl, overlayDest);

                    const xRaw = (el.xPercent / 100) * OUT_W;
                    const yRaw = (el.yPercent / 100) * mediaH;
                    const wPercentValue = el.wPercent || 20;
                    const scaleW = Math.max(10, Math.round((wPercentValue / 100) * OUT_W));

                    let xExpr = `${xRaw}`, yExpr = `${yRaw}`;

                    if (el.animation?.enabled && el.animation.direction !== "none") {
                        const dur = Number(el.animation.speed || 1);
                        const delay = Number(el.animation.delay || 0);
                        const start_t = delay;
                        const end_t = start_t + dur;

                        if (el.animation.direction === 'left') {
                            xExpr = `if(lt(t,${start_t}),${OUT_W},if(lt(t,${end_t}),${OUT_W}+(${xRaw}-${OUT_W})*(t-${start_t})/${dur},${xRaw}))`;
                        } else if (el.animation.direction === 'right') {
                            xExpr = `if(lt(t,${start_t}),-${scaleW},if(lt(t,${end_t}),-${scaleW}+(${xRaw}-(-${scaleW}))*(t-${start_t})/${dur},${xRaw}))`;
                        } else if (el.animation.direction === 'top') {
                            yExpr = `if(lt(t,${start_t}),-${scaleW},if(lt(t,${end_t}),-${scaleW}+(${yRaw}-(-${scaleW}))*(t-${start_t})/${dur},${yRaw}))`;
                        } else if (el.animation.direction === 'bottom') {
                            yExpr = `if(lt(t,${start_t}),${mediaH},if(lt(t,${end_t}),${mediaH}+(${yRaw}-${mediaH})*(t-${start_t})/${dur},${yRaw}))`;
                        }
                    }

                    const rawLabel = `raw${filterIndex}`;
                    const fmtLabel = `fmt${filterIndex}`;
                    const maskedLabel = `masked${filterIndex}`;
                    const overlayLabel = `over${filterIndex}`;
                    let currentOverlayInput = `${overlayInputIndex}:v`;

                    if (el.type === 'avatar') {
                        const shape = el.avatarConfig?.shape || el.shape || 'circle';
                        const isRound = shape === 'circle' || shape === 'round';

                        if (isRound) {
                            const maskedAvatarPath = path.join(tempDir, `masked_${overlayInputIndex}.png`);
                            console.log(`[Job ${jobId}] Creating sharp circular mask for ${overlayDest}`);
                            const circleSvg = Buffer.from(`<svg><circle cx="${scaleW / 2}" cy="${scaleW / 2}" r="${scaleW / 2}" fill="white"/></svg>`);

                            await sharp(overlayDest)
                                .resize(scaleW, scaleW, { fit: 'cover' })
                                .composite([{ input: circleSvg, blend: 'dest-in' }])
                                .png()
                                .toFile(maskedAvatarPath);

                            ffmpegCommand.input(maskedAvatarPath);
                            currentOverlayInput = `${overlayInputIndex}:v`;
                        } else {
                            ffmpegCommand.input(overlayDest);
                        }
                    } else {
                        ffmpegCommand.input(overlayDest);
                    }
                    overlayInputIndex++;

                    // Shared processing (Scaling if not already done by Sharp, and Fade animation)
                    const animationDuration = (el.animationConfig?.duration || 1000) / 1000; // Renamed to avoid conflict with image duration

                    if (el.type !== 'avatar') {
                        combinedFilters.push({
                            filter: 'scale', options: { w: scaleW, h: -1 },
                            inputs: currentOverlayInput, outputs: rawLabel
                        });
                        currentOverlayInput = rawLabel;
                    }

                    if (el.animation?.enabled) {
                        const animationDur = Number(el.animation.speed || 1);
                        combinedFilters.push({
                            filter: 'fade',
                            options: { t: 'in', st: 0, d: animationDur, alpha: 1 },
                            inputs: currentOverlayInput, outputs: maskedLabel
                        });
                        currentOverlayInput = maskedLabel;
                    }

                    combinedFilters.push({
                        filter: 'overlay',
                        options: { x: xExpr, y: yExpr, eval: 'frame' },
                        inputs: [currentBase, currentOverlayInput],
                        outputs: overlayLabel
                    });

                    currentBase = overlayLabel;
                    filterIndex++;
                } catch (e) {
                    console.error(`[Job ${jobId}] Failed overlay processing:`, e.message);
                }
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
                            fontfile: FONT_PATH,
                            shadowcolor: 'black@0.8',
                            shadowx: 2, shadowy: 2
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
            console.log(`[Job ${jobId}] Footer background added - Color: ${footerBgColor}, Area: ${Math.round(footerW)}x${footerH}`);
            currentBase = "footer_bg";

            const showElements = footerConfig?.showElements || {};
            const socialIcons = footerConfig?.socialIcons || [];
            const visibleSocialIcons = socialIcons.filter(i => i.visible);

            // Refactored Footer Layout: 2 Rows
            const PADDING_X_INNER = 60;
            const ROW_1_Y_CENTER = Math.round(footerY + (footerH * 0.35));
            const ROW_2_Y_CENTER = Math.round(footerY + (footerH * 0.75));

            const FONT_SIZE_USER = 42;
            const FONT_SIZE_INFO = 32;
            const iconSize = 48;
            const iconGap = 24;
            console.log(`[Job ${jobId}] Using FONT_PATH: ${FONT_PATH}`);
            const textColor = normalizeFfmpegColor(footerConfig?.textColor || "white");
            // --- ROW 1: Name & Socials ---
            if (showElements.name) {
                const nameLabel = `footer_name`;
                const centerName = !showElements.socialIcons || visibleSocialIcons.length === 0;

                combinedFilters.push({
                    filter: "drawtext",
                    options: {
                        text: escapeDrawText(viewer.userName || "User"),
                        x: centerName ? '(w-text_w)/2' : Math.round(footerX + PADDING_X_INNER),
                        y: Math.round(ROW_1_Y_CENTER - FONT_SIZE_USER / 2),
                        fontsize: FONT_SIZE_USER,
                        fontcolor: textColor,
                        fontfile: FONT_PATH
                    },
                    inputs: currentBase,
                    outputs: nameLabel
                });
                currentBase = nameLabel;
            }

            if (showElements.socialIcons && visibleSocialIcons.length > 0) {
                let currentIconX = footerX + footerW - PADDING_X_INNER - iconSize;

                for (let i = 0; i < visibleSocialIcons.length; i++) {
                    const icon = visibleSocialIcons[i];
                    const platform = (icon.platform || "").toLowerCase();
                    const iconUrl = `https://cdn.simpleicons.org/${platform}`;
                    const iconPath = path.join(tempDir, `social_${i}.png`);

                    try {
                        await downloadFile(iconUrl, iconPath);
                        ffmpegCommand.input(iconPath); // Add social icon as an input
                        const iconInputIndex = overlayInputIndex++; // Use overlayInputIndex for tracking

                        const iconFormated = `social_fmt${i}`;
                        const iconNegatedLabel = `social_neg${i}`;
                        const iconScaledLabel = `social_scaled_${i}`;
                        const iconOverlayLabel = `social_overlay_${i}`;

                        combinedFilters.push({
                            filter: 'format',
                            options: 'rgba',
                            inputs: `${iconInputIndex}:v`,
                            outputs: iconFormated
                        });

                        // Invert color (SimpleIcons are black by default, we need white)
                        combinedFilters.push({
                            filter: 'negate',
                            inputs: iconFormated,
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
                            options: `x=${Math.round(currentIconX)}:y=${Math.round(ROW_1_Y_CENTER - iconSize / 2)}`,
                            inputs: [currentBase, iconScaledLabel],
                            outputs: iconOverlayLabel
                        });

                        currentBase = iconOverlayLabel;
                        currentIconX -= (iconSize + iconGap);
                    } catch (e) { console.error(`Social icon failed: ${iconUrl}`, e.message); }
                }
            }

            // --- ROW 2: Email & Phone ---
            if (showElements.email || showElements.phone) {
                if (showElements.email && viewer.email) {
                    const emailLabel = `footer_email`;
                    combinedFilters.push({
                        filter: "drawtext",
                        options: {
                            text: escapeDrawText(viewer.email),
                            x: Math.round(footerX + PADDING_X_INNER),
                            y: Math.round(ROW_2_Y_CENTER - FONT_SIZE_INFO / 2),
                            fontsize: FONT_SIZE_INFO,
                            fontcolor: textColor,
                            fontfile: FONT_PATH
                        },
                        inputs: currentBase,
                        outputs: emailLabel
                    });
                    currentBase = emailLabel;
                }
                if (showElements.phone && (viewer.phone || viewer.phoneNumber)) {
                    const phoneLabel = `footer_phone`;
                    combinedFilters.push({
                        filter: "drawtext",
                        options: {
                            text: escapeDrawText(viewer.phone || viewer.phoneNumber),
                            x: `${Math.round(footerX + footerW - PADDING_X_INNER)}-text_w`,
                            y: Math.round(ROW_2_Y_CENTER - FONT_SIZE_INFO / 2),
                            fontsize: FONT_SIZE_INFO,
                            fontcolor: textColor,
                            fontfile: FONT_PATH
                        },
                        inputs: currentBase,
                        outputs: phoneLabel
                    });
                    currentBase = phoneLabel;
                }
            }
        }

        job.progress(60);
        if (io) io.to(userId).emit("download-progress", { jobId, progress: 60, status: "processing" });

        // 6. BUILD FFMPEG COMMAND
        // ffmpegCommand is already initialized and source/audio inputs added

        // Set up complex filters
        ffmpegCommand.complexFilter(combinedFilters);



        // let audioInputIndex = null; // This is now determined earlier

        // if (postType === "image+audio" && feed.audioFile?.url) {
        //     audioInputIndex = 1 + overlayInputs.length;
        // }






        // Configure output
        const outputOptions = [
            "-map", `[${currentBase}]`,
            "-c:v", "libx264",
            "-pix_fmt", "yuv420p",
            "-preset", "veryfast",
            "-movflags", "+faststart"
        ];

        // Determine final duration (match audio for image+audio posts)
        if (postType === "image+audio" && audioInputIndex !== null) {
            outputOptions.push("-shortest");
        }

        // Handle audio mapping
        if (postType === "image+audio" && audioInputIndex !== null) {
            outputOptions.push(
                "-map", `${audioInputIndex}:a`,
                "-c:a", "aac",
                "-b:a", "128k"
            );
        } else if (postType === "video") {
            // Keep original audio from video if present
            outputOptions.push("-map", "0:a?");
            outputOptions.push("-c:a", "copy");
        }

        ffmpegCommand.outputOptions(outputOptions);
        console.log(`[Job ${jobId}] Output options configured:`, outputOptions);

        // 7. RUN FFMPEG
        await new Promise((resolve, reject) => {
            ffmpegCommand
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
        console.log(`[Job ${jobId}] Processing complete. Download URL: ${downloadUrl}`);
        if (io) io.to(userId).emit("download-complete", { jobId, progress: 100, status: "ready", downloadUrl });

        return { downloadUrl, processedFilePath: finalOutputPath };

    } catch (err) {
        console.error(`[Job ${jobId}] Critical Failure:`, err.stack || err);
        const io = getIO();
        if (io) io.to(userId).emit("download-failed", { jobId, error: err.message });
        try {
            console.log(`[Job ${jobId}] Emergency cleanup of temp directory: ${tempDir}`);
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