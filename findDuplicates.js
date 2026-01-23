const fs = require('fs');

function extractRoutesWithHandlers(content) {
    const routes = [];
    const lines = content.split('\n');
    // Regex to match router.METHOD('PATH', [middleware, ...], HANDLER)
    // This is a bit tricky with multi-line or multiple middlewares.
    // We'll try to find the last identifier before the closing bracket.
    const routeRegex = /router\.(get|post|put|delete|patch)\(\s*['"](.+?)['"]\s*,\s*(?:.+?,\s*)*([a-zA-Z0-9_]+)\s*\);/i;

    lines.forEach(line => {
        const match = line.match(routeRegex);
        if (match) {
            routes.push({
                method: match[1].toUpperCase(),
                path: match[2],
                handler: match[3]
            });
        }
    });

    // Also handle routes without closing semicolon or on multiple lines if any.
    // For now, let's keep it simple as most routes seem to follow this pattern in this codebase.
    return routes;
}

const rootContent = fs.readFileSync('r:\\Suriya.DLK\\newProject\\be\\roots\\root.js', 'utf8');
const webrootContent = fs.readFileSync('r:\\Suriya.DLK\\newProject\\be\\roots\\webroot.js', 'utf8');

const rootRoutes = extractRoutesWithHandlers(rootContent);
const webrootRoutes = extractRoutesWithHandlers(webrootContent);

console.log('--- Duplicate Routes (Path, Method, and Handler) ---');
const fullDuplicates = [];
rootRoutes.forEach(r => {
    const found = webrootRoutes.find(wr => wr.method === r.method && wr.path === r.path && wr.handler === r.handler);
    if (found) {
        fullDuplicates.push(r);
    }
});
fullDuplicates.forEach(d => console.log(`${d.method} ${d.path} -> ${d.handler}`));
console.log(`Total full duplicates: ${fullDuplicates.length}`);

console.log('\n--- Same Handler, Different Path ---');
rootRoutes.forEach(r => {
    const matches = webrootRoutes.filter(wr => wr.handler === r.handler && (wr.path !== r.path || wr.method !== r.method));
    matches.forEach(m => {
        console.log(`root: ${r.method} ${r.path} | web: ${m.method} ${m.path} | Handler: ${r.handler}`);
    });
});
