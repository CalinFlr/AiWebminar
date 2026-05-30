const stage = document.querySelector("#slideStage");
const prevButton = document.querySelector("#prevSlide");
const nextButton = document.querySelector("#nextSlide");
const slideCounter = document.querySelector("#slideCounter");
const progressBar = document.querySelector("#progressBar");
const speakerNotes = document.querySelector("#speakerNotes");
const speakerNotesText = document.querySelector("#speakerNotesText");

const deckUrl = new URLSearchParams(window.location.search).get("deck") || "day-1-test.json";
let deck = null;
let currentIndex = 0;
let notesVisible = false;
let animationFrame = null;

const el = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined && text !== null) node.textContent = text;
  return node;
};

const appendTextList = (parent, items = [], className = "") => {
  items.forEach((item) => {
    const node = el("span", className, item);
    parent.append(node);
  });
};

const clearStage = () => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
    animationFrame = null;
  }
  stage.replaceChildren();
};

const createSlide = (slide, options = {}) => {
  const root = el("article", `slide ${options.dark ? "is-dark" : ""} ${options.alt ? "is-alt" : ""}`.trim());
  root.dataset.slideId = slide.id || "";
  if (slide.type) root.classList.add(`slide-type-${slide.type}`);
  return root;
};

const addBrandRail = (parent, slide) => {
  const rail = el("div", "brand-rail");
  const brand = el("div", "brand-rail-brand");
  brand.append(el("span", "brand-mark", "AI"));
  brand.append(el("span", "", deck?.title || "AI Automation Zero to Hero"));

  const meta = el("div", "brand-rail-meta");
  const subtitle = deck?.subtitle?.replace(" - Test Deck", "") || "Workshop";
  meta.append(el("span", "", subtitle));
  meta.append(el("span", "", `${String(currentIndex + 1).padStart(2, "0")} / ${String(deck?.slides?.length || 0).padStart(2, "0")}`));

  rail.append(brand, meta);
  parent.append(rail);
  return rail;
};

const addHeader = (parent, slide) => {
  const content = el("div", "slide-content");
  if (slide.kicker) content.append(el("span", "kicker", slide.kicker));
  content.append(el(slide.type === "hero" ? "h1" : "h2", "", slide.title || ""));
  if (slide.lead) content.append(el("p", "lead", slide.lead));
  parent.append(content);
  return content;
};

const normalizeTextBlocks = (value) => {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
};

const appendSlideExtras = (parent, slide) => {
  normalizeTextBlocks(slide.body).forEach((text) => {
    parent.append(el("p", "body-copy", text));
  });

  if (Array.isArray(slide.bullets) && slide.bullets.length) {
    const list = el("div", "bullet-grid");
    slide.bullets.forEach((item) => {
      list.append(el("span", "bullet-chip", item));
    });
    parent.append(list);
  }

  if (slide.question) {
    parent.append(el("p", "live-question", slide.question));
  }

  if (slide.punchline) {
    parent.append(el("p", "punchline", slide.punchline));
  }

  if (slide.closing) {
    parent.append(el("p", "closing-line", slide.closing));
  }
};

const renderHero = (slide) => {
  const root = createSlide(slide, { dark: true });
  const canvas = el("canvas", "slide-canvas");
  const scrim = el("div", "slide-scrim");
  const grid = el("div", "slide-content slide-grid");
  const copy = el("div");
  const panel = renderSystemPreview(slide.preview || {});

  root.append(canvas, scrim);
  addBrandRail(root, slide);
  root.append(grid);
  if (slide.kicker) copy.append(el("span", "kicker", slide.kicker));
  copy.append(el("h1", "", slide.title || ""));
  if (slide.lead) copy.append(el("p", "lead", slide.lead));

  if (Array.isArray(slide.meta) && slide.meta.length) {
    const meta = el("div", "hero-meta");
    appendTextList(meta, slide.meta);
    copy.append(meta);
  }

  grid.append(copy, panel);
  requestAnimationFrame(() => startSystemCanvas(canvas));
  return root;
};

const renderSystemPreview = (preview) => {
  const panel = el("aside", "system-preview");
  const top = el("div", "preview-top");
  top.append(el("strong", "", preview.title || "Workflow AI controlabil"));
  top.append(el("span", "status-pill", preview.status || "ruleaza"));
  panel.append(top);

  (preview.rows || []).forEach((row) => {
    const previewRow = el("div", "preview-row");
    previewRow.append(el("div", "preview-label", row.label || ""));

    const work = el("div", "preview-work");
    work.append(el("strong", "", row.title || ""));
    work.append(el("span", "", row.text || ""));

    const progress = el("div", "preview-progress");
    const bar = el("i");
    bar.style.width = `${Math.max(0, Math.min(100, row.progress || 0))}%`;
    if (row.color) bar.style.background = `var(--${row.color})`;
    progress.append(bar);
    work.append(progress);

    previewRow.append(work);
    panel.append(previewRow);
  });

  return panel;
};

