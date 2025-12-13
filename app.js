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
    h.textContent = "Overall Best Model per Task";
    const p = document.createElement("p");
    p.textContent = "A quick shortlist when you just need a recommendation.";
    left.append(h, p);

    header.append(left);

    const wrap = document.createElement("div");
    wrap.className = "tableWrap";

    const table = document.createElement("table");
    table.setAttribute("aria-label", "Overall best model per task");

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
    wrap.append(table);

    card.append(wrap);

    container.append(header);

    if (section.bestFor && section.bestFor.length) {
      const callout = document.createElement("div");
      callout.className = "callout";
      callout.textContent = `Best picks: ${section.bestFor.join(", ")}`;
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
      document.body.innerHTML = "Missing dataset: AI_MODELS_COMPARISON_DATA";
      return;
    }

    renderNav();
    renderModelsIncluded();
    renderOverall();
    renderSections();
    bindSearch();

    if (el.updated) el.updated.textContent = DATA.lastUpdated;
  }

  boot();
})();
