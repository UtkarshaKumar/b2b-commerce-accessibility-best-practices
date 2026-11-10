import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const dist = join(projectRoot, "dist");
const src = join(projectRoot, "src");
const catalog = JSON.parse(await readFile(join(src, "catalog.json"), "utf8"));
const categoryName = Object.fromEntries(catalog.categories.map((category) => [category.slug, category.label]));
const flagship = "NLD-10421";

const manifest = { good: [], bad: [] };

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeXml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function money(value) {
  const [whole, fraction] = Number(value).toFixed(2).split(".");
  return `$${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",")}.${fraction} CAD`;
}

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function productUrl(variant, sku) {
  return `/exercises/product/${variant}/${sku}/`;
}

function exerciseUrl(exercise, variant) {
  return `/exercises/${exercise}/${variant}/`;
}

function sectionFor(exercise) {
  if (exercise.startsWith("product")) return "listing";
  if (exercise.startsWith("catalogue")) return "catalogue";
  return exercise;
}

function catalogScript() {
  const json = JSON.stringify({ products: catalog.products }).replaceAll("<", "\\u003c");
  return `<script type="application/json" id="catalog-data">${json}</script>`;
}

function documentHtml({ variant, title, exercise, main, viewport }) {
  const lang = variant === "bad" ? "" : ` lang="en-CA"`;
  const vp = viewport || "width=device-width, initial-scale=1";
  const exerciseAttr = exercise ? ` data-exercise="${escapeHtml(exercise)}"` : "";
  const skip = variant === "bad" ? "" : `<a class="skip-link" href="#content">Skip to content</a>`;
  return `<!doctype html>
<html${lang}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="${escapeHtml(vp)}">
<title>${escapeHtml(title)}</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="stylesheet" href="/styles.css">
</head>
<body data-variant="${variant}"${exerciseAttr}>
${skip}
${main}
${catalogScript()}
<script src="/storefront.js"></script>
</body>
</html>`;
}

function labBar({ variant, exercise, sku, label }) {
  if (exercise === "help" || exercise === "catalogue-read") {
    const href = exercise === "catalogue-read" ? "/exercises/catalogue/good/" : "/";
    const text = exercise === "catalogue-read" ? "Back to the catalogue example" : "Lab home";
    return `<div class="lab-bar"><p><a href="/">Accessibility lab</a></p><p>${escapeHtml(label)}</p><p><a href="${href}">${text}</a></p></div>`;
  }
  const urls = exercise === "product"
    ? { bad: productUrl("bad", sku), good: productUrl("good", sku) }
    : { bad: exerciseUrl(exercise, "bad"), good: exerciseUrl(exercise, "good") };
  const current = (side) => (variant === side ? ` aria-current="page"` : "");
  return `<div class="lab-bar"><p><a href="/">Accessibility lab</a></p><p>${variant === "bad" ? "Broken version" : "Repaired version"} · ${escapeHtml(label)}</p><p><a href="${urls.bad}"${current("bad")}>Broken version</a> <a href="${urls.good}"${current("good")}>Repaired version</a></p></div>`;
}

function teach(panel) {
  return `<aside class="teach" aria-labelledby="teach-title"><div class="teach-card"><p class="eyebrow">${escapeHtml(panel.eyebrow)}</p><h2 id="teach-title">${escapeHtml(panel.title)}</h2><dl><div><dt>Who is blocked</dt><dd>${escapeHtml(panel.who)}</dd></div><div><dt>Why the rule exists</dt><dd>${escapeHtml(panel.rule)}</dd></div><div><dt>Acceptance criterion</dt><dd>${escapeHtml(panel.acceptance)}</dd></div></dl></div></aside>`;
}

function wordmark() {
  return `<a class="wordmark" href="/"><span class="mark" aria-hidden="true"><span></span><span></span><span></span></span>Northline Dental Supply</a>`;
}

function storeHeader(variant, exercise) {
  const section = sectionFor(exercise);
  const items = [
    ["listing", "Shop", "/exercises/listing/"],
    ["quick-order", "Quick order", "/exercises/quick-order/"],
    ["cart", "Cart", "/exercises/cart/"],
    ["approvals", "Approvals", "/exercises/approvals/"],
    ["catalogue", "Catalogue", "/exercises/catalogue/"]
  ];
  if (variant === "bad") {
    const links = items.map(([key, label, path]) => `<a href="${path}bad/">${escapeHtml(label)}</a>`).join("");
    return `<header class="store-header"><div class="utility"><div class="utility-inner"><p>Signed in as Priya Shah</p><div><a href="/exercises/approvals/bad/"><span aria-hidden="true">Account</span></a> <a href="/exercises/cart/bad/">Cart <span data-cart-count>3</span></a></div></div></div><div class="header-main">${wordmark()}<form data-search action="#"><span>Search</span><input type="search"><button type="submit">Go</button></form></div><div class="primary-nav">${links}</div></header>`;
  }
  const links = items.map(([key, label, path]) => {
    const current = section === key ? ` aria-current="page"` : "";
    return `<a href="${path}good/"${current}>${escapeHtml(label)}</a>`;
  }).join("");
  const helpCurrent = exercise === "help" ? ` aria-current="page"` : "";
  const accountCurrent = exercise === "approvals" ? ` aria-current="page"` : "";
  const cartCurrent = exercise === "cart" ? ` aria-current="page"` : "";
  return `<header class="store-header"><div class="utility"><div class="utility-inner"><p>Signed in as Priya Shah, buyer for Harbourview Dental.</p><nav aria-label="Account"><a href="/exercises/approvals/good/"${accountCurrent}>Account</a><a href="/help/"${helpCurrent}>Help</a><a href="/exercises/cart/good/"${cartCurrent}>Cart, <span data-cart-count>3</span> items</a></nav></div></div><div class="header-main">${wordmark()}<form class="site-search" data-search role="search" action="/exercises/listing/good/"><label for="site-search">Search the catalogue</label><input id="site-search" type="search" name="q"><button type="submit">Search</button></form></div><p id="search-status" role="status"></p><nav class="primary-nav" aria-label="Primary">${links}</nav></header>`;
}

function storeFooter(variant) {
  if (variant === "bad") {
    return `<footer class="store-footer"><div class="store-footer-inner"><p>Northline Dental Supply</p><a href="/exercises/catalogue/bad/">click here</a></div></footer>`;
  }
  return `<footer class="store-footer"><div class="store-footer-inner"><p><strong>Northline Dental Supply</strong> Professional ordering for Canadian practices.</p><nav aria-label="Footer"><a href="/help/">Help</a><a href="/exercises/catalogue/good/">Catalogue</a><a href="/">Accessibility lab</a></nav></div></footer>`;
}

function stickyBar() {
  return `<div class="sticky-blocker"><p>Maintenance window tonight, 01:00 to 02:00 Eastern. This bar stays put and covers whatever sits underneath, including keyboard focus.</p></div>`;
}

function frame({ variant, exercise, sku, label, title, viewport, demo, panel }) {
  return documentHtml({
    variant,
    title,
    exercise,
    viewport,
    main: `<main id="content" tabindex="-1">${labBar({ variant, exercise, sku, label })}<div data-demo>${storeHeader(variant, exercise)}<div class="commerce">${demo}</div>${storeFooter(variant)}${variant === "bad" ? `<p class="commerce"><a data-obscure-target href="#content">Back to top of this example</a></p>${stickyBar()}` : ""}</div>${teach(panel)}</main>`
  });
}

