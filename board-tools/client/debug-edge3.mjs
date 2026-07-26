import { chromium } from "file:///C:/nvm4w/nodejs/node_modules/playwright/index.mjs";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
await page.goto("http://localhost:4180/idea-map");
await page.waitForSelector(".idea-card");

const box2 = await page.evaluate(() => {
  const line = document.querySelector('line.hit[data-edge-id="2"]');
  const r = line.getBoundingClientRect();
  return { x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 };
});
await page.mouse.move(box2.x, box2.y);
await page.waitForTimeout(150);
const h1 = await page.evaluate(() => {
  const line = document.querySelector('line.hit[data-edge-id="2"]');
  const g = line.closest("g");
  const c = g.querySelectorAll("circle.edge-handle")[1];
  return { x: Number(c.getAttribute("cx")), y: Number(c.getAttribute("cy")) };
});
const screen1 = await page.evaluate((p) => {
  const svg = document.querySelector(".edge-layer");
  const pt = svg.createSVGPoint();
  pt.x = p.x; pt.y = p.y;
  const s = pt.matrixTransform(svg.getScreenCTM());
  return { x: s.x, y: s.y };
}, h1);
const card3Box = await page.locator('.idea-card[data-id="3"]').boundingBox();

await page.mouse.move(screen1.x, screen1.y);
await page.mouse.down();
await page.mouse.move(card3Box.x + card3Box.width / 2, card3Box.y + card3Box.height / 2, { steps: 12 });
await page.waitForTimeout(100);
await page.mouse.up();
await page.waitForTimeout(200);

const dbg = await page.evaluate(() => window.__EDGE_DEBUG__);
console.log("debug:", JSON.stringify(dbg));
await browser.close();
