const si = require("systeminformation");
async function test() {
  const b = await si.battery();
  const d = await si.diskLayout();
  console.log("Battery:", JSON.stringify(b, null, 2));
  console.log("Disk:", JSON.stringify(d, null, 2));
}
test();
