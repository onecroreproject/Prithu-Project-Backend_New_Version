
const path = require('path');
const fs = require('fs');

// Mock helpers from downloadQueue.js
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

const normalizeFfmpegColor = (c) => {
    if (!c) return "black@0.6";
    if (c.includes("@")) return c;
    const m = c.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/i);
    if (m) {
        const r = Number(m[1]);
        const g = Number(m[2]);
        const b = Number(m[3]);
        const a = m[4] !== undefined ? Number(m[4]) : 1;
        const hex = ((r << 16) | (g << 8) | b).toString(16).padStart(6, "0");
        return `0x${hex}@${a}`;
    }
    const hexMatch = c.match(/^#?([A-Fa-f0-9]{6})([A-Fa-f0-9]{2})?$/);
    if (hexMatch) {
        const hex = hexMatch[1];
        const alpha = hexMatch[2] ? (parseInt(hexMatch[2], 16) / 255).toFixed(2) : "1.0";
        return `0x${hex}@${alpha}`;
    }
    if (/^[a-zA-Z]+$/.test(c)) return c;
    return "black@0.6";
};

const buildFreezeExpr = (start, end, dur) => {
    return `if(lt(t,${dur}),${start}+(${end}-${start})*(t/${dur}),${end})`;
};

// Test data
const designMetadata = {
    overlayElements: [
        { type: 'avatar', xPercent: 10, yPercent: 10, wPercent: 10, visible: true, zIndex: 1, animation: { enabled: true, direction: 'left', speed: 5 } },
        { type: 'username', xPercent: 20, yPercent: 20, visible: true, zIndex: 2, textConfig: { color: 'white', fontSize: 30 } },
        { type: 'logo', xPercent: 80, yPercent: 10, wPercent: 15, visible: true, zIndex: 3 }
    ],
    footerConfig: {
        enabled: true,
        heightPercent: 10,
        backgroundColor: 'rgba(45, 83, 106, 0.8)',
        textColor: '#ffffff',
        showElements: { name: true, email: true }
    }
};

const OUT_W = 1080;
const OUT_H = 1920;
const footerH = Math.round((designMetadata.footerConfig.heightPercent / 100) * OUT_H);
const mediaH = OUT_H - footerH;

let currentBase = "base";
const combinedFilters = [];

// Base canvas filters (scaled_base, padded_base, base)
combinedFilters.push({ filter: "scale", inputs: "0:v", outputs: "scaled_base", options: `w=${OUT_W}:h=${mediaH}` });
combinedFilters.push({ filter: "pad", inputs: "scaled_base", outputs: "padded_base", options: `w=${OUT_W}:h=${mediaH}` });
combinedFilters.push({ filter: "pad", inputs: "padded_base", outputs: "base", options: `w=${OUT_W}:h=${OUT_H}` });

const overlayInputs = [];
let inputIndex = 1;
let filterIndex = 1;

const overlayElements = [...(designMetadata?.overlayElements || [])]
    .filter(el => el.visible !== false)
    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));

for (const el of overlayElements) {
    if (el.type === 'avatar' || el.type === 'logo') {
        const xRaw = (el.xPercent / 100) * OUT_W;
        const yRaw = (el.yPercent / 100) * mediaH;
        const w = (el.wPercent / 100) * OUT_W;

        let xExpr = `${xRaw}`;
        let yExpr = `${yRaw}`;

        if (el.animation?.enabled) {
            xExpr = buildFreezeExpr(-OUT_W, xRaw, el.animation.speed);
        }

        overlayInputs.push(`dummy_${inputIndex}`);

        const scaleW = Math.max(10, Math.round(w));
        const scaledLabel = `scaled${filterIndex}`;
        combinedFilters.push({
            filter: 'scale',
            options: `${scaleW}:-1`,
            inputs: `${inputIndex}:v`,
            outputs: scaledLabel
        });

        const overlayLabel = `overlay_${filterIndex}`;
        combinedFilters.push({
            filter: 'overlay',
            options: `x='${xExpr}':y='${yExpr}'`, // QUOTED
            inputs: [currentBase, scaledLabel],
            outputs: overlayLabel
        });

        currentBase = overlayLabel;
        inputIndex++;
        filterIndex++;
    }

    if (el.type === 'username' || el.type === 'text') {
        const x = (el.xPercent / 100) * OUT_W;
        const y = (el.yPercent / 100) * mediaH;
        const fontSize = 24;
        const color = el.textConfig?.color || "white";

        const textLabel = `text_${filterIndex}`;
        combinedFilters.push({
            filter: 'drawtext',
            options: {
                text: "MockUser",
                x: Math.round(x),
                y: Math.round(y),
                fontsize: fontSize,
                fontcolor: normalizeFfmpegColor(color),
                fontfile: 'arial.ttf'
            },
            inputs: currentBase,
            outputs: textLabel
        });

        currentBase = textLabel;
        filterIndex++;
    }
}

// Footer
if (designMetadata.footerConfig.enabled) {
    const footerY = mediaH;
    combinedFilters.push({
        filter: "drawbox",
        options: {
            x: 0,
            y: Math.round(footerY),
            w: OUT_W,
            h: footerH,
            c: normalizeFfmpegColor(designMetadata.footerConfig.backgroundColor),
            t: "fill"
        },
        inputs: currentBase,
        outputs: "footer_bg"
    });
    currentBase = "footer_bg";
}

console.log("Filters JSON:");
console.log(JSON.stringify(combinedFilters, null, 2));

console.log("\nComplex Filter String Simulation:");
combinedFilters.forEach(f => {
    let optStr = typeof f.options === 'string' ? f.options : Object.entries(f.options).map(([k, v]) => `${k}=${v}`).join(':');
    console.log(`[${Array.isArray(f.inputs) ? f.inputs.join('][') : f.inputs}]${f.filter}=${optStr}[${f.outputs}];`);
});

console.log("\nFinal Map Target:", currentBase);

// Verify redundant map removal simulation
const outputOptions = [
    "-map", "0:a?",
    "-c:v", "libx264"
];
console.log("\nOutput Options (partial):", outputOptions.join(' '));

if (outputOptions.includes(`[${currentBase}]`)) {
    console.error("FAIL: Redundant map found!");
} else {
    console.log("SUCCESS: No redundant map found.");
}
