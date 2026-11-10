(function () {
  const catalogNode = document.getElementById("catalog-data");
  const catalog = catalogNode ? JSON.parse(catalogNode.textContent) : { products: [] };
  const bySku = new Map(catalog.products.map((product) => [product.sku, product]));
  const variant = document.body.dataset.variant || "good";

  function money(value) {
    return `$${Number(value).toFixed(2)} CAD`;
  }

  function productName(sku) {
    return bySku.get(sku)?.name || sku;
  }

  function say(id, message) {
    const node = document.getElementById(id);
    if (!node) return;
    node.textContent = message;
  }

  function setupSearch() {
    const form = document.querySelector("[data-demo] [data-search]");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      say(
        "search-status",
        "Search stays on this page in the lab. A production catalogue should return matching products and announce how many came back."
      );
    });
  }

  function selectedValues(name) {
    return [...document.querySelectorAll(`[data-demo] input[name="${name}"]:checked`)].map((input) => input.value);
  }

  function applyListing() {
    const list = document.querySelector("[data-product-list]");
    if (!list) return;
    const cards = [...list.querySelectorAll("[data-product]")];
    const brands = selectedValues("brand");
    const availability = selectedValues("availability");
    const categories = selectedValues("category");
    const packs = selectedValues("pack");
    const min = numberOrNull(document.querySelector("[data-min-price]")?.value);
    const maxInput = document.querySelector("[data-max-price]");
    const drag = document.querySelector("[data-price-drag]");
    const max = numberOrNull(maxInput?.value || drag?.dataset.max || "");
    const sort = document.querySelector("[data-sort-select]")?.value || "featured";

    let visible = cards.filter((card) => {
      const price = Number(card.dataset.price);
      const brandOk = brands.length === 0 || brands.includes(card.dataset.brand);
      const availabilityOk = availability.length === 0 || availability.includes(card.dataset.availability);
      const categoryOk = categories.length === 0 || categories.includes(card.dataset.category);
      const packOk = packs.length === 0 || packs.includes(card.dataset.pack);
      const minOk = min === null || price >= min;
      const maxOk = max === null || price <= max;
      return brandOk && availabilityOk && categoryOk && packOk && minOk && maxOk;
    });

    visible = sortCards(visible, sort);
    visible.forEach((card) => list.append(card));
    cards.forEach((card) => {
      card.hidden = !visible.includes(card);
    });

    const count = document.getElementById("result-count");
    if (count) count.textContent = `Showing ${visible.length} of ${cards.length} products.`;
  }

  function numberOrNull(value) {
    if (value === undefined || value === null || String(value).trim() === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function sortCards(cards, sort) {
    const copy = [...cards];
    if (sort === "featured") copy.sort((a, b) => Number(a.dataset.index) - Number(b.dataset.index));
    if (sort === "price-asc") copy.sort((a, b) => Number(a.dataset.price) - Number(b.dataset.price));
    if (sort === "price-desc") copy.sort((a, b) => Number(b.dataset.price) - Number(a.dataset.price));
    if (sort === "name") copy.sort((a, b) => a.dataset.name.localeCompare(b.dataset.name));
    return copy;
  }

  function setupListing() {
    const list = document.querySelector("[data-product-list]");
    if (!list) return;
    document.querySelectorAll("[data-demo] input[type='checkbox'], [data-min-price], [data-max-price], [data-sort-select]").forEach((control) => {
      control.addEventListener("change", applyListing);
      control.addEventListener("input", applyListing);
    });
    document.querySelector("[data-clear-filters]")?.addEventListener("click", () => {
      document.querySelectorAll("[data-demo] input[type='checkbox']").forEach((input) => {
        input.checked = false;
      });
      document.querySelectorAll("[data-min-price], [data-max-price]").forEach((input) => {
        input.value = "";
      });
      const sort = document.querySelector("[data-sort-select]");
      if (sort) sort.value = "featured";
      const drag = document.querySelector("[data-price-drag]");
      if (drag) {
        delete drag.dataset.max;
        drag.style.left = "0";
      }
      const label = document.querySelector("[data-price-label]");
      if (label && drag) label.textContent = "Any price";
      applyListing();
    });

    const drag = document.querySelector("[data-price-drag]");
    if (drag) {
      const track = drag.parentElement;
      let dragging = false;
      const move = (clientX) => {
        const rect = track.getBoundingClientRect();
        const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
        drag.style.left = `${ratio * 100}%`;
        const max = Math.round(40 + ratio * 660);
        drag.dataset.max = String(max);
        const label = document.querySelector("[data-price-label]");
        if (label) label.textContent = `$${max}`;
        applyListing();
      };
      drag.addEventListener("mousedown", (event) => {
        dragging = true;
        move(event.clientX);
        event.preventDefault();
      });
      document.addEventListener("mousemove", (event) => {
        if (dragging) move(event.clientX);
      });
      document.addEventListener("mouseup", () => {
        dragging = false;
      });
    }

    document.querySelectorAll("[data-add]").forEach((button) => {
      button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const sku = button.getAttribute("data-add");
        const count = document.querySelector("[data-cart-count]");
        const next = Number(count?.textContent || "0") + 1;
        if (count) count.textContent = String(next);
        if (variant === "good") {
          say("cart-status", `Added ${productName(sku)} to the cart. The cart now has ${next} ${next === 1 ? "item" : "items"}.`);
        }
      });
    });
  }

  function setupDialog() {
    const dialog = document.querySelector("dialog");
    const open = document.querySelector("[data-open-quote]");
    if (dialog && open) {
      open.addEventListener("click", () => dialog.showModal());
      dialog.querySelectorAll("[data-close]").forEach((button) => {
        button.addEventListener("click", () => dialog.close());
      });
      const form = dialog.querySelector("form");
      form?.addEventListener("submit", (event) => {
        event.preventDefault();
        dialog.close();
        say("cart-status", "Quote request kept on this page. Nothing was sent to a server.");
        open.focus();
      });
    }

    const fake = document.querySelector("[data-fake-dialog]");
    if (!fake) return;
    fake.querySelectorAll("[data-close]").forEach((button) => {
      button.addEventListener("click", () => {
        fake.hidden = true;
      });
    });
    document.querySelector("[data-reopen-quote]")?.addEventListener("click", () => {
      fake.hidden = false;
    });
  }

  function lineInputs() {
    return [...document.querySelectorAll("[data-line]")].map((row, index) => {
      const sku = row.querySelector("[data-sku-input]");
      const qty = row.querySelector("[data-qty-input]");
      return { row, index, sku, qty };
    });
  }

  function setupQuickOrder() {
    const form = document.querySelector("[data-quick-order]");
    if (!form) return;
    document.querySelector("[data-fill-lines]")?.addEventListener("click", () => {
      const pasted = document.querySelector("[data-bulk]")?.value || "";
      const lines = pasted.split(/\n/).map((line) => line.trim()).filter(Boolean);
      const rows = lineInputs();
      lines.slice(0, rows.length).forEach((line, index) => {
        const [sku, qty] = line.split(/[,;\t ]+/);
        if (rows[index].sku) rows[index].sku.value = (sku || "").toUpperCase();
        if (rows[index].qty && qty) rows[index].qty.value = qty;
      });
      if (variant === "good") {
        const extra = lines.length - rows.length;
        say(
          "quick-status",
          extra > 0
            ? `Filled ${rows.length} lines. ${extra} pasted ${extra === 1 ? "line was" : "lines were"} left off because this form holds ${rows.length} lines.`
            : `Filled ${Math.min(lines.length, rows.length)} ${lines.length === 1 ? "line" : "lines"} from the paste box.`
        );
      }
    });

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const errors = [];
      const rows = lineInputs().filter((row) => row.sku?.value.trim() || row.qty?.value.trim());
      if (rows.length === 0) {
        const first = lineInputs()[0];
        errors.push({ input: first.sku, text: "Enter at least one SKU." });
      }
      rows.forEach((row) => {
        const sku = row.sku.value.trim().toUpperCase();
        const qty = row.qty.value.trim();
        const line = row.index + 1;
        if (!sku) errors.push({ input: row.sku, text: `Enter a SKU on line ${line}.` });
        else if (!bySku.has(sku)) errors.push({ input: row.sku, text: `No catalogue SKU matches ${sku} on line ${line}.` });
        if (!/^[1-9]\d*$/.test(qty)) errors.push({ input: row.qty, text: `Enter a whole number of packs on line ${line}.` });
      });

      if (variant === "bad") {
        form.reset();
        say("quick-error", "Something went wrong with your order.");
        return;
      }

      clearFieldErrors(form);
      if (errors.length) {
        showSummary("error-summary", "Fix the lines below", errors);
        return;
      }

      const added = rows.map((row) => `${productName(row.sku.value.trim().toUpperCase())}, quantity ${row.qty.value.trim()}`);
      say("quick-status", `Added ${rows.length} ${rows.length === 1 ? "line" : "lines"} to the cart: ${added.join("; ")}.`);
    });
  }

  function clearFieldErrors(form) {
    form.querySelectorAll("[aria-invalid]").forEach((input) => input.removeAttribute("aria-invalid"));
    form.querySelectorAll("[data-field-error]").forEach((node) => node.remove());
    form.querySelectorAll("[data-sku-input], [data-qty-input], [data-checkout-field]").forEach((input) => {
      const base = input.getAttribute("data-describedby") || "";
      if (base) input.setAttribute("aria-describedby", base);
      else input.removeAttribute("aria-describedby");
    });
  }

  function showSummary(id, title, errors) {
    const summary = document.getElementById(id);
    if (!summary) return;
    const heading = summary.querySelector("h2");
    const list = summary.querySelector("ul");
    if (heading) heading.textContent = title;
    list.innerHTML = "";
    errors.forEach((error, index) => {
      const errorId = `${id}-item-${index}`;
      const item = document.createElement("li");
      const link = document.createElement("a");
      link.href = `#${error.input.id}`;
      link.textContent = error.text;
      item.append(link);
      list.append(item);
      error.input.setAttribute("aria-invalid", "true");
      let message = document.getElementById(errorId);
      if (!message) {
        message = document.createElement("p");
        message.id = errorId;
        message.className = "field-error";
        message.dataset.fieldError = "true";
        error.input.insertAdjacentElement("afterend", message);
      }
      message.textContent = error.text;
      const base = error.input.getAttribute("data-describedby");
      error.input.setAttribute("aria-describedby", [base, errorId].filter(Boolean).join(" "));
    });
    summary.hidden = false;
    summary.focus();
  }

  function setupCheckout() {
    const form = document.querySelector("[data-checkout]");
    if (!form) return;
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (variant === "bad") {
        form.reset();
        say("checkout-error", "Something went wrong with your order.");
        return;
      }

      const po = form.querySelector("#po");
      const costCenter = form.querySelector("#cost-center");
      const delivery = form.querySelector("#delivery-date");
      const phone = form.querySelector("#dock-phone");
      const errors = [];
      if (!po.value.trim() || po.value.trim().length < 3) errors.push({ input: po, text: "Enter the purchase order number. Invoice terms need at least 3 characters." });
      if (!/^CC-\d{4}$/.test(costCenter.value.trim())) errors.push({ input: costCenter, text: "Enter the cost center as CC- followed by 4 digits, for example CC-1204." });
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const chosen = delivery.value ? new Date(`${delivery.value}T00:00:00`) : null;
      if (!chosen || Number.isNaN(chosen.getTime()) || chosen < today) errors.push({ input: delivery, text: "Choose a delivery date of today or later." });
      if (phone.value.trim() && !/[0-9]{3}/.test(phone.value)) errors.push({ input: phone, text: "Enter a dock phone number the carrier can call, or leave it blank." });
      clearFieldErrors(form);
      if (errors.length) {
        showSummary("error-summary", "There is a problem with this order", errors);
        return;
      }
      say("checkout-status", `Order accepted for ${po.value.trim()}. Nothing was sent to a server.`);
    });
  }

  function setupCart() {
    const cart = document.querySelector("[data-cart]");
    if (!cart) return;

    const announce = (message) => {
      if (variant === "good") say("cart-status", message);
    };

    cart.addEventListener("click", (event) => {
      const step = event.target.closest("[data-step]");
      const remove = event.target.closest("[data-remove]");
      const move = event.target.closest("[data-move]");
      if (step) {
        const line = step.closest("[data-line]");
        const value = line.querySelector("[data-qty-value]");
        const current = Number(value.textContent);
        const next = current + Number(step.getAttribute("data-step"));
        const name = line.getAttribute("data-name");
        if (next < 1) {
          announce(`Quantity of ${name} stays 1. Remove the line if you do not want it.`);
          return;
        }
        value.textContent = String(next);
        line.querySelector("[data-line-total]").textContent = money(next * Number(line.dataset.price));
        updateCartCount();
        announce(`Quantity of ${name} is ${next}.`);
      }
      if (remove) {
        const line = remove.closest("[data-line]");
        const name = line.getAttribute("data-name");
        line.remove();
        updateCartCount();
        announce(`Removed ${name} from the cart.`);
      }
      if (move) {
        const line = move.closest("[data-line]");
        const delta = Number(move.getAttribute("data-move"));
        const sibling = delta < 0 ? line.previousElementSibling : line.nextElementSibling;
        if (!sibling) return;
        if (delta < 0) line.parentElement.insertBefore(line, sibling);
        else line.parentElement.insertBefore(sibling, line);
        announce(`Moved ${line.getAttribute("data-name")} ${delta < 0 ? "up" : "down"}.`);
      }
    });

    const handle = document.querySelector("[data-drag-handle]");
    if (handle) {
      let dragged = null;
      cart.querySelectorAll("[data-drag-handle]").forEach((item) => {
        item.addEventListener("mousedown", () => {
          dragged = item.closest("[data-line]");
        });
      });
      cart.querySelectorAll("[data-line]").forEach((line) => {
        line.addEventListener("mouseenter", () => {
          if (!dragged || dragged === line) return;
          line.parentElement.insertBefore(dragged, line);
        });
      });
      document.addEventListener("mouseup", () => {
        dragged = null;
      });
    }

    const quote = document.querySelector("[data-quote]");
    quote?.addEventListener("submit", (event) => {
      event.preventDefault();
      if (variant === "bad") {
        quote.reset();
        say("quote-error", "Could not request a quote.");
        return;
      }
      const needed = quote.querySelector("#needed-by");
      if (!needed.value) {
        needed.setAttribute("aria-invalid", "true");
        say("quote-status", "Enter the date you need the quote prices to hold until.");
        needed.focus();
        return;
      }
      needed.removeAttribute("aria-invalid");
      say("quote-status", `Quote requested through ${needed.value}. Nothing was sent to a server.`);
    });
  }

  function updateCartCount() {
    const count = document.querySelector("[data-cart-count]");
    if (!count) return;
    const total = [...document.querySelectorAll("[data-cart] [data-qty-value]")].reduce((sum, node) => sum + Number(node.textContent), 0);
    count.textContent = String(total);
  }

  function setupApprovals() {
    const table = document.querySelector("[data-approval-table]");
    if (!table) return;
    table.querySelectorAll("[data-sort-key]").forEach((button) => {
      button.addEventListener("click", () => {
        const key = button.getAttribute("data-sort-key");
        const header = button.closest("th");
        const next = header.getAttribute("aria-sort") === "ascending" ? "descending" : "ascending";
        table.querySelectorAll("th[aria-sort]").forEach((item) => item.setAttribute("aria-sort", "none"));
        header.setAttribute("aria-sort", next);
        const body = table.querySelector("tbody");
        const rows = [...body.querySelectorAll("tr")];
        rows.sort((a, b) => {
          const left = a.dataset[key];
          const right = b.dataset[key];
          const numeric = key === "total";
          const result = numeric ? Number(left) - Number(right) : String(left).localeCompare(String(right));
          return next === "ascending" ? result : -result;
        });
        rows.forEach((row) => body.append(row));
        say("approval-status", `Sorted by ${button.textContent.trim()}, ${next}.`);
      });
    });

    table.querySelectorAll("[data-decision]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest("tr");
        const decision = button.getAttribute("data-decision");
        const id = row?.dataset.id;
        if (variant === "good") {
          say("approval-status", `${decision === "approve" ? "Approved" : "Returned"} order ${id}. The practice buyer will see this decision.`);
        } else if (row) {
          row.dataset.state = decision;
        }
      });
    });

    document.querySelectorAll("[data-fake-decision]").forEach((button) => {
      button.addEventListener("click", () => {
        const row = button.closest("[data-fake-row]");
        if (row) row.dataset.state = button.getAttribute("data-fake-decision");
      });
    });

    document.querySelectorAll("[data-fake-sort]").forEach((header) => {
      header.addEventListener("click", () => {
        const body = document.querySelector("[data-fake-body]");
        if (!body) return;
        const rows = [...body.querySelectorAll("[data-fake-row]")];
        rows.reverse().forEach((row) => body.append(row));
      });
    });
  }

  document.querySelectorAll("[data-save]").forEach((button) => {
    button.addEventListener("click", () => {
      if (variant === "good") say("cart-status", "Saved to the Harbourview Dental reorder list. Nothing was sent to a server.");
    });
  });

  setupSearch();
  setupListing();
  setupDialog();
  setupQuickOrder();
  setupCheckout();
  setupCart();
  setupApprovals();
})();
