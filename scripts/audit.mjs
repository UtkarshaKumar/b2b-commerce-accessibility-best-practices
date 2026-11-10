import { createServer } from "node:http";
import { mkdir, readFile, stat } from "node:fs/promises";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

await import("./build-site.mjs");

const root = join(fileURLToPath(new URL("..", import.meta.url)), "dist");
const manifest = JSON.parse(await readFile(join(root, "lab-manifest.json"), "utf8"));
const tags = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22a", "wcag22aa"];
const flagship = "NLD-10421";
const failures = [];

const expected = {
  listing: ["html-has-lang", "label", "button-name", "image-alt", "color-contrast", "nested-interactive", "select-name", "aria-dialog-name", "link-name", "target-size"],
  product: ["html-has-lang", "label", "button-name", "image-alt", "color-contrast", "link-name"],
  "quick-order": ["html-has-lang", "label", "color-contrast", "button-name", "link-name"],
  cart: ["html-has-lang", "button-name", "label", "color-contrast", "link-name"],
  checkout: ["html-has-lang", "label", "color-contrast", "meta-viewport", "image-alt", "link-name"],
  approvals: ["html-has-lang", "button-name", "color-contrast", "image-alt", "aria-allowed-attr", "link-name"],
  catalogue: ["html-has-lang", "frame-title", "image-alt", "link-name", "color-contrast"]
};