function goodChecks(name, legend, options) {
  const rows = options.map((option) => {
    const id = slug(`${name}-${option.value}`);
    return `<div class="check-row"><input type="checkbox" id="${id}" name="${escapeHtml(name)}" value="${escapeHtml(option.value)}"><label for="${id}">${escapeHtml(option.label)}</label></div>`;
  }).join("");
  return `<fieldset><legend>${escapeHtml(legend)}</legend>${rows}</fieldset>`;
}

function badChecks(name, heading, options) {
  const rows = options.map((option) => `<div class="check-row"><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(option.value)}"><span>${escapeHtml(option.label)}</span></div>`).join("");
  return `<div><p class="bad-muted">${escapeHtml(heading)}</p>${rows}</div>`;
}

function countOptions(products, key, labelOf = (value) => value) {
  const counts = new Map();
  products.forEach((product) => counts.set(product[key], (counts.get(product[key]) || 0) + 1));
  return [...counts.entries()].map(([value, count]) => ({ value, label: `${labelOf(value)} (${count})` }));
}

function productCard(variant, product, index) {
  const href = productUrl(variant, product.sku);
  const photo = `/assets/${product.sku}.svg`;
  if (variant === "bad") {
    return `<div class="product-card" id="product-${product.sku}" data-product data-index="${index}" data-brand="${escapeHtml(product.brand)}" data-availability="${product.availability}" data-category="${product.category}" data-pack="${escapeHtml(product.packType)}" data-price="${product.price}" data-name="${escapeHtml(product.name)}"><img class="product-photo" src="${photo}" width="640" height="480"><h2><a href="${href}">${escapeHtml(product.name)}</a></h2><button type="button" data-add="${product.sku}"><span aria-hidden="true">Add</span><a href="${href}">Details</a></button><p>${escapeHtml(product.sku)}</p><p>${money(product.price)}</p><p class="bad-muted">${money(product.contractPrice)}</p><p class="bad-muted">${escapeHtml(product.availabilityLabel)}</p><img class="rating-stars" src="/assets/stars.svg" width="120" height="24"></div>`;
  }
  return `<li class="product-card" id="product-${product.sku}" data-product data-index="${index}" data-brand="${escapeHtml(product.brand)}" data-availability="${product.availability}" data-category="${product.category}" data-pack="${escapeHtml(product.packType)}" data-price="${product.price}" data-name="${escapeHtml(product.name)}"><img class="product-photo" src="${photo}" width="640" height="480" alt="${escapeHtml(`${product.name}, ${product.pack}`)}"><p class="brand">${escapeHtml(product.brand)}</p><h2><a href="${href}">${escapeHtml(product.name)}</a></h2><p>SKU ${escapeHtml(product.sku)}</p><p>Rated ${product.rating} out of 5, from ${product.reviewCount} reviews.</p><p class="price">List price ${money(product.price)} per ${escapeHtml(product.unit)}</p><p>Your price ${money(product.contractPrice)} per ${escapeHtml(product.unit)}</p><p class="stock ${product.availability}">${escapeHtml(product.availabilityLabel)}</p><button type="button" data-add="${product.sku}">Add to cart, ${escapeHtml(product.name)}</button></li>`;
}

function listingPage(variant) {
  const products = catalog.products;
  const brands = countOptions(products, "brand");
  const packs = countOptions(products, "packType");
  const categories = catalog.categories.map((category) => ({
    value: category.slug,
    label: `${category.label} (${products.filter((product) => product.category === category.slug).length})`
  }));
  const availability = [
    ["in-stock", "In stock"],
    ["back-order", "Back ordered"],
    ["out-of-stock", "Out of stock"]
  ].map(([value, label]) => ({ value, label: `${label} (${products.filter((product) => product.availability === value).length})` }));
  const cards = products.map((product, index) => productCard(variant, product, index)).join("");
  const list = variant === "bad"
    ? `<div class="product-grid" data-product-list>${cards}</div>`
    : `<ul class="product-grid" data-product-list>${cards}</ul>`;
  const filters = variant === "bad"
    ? `${badChecks("brand", "Brand", brands)}${badChecks("availability", "Availability", availability)}${badChecks("category", "Category", categories)}${badChecks("pack", "Pack", packs)}<div><p class="bad-muted">Drag to set a maximum price</p><div class="track"><div data-price-drag></div></div><p class="bad-muted" data-price-label>Any price</p></div><button type="button" data-clear-filters>Clear filters</button>`
    : `${goodChecks("brand", "Brand", brands)}${goodChecks("availability", "Availability", availability)}${goodChecks("category", "Category", categories)}${goodChecks("pack", "Pack", packs)}<fieldset><legend>Price in Canadian dollars</legend><p id="price-hint">Leave a box blank for no limit. Filters apply as soon as you change them. Within a group, a product matches if it fits any box you check. It must also fit every group you use.</p><label for="min-price">Minimum</label><input id="min-price" data-min-price inputmode="decimal" aria-describedby="price-hint"><label for="max-price">Maximum</label><input id="max-price" data-max-price inputmode="decimal" aria-describedby="price-hint"></fieldset><button type="button" class="secondary" data-clear-filters>Clear filters</button>`;
  const sort = variant === "bad"
    ? `<select data-sort-select><option value="featured">Featured</option><option value="price-asc">Price, low to high</option><option value="price-desc">Price, high to low</option><option value="name">Name</option></select>`
    : `<div class="sort"><label for="sort">Sort products</label><select id="sort" data-sort-select><option value="featured">Featured</option><option value="price-asc">Price, low to high</option><option value="price-desc">Price, high to low</option><option value="name">Name</option></select></div>`;
  const count = variant === "bad"
    ? `<p id="result-count" class="bad-muted">Showing ${products.length} of ${products.length} products.</p>`
    : `<p id="result-count" aria-live="polite" aria-atomic="true">Showing ${products.length} of ${products.length} products.</p>`;
  const dialog = variant === "bad"
    ? `<div class="fake-dialog" role="dialog" aria-modal="true" data-fake-dialog><button type="button" data-close><span aria-hidden="true">Close</span></button><h2>Request a quote</h2><p class="bad-muted">Send this list to your rep.</p></div><button type="button" data-reopen-quote>Open quote</button>`
    : `<button type="button" data-open-quote>Request a quote</button><dialog id="quote-dialog" aria-labelledby="quote-title"><h2 id="quote-title">Request a quote</h2><p>Ask your rep to hold today's contract prices. This lab keeps the note on the page and does not send it.</p><form><label for="quote-note">Note to your rep</label><textarea id="quote-note" name="note"></textarea><div class="actions"><button type="submit">Send quote request</button><button type="button" class="secondary" data-close>Cancel</button></div></form></dialog>`;
  const demo = `<p class="eyebrow">Catalogue</p><h1>Dental supplies</h1><p class="lede">Order for Harbourview Dental. You are signed in as Priya Shah. Prices are in Canadian dollars.</p>${dialog}<div class="listing-layout"><div class="filters" data-filters>${filters}</div><div><div class="toolbar">${count}${sort}</div><p id="cart-status" ${variant === "good" ? `role="status"` : ""}></p>${list}</div></div>`;
  const panel = variant === "bad"
    ? { eyebrow: "Bad example · Listing and filters", title: "The catalogue answers a pointer and ignores everyone else", who: "A buyer using a keyboard cannot see which filter has focus, cannot operate the price control, and cannot tell that a dialog claims to be open. A screen reader hears unnamed checkboxes, an Add button that also contains a link, and no change when the result count updates. Low vision loses the stock text and the second price.", rule: "WCAG 2.2 covers this in 1.1.1, 1.3.1, 1.4.3, 1.4.10, 1.4.11, 2.1.1, 2.4.3, 2.4.7, 2.4.11, 2.5.7, 2.5.8, 3.2.6, 3.3.2, 4.1.2, and 4.1.3. The price control is drag-only. aria-modal does not trap focus, and the dialog heading was never given to the dialog as its name. The product photo has no alt attribute. Help is missing from this header.", acceptance: "Every filter is a labelled control with a visible focus style. Price can be typed. The result count is announced when it changes. Add to cart is its own button, named with the product, and does not contain another link. Focus is not covered by a sticky bar. The page reflows at 320 pixels wide. Help stays in the same header position on every page." }
    : { eyebrow: "Repaired example · Listing and filters", title: "The same catalogue, operable without a mouse", who: "Keyboard users get a visible focus ring and a price they can type. Screen reader users hear each filter name, the product, and the new count. Low vision can read stock, price, and the 320 pixel layout.", rule: "Native checkboxes, fieldsets, and labels do the work that ARIA was papering over. The dialog element supplies the name, the focus trap, and Escape. The result count uses aria-live so a filter change is a status message. Product photos name the product and the pack. Help is the second account link on every repaired page.", acceptance: "A keyboard-only buyer can set brand, availability, category, pack, and price, and hear the updated count. Add to cart includes the product name. Nothing sticky covers the focused control." };
  return frame({
    variant,
    exercise: "listing",
    label: "Product listing",
    title: `${variant === "bad" ? "Broken" : "Repaired"} example: dental supplies | Northline accessibility lab`,
    demo,
    panel
  });
}