const renderSection = (slide) => {
  const root = createSlide(slide, { dark: slide.theme === "dark", alt: slide.theme === "alt" });
  root.classList.add("center-slide");
  addBrandRail(root, slide);
  appendSlideExtras(addHeader(root, slide), slide);
  return root;
};

const renderProcessMap = (slide) => {
  const root = createSlide(slide, { alt: true });
  addBrandRail(root, slide);
  addHeader(root, slide);

  const track = el("div", "process-track slide-content");
  (slide.steps || []).forEach((step, index) => {
    const card = el("article", `step-card ${step.highlight ? "is-highlight" : ""}`.trim());
    card.append(el("span", "step-index", step.label || String(index + 1).padStart(2, "0")));
    card.append(el("h3", "", step.title || ""));
    if (step.text) card.append(el("p", "", step.text));
    track.append(card);
  });

  root.append(track);
  return root;
};

const renderAgentMap = (slide) => {
  const root = createSlide(slide);
  addBrandRail(root, slide);
  addHeader(root, slide);

  const map = el("div", "agent-map slide-content");
  const rootCard = el("aside", "agent-root");
  rootCard.append(el("strong", "", slide.root?.title || "Petru"));
  rootCard.append(el("span", "", slide.root?.text || ""));

  const grid = el("div", "agent-grid");
  (slide.agents || []).forEach((agent) => {
    const card = el("article", `agent-card ${agent.highlight ? "is-highlight" : ""}`.trim());
    card.append(el("span", "agent-tag", agent.tag || "Agent"));
    card.append(el("h3", "", agent.title || ""));
    if (agent.text) card.append(el("p", "", agent.text));
    grid.append(card);
  });

  map.append(rootCard, grid);
  root.append(map);
  return root;
};

const renderBriefTable = (slide) => {
  const root = createSlide(slide, { alt: true });
  addBrandRail(root, slide);
  addHeader(root, slide);

  const table = el("div", "brief-table slide-content");
  (slide.rows || []).forEach((row) => {
    const item = el("article", "brief-row");
    item.append(el("span", "brief-key", row.key || ""));
    item.append(el("p", "", row.question || ""));
    table.append(item);
  });

  root.append(table);
  return root;
};

const renderCompare = (slide) => {
  const root = createSlide(slide);
  addBrandRail(root, slide);
  addHeader(root, slide);

  const grid = el("div", "compare-grid slide-content");
  (slide.items || []).forEach((item) => {
    const card = el("article", "compare-card");
    card.append(el("span", "compare-label", item.label || ""));
    card.append(el("h3", "", item.title || ""));
    if (item.text) card.append(el("p", "", item.text));
    grid.append(card);
  });

  if (Array.isArray(slide.benefits) && slide.benefits.length) {
    const benefits = el("div", "benefit-grid slide-content");
    slide.benefits.forEach((benefit) => {
      const card = el("article", "benefit-card");
      card.append(el("div", "benefit-value", benefit.value || ""));
      card.append(el("h3", "", benefit.title || ""));
      if (benefit.text) card.append(el("p", "", benefit.text));
      benefits.append(card);
    });
    root.append(grid, benefits);
    return root;
  }

  root.append(grid);
  return root;
};

const renderMoneyWall = (slide) => {
  const root = createSlide(slide, { dark: true });
  root.classList.add("slide-money-wall");
  addBrandRail(root, slide);
  addHeader(root, slide);

  const wall = el("div", "money-wall slide-content");
  const equation = el("div", "money-equation");
  (slide.equation || []).forEach((item) => {
    const card = el("article", "money-step");
    card.append(el("strong", "", item.value || ""));
    card.append(el("span", "", item.label || ""));
    equation.append(card);
  });

  const result = el("article", "money-result");
  if (slide.result?.label) result.append(el("span", "money-label", slide.result.label));
  result.append(el("strong", "", slide.result?.value || ""));
  if (slide.result?.text) result.append(el("p", "", slide.result.text));

  const losses = el("div", "loss-grid");
  (slide.losses || []).forEach((loss) => {
    const card = el("article", "loss-card");
    card.append(el("span", "loss-label", loss.label || ""));
    card.append(el("strong", "", loss.title || ""));
    if (loss.text) card.append(el("p", "", loss.text));
    losses.append(card);
  });

  wall.append(equation, result, losses);
  if (slide.punchline) wall.append(el("p", "punchline", slide.punchline));
  root.append(wall);
  return root;
};

