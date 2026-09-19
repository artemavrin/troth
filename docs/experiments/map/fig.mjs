import { chromium } from "playwright";
const br = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args:["--no-sandbox"] });
const pg = await br.newPage({ viewport: { width: 1140, height: 800 }, deviceScaleFactor: 2 });
await pg.goto("file://" + process.cwd() + "/figure.html");
await pg.waitForLoadState("networkidle");
await pg.screenshot({ path: "troth-belief.png", fullPage: true });
await br.close(); console.log("снято");