function exerciseOf(urlPath) {
  const match = urlPath.match(/^\/exercises\/([^/]+)\//);
  return match ? match[1] : "home";
}

function badSample(urlPath) {
  if (exerciseOf(urlPath) !== "product") return true;
  return urlPath.includes(flagship);
}

function fail(message) {
  failures.push(message);
  console.log(`  FAIL ${message}`);
}

function serve() {
  const types = {
    ".css": "text/css; charset=utf-8",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".pdf": "application/pdf"
  };
  const server = createServer(async (request, response) => {
    const pathname = decodeURIComponent(new URL(request.url, "http://localhost").pathname);
    const full = resolve(root, `.${pathname}`);
    if (full !== root && !full.startsWith(root + sep)) {
      response.writeHead(403).end("Forbidden");
      return;
    }
    for (const candidate of [full, join(full, "index.html")]) {
      try {
        if (!(await stat(candidate)).isFile()) continue;
        response.writeHead(200, { "Content-Type": types[extname(candidate)] || "application/octet-stream" });
        response.end(await readFile(candidate));
        return;
      } catch {
        // next candidate
      }
    }
    response.writeHead(404).end("Not found");
  });
  return new Promise((listen) => {
    server.listen(0, "127.0.0.1", () => listen(server));
  });
}

async function overflows(page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

async function axe(page) {
  const primary = await new AxeBuilder({ page }).withTags(tags).analyze();
  const dialogs = await new AxeBuilder({ page }).withRules(["aria-dialog-name"]).analyze();
  const seen = new Set(primary.violations.map((violation) => violation.id));
  for (const violation of dialogs.violations) {
    if (!seen.has(violation.id)) primary.violations.push(violation);
  }
  return primary;
}

const server = await serve();
const { port } = server.address();
const origin = `http://127.0.0.1:${port}`;
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const report = [];

async function open(urlPath) {
  const page = await context.newPage();
  await page.goto(origin + urlPath, { waitUntil: "networkidle" });
  return page;
}

console.log("\naxe-core, WCAG 2.x A and AA tags\n");

for (const urlPath of [...manifest.good, ...manifest.bad.filter(badSample)]) {
  const kind = manifest.good.includes(urlPath) ? "good" : "bad";
  const page = await open(urlPath);
  const result = await axe(page);
  const ids = result.violations.map((violation) => violation.id);
  const summary = result.violations.map((violation) => `${violation.id} (${violation.nodes.length})`).join(", ") || "none";
  console.log(`${kind.padEnd(4)} ${String(result.violations.length).padStart(3)}  ${urlPath}`);
  console.log(`      ${summary}`);
  report.push({ kind, urlPath, count: result.violations.length, ids });
  if (kind === "good" && result.violations.length) {
    const sample = result.violations[0].nodes[0];
    fail(`${urlPath} should have no WCAG violations, found ${summary}`);
    console.log(`      ${sample?.html?.slice(0, 240) || ""}`);
    console.log(`      ${sample?.failureSummary || ""}`);
  }
  if (kind === "bad") {
    if (!result.violations.length) fail(`${urlPath} should have violations`);
    for (const rule of expected[exerciseOf(urlPath)] || []) {
      if (!ids.includes(rule)) fail(`${urlPath} missing expected rule ${rule}`);
    }
  }
  if (result.incomplete.length && kind === "good") {
    console.log(`      incomplete: ${result.incomplete.map((item) => item.id).join(", ")}`);
  }
  await page.setViewportSize({ width: 320, height: 800 });
  const scrolled = await overflows(page);
  if (kind === "good" && scrolled) fail(`${urlPath} scrolls sideways at 320 CSS pixels`);
  if (kind === "bad" && !scrolled) fail(`${urlPath} should scroll sideways at 320 CSS pixels`);
  await page.close();
}

async function focusRing(urlPath, wantVisible) {
  const page = await open(urlPath);
  let found = false;
  for (let step = 0; step < 25; step += 1) {
    await page.keyboard.press("Tab");
    const inside = await page.evaluate(() => {
      const active = document.activeElement;
      const demo = document.querySelector("[data-demo]");
      if (!active || !demo || !demo.contains(active)) return null;
      const style = getComputedStyle(active);
      return { outlineStyle: style.outlineStyle, outlineWidth: Number.parseFloat(style.outlineWidth) };
    });
    if (!inside) continue;
    found = true;
    const visible = inside.outlineStyle !== "none" && inside.outlineWidth >= 2;
    if (visible !== wantVisible) fail(`${urlPath} focus ring visible=${visible}, expected ${wantVisible}`);
    break;
  }
  if (!found) fail(`${urlPath} had no focusable control in the storefront`);
  await page.close();
}

async function obscured(urlPath, wantCovered) {
  const page = await open(urlPath);
  const covered = await page.evaluate(() => {
    const target = document.querySelector("[data-obscure-target]") || document.querySelector("[data-demo] button, [data-demo] a");
    target.scrollIntoView({ block: "end", inline: "nearest" });
    target.focus();
    const rect = target.getBoundingClientRect();
    const x = Math.min(window.innerWidth - 2, Math.max(2, rect.left + rect.width / 2));
    const y = Math.min(window.innerHeight - 2, Math.max(2, rect.top + Math.min(rect.height / 2, rect.height - 2)));
    const hit = document.elementFromPoint(x, y);
    return hit !== target && !target.contains(hit);
  });
  if (covered !== wantCovered) fail(`${urlPath} focus covered=${covered}, expected ${wantCovered}`);
  await page.close();
}

console.log("\nLab checks beyond the scanner\n");
await focusRing("/exercises/listing/good/", true);
await focusRing("/exercises/listing/bad/", false);
await obscured("/exercises/listing/bad/", true);
await obscured("/exercises/listing/good/", false);

{
  const page = await open("/exercises/listing/good/");
  await page.getByRole("button", { name: "Request a quote" }).click();
  const openDialog = page.getByRole("dialog", { name: "Request a quote" });
  if (!(await openDialog.count())) fail("repaired quote dialog has no accessible name");
  const trapped = await page.evaluate(() => {
    const dialog = document.querySelector("dialog");
    return dialog?.open && dialog.contains(document.activeElement);
  });
  if (!trapped) fail("repaired dialog did not take focus");
  for (let step = 0; step < 6; step += 1) await page.keyboard.press("Tab");
  const stayed = await page.evaluate(() => document.querySelector("dialog")?.contains(document.activeElement));
  if (!stayed) fail("keyboard focus left the repaired dialog");
  await page.keyboard.press("Escape");
  const closed = await page.evaluate(() => !document.querySelector("dialog")?.open && document.activeElement?.matches("[data-open-quote]"));
  if (!closed) fail("Escape did not close the repaired dialog and return focus");
  const sets = await page.locator("[data-demo] fieldset").count();
  if (sets < 4) fail("repaired listing is missing fieldsets");
  await page.locator("input[name='brand']").first().check();
  const announced = await page.locator("#result-count").innerText();
  if (!/Showing \d+ of 8 products/.test(announced)) fail(`result count was not updated (${announced})`);
  await page.close();

  const broken = await open("/exercises/listing/bad/");
  const name = await broken.locator("[data-fake-dialog]").evaluate((element) => element.getAttribute("aria-label") || element.getAttribute("aria-labelledby") || "");
  if (name) fail("broken dialog is named, so the bug is gone");
  const closeText = await broken.locator("[data-fake-dialog] [data-close]").evaluate((element) => element.textContent.replace(element.querySelector("[aria-hidden='true']")?.textContent || "", "").trim());
  if (closeText) fail("broken dialog close control has a name");
  await broken.locator("[data-fake-dialog] [data-close]").focus();
  await broken.keyboard.press("Tab");
  const inside = await broken.evaluate(() => document.querySelector("[data-fake-dialog]").contains(document.activeElement));
  if (inside) fail("broken dialog trapped focus even though it is only marked aria-modal");
  const drag = await broken.locator("[data-price-drag]").evaluate((element) => element.tabIndex < 0 && element.tagName === "DIV");
  if (!drag) fail("broken price control is in the tab order");
  if (await broken.locator("[data-demo] fieldset").count()) fail("broken listing should not use fieldsets");
  const nested = await broken.locator("[data-demo] button a").count();
  if (nested < 1) fail("broken listing no longer nests a link inside Add");
  await broken.close();
}

{
  const page = await open("/exercises/quick-order/good/");
  await page.locator("#sku-1").fill("NLD-NOPE");
  await page.locator("#qty-1").fill("2");
  await page.locator("[data-quick-order] button[type='submit']").click();
  const focused = await page.evaluate(() => document.activeElement.id);
  const invalid = await page.locator("#sku-1").getAttribute("aria-invalid");
  const value = await page.locator("#sku-1").inputValue();
  const summary = await page.locator("#error-summary").innerText();
  if (focused !== "error-summary") fail(`quick order focus is ${focused || "body"}, not the error summary`);
  if (invalid !== "true" || value !== "NLD-NOPE" || !summary.includes("NLD-NOPE")) fail("quick order error did not keep the SKU and point at the field");
  await page.close();

  const broken = await open("/exercises/quick-order/bad/");
  await broken.locator("[data-sku-input]").first().fill("NLD-NOPE");
  await broken.locator("[data-quick-order] button[type='submit']").click();
  const cleared = await broken.locator("[data-sku-input]").first().inputValue();
  const message = await broken.locator("#quick-error").innerText();
  if (cleared !== "" || message.includes("NLD-NOPE")) fail("broken quick order should clear the SKU and hide which line failed");
  await broken.close();
}

{
  const page = await open("/exercises/checkout/good/");
  await page.locator("#po").fill("PO-77");
  await page.locator("#cost-center").fill("nope");
  await page.locator("#delivery-date").fill("2020-01-01");
  await page.locator("[data-checkout] button[type='submit']").click();
  const focused = await page.evaluate(() => document.activeElement.id);
  const po = await page.locator("#po").inputValue();
  const summary = await page.locator("#error-summary").innerText();
  if (focused !== "error-summary" || po !== "PO-77" || !summary.includes("CC-")) fail("checkout did not keep the purchase order and describe the cost center");
  if (await page.locator(".captcha, [placeholder='Account number']").count()) fail("repaired checkout still asks for a captcha or the account number");
  await page.close();

  const broken = await open("/exercises/checkout/bad/");
  const poField = broken.locator("[data-po]");
  await poField.fill("PO-77");
  await broken.locator("[data-checkout] button[type='submit']").click();
  if (await poField.inputValue() !== "") fail("broken checkout kept the value");
  if (!(await broken.locator(".captcha").count())) fail("broken checkout is missing the captcha image");
  await broken.close();
}

{
  const page = await open("/exercises/cart/good/");
  await page.locator("[data-step='1']").first().click();
  const status = await page.locator("#cart-status").innerText();
  if (!status.includes("Apex Dental Universal Composite A2") || !status.includes("3")) fail(`cart status was "${status}"`);
  if (!(await page.locator("[data-demo] th").count())) fail("repaired cart has no header cells");
  await page.close();

  const broken = await open("/exercises/cart/bad/");
  if (await broken.locator("[data-demo] th, [data-demo] [aria-live], [data-demo] [role='status']").count()) fail("broken cart exposes headers or a live region");
  await broken.locator("[data-step='1']").first().click();
  const quiet = await broken.locator("#cart-status").innerText();
  if (quiet.trim()) fail("broken cart announced the quantity change");
  await broken.close();
}

{
  const page = await open("/exercises/approvals/good/");
  await page.getByRole("button", { name: "Total", exact: true }).click();
  await page.getByRole("button", { name: "Total", exact: true }).click();
  const first = await page.locator("[data-approval-table] tbody tr").first().getAttribute("data-id");
  if (first !== "Q-1054") fail(`sorting by total descending started at ${first}`);
  await page.getByRole("button", { name: "Approve Q-1048", exact: true }).click();
  const status = await page.locator("#approval-status").innerText();
  if (!status.includes("Q-1048")) fail("approval was not announced with the order id");
  await page.close();

  const broken = await open("/exercises/approvals/bad/");
  const sameName = await broken.getByRole("button", { name: "Approve", exact: true }).count();
  if (sameName < 4) fail(`expected 4 identical Approve buttons, found ${sameName}`);
  await broken.close();
}

{
  const good = await open(`/exercises/product/good/${flagship}/`);
  const alt = await good.locator("[data-demo] img.product-photo").first().getAttribute("alt");
  if (!alt?.includes("Apex Dental Universal Composite A2")) fail(`repaired photo alt is "${alt}"`);
  if (!(await good.locator("[data-demo] table.spec th").count())) fail("repaired spec table has no headers");
  await good.close();

  const bad = await open(`/exercises/product/bad/${flagship}/`);
  const empty = await bad.locator("[data-demo] img.product-photo").first().getAttribute("alt");
  const stars = await bad.locator("img.rating-stars").first().getAttribute("alt");
  if (empty !== "") fail("broken product photo should be alt=\"\" so the scanner treats it as decorative");
  if (stars !== null) fail("broken star image should omit alt so image-alt fires");
  if (await bad.locator("[data-demo] th").count()) fail("broken spec table should have no header cells");
  console.log("  note  broken product photo uses alt=\"\" and axe does not flag that image. The star image, which omits alt, is the violation.");
  await bad.close();
}

for (const urlPath of manifest.good) {
  if (urlPath === "/") continue;
  const page = await open(urlPath);
  if (!(await page.locator("[data-demo] a[href='/help/']").count())) fail(`${urlPath} is missing the Help link`);
  await page.close();
}
for (const urlPath of manifest.bad.filter(badSample)) {
  const page = await open(urlPath);
  if (await page.locator("[data-demo] a[href='/help/']").count()) fail(`${urlPath} still has the Help link`);
  await page.close();
}

const shots = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
const shotPage = await shots.newPage();
const screenshotDir = join(fileURLToPath(new URL("..", import.meta.url)), "docs", "screenshots");
await mkdir(screenshotDir, { recursive: true });
const pictures = [
  ["/", "home.png"],
  ["/exercises/listing/bad/", "listing-bad.png"],
  ["/exercises/listing/good/", "listing-good.png"],
  [`/exercises/product/good/${flagship}/`, "product-good.png"],
  ["/exercises/approvals/good/", "approvals-good.png"]
];
for (const [urlPath, file] of pictures) {
  await shotPage.goto(origin + urlPath, { waitUntil: "networkidle" });
  await shotPage.screenshot({ path: join(screenshotDir, file) });
}
await shotPage.setViewportSize({ width: 390, height: 844 });
await shotPage.goto(`${origin}/exercises/listing/good/`, { waitUntil: "networkidle" });
await shotPage.screenshot({ path: join(screenshotDir, "listing-good-mobile.png") });
await shots.close();

const goodTotal = report.filter((row) => row.kind === "good").reduce((sum, row) => sum + row.count, 0);
const badTotal = report.filter((row) => row.kind === "bad").reduce((sum, row) => sum + row.count, 0);
console.log(`\nRepaired pages: ${goodTotal} WCAG violations.`);
console.log(`Broken pages: ${badTotal} WCAG violations.`);
console.log(failures.length ? `\n${failures.length} lab checks failed.` : "\nLab checks passed.");

await browser.close();
server.close();
if (failures.length) process.exit(1);