const renderCommandCenter = (slide) => {
  const root = createSlide(slide, { dark: slide.theme !== "light" });
  root.classList.add("slide-command-center");
  addBrandRail(root, slide);
  addHeader(root, slide);

  const board = el("div", `command-board slide-content ${slide.intensity === "high" ? "is-intense" : ""}`.trim());
  board.append(el("div", "command-gridline"));
  board.append(el("div", "command-ring ring-one"));
  board.append(el("div", "command-ring ring-two"));
  board.append(el("div", "command-ring ring-three"));

  const core = el("article", "command-core");
  core.append(el("span", "command-status", slide.center?.status || "online"));
  core.append(el("strong", "", slide.center?.title || "Agent Spion de Piata"));
  if (slide.center?.text) core.append(el("p", "", slide.center.text));
  board.append(core);

  (slide.sources || []).forEach((source, index) => {
    board.append(el("i", `command-connector connector-${index}`));
    const card = el("article", `source-card source-${index}`.trim());
    card.append(el("span", "source-label", source.label || `Sursa ${index + 1}`));
    card.append(el("strong", "", source.title || ""));
    if (source.text) card.append(el("p", "", source.text));
    if (Array.isArray(source.details) && source.details.length) {
      const detailList = el("div", "source-detail-list");
      source.details.forEach((detail) => {
        const row = el("div", "source-detail-row");
        row.append(el("span", "source-detail-key", detail.key || ""));
        row.append(el("span", `source-detail-value tone-${detail.tone || "teal"}`, detail.value || ""));
        detailList.append(row);
      });
      card.append(detailList);
    }
    if (Array.isArray(source.badges) && source.badges.length) {
      const badges = el("div", "source-badges");
      source.badges.forEach((badge) => badges.append(el("span", "", badge)));
      card.append(badges);
    }
    board.append(card);
  });

  if (Array.isArray(slide.metrics) && slide.metrics.length) {
    const metrics = el("div", "command-metrics");
    slide.metrics.forEach((metric) => {
      const item = el("article", "command-metric");
      item.append(el("span", "metric-icon", metric.icon || ""));
      item.append(el("strong", "", metric.value || ""));
      item.append(el("span", "", metric.label || ""));
      metrics.append(item);
    });
    board.append(metrics);
  }

  if (Array.isArray(slide.signals) && slide.signals.length) {
    const strip = el("div", "signal-strip");
    slide.signals.forEach((signal) => strip.append(el("span", "", signal)));
    board.append(strip);
  }

  if (slide.punchline) {
    board.append(el("p", "punchline", slide.punchline));
  }

  root.append(board);
  return root;
};

const renderSignalList = (slide) => {
  const root = createSlide(slide, { dark: slide.theme === "dark", alt: slide.theme === "alt" });
  root.classList.add("slide-signal-list");
  addBrandRail(root, slide);
  addHeader(root, slide);

  const grid = el("div", `signal-list slide-content cols-${Math.min(4, Math.max(2, slide.items?.length || 3))}`);
  (slide.items || []).forEach((item) => {
    const card = el("article", `signal-card ${item.highlight ? "is-highlight" : ""}`.trim());
    card.append(el("span", "signal-label", item.label || ""));
    card.append(el("h3", "", item.title || ""));
    if (item.text) card.append(el("p", "", item.text));
    grid.append(card);
  });
  root.append(grid);

  if (slide.question || slide.punchline || slide.closing) {
    const footer = el("div", "signal-footer slide-content");
    appendSlideExtras(footer, slide);
    root.append(footer);
  }

  return root;
};

const renderClosing = (slide) => {
  const root = createSlide(slide, { dark: true });
  root.classList.add("center-slide");
  addBrandRail(root, slide);
  const card = el("div", "closing-card slide-content");
  if (slide.kicker) card.append(el("span", "kicker", slide.kicker));
  card.append(el("h2", "", slide.title || ""));
  if (slide.lead) card.append(el("p", "lead", slide.lead));
  appendSlideExtras(card, slide);
  root.append(card);
  return root;
};

const renderSlide = (slide) => {
  switch (slide.type) {
    case "hero":
      return renderHero(slide);
    case "section":
      return renderSection(slide);
    case "process-map":
      return renderProcessMap(slide);
    case "agent-map":
      return renderAgentMap(slide);
    case "brief-table":
      return renderBriefTable(slide);
    case "compare":
      return renderCompare(slide);
    case "money-wall":
      return renderMoneyWall(slide);
    case "command-center":
      return renderCommandCenter(slide);
    case "signal-list":
      return renderSignalList(slide);
    case "closing":
      return renderClosing(slide);
    default:
      return renderSection({
        ...slide,
        kicker: "Slide necunoscut",
        title: slide.title || "Tip de slide nesuportat",
        lead: `Tipul "${slide.type}" nu este implementat in engine.`
      });
  }
};

const updateNotes = (slide) => {
  speakerNotesText.textContent = slide.notes || "Nu exista notite pentru acest slide.";
  speakerNotes.hidden = !notesVisible;
};

