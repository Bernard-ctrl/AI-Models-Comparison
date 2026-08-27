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
    directorySearch: document.querySelector("#directorySearch"),
    providerFilter: document.querySelector("#providerFilter"),
    regionFilter: document.querySelector("#regionFilter"),
    focusFilter: document.querySelector("#focusFilter"),
    sortFilter: document.querySelector("#sortFilter"),
    directoryTabs: document.querySelector("#directoryTabs"),
    modelGrid: document.querySelector("#modelGrid"),
    directoryCount: document.querySelector("#directoryCount"),
    pagination: document.querySelector("#pagination"),
    selectionBar: document.querySelector("#selectionBar"),
    selectionCount: document.querySelector("#selectionCount"),
    compareSelected: document.querySelector("#compareSelected"),
    clearSelection: document.querySelector("#clearSelection"),
  };

  const norm = (s) => (s ?? "").toString().trim().toLowerCase();
  const displayValue = (value) => value === undefined || value === null || value === "" || value === "Not disclosed" ? "Not available" : value;
  const hasValue = (value) => value !== undefined && value !== null && value !== "" && value !== "Not disclosed";
  const canonicalName = (value) => norm(value).replace(/\s*\(.*?\)/g, "").replace(/\s+preview$/g, "");

  function benchmarkEntries(model) {
    const records = DATA.benchmarks || [];
    const modelKeys = new Set([model.id, canonicalName(model.name), ...(model.aliases || []).map(canonicalName)]);
    return records.filter((record) => modelKeys.has(record.modelId) || modelKeys.has(canonicalName(record.modelName || record.name)));
  }

  function benchmarkSummary(model) {
    const records = benchmarkEntries(model);
    if (records.length) return records.map((record) => `${record.name}: ${record.score}${record.date ? ` (${record.date})` : ""}${record.source ? ` [${new URL(record.source).hostname}]` : ""}`).join("; ");
    return "No published score";
  }

  const LEVEL_VALUES = new Set([
    "very high",
    "high",
    "medium",
    "low",
    "very rare",
    "rare",
    "sometimes",
    "often",
    "very often",
  ]);

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
    if (!el.modelsList) return;
    const frag = document.createDocumentFragment();
    (DATA.modelCatalog || []).filter((model) => model.status === "Verified").forEach((model, i) => {
      const li = document.createElement("li");

      const left = document.createElement("span");
      left.className = "name";
      left.textContent = model.name;

      const right = document.createElement("span");
      right.className = "tag";
      right.textContent = `#${String(i + 1).padStart(2, "0")}`;

      li.append(left, right);
      frag.append(li);
    });

    el.modelsList.append(frag);
  }

  function contextNumber(value) {
    const match = String(value || "").match(/([\d.]+)\s*(K|M)?/i);
    if (!match) return 0;
    const multiplier = (match[2] || "").toUpperCase() === "M" ? 1000 : 1;
    return Number(match[1]) * multiplier;
  }

  function priceNumber(value) {
    const match = String(value || "").match(/\$([\d.]+)/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  }

  function renderDirectory() {
    if (!el.modelGrid || !DATA.modelCatalog) return;
    const catalog = DATA.modelCatalog.filter((model) => model.status === "Verified");
    const state = { tab: "all", page: 1, selected: new Set() };
    const pageSize = 12;

    ["provider", "region"].forEach((key) => {
      const select = el[`${key}Filter`];
      [...new Set(catalog.map((model) => model[key]))].sort().forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = displayValue(value);
        select.append(option);
      });
    });

    function matchesFocus(model, focus) {
      if (!focus || focus === "all") return true;
      if (focus === "open") return model.weights === "Open-weight";
      return Boolean(model[focus]);
    }

    function getFiltered() {
      const query = norm(el.directorySearch.value);
      const provider = el.providerFilter.value;
      const region = el.regionFilter.value;
      const focus = el.focusFilter.value;
      const filtered = catalog.filter((model) => {
        const haystack = norm(`${model.name} ${model.provider} ${model.region} ${model.type} ${model.modality} ${model.license}`);
        const tabMatch = state.tab === "china" ? model.region === "China" : matchesFocus(model, state.tab === "all" ? "" : state.tab);
        return (!query || haystack.includes(query)) && (!provider || model.provider === provider) && (!region || model.region === region) && tabMatch && matchesFocus(model, focus);
      });
      const sort = el.sortFilter.value;
      return filtered.sort((a, b) => {
        if (sort === "name") return a.name.localeCompare(b.name);
        if (sort === "context") return contextNumber(b.context) - contextNumber(a.context);
        if (sort === "price") return priceNumber(a.input) - priceNumber(b.input);
        return String(b.release).localeCompare(String(a.release));
      });
    }

    function updateSelection() {
      el.selectionBar.hidden = state.selected.size === 0;
      el.selectionCount.textContent = state.selected.size;
      el.compareSelected.href = `./compare.html?models=${encodeURIComponent([...state.selected].join(","))}`;
    }

    function renderPage() {
      const filtered = getFiltered();
      const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
      state.page = Math.min(state.page, pages);
      const visible = filtered.slice((state.page - 1) * pageSize, state.page * pageSize);
      el.directoryCount.textContent = `${filtered.length} model${filtered.length === 1 ? "" : "s"}`;
      el.modelGrid.innerHTML = "";
      visible.forEach((model) => {
        const article = document.createElement("article");
        article.className = "modelCard";
        if (state.selected.has(model.id)) article.classList.add("is-selected");
        const top = document.createElement("div");
        top.className = "modelCardTop";
        const title = document.createElement("div");
        title.innerHTML = `<h3>${model.name}</h3><p>${model.provider} <span>·</span> ${model.region}</p>`;
        const check = document.createElement("button");
        check.type = "button";
        check.className = "selectModel";
        check.textContent = state.selected.has(model.id) ? "Selected" : "Compare";
        check.setAttribute("aria-label", `${check.textContent} ${model.name}`);
        check.addEventListener("click", () => {
          if (state.selected.has(model.id)) state.selected.delete(model.id); else state.selected.add(model.id);
          renderPage();
          updateSelection();
        });
        top.append(title, check);
        const tags = document.createElement("div");
        tags.className = "modelTags";
        [model.type, model.weights, model.status].forEach((tag) => { const span = document.createElement("span"); span.textContent = displayValue(tag); tags.append(span); });
        const facts = document.createElement("dl");
        [["Context", model.context], ["Input / 1M tokens", model.input], ["Output / 1M tokens", model.output], ["Benchmarks", benchmarkSummary(model)], ["Modalities", model.modality]].filter(([, value]) => hasValue(value) && value !== "Not available").forEach(([label, value]) => { const dt = document.createElement("dt"); dt.textContent = label; const dd = document.createElement("dd"); dd.textContent = displayValue(value); facts.append(dt, dd); });
        const details = document.createElement("details");
        const summary = document.createElement("summary"); summary.textContent = "More model details";
        const more = document.createElement("div"); more.className = "modelMore"; more.textContent = [["Release", model.release], ["License", model.license], ["API", model.api], ["Tool calling", model.tools ? "Yes" : "No"]].filter(([, value]) => hasValue(value)).map(([label, value]) => `${label} ${value}`).join(" · ");
        const source = document.createElement("a"); source.href = model.source; source.target = "_blank"; source.rel = "noreferrer"; source.textContent = "Open source reference"; more.append(source); details.append(summary, more);
        article.append(top, tags, facts, details); el.modelGrid.append(article);
      });
      el.pagination.innerHTML = "";
      for (let page = 1; page <= pages; page += 1) { const button = document.createElement("button"); button.type = "button"; button.textContent = page; button.className = page === state.page ? "is-active" : ""; button.setAttribute("aria-label", `Page ${page}`); button.addEventListener("click", () => { state.page = page; renderPage(); }); el.pagination.append(button); }
    }

    [el.directorySearch, el.providerFilter, el.regionFilter, el.focusFilter, el.sortFilter].forEach((control) => control.addEventListener("input", () => { state.page = 1; renderPage(); }));
    el.directoryTabs.addEventListener("click", (event) => { const button = event.target.closest("button[data-tab]"); if (!button) return; state.tab = button.dataset.tab; state.page = 1; el.directoryTabs.querySelectorAll("button").forEach((tab) => { const active = tab === button; tab.classList.toggle("is-active", active); tab.setAttribute("aria-selected", String(active)); }); renderPage(); });
    el.clearSelection.addEventListener("click", () => { state.selected.clear(); renderPage(); updateSelection(); });
    renderPage(); updateSelection();
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

    card.append(wrap);
    // place the section header outside the table card so the text sits above the card
    el.overall.append(header, card);
  }

  function renderNav() {
    const frag = document.createDocumentFragment();

    const anchors = [
      { href: "./index.html", label: "Directory" },
      { href: "./compare.html", label: "Compare" },
      { href: "./overall.html", label: "Quick picks" },
      ...DATA.sections.map((s) => ({ href: `./${s.id}.html`, label: s.title })),
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
    if (DATA.modelCatalog && document.body.dataset.section) return renderCatalogTaskLens(section);
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
          const isLevel = LEVEL_VALUES.has(norm(cell));

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

  function renderCatalogTaskLens(section) {
    const container = document.createElement("section");
    container.className = "section";
    container.id = section.id;
    const header = document.createElement("div");
    header.className = "sectionHeader";
    const h2 = document.createElement("h2"); h2.textContent = section.title;
    const p = document.createElement("p"); p.textContent = `${section.subtitle}. Ranked by task capability signals; benchmark scores are shown when providers publish comparable results.`;
    header.append(h2, p);
    const selected = new Set();
    const card = document.createElement("div"); card.className = "card tableCard";
    const compareBar = document.createElement("div"); compareBar.className = "selectionBar taskSelection"; compareBar.hidden = true;
    const compareText = document.createElement("span"); compareText.textContent = "0 selected";
    const compareLink = document.createElement("a"); compareLink.className = "btn btnPrimary"; compareLink.href = "./compare.html"; compareLink.textContent = "Compare selected";
    compareBar.append(compareText, compareLink);
    const wrap = document.createElement("div"); wrap.className = "tableWrap";
    const table = document.createElement("table"); table.setAttribute("aria-label", `${section.title} latest model comparison`);
    const columns = ["Task rank", "Model", "Provider", "Benchmark signal", "Context", "Input / 1M tokens", "Output / 1M tokens", "Capabilities", "Compare"];
    const head = document.createElement("thead"); const headRow = document.createElement("tr");
    columns.forEach((column) => { const th = document.createElement("th"); th.textContent = column; headRow.append(th); }); head.append(headRow);
    const eligible = DATA.modelCatalog.filter((model) => model.status === "Verified");
    const body = document.createElement("tbody");
    const taskWeight = section.id === "speed-cost" ? (model) => (model.input.includes("0.20") ? 5 : model.input.includes("0.30") ? 4 : model.input.includes("0.75") ? 3 : model.reasoning ? 2 : 1) : (model) => (model.reasoning ? 4 : 2) + (model.coding ? 2 : 0) + (model.multimodal ? 1 : 0) + (model.tools ? 1 : 0);
    eligible.sort((a, b) => taskWeight(b) - taskWeight(a) || a.name.localeCompare(b.name)).forEach((model, index) => {
      const row = document.createElement("tr");
      const values = [`#${index + 1}`, model.name, model.provider, benchmarkSummary(model), model.context, model.input, model.output, [model.reasoning && "Reasoning", model.coding && "Coding", model.multimodal && "Multimodal", model.tools && "Tools"].filter(Boolean).join(", ")];
      values.forEach((value, valueIndex) => { const cell = document.createElement("td"); cell.textContent = displayValue(value); if (valueIndex === 0 || valueIndex === 1) cell.className = valueIndex === 1 ? "modelCell" : "rankCell"; row.append(cell); });
      const actionCell = document.createElement("td");
      const action = document.createElement("button"); action.type = "button"; action.className = "selectModel"; action.textContent = "Compare"; action.setAttribute("aria-label", `Select ${model.name} for comparison`);
      action.addEventListener("click", () => { if (selected.has(model.id)) selected.delete(model.id); else if (selected.size < 4) selected.add(model.id); action.textContent = selected.has(model.id) ? "Selected" : "Compare"; row.classList.toggle("is-selected", selected.has(model.id)); compareBar.hidden = selected.size === 0; compareText.textContent = `${selected.size} selected`; compareLink.href = `./compare.html?models=${encodeURIComponent([...selected].slice(0, 2).join(","))}`; });
      actionCell.append(action); row.append(actionCell);
      body.append(row);
    });
    table.append(head, body); wrap.append(table); card.append(compareBar, wrap); container.append(header, card); return container;
  }

  function renderSections() {
    if (!el.sections) return;
    const frag = document.createDocumentFragment();
    const selectedId = document.body.dataset.section;
    const sections = selectedId ? DATA.sections.filter((section) => section.id === selectedId) : DATA.sections;
    sections.forEach((s) => frag.append(renderSection(s)));
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
    renderDirectory();
    if (el.overall) renderOverall();
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