function productPage(variant, product) {
  const photo = `/assets/${product.sku}.svg`;
  const image = variant === "bad"
    ? `<img class="product-photo" alt="" src="${photo}" width="640" height="480">`
    : `<img class="product-photo" src="${photo}" width="640" height="480" alt="${escapeHtml(`${product.name}, ${product.pack}`)}">`;
  const rows = product.specs.map(([label, value]) => (
    variant === "bad"
      ? `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`
      : `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`
  )).join("");
  const table = variant === "bad"
    ? `<table class="spec">${rows}</table>`
    : `<table class="spec"><caption>Specifications for ${escapeHtml(product.name)}</caption><tbody>${rows}</tbody></table>`;
  const rating = variant === "bad"
    ? `<img class="rating-stars" src="/assets/stars.svg" width="120" height="24"><span class="bad-muted">(${product.reviewCount})</span>`
    : `<p>Rated ${product.rating} out of 5, from ${product.reviewCount} reviews.</p>`;
  const price = variant === "bad"
    ? `<p>${money(product.price)}</p><p class="bad-muted">${money(product.contractPrice)}</p><p class="bad-muted">${escapeHtml(product.availabilityLabel)}</p>`
    : `<p>List price ${money(product.price)} per ${escapeHtml(product.unit)}</p><p>Your contract price ${money(product.contractPrice)} per ${escapeHtml(product.unit)}, ${escapeHtml(catalog.account.practice)}, ${escapeHtml(catalog.account.tier)}.</p><p class="stock ${product.availability}">${escapeHtml(product.availabilityLabel)}</p>`;
  const buy = variant === "bad"
    ? `<span>Quantity</span><input type="number" value="1"><button type="button" data-add="${product.sku}">Add</button><button type="button" data-save><span aria-hidden="true">Save</span></button>`
    : `<div class="form-grid"><label for="qty">Quantity in packs</label><input id="qty" type="number" min="1" value="1"><div class="actions"><button type="button" data-add="${product.sku}">Add to cart, ${escapeHtml(product.name)}</button><button type="button" class="secondary" data-save>Save to a list, ${escapeHtml(product.name)}</button></div></div>`;
  const related = catalog.products.filter((item) => item.sku !== product.sku).slice(0, 3).map((item, index) => productCard(variant, item, index)).join("");
  const relatedList = variant === "bad" ? `<div class="product-grid">${related}</div>` : `<ul class="product-grid">${related}</ul>`;
  const crumb = variant === "bad"
    ? `<p><a href="/exercises/listing/bad/">Supplies</a> / <a href="${productUrl("bad", product.sku)}">here</a></p>`
    : `<nav aria-label="Breadcrumb"><a href="/exercises/listing/good/">Dental supplies</a> <span aria-hidden="true">/</span> <a href="/exercises/listing/good/#product-${product.sku}">${escapeHtml(categoryName[product.category])}</a> <span aria-hidden="true">/</span> ${escapeHtml(product.name)}</nav>`;
  const demo = `${crumb}<div class="product-hero"><div>${image}</div><div><p class="eyebrow">${escapeHtml(product.brand)}</p><h1>${escapeHtml(product.name)}</h1>${rating}<p>${escapeHtml(product.summary)}</p>${price}<div class="buy-box">${buy}</div><p id="cart-status" ${variant === "good" ? `role="status"` : ""}></p></div></div><h2>Specifications</h2>${table}<h2>You may also need</h2>${relatedList}`;
  const panel = variant === "bad"
    ? { eyebrow: "Bad example · Product detail", title: "The spec sheet is a picture of a table, and the photo is marked decorative", who: "A screen reader skips the product photo because alt is empty, then hits a star image with no alt at all. The specification grid has no header cells, so the shade and the pack size are just a stream of words. The quantity field has no name. Low vision gets a second price with no label.", rule: "WCAG 2.2 1.1.1, 1.3.1, 1.4.1, 1.4.3, 2.4.4, 3.3.2, and 4.1.2. An empty alt is a claim that the image adds nothing. Axe will not argue with that claim, which is why the repaired page is the one that has to prove the photo is described. The link text \"here\" does not say where it goes.", acceptance: "The product photo alt names the product and the pack. Rating is text. The spec table has a caption and row headers. List price and contract price are both named. Quantity has a visible label. Links say where they go." }
    : { eyebrow: "Repaired example · Product detail", title: "The buyer can check the spec without seeing the grid", who: "Someone listening to the page hears the product, the pack, the rating, and each spec as a labelled row. Someone zoomed in still gets the two prices as text, not as a green number.", rule: "A two-column spec table uses row headers. The photo alt repeats the product and the pack because that image is content, not decoration. Price and stock are words. The visible button text \"Add to cart\" is included in the accessible name, with the product added after it, so speech input still has a string to hit.", acceptance: "Accept the page when the spec table, the photo alt, the rating, and both prices are understandable with the monitor off and with colour removed." };
  return frame({
    variant,
    exercise: "product",
    sku: product.sku,
    label: product.name,
    title: `${variant === "bad" ? "Broken" : "Repaired"} example: ${product.name} | Northline accessibility lab`,
    demo,
    panel
  });
}