const showSlide = (index, options = {}) => {
  if (!deck?.slides?.length) return;
  currentIndex = Math.max(0, Math.min(deck.slides.length - 1, index));
  const slide = deck.slides[currentIndex];

  clearStage();
  stage.append(renderSlide(slide));

  slideCounter.textContent = `${currentIndex + 1} / ${deck.slides.length}`;
  progressBar.style.width = `${((currentIndex + 1) / deck.slides.length) * 100}%`;
  prevButton.disabled = currentIndex === 0;
  nextButton.disabled = currentIndex === deck.slides.length - 1;
  updateNotes(slide);

  if (!options.fromHash) {
    const id = slide.id || String(currentIndex + 1);
    history.replaceState(null, "", `#${encodeURIComponent(id)}`);
  }
};

const findSlideFromHash = () => {
  const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
  if (!hash || !deck?.slides) return 0;
  const index = deck.slides.findIndex((slide) => slide.id === hash);
  return index >= 0 ? index : 0;
};

const go = (direction) => {
  showSlide(currentIndex + direction);
};

const handleKeydown = (event) => {
  const key = event.key;
  if (key === "ArrowRight" || key === "PageDown" || key === " ") {
    event.preventDefault();
    go(1);
  }
  if (key === "ArrowLeft" || key === "PageUp") {
    event.preventDefault();
    go(-1);
  }
  if (key.toLowerCase() === "n") {
    notesVisible = !notesVisible;
    updateNotes(deck.slides[currentIndex]);
  }
};

const startSystemCanvas = (canvas) => {
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  const nodes = [
    { x: 0.12, y: 0.28, label: "Lead" },
    { x: 0.28, y: 0.18, label: "Email" },
    { x: 0.46, y: 0.32, label: "Agent" },
    { x: 0.66, y: 0.22, label: "CRM" },
    { x: 0.82, y: 0.36, label: "Raport" },
    { x: 0.22, y: 0.66, label: "Brief" },
    { x: 0.48, y: 0.72, label: "Verificare" },
    { x: 0.76, y: 0.68, label: "Output" }
  ];
  const links = [[0, 2], [1, 2], [2, 3], [3, 4], [5, 6], [6, 7], [2, 6], [0, 5]];

  const resize = () => {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(rect.width * ratio);
    canvas.height = Math.floor(rect.height * ratio);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  };

  const draw = (time) => {
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#151512";
    ctx.fillRect(0, 0, width, height);

    links.forEach(([from, to], index) => {
      const a = nodes[from];
      const b = nodes[to];
      const ax = a.x * width;
      const ay = a.y * height;
      const bx = b.x * width;
      const by = b.y * height;

      ctx.strokeStyle = "rgba(247, 243, 233, 0.16)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      ctx.lineTo(bx, by);
      ctx.stroke();

      const progress = ((time / 1600) + index * 0.18) % 1;
      const px = ax + (bx - ax) * progress;
      const py = ay + (by - ay) * progress;
      ctx.fillStyle = index % 3 === 0 ? "#d96f55" : index % 3 === 1 ? "#2f7d7a" : "#b8954c";
      ctx.beginPath();
      ctx.arc(px, py, 3, 0, Math.PI * 2);
      ctx.fill();
    });

    nodes.forEach((node, index) => {
      if (width < 720 || node.x < 0.56) return;
      const x = node.x * width;
      const y = node.y * height;
      const w = 92;
      const h = 40;

      ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
      ctx.strokeStyle = "rgba(255, 255, 255, 0.18)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - h / 2, w, h, 8);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = index === 2 ? "#d96f55" : "#f7f3e9";
      ctx.font = "700 12px Inter, system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(node.label, x, y);
    });

    animationFrame = requestAnimationFrame(draw);
  };

  resize();
  window.addEventListener("resize", resize, { passive: true });
  animationFrame = requestAnimationFrame(draw);
};

const loadDeck = async () => {
  const response = await fetch(deckUrl);
  if (!response.ok) {
    throw new Error(`Nu pot incarca deck-ul: ${response.status}`);
  }
  deck = await response.json();
  document.title = `${deck.title || "Workshop Slides"} | ${deck.subtitle || "Deck"}`;
  showSlide(findSlideFromHash(), { fromHash: true });
};

prevButton.addEventListener("click", () => go(-1));
nextButton.addEventListener("click", () => go(1));
window.addEventListener("keydown", handleKeydown);
window.addEventListener("hashchange", () => showSlide(findSlideFromHash(), { fromHash: true }));

loadDeck().catch((error) => {
  clearStage();
  const fallback = renderSection({
    type: "section",
    theme: "dark",
    kicker: "Eroare",
    title: "Deck-ul nu a putut fi incarcat",
    lead: error.message
  });
  stage.append(fallback);
});
