const os = require('os');
const { exec } = require('child_process');
const path = require('path');

/**
 * Get comprehensive server statistics
 */
exports.getServerStats = async (req, res) => {
    try {
        const stats = {
            os: {
                platform: os.platform(),
                release: os.release(),
                arch: os.arch(),
                type: os.type(),
                hostname: os.hostname(),
            },
            uptime: {
                system: os.uptime(),
                process: process.uptime(),
            },
            memory: {
                total: os.totalmem(),
                free: os.freemem(),
                used: os.totalmem() - os.freemem(),
                usagePercent: ((os.totalmem() - os.freemem()) / os.totalmem() * 100).toFixed(2),
            },
            cpu: {
                model: os.cpus()[0].model,
                cores: os.cpus().length,
                loadAverage: os.loadavg(), // [1, 5, 15] mins (empty on Windows)
            },
            network: os.networkInterfaces(),
            disk: await getDiskUsage(),
            pm2: await getPM2Stats(),
            projectSize: await getProjectFolderSize(),
            timestamp: new Date(),
        };

        res.status(200).json({
            success: true,
            data: stats
        });
    } catch (err) {
        console.error("❌ Server Monitor Error:", err.message);
        res.status(500).json({ success: false, message: "Error gathering server stats" });
    }
};

/**
 * Helper to get Disk Usage
 */
async function getDiskUsage() {
    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';
        const cmd = isWin
            ? 'powershell "Get-CimInstance Win32_LogicalDisk | Select-Object DeviceID, @{Name=\'Size\';Expression={$_.Size}}, @{Name=\'Free\';Expression={$_.FreeSpace}} | ConvertTo-Json"'
            : 'df -k / --output=source,size,used,avail,pcent';

        exec(cmd, (error, stdout) => {
            if (error) return resolve({ error: "Could not fetch disk usage" });

            try {
                if (isWin) {
                    const data = JSON.parse(stdout);
                    // Handle single drive or multiple
                    const drives = Array.isArray(data) ? data : [data];
                    return resolve(drives.map(d => ({
                        drive: d.DeviceID,
                        total: d.Size,
                        free: d.Free,
                        used: d.Size - d.Free,
                        percent: ((d.Size - d.Free) / d.Size * 100).toFixed(2)
                    })));
                } else {
                    const lines = stdout.trim().split('\n');
                    if (lines.length < 2) return resolve({ raw: stdout });
                    const parts = lines[1].split(/\s+/);
                    return resolve([{
                        drive: parts[0],
                        total: parseInt(parts[1]) * 1024,
                        used: parseInt(parts[2]) * 1024,
                        free: parseInt(parts[3]) * 1024,
                        percent: parts[4].replace('%', '')
                    }]);
                }
            } catch (e) {
                resolve({ raw: stdout });
            }
        });
    });
}

/**
 * Helper to get PM2 Stats
 */
async function getPM2Stats() {
    return new Promise((resolve) => {
        exec('pm2 jlist', (error, stdout) => {
            if (error) return resolve({ status: "PM2 not available or no processes running" });
            try {
                const processes = JSON.parse(stdout);
                return resolve(processes.map(p => ({
                    name: p.name,
                    status: p.pm2_env.status,
                    cpu: p.monit.cpu,
                    memory: p.monit.memory,
                    restarts: p.pm2_env.restart_time,
                    uptime: Math.floor((Date.now() - p.pm2_env.pm_uptime) / 1000)
                })));
            } catch (e) {
                resolve({ error: "Failed to parse PM2 output" });
            }
        });
    });
}

/**
 * Helper to get Project Folder Size
 */
async function getProjectFolderSize() {
    return new Promise((resolve) => {
        const isWin = process.platform === 'win32';
        // Use du -sh if available, or lightweight powershell command
        const cmd = isWin
            ? 'powershell "(Get-ChildItem -Path . -Recurse -File -ErrorAction SilentlyContinue | Measure-Object -Property Length -Sum).Sum / 1MB"'
            : 'du -sh . | cut -f1';

        exec(cmd, { cwd: path.resolve(__dirname, '../../') }, (error, stdout) => {
            if (error) return resolve("Unknown");
            const output = stdout.trim();
            if (isWin) {
                return resolve(parseFloat(output).toFixed(2) + " MB");
            }
            resolve(output);
        });
    });
}