function quickOrderPage(variant) {
  const rows = [1, 2, 3, 4].map((line) => {
    if (variant === "bad") {
      return `<div data-line><span>SKU</span><input data-sku-input><span>Quantity</span><input data-qty-input><button type="button"><span aria-hidden="true">Remove</span></button></div>`;
    }
    return `<tr data-line><th scope="row">${line}</th><td><label class="sr-only" for="sku-${line}">SKU for line ${line}</label><input id="sku-${line}" data-sku-input data-describedby="quick-hint" aria-describedby="quick-hint" autocomplete="off"></td><td><label class="sr-only" for="qty-${line}">Quantity for line ${line}</label><input id="qty-${line}" data-qty-input inputmode="numeric" autocomplete="off"></td></tr>`;
  }).join("");
  const table = variant === "bad"
    ? `<div>${rows}</div>`
    : `<div class="table-scroll" tabindex="0" role="region" aria-label="Quick order lines. Scroll sideways if the columns overflow."><table class="data"><caption>Quick order lines. Quantities are packs, not individual pieces.</caption><thead><tr><th scope="col">Line</th><th scope="col">SKU</th><th scope="col">Quantity</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const paste = variant === "bad"
    ? `<span>Paste SKUs</span><textarea data-bulk></textarea><button type="button" data-fill-lines>Fill</button><p id="quick-error" class="bad-error">Something went wrong with your order.</p>`
    : `<label for="bulk">Paste SKUs and quantities</label><p id="bulk-hint">One line at a time. Example: NLD-10421, 4. SKU means the stock keeping unit printed on the box. This form holds 4 lines. Extra pasted lines are reported, not dropped quietly.</p><textarea id="bulk" data-bulk aria-describedby="bulk-hint"></textarea><button type="button" class="secondary" data-fill-lines>Fill the lines</button><p id="quick-status" role="status"></p>`;
  const summary = variant === "good" ? `<div id="error-summary" tabindex="-1" hidden><h2>Fix the lines below</h2><ul></ul></div>` : "";
  const demo = `<p class="eyebrow">Quick order</p><h1>Bulk SKU entry</h1><p class="lede">${variant === "bad" ? "Paste or type the codes from your shelf labels." : "Type a SKU and a pack quantity, or paste several lines. Known codes in this lab start with NLD-."}</p><form data-quick-order>${summary}${paste}${variant === "good" ? `<p id="quick-hint">Enter the SKU printed on the box. Quantities are whole packs.</p>` : ""}${table}<button type="submit">${variant === "bad" ? "Submit" : "Add lines to cart"}</button></form>`;
  const panel = variant === "bad"
    ? { eyebrow: "Bad example · Quick order", title: "The error says something went wrong, then throws away the SKUs", who: "A buyer who pasted 20 lines cannot tell which line failed, and the form clears the work. A screen reader hears edit boxes with no name. The pale error is easy to miss if you are not looking at the top of the form.", rule: "WCAG 2.2 1.3.1, 1.4.3, 3.3.1, 3.3.2, and 4.1.2. Identifying a field by its placeholder disappears as soon as someone types. A single vague error is not an error identification. Clearing the form is the opposite of helping someone correct it.", acceptance: "Do not accept a quick order that uses placeholders as labels, reports a vague error, or clears values after a failed submit." }
    : { eyebrow: "Repaired example · Quick order", title: "The line, the SKU, and the value survive a mistake", who: "Someone tabbing through four lines hears \"SKU for line 2\", not four boxes that all say nothing. On a bad code, focus moves to a summary that links to that line, and the typed value is still there.", rule: "WCAG 2.2 3.3.1 Error Identification, 3.3.2 Labels or Instructions, 3.3.3 Error Suggestion, and 4.1.2. The summary is focused, so the message is delivered even if a live region is missed. aria-invalid and aria-describedby tie the text to the field. The paste box explains the pattern before the buyer has to guess it.", acceptance: "Every SKU and quantity has a unique name. Errors name the line and the code, stay attached to the field, and do not clear what was typed. Focus moves to the summary." };
  return frame({
    variant,
    exercise: "quick-order",
    label: "Quick order",
    title: `${variant === "bad" ? "Broken" : "Repaired"} example: quick order | Northline accessibility lab`,
    demo,
    panel
  });
}

function cartLine(variant, product, qty) {
  const total = money(product.price * qty);
  if (variant === "bad") {
    return `<div data-line data-name="${escapeHtml(product.name)}" data-price="${product.price}"><div data-drag-handle>Drag</div><p>${escapeHtml(product.name)}</p><p>${escapeHtml(product.sku)}</p><button type="button" data-step="-1"><span aria-hidden="true">Decrease</span></button><span data-qty-value>${qty}</span><button type="button" data-step="1"><span aria-hidden="true">Increase</span></button><p data-line-total class="bad-muted">${total}</p><button type="button" data-remove><span aria-hidden="true">Remove</span></button></div>`;
  }
    return `<tr data-line data-name="${escapeHtml(product.name)}" data-price="${product.price}"><th scope="row">${escapeHtml(product.name)}<br>${escapeHtml(product.sku)}</th><td>${money(product.price)}</td><td><div class="actions"><button type="button" data-step="-1">Decrease, ${escapeHtml(product.name)}</button><span data-qty-value>${qty}</span><button type="button" data-step="1">Increase, ${escapeHtml(product.name)}</button></div></td><td data-line-total>${total}</td><td><button type="button" data-move="-1">Move up, ${escapeHtml(product.name)}</button> <button type="button" data-move="1">Move down, ${escapeHtml(product.name)}</button></td><td><button type="button" class="secondary" data-remove>Remove, ${escapeHtml(product.name)}</button></td></tr>`;
}

function cartPage(variant) {
  const lines = [
    [catalog.products.find((product) => product.sku === "NLD-10421"), 2],
    [catalog.products.find((product) => product.sku === "NLD-21014"), 1]
  ];
  const body = lines.map(([product, qty]) => cartLine(variant, product, qty)).join("");
  const table = variant === "bad"
    ? `<div data-cart>${body}</div>`
    : `<div class="table-scroll" tabindex="0" role="region" aria-label="Cart lines. Scroll sideways if the columns overflow."><table class="data" data-cart><caption>Cart for Harbourview Dental. Prices in Canadian dollars, before tax.</caption><thead><tr><th scope="col">Product</th><th scope="col">List price</th><th scope="col">Quantity</th><th scope="col">Line total</th><th scope="col">Reorder</th><th scope="col">Remove</th></tr></thead><tbody>${body}</tbody></table></div>`;
  const quote = variant === "bad"
    ? `<form data-quote><span>Date</span><input><span>Note</span><textarea></textarea><button type="submit">Send</button></form><p id="quote-error" class="bad-error">Could not request a quote.</p>`
    : `<form data-quote class="form-grid"><h2>Request a quote hold</h2><label for="needed-by">Hold prices until (required)</label><input id="needed-by" type="date" aria-required="true"><label for="quote-note">Note to your rep</label><textarea id="quote-note"></textarea><button type="submit">Request quote</button></form><p id="quote-status" role="status"></p>`;
  const status = variant === "good" ? `<p id="cart-status" role="status"></p>` : `<p id="cart-status"></p>`;
  const demo = `<p class="eyebrow">Cart</p><h1>Cart and quote</h1><p class="lede">Two lines are already in the cart. Change a quantity, reorder a line, or ask for a price hold.</p>${status}${table}<h2>Quote</h2>${quote}`;
  const panel = variant === "bad"
    ? { eyebrow: "Bad example · Cart and quote", title: "Quantity is a symbol with no name, and reorder is a drag", who: "Someone who cannot drag cannot reorder the lines. The plus, minus, and remove controls have no names, so a screen reader says \"button\" three times. The line total is faint. The quote fields are placeholders, and the error does not say what to fix.", rule: "WCAG 2.2 1.3.1, 1.4.3, 2.1.1, 2.5.7, 3.3.1, 3.3.2, 4.1.2, and 4.1.3. Dragging has to have a single-pointer alternative that does not require dragging. A quantity change that only updates a number is not a status message. A div stack is not a table, even if it looks like one.", acceptance: "Do not accept a cart whose quantity controls are unnamed, whose reorder is drag-only, or whose quote form has no labels." }
    : { eyebrow: "Repaired example · Cart and quote", title: "The cart is a table, and the new quantity is announced", who: "A screen reader user hears the product in the row header and hears \"Quantity of Apex Dental Universal Composite A2 is 3\" after a change. Reorder is Move up and Move down. The quote form asks for a date in a labelled field.", rule: "WCAG 2.2 1.3.1, 2.5.7, 4.1.2, and 4.1.3. The status region announces the result and is not placed on the whole table, which would re-read every line. Button names start with the visible word and then add the product, so the visible label is still part of the name.", acceptance: "Quantity buttons name the product. A change is announced. Lines move without dragging. The quote form has visible labels and a specific error." };
  return frame({
    variant,
    exercise: "cart",
    label: "Cart and quote",
    title: `${variant === "bad" ? "Broken" : "Repaired"} example: cart and quote | Northline accessibility lab`,
    demo,
    panel
  });
}

function checkoutPage(variant) {
  const account = catalog.account;
  if (variant === "bad") {
    const demo = `<p class="eyebrow">Checkout</p><h1>Checkout</h1><p class="lede">Invoice terms for ${escapeHtml(account.practice)}.</p><form data-checkout class="form-grid"><p id="checkout-error" class="bad-error">Something went wrong with your order.</p><span>Account number</span><input><span>Practice name</span><input><span>Ship-to address</span><input><span>PO number</span><input data-po><span>Cost center</span><input><span>Delivery date</span><input><span>Phone</span><input><img class="captcha" src="/assets/captcha.svg" width="180" height="64"><span>Type the characters</span><input><button type="submit">Place order</button></form>`;
    const panel = { eyebrow: "Bad example · Checkout", title: "The form asks for what it already knows, then wipes the answers", who: "Priya already has an account number, a practice, and a ship-to on the order. The form asks her to type them again, then clears everything when the pale error appears. The captcha is a cognitive test with no alternative. Zoom is locked by the viewport, so a low-vision buyer cannot pinch in.", rule: "WCAG 2.2 1.1.1, 1.4.3, 1.4.4, 3.3.1, 3.3.2, 3.3.7 Redundant Entry, and 3.3.8 Accessible Authentication. The characters in the image are 7KQM. Nothing in the form tells that to a screen reader. Help is not in this header, so the help mechanism moved or disappeared compared with a repaired page.", acceptance: "Do not accept checkout that re-asks account data, locks zoom, uses a captcha, clears fields on error, or reports a vague message." };
    return frame({
      variant,
      exercise: "checkout",
      label: "Checkout",
      title: "Broken example: checkout | Northline accessibility lab",
      viewport: "width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no",
      demo,
      panel
    });
  }
  const demo = `<p class="eyebrow">Checkout</p><h1>Checkout</h1><p class="lede">Invoice terms. The account details already on file are shown, not asked again.</p><dl class="account-facts"><div><dt>Account</dt><dd>${escapeHtml(account.practice)}, ${escapeHtml(account.accountNumber)}</dd></div><div><dt>Ship to</dt><dd>${escapeHtml(account.shipTo)}</dd></div><div><dt>Buyer</dt><dd>${escapeHtml(account.buyer)}</dd></div></dl><form data-checkout class="form-grid"><div id="error-summary" tabindex="-1" hidden><h2>There is a problem with this order</h2><ul></ul></div><label for="po">Purchase order number (required)</label><p id="po-hint">Printed on your practice's purchase order. Invoice terms need at least 3 characters.</p><input id="po" data-checkout-field autocomplete="off" aria-required="true" data-describedby="po-hint" aria-describedby="po-hint"><label for="cost-center">Cost center (required)</label><p id="cc-hint">Format CC- and 4 digits, for example ${escapeHtml(account.costCenterExample)}.</p><input id="cost-center" data-checkout-field autocomplete="off" aria-required="true" data-describedby="cc-hint" aria-describedby="cc-hint"><label for="delivery-date">Delivery date (required)</label><p id="date-hint">Today or later. The carrier delivers on business days.</p><input id="delivery-date" type="date" data-checkout-field aria-required="true" data-describedby="date-hint" aria-describedby="date-hint"><label for="dock-phone">Dock phone (optional)</label><input id="dock-phone" type="tel" data-checkout-field autocomplete="tel"><label for="dock-note">Dock instructions (optional)</label><textarea id="dock-note" data-checkout-field></textarea><button type="submit">Place order</button></form><p id="checkout-status" role="status"></p>`;
  const panel = { eyebrow: "Repaired example · Checkout", title: "Ask for the purchase order, not for the account you already have", who: "Priya does not retype her account, practice, or ship-to. A mistake names the field, leaves her values in place, and moves focus to the summary. She can pinch-zoom. There is no captcha.", rule: "WCAG 2.2 3.3.1, 3.3.2, 3.3.7, 3.3.8, and 1.4.4. Sign-in, if you add it, should allow a password manager and paste, and must not depend on remembering or transcribing a code. This step is already past sign-in. Help stays in the header.", acceptance: "Account data on file is text, not inputs. Errors are specific and the values remain. Zoom is allowed. Placing the order does not require a cognitive test." };
  return frame({
    variant,
    exercise: "checkout",
    label: "Checkout",
    title: "Repaired example: checkout | Northline accessibility lab",
    demo,
    panel
  });
}

