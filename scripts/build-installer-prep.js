const fs = require('fs-extra');
const path = require('path');

const dist = path.resolve("dist");

await fs.ensureDir(dist);
await fs.copy("config.json", path.join(dist, "config.json"));
await fs.copy(".env", path.join(dist, ".env"));
await fs.copy("data", path.join(dist, "data"));
await fs.copy("logs", path.join(dist, "logs"));
await fs.copy("scripts", path.join(dist, "scripts"));
await fs.copy("services", path.join(dist, "services"));
await fs.copy("utils", path.join(dist, "utils"));

console.log("✅ All files copied to dist/");
