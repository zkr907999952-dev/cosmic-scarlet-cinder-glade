import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { chromium } from "playwright";

const ROOT = "/workspace";
const PORT = 18765;
const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".woff2": "font/woff2",
  ".json": "application/json",
};

const server = createServer((req, res) => {
  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  let rel = decodeURIComponent(url.pathname);
  if (rel === "/") rel = "/.grok/og-card.html";
  const file = normalize(join(ROOT, rel));
  if (!file.startsWith(ROOT) || !existsSync(file) || statSync(file).isDirectory()) {
    res.writeHead(404);
    res.end("not found");
    return;
  }
  res.writeHead(200, { "Content-Type": MIME[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
});

await new Promise((resolve) => server.listen(PORT, "127.0.0.1", resolve));

const browser = await chromium.launch({
  args: ["--use-gl=angle", "--ignore-gpu-blocklist"],
});

async function shot(mode, width, height, out) {
  const page = await browser.newPage({
    viewport: { width, height },
    deviceScaleFactor: 2,
  });
  page.on("console", (msg) => console.log(`[${mode}]`, msg.type(), msg.text()));
  page.on("pageerror", (err) => console.log(`[${mode}] PAGEERROR`, err.message));
  page.setDefaultTimeout(30000);
  await page.goto(`http://127.0.0.1:${PORT}/.grok/og-card.html?mode=${mode}`, {
    waitUntil: "networkidle",
  });
  await page.waitForFunction(() => document.body.dataset.ready === "1", null, {
    timeout: 15000,
  }).catch(() => {});
  await page.waitForTimeout(900);
  await page.screenshot({ path: out, type: "png" });
  await page.close();
  console.log("wrote", out);
}

try {
  await shot("og", 1200, 630, "/workspace/.grok/og-raw.png");
  await shot("banner", 1200, 264, "/workspace/.grok/banner-raw.png");
  await shot("og&notext=1", 1200, 630, "/workspace/.grok/og-mesh.png");
} finally {
  await browser.close();
  server.close();
}