function approvalsPage(variant) {
  const orders = [...catalog.orders].sort((a, b) => a.submitted.localeCompare(b.submitted));
  if (variant === "bad") {
    const rows = orders.map((order) => `<div class="product-card" data-fake-row data-id="${order.id}"><p>${escapeHtml(order.id)} ${escapeHtml(order.practice)}</p><p>${escapeHtml(order.submitted)}</p><p class="bad-muted">${money(order.total)}</p><p class="bad-status">${escapeHtml(order.status)}</p><button type="button" data-fake-decision="approve">Approve</button><button type="button" data-fake-decision="reject"><span aria-hidden="true">Return</span></button></div>`).join("");
    const demo = `<p class="eyebrow">Account</p><h1>Approvals</h1><img class="spend-chart" src="/assets/spend-chart.svg" width="640" height="280"><div data-fake-sort aria-sort="ascending">Submitted</div><div data-fake-body>${rows}</div><p id="approval-status"></p>`;
    const panel = { eyebrow: "Bad example · Approvals", title: "Four buttons that all say Approve, and a chart with no words", who: "A screen reader user hears \"Approve\" four times and cannot tell which order. Return has no name. The spend picture has no text alternative, so the quarter disappears. Status is a faint word. The sort control is a div with aria-sort, which is not allowed on a div, and it is not a button.", rule: "WCAG 2.2 1.1.1, 1.3.1, 1.4.1, 1.4.3, 2.1.1, and 4.1.2. Repeating the visible word Approve is not enough when the accessible name does not say which order. A chart image is not a data table. Putting an ARIA attribute on the wrong element is not a fix.", acceptance: "Do not accept an approval queue whose actions omit the order id, whose status is colour or faint text, or whose numbers exist only in an image." };
    return frame({ variant, exercise: "approvals", label: "Approvals", title: "Broken example: approvals | Northline accessibility lab", demo, panel });
  }
  const rows = orders.map((order) => `<tr data-id="${order.id}" data-practice="${escapeHtml(order.practice)}" data-submitted="${order.submitted}" data-total="${order.total}"><th scope="row">${escapeHtml(order.id)}</th><td>${escapeHtml(order.practice)}</td><td>${escapeHtml(order.submitted)}</td><td>${money(order.total)}</td><td>${escapeHtml(order.status)}</td><td><div class="actions"><button type="button" data-decision="approve">Approve ${escapeHtml(order.id)}</button><button type="button" class="secondary" data-decision="reject">Return ${escapeHtml(order.id)}</button></div></td></tr>`).join("");
  const spendRows = catalog.spend.map(([label, share]) => `<tr><th scope="row">${escapeHtml(label)}</th><td>${share}% of approved spend this quarter</td></tr>`).join("");
  const bars = catalog.spend.map(([label, share]) => `<div class="bar-row"><span>${escapeHtml(label)}</span><span class="bar" style="width:${share}%"></span><span>${share}%</span></div>`).join("");
  const demo = `<p class="eyebrow">Account</p><h1>Approvals</h1><p class="lede">${escapeHtml(catalog.account.buyer)} can approve orders up to ${money(catalog.account.approvalLimit)}. Larger orders need a second approver.</p><div class="table-scroll" tabindex="0" role="region" aria-label="Orders waiting for approval. Scroll sideways if the columns overflow."><table class="data" data-approval-table><caption>Orders waiting for ${escapeHtml(catalog.account.buyer)}.</caption><thead><tr><th scope="col">Order</th><th scope="col" aria-sort="none"><button type="button" data-sort-key="practice">Practice</button></th><th scope="col" aria-sort="ascending"><button type="button" data-sort-key="submitted">Submitted</button></th><th scope="col" aria-sort="none"><button type="button" data-sort-key="total">Total</button></th><th scope="col">Status</th><th scope="col">Decision</th></tr></thead><tbody>${rows}</tbody></table></div><p id="approval-status" role="status"></p><h2>Spend this quarter</h2><table class="data"><caption>Share of approved spend by category. The bars repeat these numbers and are hidden from assistive technology.</caption><thead><tr><th scope="col">Category</th><th scope="col">Share</th></tr></thead><tbody>${spendRows}</tbody></table><div class="bars" aria-hidden="true">${bars}</div>`;
  const panel = { eyebrow: "Repaired example · Approvals", title: "The decision names the order, and the chart is a table", who: "Someone scanning buttons hears \"Approve, order Q-1048 from Harbourview Dental\" instead of four identical Approves. Status is a phrase, not a colour. Sorting is a button with aria-sort on the header cell.", rule: "WCAG 2.2 1.3.1, 1.4.1, 2.1.1, and 4.1.2, plus the WAI-ARIA table pattern. The visible word Approve remains the start of the accessible name so speech input can still say it. The bars are aria-hidden because the table already states the percentages.", acceptance: "Approve and Return include the order. The queue is a keyboard-sortable table. Spend is available as text. Status is not colour alone." };
  return frame({ variant, exercise: "approvals", label: "Approvals", title: "Repaired example: approvals | Northline accessibility lab", demo, panel });
}

