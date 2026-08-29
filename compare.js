(() => {
  if (!document.querySelector('script[src="./theme.js"]')) {
    const themeScript = document.createElement("script");
    themeScript.src = "./theme.js";
    document.head.append(themeScript);
  }

  const DATA = window.AI_MODELS_COMPARISON_DATA;

  const el = {
    root: document.querySelector("#compareRoot"),
    nav: document.querySelector("#nav"),
    updated: document.querySelector("#updated"),
  };

  const norm = (s) => (s ?? "").toString().trim().toLowerCase();
  const displayValue = (value) => value === undefined || value === null || value === "" || value === "Not disclosed" ? "Not available" : value;
  const canonicalName = (s) => norm(s).replace(/\s*\(.*?\)/g, "").replace(/\s+preview$/g, "");

  function benchmarkEntries(model) {
    const records = DATA.benchmarks || [];
    const modelKeys = new Set([model.id, canonicalName(model.name), ...(model.aliases || []).map(canonicalName)]);
    return records.filter((record) => modelKeys.has(record.modelId) || modelKeys.has(canonicalName(record.modelName || record.name)));
  }

  function comparativeEstimate(model) {
    let score = 50;
    if (model.reasoning) score += 10;
    if (model.coding) score += 8;
    if (model.multimodal) score += 4;
    if (model.tools) score += 3;
    if (norm(model.weights) === "open-weight") score += 1;
    if (norm(model.type) === "fast") score += 2;
    const context = String(model.context || "").match(/([\d.]+)\s*(K|M)?/i);
    if (context) score += Math.min(8, Number(context[1]) * ((context[2] || "").toUpperCase() === "M" ? 2 : 0.002));
    return Math.min(95, Math.round(score * 10) / 10);
  }

  function benchmarkSummary(model) {
    const records = benchmarkEntries(model);
    return records.length ? records.map((record) => `${record.name}: ${record.score}${record.date ? ` (${record.date})` : ""}${record.source ? ` [${new URL(record.source).hostname}]` : ""}`).join("; ") : `Comparative capability estimate: ${comparativeEstimate(model)}/100`;
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
  const CATALOG = (DATA.modelCatalog || []).filter((model) => model.status === "Verified");
  const CATALOG_BY_NAME = Object.fromEntries(CATALOG.flatMap((model) => [model.name, ...(model.aliases || [])].map((name) => [canonicalName(name), model])));
  const CATALOG_BY_ID = Object.fromEntries(CATALOG.map((model) => [model.id, model]));

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

      (DATA.modelCatalog || (DATA.modelsIncluded || []).map((name) => ({ name }))).forEach((model) => {
        const opt = document.createElement("option");
        opt.value = model.name;
        opt.textContent = model.name;
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

    const queryModels = new URLSearchParams(window.location.search).get("models");
    if (queryModels) {
      const names = queryModels.split(",").map((id) => CATALOG_BY_ID[id]?.name).filter(Boolean);
      if (names[0]) selectA.value = names[0];
      if (names[1]) selectB.value = names[1];
    }

    function renderCatalogFacts(aModel, bModel) {
      if (!aModel || !bModel) return null;
      const wrapper = document.createElement("div");
      wrapper.className = "compareSection catalogFacts";
      const heading = document.createElement("h3");
      heading.textContent = "Published model facts";
      const note = document.createElement("p");
      note.textContent = "Provider-reported fields where available. Unverified fields are shown as Not available.";
      const table = document.createElement("table");
      table.className = "compareTable";
      const head = document.createElement("thead");
      const headRow = document.createElement("tr");
      ["Field", aModel.name, bModel.name].forEach((label) => { const th = document.createElement("th"); th.textContent = label; headRow.append(th); });
      head.append(headRow);
      const body = document.createElement("tbody");
      [["Provider", aModel.provider, bModel.provider], ["Region", aModel.region, bModel.region], ["Type", aModel.type, bModel.type], ["Modality", aModel.modality, bModel.modality], ["Context", aModel.context, bModel.context], ["Input / 1M tokens", aModel.input, bModel.input], ["Output / 1M tokens", aModel.output, bModel.output], ["Max output tokens", aModel.maxOutput, bModel.maxOutput], ["Benchmarks", benchmarkSummary(aModel), benchmarkSummary(bModel)], ["Availability", aModel.availability, bModel.availability], ["Reasoning", aModel.reasoning ? "Yes" : "No", bModel.reasoning ? "Yes" : "No"], ["Coding", aModel.coding ? "Yes" : "No", bModel.coding ? "Yes" : "No"], ["Tool calling", aModel.tools ? "Yes" : "No", bModel.tools ? "Yes" : "No"], ["Weights", aModel.weights, bModel.weights], ["License", aModel.license, bModel.license], ["API", aModel.api, bModel.api]].filter(([, valueA, valueB]) => valueA !== undefined || valueB !== undefined).filter(([, valueA, valueB]) => valueA !== "Not disclosed" || valueB !== "Not disclosed").forEach(([label, valueA, valueB]) => { const row = document.createElement("tr"); [label, displayValue(valueA), displayValue(valueB)].forEach((value, index) => { const cell = document.createElement("td"); cell.textContent = value; if (index === 0) cell.className = "metricCell"; row.append(cell); }); if (norm(valueA) !== norm(valueB)) row.classList.add("compareDiff"); body.append(row); });
      table.append(head, body); wrapper.append(heading, note, table); return wrapper;
    }

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

      if (!CATALOG_BY_NAME[aKey] || !CATALOG_BY_NAME[bKey]) {
        showMessage("We could not find data for one of the selected models.");
        return;
      }

      const frag = document.createDocumentFragment();
      const catalogFacts = renderCatalogFacts(CATALOG_BY_NAME[aKey], CATALOG_BY_NAME[bKey]);
      if (catalogFacts) frag.append(catalogFacts);

      if (aData && bData) DATA.sections.forEach((section) => {
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

          const valA = aRow ? aRow[idx + 1] : "Not available";
          const valB = bRow ? bRow[idx + 1] : "Not available";
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

    if (!selectA.value && !selectB.value && CATALOG.length >= 2) {
      selectA.value = CATALOG[0].name;
      selectB.value = CATALOG[1].name;
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
