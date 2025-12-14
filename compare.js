(() => {
  const DATA = window.AI_MODELS_COMPARISON_DATA;

  const el = {
    root: document.querySelector("#compareRoot"),
    nav: document.querySelector("#nav"),
    updated: document.querySelector("#updated"),
  };

  const norm = (s) => (s ?? "").toString().trim().toLowerCase();
  const canonicalName = (s) => norm(s).replace(/\s*\(.*?\)/g, "");

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
    };

    const cls = levelMap[v] ?? "";
    const span = document.createElement("span");
    span.className = `badge ${cls}`.trim();
    span.textContent = value;
    return span;
  }

  function buildModelIndex(data) {
    const index = {};
    if (!data?.sections) return index;

    data.sections.forEach((section) => {
      section.rows.forEach((row) => {
        const name = row[0];
        const keys = [norm(name), canonicalName(name)];

        keys.forEach((key) => {
          if (!index[key]) index[key] = { name, sections: {} };
          index[key].sections[section.id] = {
            title: section.title,
            subtitle: section.subtitle,
            columns: section.columns,
            row,
          };
        });
      });
    });

    return index;
  }

  const MODEL_INDEX = buildModelIndex(DATA);

  function createValueCell(value) {
    const td = document.createElement("td");

    if (value === undefined || value === null || value === "") {
      td.textContent = "—";
      return td;
    }

    const normalized = norm(value);
    if (LEVEL_VALUES.has(normalized)) td.append(badgeFor(value));
    else td.textContent = value;

    return td;
  }

  function renderNav() {
    if (!el.nav) return;
    const frag = document.createDocumentFragment();
    const anchors = [
      { href: "./index.html", label: "Main tables" },
    ];

    anchors.forEach((a) => {
      const link = document.createElement("a");
      link.href = a.href;
      link.textContent = a.label;
      if (a.href.endsWith("compare.html")) link.classList.add("is-active");
      frag.append(link);
    });

    el.nav.append(frag);
  }

  function renderCompareCard() {
    if (!el.root) return;

    const card = document.createElement("div");
    card.className = "card compareCard";

    const header = document.createElement("div");
    header.className = "sectionHeader";

    const h2 = document.createElement("h2");
    h2.textContent = "Compare two models";
    const p = document.createElement("p");
    p.textContent = "Pick any two models to see their ratings across every category.";
    header.append(h2, p);

    const controls = document.createElement("div");
    controls.className = "compareControls";

    const selectA = document.createElement("select");
    selectA.className = "compareSelect";
    selectA.setAttribute("aria-label", "First model to compare");

    const selectB = document.createElement("select");
    selectB.className = "compareSelect";
    selectB.setAttribute("aria-label", "Second model to compare");

    [selectA, selectB].forEach((select) => {
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "Choose a model";
      select.append(placeholder);

      DATA.modelsIncluded.forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        select.append(opt);
      });
    });

    const actions = document.createElement("div");
    actions.className = "compareActions";

    const swap = document.createElement("button");
    swap.type = "button";
    swap.className = "btn compareSwap";
    swap.textContent = "Swap";

    actions.append(swap);
    controls.append(selectA, selectB, actions);

    const results = document.createElement("div");
    results.className = "compareResults";

    const initial = document.createElement("div");
    initial.className = "compareEmpty";
    initial.textContent = "Select two models to see a side-by-side comparison.";
    results.append(initial);

    card.append(header, controls, results);
    el.root.append(card);

    function showMessage(message) {
      results.innerHTML = "";
      const msg = document.createElement("div");
      msg.className = "compareEmpty";
      msg.textContent = message;
      results.append(msg);
    }

    function updateResults() {
      const aKey = canonicalName(selectA.value);
      const bKey = canonicalName(selectB.value);

      if (!aKey || !bKey) {
        showMessage("Select two models to see a side-by-side comparison.");
        return;
      }

      if (aKey === bKey) {
        showMessage("Pick two different models to compare.");
        return;
      }

      const aData = MODEL_INDEX[aKey];
      const bData = MODEL_INDEX[bKey];

      if (!aData || !bData) {
        showMessage("We could not find data for one of the selected models.");
        return;
      }

      const frag = document.createDocumentFragment();

      DATA.sections.forEach((section) => {
        const aRow = aData.sections[section.id]?.row;
        const bRow = bData.sections[section.id]?.row;
        if (!aRow && !bRow) return;

        const wrapper = document.createElement("div");
        wrapper.className = "compareSection";

        const sectionHeader = document.createElement("div");
        sectionHeader.className = "compareSectionHeader";

        const h3 = document.createElement("h3");
        h3.textContent = section.title;
        const sub = document.createElement("p");
        sub.textContent = section.subtitle;

        sectionHeader.append(h3, sub);

        const wrap = document.createElement("div");
        wrap.className = "tableWrap";

        const table = document.createElement("table");
        table.className = "compareTable";
        table.setAttribute("aria-label", `Compare ${aData.name} vs ${bData.name} for ${section.title}`);

        const thead = document.createElement("thead");
        const trh = document.createElement("tr");
        ["Metric", aData.name, bData.name].forEach((label) => {
          const th = document.createElement("th");
          th.textContent = label;
          trh.append(th);
        });
        thead.append(trh);

        const tbody = document.createElement("tbody");
        section.columns.slice(1).forEach((metric, idx) => {
          const tr = document.createElement("tr");
          const metricTd = document.createElement("td");
          metricTd.className = "metricCell";
          metricTd.textContent = metric;

          const valA = aRow ? aRow[idx + 1] : "—";
          const valB = bRow ? bRow[idx + 1] : "—";
          const tdA = createValueCell(valA);
          const tdB = createValueCell(valB);

          if (norm(valA) !== norm(valB)) tr.classList.add("compareDiff");

          tr.append(metricTd, tdA, tdB);
          tbody.append(tr);
        });

        table.append(thead, tbody);
        wrap.append(table);

        wrapper.append(sectionHeader, wrap);
        frag.append(wrapper);
      });

      results.innerHTML = "";
      if (!frag.childNodes.length) {
        showMessage("No comparison data available for these models.");
        return;
      }

      results.append(frag);
    }

    swap.addEventListener("click", () => {
      const temp = selectA.value;
      selectA.value = selectB.value;
      selectB.value = temp;
      updateResults();
    });

    selectA.addEventListener("change", updateResults);
    selectB.addEventListener("change", updateResults);

    if (DATA.modelsIncluded.length >= 2) {
      selectA.value = DATA.modelsIncluded[0];
      selectB.value = DATA.modelsIncluded[1];
    }

    updateResults();
  }

  function boot() {
    if (!DATA) {
      document.body.innerHTML = "Missing dataset: window.AI_MODELS_COMPARISON_DATA";
      return;
    }

    renderNav();
    renderCompareCard();
    if (el.updated) el.updated.textContent = DATA.lastUpdated;
  }

  boot();
})();