function cataloguePage(variant) {
  if (variant === "bad") {
    const demo = `<p class="eyebrow">Resources</p><h1>Resources</h1><img class="product-photo" src="/assets/catalogue-cover.svg" width="640" height="800"><p><a class="icon-link" href="/files/northline-restorative-catalogue.pdf"><span aria-hidden="true">Download</span></a> <a href="/files/northline-restorative-catalogue.pdf">click here</a></p><iframe src="/files/northline-restorative-catalogue.pdf" width="800" height="360"></iframe>`;
    const panel = { eyebrow: "Bad example · Catalogue and PDF", title: "The only copy is an untitled frame and a link that says click here", who: "A buyer does not learn that the link is a PDF, how long it is, or that it has no tags, no language, and no headings. The cover image carries the title in pixels and has no alt. The iframe has no title, so a screen reader says \"frame\".", rule: "WCAG 2.2 1.1.1, 2.4.4, and 4.1.2 for the page. EN 301 549 clause 10 applies the same bar to the downloaded document. India's RPwD Rules expect documents on a site to be ePUB or OCR PDF, which this file is not. Axe checks the page, not the bytes inside the PDF.", acceptance: "Do not ship a catalogue whose only copy is an untagged PDF, whose link hides the format, or whose preview frame has no name." };
    return frame({ variant, exercise: "catalogue", label: "Catalogue", title: "Broken example: catalogue | Northline accessibility lab", demo, panel });
  }
  const demo = `<p class="eyebrow">Resources</p><h1>2026 restorative catalogue</h1><img class="product-photo" alt="" src="/assets/catalogue-cover.svg" width="640" height="800"><p class="lede">The cover repeats this heading, so the image is decorative. The catalogue itself is the HTML page. The PDF is a one-page sample with no tags, no document language, and no headings. It is not the accessible copy.</p><ul><li><a href="/exercises/catalogue/read/">Read the 2026 restorative catalogue in HTML</a></li><li><a href="/files/northline-restorative-catalogue.pdf">Download the plain PDF, 1 page, not an accessible copy</a></li></ul>`;
  const panel = { eyebrow: "Repaired example · Catalogue and PDF", title: "Give the buyer the HTML catalogue, and say what the PDF is", who: "A screen reader user gets the products as a table on the next page. A sighted buyer can still download the PDF, and the link says it is not the accessible copy. The frame is gone.", rule: "WCAG 2.2 1.1.1 and 2.4.4, EN 301 549 clause 10 for non-web documents, and the RPwD Rules document requirement. An empty alt is correct here because the heading carries the same words. It was not correct on the product photo, where the image was the only pack shot.", acceptance: "The accessible catalogue is HTML, or a PDF that has been tagged and tested. The link names the format and whether it is the accessible copy. No untitled iframe." };
  return frame({ variant, exercise: "catalogue", label: "Catalogue", title: "Repaired example: catalogue | Northline accessibility lab", demo, panel });
}

