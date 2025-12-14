(() => {
  const DATA = window.AI_MODELS_COMPARISON_DATA;

  const el = {
    sections: document.querySelector("#sections"),
    nav: document.querySelector("#nav"),
    search: document.querySelector("#search"),
    clear: document.querySelector("#clear"),
    modelsList: document.querySelector("#modelsList"),
    updated: document.querySelector("#updated"),
    overall: document.querySelector("#overall"),
  };

  const norm = (s) => (s ?? "").toString().trim().toLowerCase();

  function badgeFor(value) {
    const v = norm(value);

    const levelMap = {
      "very high": "vh",
      high: "h",
      medium: "m",
      low: "l",

      "very rare": "vr",
      rare: "r",
      sometimes: "s",
      often: "o",
      "very often": "o",

      // leave unknown unstyled
    };

    const cls = levelMap[v] ?? "";
    const span = document.createElement("span");
    span.className = `badge ${cls}`.trim();
    span.textContent = value;
    return span;
  }

  function toTitleCase(value) {
    return value.replace(/\b\w/g, (char) => char.toUpperCase());
  }

  const SCALE_VALUES = {
    quality: ["very high", "high", "medium", "low"],
    frequency: ["very often", "often", "sometimes", "rare", "very rare"],
  };

  const SCALE_PRIORITY = Object.fromEntries(
    Object.entries(SCALE_VALUES).map(([key, values]) => [
      key,
      values.reduce((acc, value, index) => {
        acc[value] = index;
        return acc;
      }, {}),
    ])
  );

  const SCALE_SORT_OPTIONS = Object.fromEntries(
    Object.entries(SCALE_VALUES).map(([key, values]) => [
      key,
      values.map((value) => ({ label: toTitleCase(value), value })).concat({ label: "Reset order", value: "reset" }),
    ])
  );

  const ALPHA_SORT_OPTIONS = [
    { label: "A to Z", value: "asc" },
    { label: "Z to A", value: "desc" },
    { label: "Reset order", value: "reset" },
  ];

  const SORT_MAX_RANK = 1e6;
  let activeSortMenu = null;

  function detectScale(values) {
    if (!values.length) return "alpha";
    const allQuality = values.every((v) => SCALE_PRIORITY.quality.hasOwnProperty(v));
    if (allQuality) return "quality";
    const allFrequency = values.every((v) => SCALE_PRIORITY.frequency.hasOwnProperty(v));
    if (allFrequency) return "frequency";
    return "alpha";
  }

  function getColumnMeta(columns, rows) {
    if (!columns) return [];
    const safeRows = rows ?? [];
    return columns.map((_, idx) => {
      if (idx === 0) return { type: "alpha" };
      const values = safeRows
        .map((row) => norm(row[idx]))
        .filter(Boolean);
      const type = detectScale(values);
      return { type };
    });
  }

  function closeActiveSortMenu() {
    if (!activeSortMenu) return;
    const { menu, toggle, origin } = activeSortMenu;
    if (menu) {
      menu.hidden = true;
      menu.classList.remove("is-open");
      // reset any absolute positioning applied when moved to body
      menu.style.position = "";
      menu.style.left = "";
      menu.style.top = "";
      menu.style.right = "";
      menu.style.visibility = "";
      menu.style.width = "";
      menu.style.minWidth = "";
      menu.style.maxWidth = "";
      menu.style.display = "";
      menu.style.zIndex = "";
      // move back into origin header to keep DOM order
      try {
        if (origin) origin.append(menu);
      } catch (e) {
        /* ignore */
      }
    }
    if (toggle) {
      toggle.classList.remove("is-active");
      toggle.setAttribute("aria-expanded", "false");
    }
    activeSortMenu = null;
  }

  function compareAlphaRows(a, b, columnIndex, direction) {
    const aText = norm(a.cells[columnIndex]?.textContent);
    const bText = norm(b.cells[columnIndex]?.textContent);
    if (aText === bText) return 0;
    const comparison = aText.localeCompare(bText, undefined, {
      numeric: true,
      sensitivity: "base",
    });
    return direction === "desc" ? -comparison : comparison;
  }

  function compareScaleRows(a, b, columnIndex, priorityMap, targetLevel) {
    const aText = norm(a.cells[columnIndex]?.textContent);
    const bText = norm(b.cells[columnIndex]?.textContent);
    const aRank = priorityMap.hasOwnProperty(aText) ? priorityMap[aText] : SORT_MAX_RANK;
    const bRank = priorityMap.hasOwnProperty(bText) ? priorityMap[bText] : SORT_MAX_RANK;
    const targetRank = priorityMap[targetLevel];
    const aDiff = targetRank !== undefined ? Math.abs(aRank - targetRank) : aRank;
    const bDiff = targetRank !== undefined ? Math.abs(bRank - targetRank) : bRank;

    if (aDiff !== bDiff) return aDiff - bDiff;
    return aRank - bRank;
  }

  function applySortToTable(table, columnIndex, columnMeta, optionValue) {
    const tbody = table.tBodies[0];
    if (!tbody) return;
    const baseRows = table.__initialRows ?? Array.from(tbody.rows);
    const rows = optionValue === "reset" ? baseRows : [...baseRows];

    if (optionValue === "reset") {
      tbody.append(...rows);
      return;
    }

    if (columnMeta.type === "quality" || columnMeta.type === "frequency") {
      const priority = SCALE_PRIORITY[columnMeta.type];
      rows.sort((a, b) => compareScaleRows(a, b, columnIndex, priority, optionValue));
    } else {
      rows.sort((a, b) => compareAlphaRows(a, b, columnIndex, optionValue));
    }

    tbody.append(...rows);
  }

  function attachSortControls(table, columnMeta = []) {
    const tbody = table.tBodies[0];
    if (!tbody) return;
    if (!table.__initialRows) {
      table.__initialRows = Array.from(tbody.rows);
    }

    const headers = table.querySelectorAll("thead th");
    headers.forEach((th, index) => {
      const meta = columnMeta[index] ?? { type: "alpha" };
      const labelText = th.textContent.trim();
      th.textContent = "";

      const content = document.createElement("div");
      content.className = "thContent";

      const label = document.createElement("span");
      label.className = "thLabel";
      label.textContent = labelText;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "sortToggle";
      toggle.setAttribute("aria-haspopup", "menu");
      toggle.setAttribute("aria-expanded", "false");
      toggle.setAttribute("aria-label", `Sort ${labelText}`);
      const chevron = document.createElement("span");
      chevron.className = "sortChevron";
      toggle.append(chevron);

      content.append(label, toggle);
      th.append(content);

      const menu = document.createElement("div");
      menu.className = "sortMenu";
      menu.setAttribute("role", "menu");
      menu.dataset.columnIndex = index;
      menu.dataset.columnType = meta.type;
      menu.hidden = true;

      const options = meta.type === "quality"
        ? SCALE_SORT_OPTIONS.quality
        : meta.type === "frequency"
          ? SCALE_SORT_OPTIONS.frequency
          : ALPHA_SORT_OPTIONS;
      options.forEach((opt) => {
        const optionButton = document.createElement("button");
        optionButton.type = "button";
        optionButton.className = "sortOption";
        optionButton.setAttribute("role", "menuitem");
        optionButton.dataset.action = opt.value;
        optionButton.textContent = opt.label;
        optionButton.addEventListener("click", () => {
          applySortToTable(table, index, meta, opt.value);
          closeActiveSortMenu();
        });
        menu.append(optionButton);
      });

      th.append(menu);

      toggle.addEventListener("click", (event) => {
        event.stopPropagation();
        const isOpen = menu.classList.contains("is-open");
        if (isOpen) {
          closeActiveSortMenu();
          return;
        }
        closeActiveSortMenu();
        // Move menu to document.body to avoid stacking-context clipping
        try {
          console.log("sort: opening menu", index, meta.type);
          document.body.append(menu);
          // remove CSS right so left/width don't produce a stretched width
          menu.style.right = "";
          // make invisible but renderable so we can measure intrinsic content width
          menu.style.visibility = "hidden";
          menu.hidden = false;
          const rect = toggle.getBoundingClientRect();
          menu.style.position = "absolute";
          // measure the content width (scrollWidth) then clamp to viewport and a sane max
          const measured = menu.scrollWidth || menu.offsetWidth || 120;
          const viewportMax = Math.max(120, document.documentElement.clientWidth - 32);
          const maxInline = 260;
          const desiredWidth = Math.min(measured, Math.min(viewportMax, maxInline));
          menu.style.width = `${desiredWidth}px`;
          const pageRight = rect.right + window.scrollX;
          let left = pageRight - desiredWidth;
          const minLeft = 8 + window.scrollX;
          const maxLeft = document.documentElement.scrollWidth - desiredWidth - 8;
          left = Math.min(Math.max(left, minLeft), Math.max(minLeft, maxLeft));
          menu.style.left = `${left}px`;
          menu.style.top = `${rect.bottom + window.scrollY + 8}px`;
          // now reveal and bring to front
          menu.style.visibility = "";
          menu.style.display = "flex";
          menu.style.zIndex = "9999";
        } catch (e) {
          console.error("sort: failed to position menu", e);
          // fallback: leave menu in-place
          menu.hidden = false;
          menu.style.display = "flex";
          menu.style.zIndex = "9999";
        }
        menu.classList.add("is-open");
        toggle.classList.add("is-active");
        toggle.setAttribute("aria-expanded", "true");
        activeSortMenu = { menu, toggle, origin: th };
      });
    });
  }

  function renderModelsIncluded() {
    const frag = document.createDocumentFragment();
    DATA.modelsIncluded.forEach((name, i) => {
      const li = document.createElement("li");

      const left = document.createElement("span");
      left.className = "name";
      left.textContent = name;

      const right = document.createElement("span");
      right.className = "tag";
      right.textContent = `#${String(i + 1).padStart(2, "0")}`;

      li.append(left, right);
      frag.append(li);
    });

    el.modelsList.append(frag);
  }

  function renderOverall() {
    const card = document.createElement("div");
    card.className = "card tableCard";

    const header = document.createElement("div");
    header.className = "sectionHeader";

    const left = document.createElement("div");
    const h = document.createElement("h2");
    h.textContent = "Recommended models (quick picks)";
    const p = document.createElement("p");
    p.textContent = "A simple starting point if you want one pick per task.";
    left.append(h, p);

    header.append(left);

    const wrap = document.createElement("div");
    wrap.className = "tableWrap";

    const table = document.createElement("table");
    table.setAttribute("aria-label", "Overall best model per task");
    const columnMeta = getColumnMeta(DATA.overallBest.columns, DATA.overallBest.rows);

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");
    DATA.overallBest.columns.forEach((c) => {
      const th = document.createElement("th");
      th.textContent = c;
      trh.append(th);
    });
    thead.append(trh);

    const tbody = document.createElement("tbody");
    DATA.overallBest.rows.forEach((r) => {
      const tr = document.createElement("tr");
      r.forEach((cell, idx) => {
        const td = document.createElement("td");
        td.textContent = cell;
        if (idx === 0) td.className = "modelCell";
        tr.append(td);
      });
      tbody.append(tr);
    });

    table.append(thead, tbody);
    attachSortControls(table, columnMeta);
    wrap.append(table);

    card.append(header, wrap);
    el.overall.append(card);
  }

  function renderNav() {
    const frag = document.createDocumentFragment();

    const anchors = [
      { href: "#overall", label: "Overall" },
      ...DATA.sections.map((s) => ({ href: `#${s.id}`, label: s.title })),
    ];

    anchors.forEach((a) => {
      const link = document.createElement("a");
      link.href = a.href;
      link.textContent = a.label;
      frag.append(link);
    });

    el.nav.append(frag);
  }

  function renderSection(section) {
    const container = document.createElement("section");
    container.className = "section";
    container.id = section.id;

    const header = document.createElement("div");
    header.className = "sectionHeader";

    const left = document.createElement("div");
    const h2 = document.createElement("h2");
    h2.textContent = section.title;
    const p = document.createElement("p");
    p.textContent = section.subtitle;
    left.append(h2, p);

    header.append(left);

    const card = document.createElement("div");
    card.className = "card tableCard";

    const wrap = document.createElement("div");
    wrap.className = "tableWrap";

    const table = document.createElement("table");
    table.dataset.sectionId = section.id;
    table.setAttribute("aria-label", `${section.title} comparison table`);
    const columnMeta = getColumnMeta(section.columns, section.rows);

    const thead = document.createElement("thead");
    const trh = document.createElement("tr");

    section.columns.forEach((c) => {
      const th = document.createElement("th");
      th.textContent = c;
      trh.append(th);
    });

    thead.append(trh);

    const tbody = document.createElement("tbody");

    section.rows.forEach((row) => {
      const tr = document.createElement("tr");
      tr.dataset.model = row[0];

      row.forEach((cell, idx) => {
        const td = document.createElement("td");

        if (idx === 0) {
          td.className = "modelCell";
          td.textContent = cell;
        } else {
          const isLevel =
            ["very high", "high", "medium", "low", "very rare", "rare", "sometimes", "often", "very often"].includes(
              norm(cell)
            );

          if (isLevel) td.append(badgeFor(cell));
          else td.textContent = cell;
        }

        tr.append(td);
      });

      tbody.append(tr);
    });

    table.append(thead, tbody);
    attachSortControls(table, columnMeta);
    wrap.append(table);

    card.append(wrap);

    container.append(header);

    if (section.bestFor && section.bestFor.length) {
      const callout = document.createElement("div");
      callout.className = "callout";
      callout.textContent = `Recommended picks: ${section.bestFor.join(", ")}`;
      container.append(callout);
    }

    container.append(card);
    return container;
  }

  function renderSections() {
    const frag = document.createDocumentFragment();
    DATA.sections.forEach((s) => frag.append(renderSection(s)));
    el.sections.append(frag);
  }

  function applySearch(queryRaw) {
    const q = norm(queryRaw);
    const tables = document.querySelectorAll("table[data-section-id]");

    tables.forEach((table) => {
      const rows = table.querySelectorAll("tbody tr");
      rows.forEach((tr) => {
        tr.classList.remove("rowHighlight", "rowDim");

        if (!q) return;

        const model = norm(tr.dataset.model);
        const rowText = norm(tr.textContent);
        const match = model.includes(q) || rowText.includes(q);

        tr.classList.toggle("rowHighlight", match);
        tr.classList.toggle("rowDim", !match);
      });
    });

    // Also dim overall table rows (but don't highlight badges there)
    const overallTable = document.querySelector("#overall table");
    if (overallTable) {
      const rows = overallTable.querySelectorAll("tbody tr");
      rows.forEach((tr) => {
        tr.classList.remove("rowHighlight", "rowDim");
        if (!q) return;
        const match = norm(tr.textContent).includes(q);
        tr.classList.toggle("rowHighlight", match);
        tr.classList.toggle("rowDim", !match);
      });
    }
  }

  function bindSearch() {
    const onInput = () => applySearch(el.search.value);
    el.search.addEventListener("input", onInput);

    el.clear.addEventListener("click", () => {
      el.search.value = "";
      el.search.focus();
      applySearch("");
    });

    window.addEventListener("keydown", (e) => {
      // Cmd/Ctrl + K focuses search
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        el.search.focus();
      }

      // Escape clears if focused
      if (e.key === "Escape" && document.activeElement === el.search) {
        el.search.value = "";
        applySearch("");
      }
    });
  }

  function boot() {
    if (!DATA) {
      document.body.innerHTML = "Missing dataset: window.AI_MODELS_COMPARISON_DATA";
      return;
    }

    renderNav();
    renderModelsIncluded();
    renderOverall();
    renderSections();
    bindSearch();

    if (el.updated) el.updated.textContent = DATA.lastUpdated;
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".sortMenu") && !event.target.closest(".sortToggle")) {
      closeActiveSortMenu();
    }
  });

  boot();
})();