function catalogueReadPage() {
  const rows = catalog.products.map((product) => `<tr><th scope="row">${escapeHtml(product.name)}</th><td>${escapeHtml(product.sku)}</td><td>${escapeHtml(product.pack)}</td><td>${money(product.price)}</td><td>${money(product.contractPrice)}</td><td>${escapeHtml(product.availabilityLabel)}</td></tr>`).join("");
  const demo = `<p class="eyebrow">Catalogue</p><h1>2026 restorative catalogue</h1><p class="lede">HTML version for Harbourview Dental, ${escapeHtml(catalog.account.tier)}. Prices are list and contract, in Canadian dollars. This is the accessible copy of the catalogue.</p><div class="table-scroll" tabindex="0" role="region" aria-label="2026 restorative catalogue. Scroll sideways if the columns overflow."><table class="data"><caption>2026 restorative catalogue for ${escapeHtml(catalog.account.practice)}.</caption><thead><tr><th scope="col">Product</th><th scope="col">SKU</th><th scope="col">Pack</th><th scope="col">List price</th><th scope="col">Your price</th><th scope="col">Availability</th></tr></thead><tbody>${rows}</tbody></table></div>`;
  const panel = { eyebrow: "Accessible copy", title: "Same products as the PDF, in a table", who: "A buyer can read, search, and navigate this by header. The PDF sample cannot offer that.", rule: "This is the conforming alternative for the catalogue exercise. A real PDF would still need tags, a language, a title, and a reading order before it could replace this page.", acceptance: "If the business wants a download, keep this HTML page available beside it until the PDF passes a document check." };
  return frame({
    variant: "good",
    exercise: "catalogue-read",
    label: "HTML catalogue",
    title: "2026 restorative catalogue | Northline accessibility lab",
    demo,
    panel
  });
}

function helpPage() {
  const support = catalog.support;
  const demo = `<p class="eyebrow">Help</p><h1>Order desk</h1><p class="lede">Help sits in the same place on every repaired page: the account row, between Account and Cart.</p><dl class="account-facts"><div><dt>Phone</dt><dd><a href="tel:+18005550199">${escapeHtml(support.phone)}</a></dd></div><div><dt>Email</dt><dd><a href="mailto:${escapeHtml(support.email)}">${escapeHtml(support.email)}</a></dd></div><div><dt>Hours</dt><dd>${escapeHtml(support.hours)}</dd></div></dl><h2>Quick order</h2><p>Use the SKU on the box. Quantities are packs. A line that the catalogue does not know is named in the error summary, and the SKU you typed stays in the field.</p><h2>Contract price</h2><p>${escapeHtml(catalog.account.practice)} is ${escapeHtml(catalog.account.tier)}. Your price is on the product page next to the list price, with both labels in text.</p><h2>Approvals</h2><p>${escapeHtml(catalog.account.buyer)} can approve up to ${money(catalog.account.approvalLimit)}. Orders above that need a second approver.</p>`;
  const panel = { eyebrow: "Consistent help", title: "The help link does not move", who: "Someone who learned Help on the catalogue can find it on checkout without searching the footer. WCAG 2.2 3.2.6 Consistent Help asks for that when the same mechanism is repeated.", rule: "Put the human contact in the same relative order on every page in the set. This lab uses Account, Help, Cart. The broken pages drop Help.", acceptance: "On every page in the buying flow, Help is present and occupies the same position." };
  return frame({
    variant: "good",
    exercise: "help",
    label: "Help",
    title: "Help | Northline accessibility lab",
    demo,
    panel
  });
}

function homePage() {
  const pairs = [
    ["listing", "Product listing and filters", "Facets, price, sort, result count, quote dialog."],
    ["product", "Product detail and spec table", "Photo alt, rating, prices, specifications."],
    ["quick-order", "Quick order and bulk SKU entry", "Labels, paste instructions, errors that keep the value."],
    ["cart", "Cart and quote", "Quantity, reorder, status messages, quote form."],
    ["checkout", "Checkout", "Redundant entry, errors, zoom, captcha."],
    ["approvals", "Approvals and data tables", "Order actions, status, sortable queue, spend."],
    ["catalogue", "Catalogue and PDF", "Link purpose, iframe name, HTML alternative."]
  ];
  const cards = pairs.map(([slug, title, copy], index) => `<li><a class="route-card" href="${exerciseUrl(slug, "bad")}"><span>0${index + 1}</span><strong>${escapeHtml(title)}, broken version</strong><span>${escapeHtml(copy)}</span></a></li><li><a class="route-card" href="${slug === "product" ? productUrl("good", flagship) : exerciseUrl(slug, "good")}"><span>0${index + 1}</span><strong>${escapeHtml(title)}, repaired version</strong><span>${escapeHtml(copy)}</span></a></li>`).join("");
  const main = `<main id="content" tabindex="-1"><header class="lab-wrap"><div class="hero"><div><p class="eyebrow">Northline Dental Supply</p><h1>See the buying task fail, then see it work.</h1><p class="lede">A private accessibility lab for a B2B dental catalogue. Each exercise is the same storefront twice: a broken version a team could ship, and a repaired version a buyer can finish without a mouse, without sight, or at 320 pixels wide.</p><div class="actions"><a class="button" href="/exercises/listing/bad/">Open the broken catalogue</a><a class="button secondary" href="/exercises/listing/good/">Open the repaired catalogue</a></div></div><div class="hero-card"><span>WHAT CHANGED</span><strong>Broken page</strong><span>Unnamed controls, faint text, drag-only price, silent cart.</span><strong>Repaired page</strong><span>Names, contrast, keyboard, errors that keep what was typed.</span><strong>npm run check</strong><span>axe-core on both. The violations are the lesson.</span></div></div><div class="stat-grid"><div class="stat"><strong>8</strong><span>products in the catalogue</span></div><div class="stat"><strong>7</strong><span>buying tasks, each with two versions</span></div><div class="stat"><strong>AA</strong><span>WCAG 2.2 level this lab aims at</span></div><div class="stat"><strong>1</strong><span>command to see the difference</span></div></div></header><div class="lab-wrap"><section class="section" aria-labelledby="tasks-title"><h2 id="tasks-title">The buying tasks</h2><p>Start with a broken page. Tab through it. Then open the repaired version and run the check.</p><ul class="route-grid">${cards}</ul></section><section class="section" aria-labelledby="principles-title"><h2 id="principles-title">Four agreements with the buyer</h2><div class="concept-grid"><article class="concept"><h3>Perceivable</h3><p>Text for images, prices, status, and charts. Contrast that survives pale grey. Information that is not colour alone.</p></article><article class="concept"><h3>Operable</h3><p>Keyboard for every control, a visible focus ring, targets that are at least 24 pixels, and no action that is drag-only.</p></article><article class="concept"><h3>Understandable</h3><p>Labels that stay when you type. Errors that name the field. Help in the same place. Do not ask for the account number you already have.</p></article><article class="concept"><h3>Robust</h3><p>The page language is set. Controls have names. Status messages are announced. A dialog is a dialog, not a div with a hope.</p></article></div></section><section class="section" aria-labelledby="accept-title"><h2 id="accept-title">Acceptance, in one pass</h2><div class="check-grid"><article class="check-card"><h3>Listing</h3><p>Keyboard sets every filter, including price. The new count is announced. Add to cart names the product and is not inside the link.</p></article><article class="check-card"><h3>Product</h3><p>Photo alt names the pack. Specs are a table. Both prices are labelled. Rating is text.</p></article><article class="check-card"><h3>Quick order</h3><p>Each line has a unique name. Errors name the SKU and keep the value. Focus moves to the summary.</p></article><article class="check-card"><h3>Cart, checkout, approvals, catalogue</h3><p>Quantity is announced. Reorder is not drag-only. Checkout does not re-ask or use a captcha. Approve names the order. The catalogue has an HTML copy.</p></article></div></section><section class="section prose" aria-labelledby="sources-title"><h2 id="sources-title">Sources the repaired pages are built against</h2><ul class="source-list"><li><a href="https://www.w3.org/TR/WCAG22/" target="_blank" rel="noopener noreferrer">WCAG 2.2<span class="sr-only"> (opens in a new tab)</span></a></li><li><a href="https://www.w3.org/WAI/ARIA/apg/" target="_blank" rel="noopener noreferrer">WAI-ARIA Authoring Practices<span class="sr-only"> (opens in a new tab)</span></a></li><li><a href="https://eur-lex.europa.eu/eli/dir/2019/882/oj" target="_blank" rel="noopener noreferrer">European Accessibility Act, Directive (EU) 2019/882<span class="sr-only"> (opens in a new tab)</span></a></li><li><a href="https://www.etsi.org/deliver/etsi_en/301500_301599/301549/04.01.01_60/en_301549v040101p.pdf" target="_blank" rel="noopener noreferrer">EN 301 549 V4.1.1<span class="sr-only"> (opens in a new tab)</span></a></li><li><a href="https://www.section508.gov/" target="_blank" rel="noopener noreferrer">Section 508<span class="sr-only"> (opens in a new tab)</span></a></li><li><a href="https://guidelines.india.gov.in/" target="_blank" rel="noopener noreferrer">GIGW, Guidelines for Indian Government Websites<span class="sr-only"> (opens in a new tab)</span></a></li></ul><p>The README cites the versions and says what each one does, and does not, require of a B2B storefront. This lab is not a legal opinion or a conformance claim.</p></section></div><footer class="store-footer"><div class="store-footer-inner"><p>Northline Dental Supply. A private learning lab, not a live store.</p><a href="/help/">Help</a></div></footer></main>`;
  return documentHtml({
    variant: "good",
    title: "B2B commerce accessibility best practices | Northline Dental Supply",
    main
  });
}

function productSvg(product) {
  const initials = product.brand.split(" ").map((word) => word[0]).join("").slice(0, 3);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480" viewBox="0 0 640 480">
  <rect width="640" height="480" fill="${product.tone}"/>
  <rect x="48" y="40" width="544" height="400" fill="#ffffff"/>
  <text x="72" y="110" font-family="Arial, sans-serif" font-size="22" fill="${product.ink}">${escapeXml(product.brand)}</text>
  <text x="72" y="250" font-family="Arial, sans-serif" font-size="72" font-weight="700" fill="${product.ink}">${escapeXml(initials)}</text>
  <text x="72" y="360" font-family="Arial, sans-serif" font-size="24" fill="${product.ink}">${escapeXml(product.pack)}</text>
</svg>`;
}

function pdfDocument() {
  const stream = "BT /F1 18 Tf 72 720 Td (Northline Dental Supply 2026 Restorative Catalogue. This file is not tagged.) Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>"
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(body.length);
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = body.length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) table += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  return `${body}${table}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
}

async function writePage(urlPath, html, kind) {
  const relative = urlPath.replace(/^\/|\/$/g, "");
  const target = relative ? join(dist, relative, "index.html") : join(dist, "index.html");
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, html);
  manifest[kind].push(urlPath);
}

await rm(dist, { recursive: true, force: true });
await mkdir(join(dist, "assets"), { recursive: true });
await mkdir(join(dist, "files"), { recursive: true });
await writeFile(join(dist, "styles.css"), await readFile(join(src, "styles.css")));
await writeFile(join(dist, "storefront.js"), await readFile(join(src, "storefront.js")));
await writeFile(join(dist, "favicon.svg"), `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="4" fill="#0c4dae"/><rect x="8" y="18" width="4" height="8" fill="#ffffff"/><rect x="14" y="12" width="4" height="14" fill="#ffffff"/><rect x="20" y="6" width="4" height="20" fill="#ffffff"/></svg>`);
await writeFile(join(dist, "assets", "stars.svg"), `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="120" height="24" viewBox="0 0 120 24"><text x="0" y="18" font-size="18" fill="#e99a36">★★★★★</text></svg>`);
await writeFile(join(dist, "assets", "captcha.svg"), `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="180" height="64" viewBox="0 0 180 64"><rect width="180" height="64" fill="#eef2f6"/><path d="M8 40 C 40 10, 80 60, 172 24" fill="none" stroke="#8aa0b8" stroke-width="3"/><text x="24" y="42" font-family="Arial, sans-serif" font-size="32" fill="#10233f">7KQM</text></svg>`);
await writeFile(join(dist, "assets", "catalogue-cover.svg"), `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="640" height="800" viewBox="0 0 640 800"><rect width="640" height="800" fill="#10233f"/><text x="48" y="360" fill="#ffffff" font-family="Arial, sans-serif" font-size="36">2026 Restorative Catalogue</text><text x="48" y="420" fill="#d5e4f5" font-family="Arial, sans-serif" font-size="22">Northline Dental Supply</text></svg>`);
const spendBars = catalog.spend.map(([label, share], index) => `<rect x="160" y="${40 + index * 56}" width="${share * 4}" height="28" fill="#0c4dae"/><text x="16" y="${60 + index * 56}" font-family="Arial, sans-serif" font-size="16" fill="#10233f">${escapeXml(label)} ${share}%</text>`).join("");
await writeFile(join(dist, "assets", "spend-chart.svg"), `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="640" height="280" viewBox="0 0 640 280"><rect width="640" height="280" fill="#ffffff"/>${spendBars}</svg>`);
await writeFile(join(dist, "files", "northline-restorative-catalogue.pdf"), pdfDocument());

for (const product of catalog.products) {
  await writeFile(join(dist, "assets", `${product.sku}.svg`), productSvg(product));
}

await writePage("/", homePage(), "good");
await writePage("/help/", helpPage(), "good");
await writePage("/exercises/listing/bad/", listingPage("bad"), "bad");
await writePage("/exercises/listing/good/", listingPage("good"), "good");
for (const product of catalog.products) {
  await writePage(productUrl("bad", product.sku), productPage("bad", product), "bad");
  await writePage(productUrl("good", product.sku), productPage("good", product), "good");
}
await writePage("/exercises/quick-order/bad/", quickOrderPage("bad"), "bad");
await writePage("/exercises/quick-order/good/", quickOrderPage("good"), "good");
await writePage("/exercises/cart/bad/", cartPage("bad"), "bad");
await writePage("/exercises/cart/good/", cartPage("good"), "good");
await writePage("/exercises/checkout/bad/", checkoutPage("bad"), "bad");
await writePage("/exercises/checkout/good/", checkoutPage("good"), "good");
await writePage("/exercises/approvals/bad/", approvalsPage("bad"), "bad");
await writePage("/exercises/approvals/good/", approvalsPage("good"), "good");
await writePage("/exercises/catalogue/bad/", cataloguePage("bad"), "bad");
await writePage("/exercises/catalogue/good/", cataloguePage("good"), "good");
await writePage("/exercises/catalogue/read/", catalogueReadPage(), "good");
await writeFile(join(dist, "lab-manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Built ${manifest.good.length} repaired pages and ${manifest.bad.length} broken pages.`);
