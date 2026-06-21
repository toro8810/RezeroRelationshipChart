const DB_NAME = "relationship-chart-tool";
const DB_VERSION = 1;
const STORE_NAME = "characters";
const DEFAULT_DATA_URL = "characters.json";
const ICON_OUTPUT_SIZE = 256;
const COLLATOR = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

const state = {
  characters: [],
  activeView: "chart",
  editingId: null,
  selectedId: null,
  draftIcon: "",
  draftImages: [],
  draftRelations: [],
  lastDraftSnapshot: "",
  detailOpen: false,
  chartAffiliationFilter: "all",
  chartFocus: null,
  crop: {
    image: null,
    scale: 1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    lastX: 0,
    lastY: 0
  }
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  bindEvents();
  state.characters = await loadCharactersFromDefaultJson();
  state.selectedId = state.characters[0]?.id || null;
  resetForm();
  renderAll();
  showView("chart");
}

function bindElements() {
  els.views = {
    edit: document.getElementById("edit-view"),
    chart: document.getElementById("chart-view"),
    list: document.getElementById("list-view")
  };
  els.tabs = Array.from(document.querySelectorAll(".tab-button"));
  els.form = document.getElementById("character-form");
  els.name = document.getElementById("name-input");
  els.affiliations = document.getElementById("affiliations-input");
  els.description = document.getElementById("description-input");
  els.newBtn = document.getElementById("new-character-btn");
  els.saveBtn = document.getElementById("save-character-btn");
  els.deleteBtn = document.getElementById("delete-character-btn");
  els.characterCount = document.getElementById("character-count");
  els.editList = document.getElementById("edit-character-list");
  els.iconInput = document.getElementById("icon-input");
  els.chooseIconBtn = document.getElementById("choose-icon-btn");
  els.iconPreview = document.getElementById("icon-preview");
  els.imagesInput = document.getElementById("images-input");
  els.chooseImagesBtn = document.getElementById("choose-images-btn");
  els.editorGallery = document.getElementById("image-gallery-editor");
  els.relationTarget = document.getElementById("relation-target-select");
  els.relationLabel = document.getElementById("relation-label-input");
  els.addRelationBtn = document.getElementById("add-relation-btn");
  els.relationsList = document.getElementById("relations-list");
  els.chartBoard = document.getElementById("chart-board");
  els.fitChartBtn = document.getElementById("fit-chart-btn");
  els.chartAffiliationFilter = document.getElementById("chart-affiliation-filter");
  els.detailModal = document.getElementById("detail-modal");
  els.detailPanel = document.getElementById("detail-panel");
  els.editSelectedBtn = document.getElementById("edit-selected-btn");
  els.detailCloseBtn = document.getElementById("detail-close-btn");
  els.listSearch = document.getElementById("list-search-input");
  els.listAffiliation = document.getElementById("list-affiliation-filter");
  els.listSort = document.getElementById("list-sort-select");
  els.characterListView = document.getElementById("character-list-view");
  els.exportDataBtn = document.getElementById("export-data-btn");
  els.shareStatus = document.getElementById("share-status");
  els.cropModal = document.getElementById("crop-modal");
  els.cropCanvas = document.getElementById("crop-canvas");
  els.cropScale = document.getElementById("crop-scale-input");
  els.cropClose = document.getElementById("crop-close-btn");
  els.cropCancel = document.getElementById("crop-cancel-btn");
  els.cropSave = document.getElementById("crop-save-btn");
  els.emptyTemplate = document.getElementById("empty-template");
}

function bindEvents() {
  els.tabs.forEach((button) => {
    button.addEventListener("click", () => requestViewChange(button.dataset.view));
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCurrentCharacter();
  });

  els.newBtn.addEventListener("click", async () => {
    const saved = await saveDraftIfNeeded();
    if (!saved) return;
    resetForm();
    renderEditList();
  });

  els.saveBtn.addEventListener("click", saveCurrentCharacter);
  els.deleteBtn.addEventListener("click", deleteCurrentCharacter);
  els.chooseIconBtn.addEventListener("click", () => els.iconInput.click());
  els.chooseImagesBtn.addEventListener("click", () => els.imagesInput.click());

  els.iconInput.addEventListener("change", async () => {
    const file = els.iconInput.files[0];
    if (!file) return;
    await openCropper(file);
    els.iconInput.value = "";
  });

  els.imagesInput.addEventListener("change", async () => {
    const files = Array.from(els.imagesInput.files || []);
    const images = await Promise.all(files.map(fileToImageRecord));
    state.draftImages.push(...images);
    els.imagesInput.value = "";
    renderEditorGallery();
  });

  els.addRelationBtn.addEventListener("click", addDraftRelation);
  els.fitChartBtn.addEventListener("click", renderChart);
  els.chartAffiliationFilter.addEventListener("change", () => {
    state.chartAffiliationFilter = els.chartAffiliationFilter.value;
    state.chartFocus = null;
    renderChart();
  });
  els.chartBoard.addEventListener("click", (event) => {
    const focusTarget = event.target.closest("[data-focus-type]");
    if (focusTarget) {
      state.chartFocus = {
        type: focusTarget.dataset.focusType,
        id: focusTarget.dataset.focusId
      };
      applyChartFocus();
      return;
    }
    if (event.target.closest(".chart-node")) return;
    state.chartFocus = null;
    applyChartFocus();
  });
  els.editSelectedBtn.addEventListener("click", async () => {
    const character = getSelectedCharacter();
    if (!character) return;
    closeDetailDialog();
    await openCharacterEditor(character.id);
  });
  els.detailCloseBtn.addEventListener("click", closeDetailDialog);
  els.detailModal.addEventListener("click", (event) => {
    if (event.target === els.detailModal) closeDetailDialog();
  });

  els.listSearch.addEventListener("input", renderCharacterListView);
  els.listAffiliation.addEventListener("change", renderCharacterListView);
  els.listSort.addEventListener("change", renderCharacterListView);
  els.exportDataBtn.addEventListener("click", async () => {
    const saved = await saveDraftIfNeeded();
    if (!saved) return;
    await copyCharactersJson();
  });

  els.cropClose.addEventListener("click", closeCropper);
  els.cropCancel.addEventListener("click", closeCropper);
  els.cropSave.addEventListener("click", saveCroppedIcon);
  els.cropScale.addEventListener("input", () => {
    state.crop.scale = Number(els.cropScale.value);
    constrainCropOffset();
    drawCropCanvas();
  });

  els.cropCanvas.addEventListener("pointerdown", startCropDrag);
  els.cropCanvas.addEventListener("pointermove", moveCropDrag);
  els.cropCanvas.addEventListener("pointerup", endCropDrag);
  els.cropCanvas.addEventListener("pointercancel", endCropDrag);
  els.cropCanvas.addEventListener("wheel", zoomCropWithWheel, { passive: false });

  window.addEventListener("resize", () => {
    if (state.activeView === "chart") renderChart();
  });
  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.detailOpen) closeDetailDialog();
  });
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllCharacters() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const request = tx.objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(sortByName(request.result || []));
    request.onerror = () => reject(request.error);
    tx.oncomplete = () => db.close();
  });
}

async function putCharacter(character) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(character);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function removeCharacter(id) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function replaceAllCharacters(characters) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    characters.forEach((character) => store.put(character));
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error);
    };
  });
}

async function requestViewChange(view) {
  if (view === state.activeView) return;
  const saved = await saveDraftIfNeeded();
  if (!saved) return;
  closeDetailDialog();
  if (view === "edit") resetForm();
  showView(view);
}

function showView(view) {
  state.activeView = view;
  Object.entries(els.views).forEach(([key, element]) => {
    element.classList.toggle("is-active", key === view);
  });
  els.tabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  if (view === "chart") renderChart();
  if (view === "list") renderCharacterListView();
}

async function saveCurrentCharacter() {
  await saveDraft({ allowFallbackName: false });
}

async function saveDraftIfNeeded() {
  if (state.activeView !== "edit") return true;
  if (!state.editingId && !hasDraftContent()) return true;
  if (getDraftSnapshot() === state.lastDraftSnapshot) return true;
  return saveDraft({ allowFallbackName: true });
}

async function saveDraft({ allowFallbackName }) {
  const name = els.name.value.trim();
  if (!name && !allowFallbackName) {
    els.name.focus();
    return false;
  }

  const id = state.editingId || createId();
  const character = {
    id,
    name: name || createUntitledName(id),
    icon: state.draftIcon,
    images: state.draftImages,
    description: els.description.value.trim(),
    affiliations: parseAffiliations(els.affiliations.value),
    relationships: cleanRelations(state.draftRelations),
    updatedAt: new Date().toISOString()
  };

  await putCharacter(character);
  state.characters = await getAllCharacters();
  state.editingId = character.id;
  state.selectedId = character.id;
  loadCharacterIntoForm(getCharacterById(character.id) || character);
  renderAll();
  return true;
}

async function deleteCurrentCharacter() {
  if (!state.editingId) return;
  const character = getCharacterById(state.editingId);
  if (!character) return;
  const ok = window.confirm(`「${character.name}」を削除しますか？`);
  if (!ok) return;

  await removeCharacter(character.id);
  const updatedCharacters = state.characters
    .filter((item) => item.id !== character.id)
    .map((item) => ({
      ...item,
      relationships: (item.relationships || []).filter((relation) => relation.targetId !== character.id)
    }));
  await Promise.all(updatedCharacters.map(putCharacter));
  state.characters = await getAllCharacters();
  state.selectedId = state.characters[0]?.id || null;
  resetForm();
  renderAll();
}

function resetForm() {
  state.editingId = null;
  state.draftIcon = "";
  state.draftImages = [];
  state.draftRelations = [];
  els.form.reset();
  els.iconPreview.removeAttribute("src");
  els.deleteBtn.disabled = true;
  renderEditorGallery();
  renderRelationTargetOptions();
  renderRelationsEditor();
  markDraftClean();
}

function loadCharacterIntoForm(character) {
  state.editingId = character.id;
  state.draftIcon = character.icon || "";
  state.draftImages = [...(character.images || [])];
  state.draftRelations = [...(character.relationships || [])];
  els.name.value = character.name || "";
  els.affiliations.value = (character.affiliations || []).join(", ");
  els.description.value = character.description || "";
  els.deleteBtn.disabled = false;
  renderIconPreview();
  renderEditorGallery();
  renderRelationTargetOptions();
  renderRelationsEditor();
  markDraftClean();
}

function renderAll() {
  renderEditList();
  renderIconPreview();
  renderEditorGallery();
  renderRelationTargetOptions();
  renderRelationsEditor();
  renderChartAffiliationFilter();
  renderAffiliationFilter();
  if (state.activeView === "chart") renderChart();
  if (state.detailOpen) renderDetail();
  if (state.activeView === "list") renderCharacterListView();
}

function hasDraftContent() {
  return Boolean(
    els.name.value.trim()
    || els.affiliations.value.trim()
    || els.description.value.trim()
    || state.draftIcon
    || state.draftImages.length
    || state.draftRelations.length
  );
}

function getDraftSnapshot() {
  return JSON.stringify({
    id: state.editingId || null,
    name: els.name.value.trim(),
    icon: state.draftIcon,
    images: state.draftImages,
    description: els.description.value.trim(),
    affiliations: parseAffiliations(els.affiliations.value),
    relationships: cleanRelations(state.draftRelations)
  });
}

function markDraftClean() {
  state.lastDraftSnapshot = getDraftSnapshot();
}

function createUntitledName(id) {
  const base = "名称未設定";
  const existing = new Set(
    state.characters
      .filter((character) => character.id !== id)
      .map((character) => character.name)
  );
  if (!existing.has(base)) return base;
  let index = 2;
  while (existing.has(`${base}${index}`)) index += 1;
  return `${base}${index}`;
}

function renderEditList() {
  els.characterCount.textContent = String(state.characters.length);
  els.editList.innerHTML = "";
  if (state.characters.length === 0) {
    els.editList.appendChild(createEmptyState());
    return;
  }

  sortByName(state.characters).forEach((character) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "compact-item";
    button.classList.toggle("active", character.id === state.editingId);
    button.innerHTML = `
        ${renderImageTag(character.icon, "thumb", character.name)}
      <span>
        <span class="compact-name">${escapeHtml(character.name)}</span>
        <span class="compact-meta">${escapeHtml((character.affiliations || []).join(" / "))}</span>
      </span>
    `;
    button.addEventListener("click", async () => {
      if (character.id === state.editingId) return;
      const saved = await saveDraftIfNeeded();
      if (!saved) return;
      state.editingId = character.id;
      state.selectedId = character.id;
      loadCharacterIntoForm(character);
      renderEditList();
    });
    els.editList.appendChild(button);
  });
}

function renderIconPreview() {
  if (state.draftIcon) {
    els.iconPreview.src = state.draftIcon;
  } else {
    els.iconPreview.removeAttribute("src");
  }
}

function renderEditorGallery() {
  els.editorGallery.innerHTML = "";
  if (state.draftImages.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.style.minHeight = "120px";
    empty.innerHTML = "<span>画像未登録</span>";
    els.editorGallery.appendChild(empty);
    return;
  }

  state.draftImages.forEach((image) => {
    const tile = document.createElement("div");
    tile.className = "image-tile";
    tile.innerHTML = `
      <img src="${image.url}" alt="${escapeHtml(image.name || "")}">
      <button type="button" class="image-remove" aria-label="画像を削除">×</button>
    `;
    tile.querySelector("button").addEventListener("click", () => {
      state.draftImages = state.draftImages.filter((item) => item.id !== image.id);
      renderEditorGallery();
    });
    els.editorGallery.appendChild(tile);
  });
}

function renderRelationTargetOptions() {
  els.relationTarget.innerHTML = "";
  const candidates = sortByName(state.characters).filter((character) => character.id !== state.editingId);
  if (candidates.length === 0) {
    const option = new Option("相手なし", "");
    els.relationTarget.appendChild(option);
    els.relationTarget.disabled = true;
    els.addRelationBtn.disabled = true;
    return;
  }
  els.relationTarget.disabled = false;
  els.addRelationBtn.disabled = false;
  candidates.forEach((character) => {
    els.relationTarget.appendChild(new Option(character.name, character.id));
  });
}

function addDraftRelation() {
  const targetId = els.relationTarget.value;
  const label = els.relationLabel.value.trim();
  if (!targetId || !label) {
    els.relationLabel.focus();
    return;
  }
  state.draftRelations.push({ id: createId(), targetId, label });
  els.relationLabel.value = "";
  renderRelationsEditor();
}

function renderRelationsEditor() {
  els.relationsList.innerHTML = "";
  if (state.draftRelations.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.style.minHeight = "96px";
    empty.innerHTML = "<span>関係線未登録</span>";
    els.relationsList.appendChild(empty);
    return;
  }

  state.draftRelations.forEach((relation) => {
    const target = getCharacterById(relation.targetId);
    const row = document.createElement("div");
    row.className = "relation-row";
    row.innerHTML = `
      <span><strong>${escapeHtml(target?.name || "削除済み")}</strong> <span>${escapeHtml(relation.label)}</span></span>
      <button type="button" class="secondary-button">削除</button>
    `;
    row.querySelector("button").addEventListener("click", () => {
      state.draftRelations = state.draftRelations.filter((item) => item.id !== relation.id);
      renderRelationsEditor();
    });
    els.relationsList.appendChild(row);
  });
}

function renderChart() {
  els.chartBoard.innerHTML = "";
  const chartCharacters = getChartCharacters();
  if (chartCharacters.length === 0) {
    els.chartBoard.style.width = "100%";
    els.chartBoard.style.height = "560px";
    els.chartBoard.appendChild(createEmptyState());
    return;
  }

  const layout = createChartLayout(chartCharacters);
  els.chartBoard.style.width = `${layout.width}px`;
  els.chartBoard.style.height = `${layout.height}px`;

  const frameSvg = createSvgElement("svg", {
    class: "chart-frame-svg",
    width: layout.width,
    height: layout.height,
    viewBox: `0 0 ${layout.width} ${layout.height}`
  });
  const labelLayerItems = [];
  drawAffiliationFrames(frameSvg, layout, labelLayerItems);
  els.chartBoard.appendChild(frameSvg);

  const lineSvg = createSvgElement("svg", {
    class: "chart-lines-svg",
    width: layout.width,
    height: layout.height,
    viewBox: `0 0 ${layout.width} ${layout.height}`
  });
  lineSvg.appendChild(createArrowDefs());
  drawRelationshipLines(lineSvg, layout, labelLayerItems);
  els.chartBoard.appendChild(lineSvg);

  const labelSvg = createSvgElement("svg", {
    class: "chart-label-svg",
    width: layout.width,
    height: layout.height,
    viewBox: `0 0 ${layout.width} ${layout.height}`
  });
  drawChartLabels(labelSvg, labelLayerItems, layout);
  els.chartBoard.appendChild(labelSvg);

  layout.nodes.forEach((node) => {
    const character = node.character;
    const card = document.createElement("article");
    card.className = "chart-node";
    card.dataset.characterId = character.id;
    card.dataset.affiliations = (character.affiliations || []).join("\u001f");
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");
    card.setAttribute("aria-label", `${character.name}の詳細`);
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    card.style.width = `${node.width}px`;
    card.style.height = `${node.height}px`;
    card.innerHTML = `
      <button type="button" aria-label="${escapeHtml(character.name)}の詳細">
        ${renderImageTag(character.icon, "chart-icon", character.name)}
      </button>
      <div class="chart-name">${escapeHtml(character.name)}</div>
      <div class="affiliation-chips">${renderChips(character.affiliations)}</div>
    `;
    card.addEventListener("click", async () => {
      await openDetailDialog(character.id);
    });
    card.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      await openDetailDialog(character.id);
    });
    els.chartBoard.appendChild(card);
  });
  applyChartFocus();
}

async function openCharacterEditor(characterId) {
  const saved = await saveDraftIfNeeded();
  if (!saved) return;
  const character = getCharacterById(characterId);
  if (!character) return;
  state.editingId = character.id;
  state.selectedId = character.id;
  loadCharacterIntoForm(character);
  showView("edit");
}

async function openDetailDialog(characterId) {
  const saved = await saveDraftIfNeeded();
  if (!saved) return;
  state.selectedId = characterId;
  state.detailOpen = true;
  renderDetail();
  els.detailModal.classList.add("is-open");
  els.detailModal.setAttribute("aria-hidden", "false");
}

function closeDetailDialog() {
  if (!state.detailOpen) return;
  state.detailOpen = false;
  els.detailModal.classList.remove("is-open");
  els.detailModal.setAttribute("aria-hidden", "true");
}

function getChartCharacters() {
  if (state.chartAffiliationFilter === "all") return [...state.characters];
  return state.characters.filter((character) => {
    return (character.affiliations || []).includes(state.chartAffiliationFilter);
  });
}

function renderChartAffiliationFilter() {
  const current = state.chartAffiliationFilter || "all";
  els.chartAffiliationFilter.innerHTML = "";
  els.chartAffiliationFilter.appendChild(new Option("すべて", "all"));
  getAllAffiliations().forEach((affiliation) => {
    els.chartAffiliationFilter.appendChild(new Option(affiliation, affiliation));
  });
  state.chartAffiliationFilter = [...els.chartAffiliationFilter.options].some((option) => option.value === current)
    ? current
    : "all";
  els.chartAffiliationFilter.value = state.chartAffiliationFilter;
}

function applyChartFocus() {
  const focus = state.chartFocus;
  els.chartBoard.classList.toggle("has-focus", Boolean(focus));

  const nodes = Array.from(els.chartBoard.querySelectorAll(".chart-node"));
  const relationGroups = Array.from(els.chartBoard.querySelectorAll(".chart-relation-group"));
  const affiliationFrames = Array.from(els.chartBoard.querySelectorAll(".chart-affiliation-frame"));
  const labels = Array.from(els.chartBoard.querySelectorAll(".chart-label"));
  const focusedRelation = focus?.type === "relationship"
    ? relationGroups.find((group) => group.dataset.relationId === focus.id)
    : null;

  if (!focus) {
    [...nodes, ...relationGroups, ...affiliationFrames, ...labels].forEach((element) => {
      element.classList.remove("is-dimmed", "is-focused-item");
    });
    return;
  }

  const isAffiliationFocus = focus.type === "affiliation";
  const relatedCharacters = new Set();
  if (isAffiliationFocus) {
    state.characters.forEach((character) => {
      if ((character.affiliations || []).includes(focus.id)) relatedCharacters.add(character.id);
    });
  }

  nodes.forEach((node) => {
    const keep = isAffiliationFocus
      ? relatedCharacters.has(node.dataset.characterId)
      : node.dataset.characterId === focusedRelation?.dataset.sourceId
        || node.dataset.characterId === focusedRelation?.dataset.targetId;
    node.classList.toggle("is-focused-item", keep);
    node.classList.toggle("is-dimmed", !keep);
  });

  relationGroups.forEach((group) => {
    const keep = isAffiliationFocus
      ? relatedCharacters.has(group.dataset.sourceId) || relatedCharacters.has(group.dataset.targetId)
      : group.dataset.relationId === focus.id;
    group.classList.toggle("is-focused-item", keep);
    group.classList.toggle("is-dimmed", !keep);
  });

  affiliationFrames.forEach((frame) => {
    const keep = isAffiliationFocus ? frame.dataset.affiliation === focus.id : false;
    frame.classList.toggle("is-focused-item", keep);
    frame.classList.toggle("is-dimmed", !keep);
  });

  labels.forEach((label) => {
    const keep = isAffiliationFocus
      ? label.dataset.focusType === "affiliation" && label.dataset.focusId === focus.id
      : label.dataset.focusType === "relationship" && label.dataset.focusId === focus.id;
    label.classList.toggle("is-focused-item", keep);
    label.classList.toggle("is-dimmed", !keep);
  });
}

function createChartLayout(characters) {
  const boardParent = els.chartBoard.parentElement;
  const visibleWidth = Math.max(760, boardParent.clientWidth - 4);
  const margin = 52;
  const nodeWidth = 128;
  const columnGap = 44;
  const rowGap = 46;
  const groupGap = 46;
  const framePadX = 24;
  const framePadTop = 50;
  const framePadBottom = 30;
  const groupLabelOffset = 48;
  const innerWidth = visibleWidth - margin * 2 - framePadX * 2;
  const columns = Math.max(2, Math.floor((innerWidth + columnGap) / (nodeWidth + columnGap)));
  const contentWidth = margin * 2 + framePadX * 2 + columns * nodeWidth + (columns - 1) * columnGap;
  const width = Math.max(visibleWidth, contentWidth);
  const nodes = [];
  const positions = new Map();
  let y = margin;

  const characterGroups = groupByPrimaryAffiliation(characters);
  characterGroups.forEach((characters, groupName) => {
    const sorted = sortByName(characters);
    const rows = Math.ceil(sorted.length / columns);
    const nodeStartY = y + (groupName ? groupLabelOffset : 0);
    const groupNodes = [];
    const rowHeights = Array.from({ length: rows }, (_, row) => {
      const rowCharacters = sorted.slice(row * columns, row * columns + columns);
      return Math.max(...rowCharacters.map(estimateChartNodeHeight));
    });
    const rowOffsets = rowHeights.map((_, row) => {
      return rowHeights.slice(0, row).reduce((sum, height) => sum + height, 0) + row * rowGap;
    });

    sorted.forEach((character, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const x = margin + framePadX + column * (nodeWidth + columnGap);
      const nodeY = nodeStartY + rowOffsets[row];
      const nodeHeight = estimateChartNodeHeight(character);
      const node = {
        character,
        x,
        y: nodeY,
        width: nodeWidth,
        height: nodeHeight,
        cx: x + nodeWidth / 2,
        cy: nodeY + nodeHeight / 2
      };
      nodes.push(node);
      groupNodes.push(node);
      positions.set(character.id, node);
    });

    const maxY = groupNodes.length
      ? Math.max(...groupNodes.map((node) => node.y + node.height)) + framePadBottom
      : nodeStartY;
    y = maxY + groupGap;
  });

  const frames = createAffiliationFrames(positions, width, characters);
  const frameMaxY = frames.length
    ? Math.max(...frames.map((frame) => frame.y + frame.height))
    : 0;

  return {
    width,
    height: Math.max(560, y + margin, frameMaxY + margin),
    nodes,
    positions,
    frames
  };
}

function estimateChartNodeHeight(character) {
  const chipRows = estimateChipRows(character.affiliations || [], 112);
  return 150 + chipRows * 22;
}

function estimateChipRows(items, availableWidth) {
  if (!items?.length) return 0;
  let rows = 1;
  let rowWidth = 0;
  items.forEach((item) => {
    const chipWidth = Math.min(92, Math.max(42, String(item).length * 13 + 18));
    const nextWidth = rowWidth === 0 ? chipWidth : rowWidth + 4 + chipWidth;
    if (nextWidth <= availableWidth) {
      rowWidth = nextWidth;
    } else {
      rows += 1;
      rowWidth = chipWidth;
    }
  });
  return rows;
}

function groupByPrimaryAffiliation(characters) {
  const groups = new Map();
  sortByName(characters).forEach((character) => {
    const key = character.affiliations?.[0] || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(character);
  });
  return new Map([...groups.entries()].sort(([a], [b]) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    return COLLATOR.compare(a, b);
  }));
}

function createAffiliationFrames(positions, boardWidth, characters) {
  const padX = 22;
  const padTop = 46;
  const padBottom = 24;
  return getAllAffiliations().map((affiliation, index) => {
    const members = characters
      .filter((character) => (character.affiliations || []).includes(affiliation))
      .map((character) => positions.get(character.id))
      .filter(Boolean);
    if (!members.length) return null;

    const offset = (index % 4) * 5;
    const minX = Math.max(14, Math.min(...members.map((node) => node.x)) - padX - offset);
    const minY = Math.max(14, Math.min(...members.map((node) => node.y)) - padTop - offset);
    const maxX = Math.min(boardWidth - 14, Math.max(...members.map((node) => node.x + node.width)) + padX + offset);
    const maxY = Math.max(...members.map((node) => node.y + node.height)) + padBottom + offset;
    return {
      name: affiliation,
      color: getAffiliationColor(index),
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY
    };
  }).filter(Boolean).sort((a, b) => (b.width * b.height) - (a.width * a.height));
}

function getAffiliationColor(index) {
  const colors = ["#217c73", "#c17c21", "#a84862", "#6856a3", "#386f9f", "#4d7f3f"];
  return colors[index % colors.length];
}

function drawAffiliationFrames(svg, layout, labelLayerItems) {
  layout.frames.forEach((group) => {
    const color = group.color;

    svg.appendChild(createSvgElement("rect", {
      x: group.x,
      y: group.y,
      width: group.width,
      height: group.height,
      rx: 8,
      fill: color,
      "fill-opacity": 0.08,
      stroke: color,
      "stroke-width": 2,
      opacity: 0.9,
      class: "chart-affiliation-frame",
      "data-affiliation": group.name
    }));

    const labelWidth = Math.max(64, Math.min(group.width - 20, 220, group.name.length * 16 + 26));
    labelLayerItems.push({
      type: "affiliation",
      text: group.name,
      color,
      frame: group,
      width: labelWidth,
      height: 28
    });
  });
}

function placeAffiliationLabel(item, boardWidth, boardHeight, blockers, index = 0) {
  const frame = item.frame;
  const width = item.width;
  const height = item.height;
  const candidates = [];
  const left = frame.x + 10;
  const right = frame.x + frame.width - width - 10;
  const insideMaxY = frame.y + frame.height - height - 8;

  for (let y = frame.y + 9; y <= insideMaxY; y += 34) {
    candidates.push({ x: left, y, width, height });
    if (right > left + 8) candidates.push({ x: right, y, width, height });
  }

  candidates.push(
    { x: left, y: frame.y - height - 8, width, height },
    { x: right, y: frame.y - height - 8, width, height },
    { x: left, y: frame.y + frame.height + 8, width, height },
    { x: right, y: frame.y + frame.height + 8, width, height }
  );

  const normalized = candidates.map((candidate) => ({
    ...candidate,
    x: clamp(candidate.x, 8, boardWidth - width - 8),
    y: clamp(candidate.y, 8, boardHeight - height - 8)
  }));
  const rotated = normalized.slice(index % normalized.length).concat(normalized.slice(0, index % normalized.length));
  const clearCandidate = rotated.find((candidate) => !blockers.some((blocker) => boxesOverlap(candidate, blocker)));
  if (clearCandidate) return clearCandidate;

  return rotated
    .map((candidate) => ({
      candidate,
      score: blockers.reduce((total, blocker) => total + getOverlapArea(candidate, blocker), 0)
    }))
    .sort((a, b) => a.score - b.score)[0].candidate;
}

function boxesOverlap(a, b) {
  return a.x < b.x + b.width
    && a.x + a.width > b.x
    && a.y < b.y + b.height
    && a.y + a.height > b.y;
}

function getOverlapArea(a, b) {
  const width = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const height = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  return width * height;
}

function drawRelationshipLines(svg, layout, labelLayerItems) {
  const relations = [];
  const visibleIds = new Set(layout.nodes.map((node) => node.character.id));
  layout.nodes.forEach((sourceNode) => {
    const source = sourceNode.character;
    const from = layout.positions.get(source.id);
    if (!from) return;
    (source.relationships || []).forEach((relation, index) => {
      if (!visibleIds.has(relation.targetId)) return;
      const to = layout.positions.get(relation.targetId);
      if (!to || from === to) return;
      relations.push({ source, relation, from, to, index, relationId: relation.id || `${source.id}-${relation.targetId}-${index}` });
    });
  });

  const pairCounts = new Map();
  relations.forEach((item) => {
    const key = createRelationPairKey(item.source.id, item.relation.targetId);
    pairCounts.set(key, (pairCounts.get(key) || 0) + 1);
  });

  const pairIndexes = new Map();
  relations.forEach((item) => {
    const key = createRelationPairKey(item.source.id, item.relation.targetId);
    const pairIndex = pairIndexes.get(key) || 0;
    pairIndexes.set(key, pairIndex + 1);
    const pairCount = pairCounts.get(key) || 1;
    const geometry = createRelationshipGeometry(item.from, item.to, layout.nodes, pairCount, pairIndex);

    const group = createSvgElement("g", {
      class: "chart-relation-group",
      "data-relation-id": item.relationId,
      "data-source-id": item.source.id,
      "data-target-id": item.relation.targetId
    });
    group.appendChild(createSvgElement("path", {
      d: geometry.path,
      fill: "none",
      stroke: "#fffdf9",
      "stroke-width": 7,
      "stroke-linecap": "round",
      opacity: 0.94
    }));
    group.appendChild(createSvgElement("path", {
      d: geometry.path,
      fill: "none",
      stroke: "#2f5f83",
      "stroke-width": 2.4,
      "stroke-linecap": "round",
      "marker-start": "url(#line-start-dot)",
      "marker-end": "url(#arrow-head)",
      opacity: 0.96
    }));
    svg.appendChild(group);

    labelLayerItems.push({
      type: "relationship",
      id: item.relationId,
      text: item.relation.label,
      x: geometry.labelX,
      y: geometry.labelY,
      color: "#27231f"
    });
  });
}

function drawChartLabels(svg, items, layout) {
  const blockers = layout.nodes.map((node) => ({
    x: node.x - 8,
    y: node.y - 8,
    width: node.width + 16,
    height: node.height + 16
  }));

  items.filter((item) => item.type === "affiliation").forEach((item, index) => {
    const labelBox = placeAffiliationLabel(item, layout.width, layout.height, blockers, index);
    const placedItem = { ...item, ...labelBox };
    drawAffiliationLabel(svg, placedItem);
    blockers.push(labelBox);
  });

  items.filter((item) => item.type === "relationship").forEach((item, index) => {
    const labelBox = placeRelationshipLabel(
      item.x,
      item.y,
      item.text,
      layout.width,
      layout.height,
      blockers,
      index
    );
    labelBox.relationId = item.id;
    blockers.push(labelBox);
    drawRelationshipLabel(svg, labelBox, item.text);
  });
}

function drawAffiliationLabel(svg, item) {
  const group = createSvgElement("g", {
    class: "chart-label chart-affiliation-label",
    "data-focus-type": "affiliation",
    "data-focus-id": item.text
  });
  group.appendChild(createSvgElement("rect", {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rx: 6,
    fill: "#fffdf9",
    stroke: item.color,
    "stroke-width": 1.4,
    opacity: 0.98
  }));

  group.appendChild(createSvgElement("text", {
    x: item.x + 10,
    y: item.y + 20,
    fill: item.color,
    "font-size": 15,
    "font-weight": 800
  }, item.text));
  svg.appendChild(group);
}

function drawRelationshipLabel(svg, labelBox, text) {
  const group = createSvgElement("g", {
    class: "chart-label chart-relationship-label",
    "data-focus-type": "relationship",
    "data-focus-id": labelBox.relationId
  });
  group.appendChild(createSvgElement("rect", {
    x: labelBox.x,
    y: labelBox.y,
    width: labelBox.width,
    height: labelBox.height,
    rx: 5,
    fill: "#fffdf9",
    stroke: "#2f5f83",
    "stroke-width": 1.2,
    opacity: 0.98
  }));
  group.appendChild(createSvgElement("text", {
    x: labelBox.x + labelBox.width / 2,
    y: labelBox.y + 17,
    fill: "#27231f",
    "font-size": 13,
    "font-weight": 800,
    "text-anchor": "middle"
  }, text));
  svg.appendChild(group);
}

function createRelationPairKey(sourceId, targetId) {
  return [sourceId, targetId].sort().join("::");
}

function createRelationshipGeometry(from, to, nodes, pairCount, pairIndex) {
  const start = getNodeEdgePoint(from, to);
  const end = getNodeEdgePoint(to, from);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.max(1, Math.hypot(dx, dy));
  const normalX = -dy / length;
  const normalY = dx / length;
  const stackedOffset = pairCount > 1 ? (pairIndex - (pairCount - 1) / 2) * 32 : 0;
  const hasObstacle = segmentHitsAnotherNode(start, end, nodes, from, to);
  const needsCurve = pairCount > 1 || hasObstacle;
  const bend = needsCurve
    ? (stackedOffset || 54) * (hasObstacle && stackedOffset === 0 ? 1 : 1)
    : 0;
  const startX = start.x + normalX * stackedOffset * 0.18;
  const startY = start.y + normalY * stackedOffset * 0.18;
  const endX = end.x + normalX * stackedOffset * 0.18;
  const endY = end.y + normalY * stackedOffset * 0.18;

  if (!needsCurve) {
    return {
      path: `M ${startX} ${startY} L ${endX} ${endY}`,
      labelX: startX + dx * 0.5,
      labelY: startY + dy * 0.5 - 18
    };
  }

  const controlX = startX + dx * 0.5 + normalX * bend;
  const controlY = startY + dy * 0.5 + normalY * bend;
  return {
    path: `M ${startX} ${startY} Q ${controlX} ${controlY} ${endX} ${endY}`,
    labelX: controlX,
    labelY: controlY - 18
  };
}

function placeRelationshipLabel(centerX, centerY, text, boardWidth, boardHeight, placedLabels, index = 0) {
  const width = Math.min(180, Math.max(42, String(text).length * 13 + 20));
  const height = 24;
  const offsets = [
    [0, -22],
    [0, 22],
    [58, -2],
    [-58, -2],
    [76, -34],
    [-76, -34],
    [76, 34],
    [-76, 34],
    [0, -62],
    [0, 62],
    [116, 0],
    [-116, 0],
    [118, -58],
    [-118, -58],
    [118, 58],
    [-118, 58]
  ];
  const rotatedOffsets = offsets.slice(index % offsets.length).concat(offsets.slice(0, index % offsets.length));
  const candidates = rotatedOffsets.map(([offsetX, offsetY]) => ({
    x: clamp(centerX - width / 2 + offsetX, 8, boardWidth - width - 8),
    y: clamp(centerY - height / 2 + offsetY, 8, boardHeight - height - 8),
    width,
    height
  }));

  const clearCandidate = candidates.find((candidate) => {
    return !placedLabels.some((placed) => boxesOverlap(candidate, placed));
  });
  if (clearCandidate) return clearCandidate;

  return candidates
    .map((candidate) => ({
      candidate,
      score: placedLabels.reduce((total, placed) => total + getOverlapArea(candidate, placed), 0)
    }))
    .sort((a, b) => a.score - b.score)[0].candidate;
}

function segmentHitsAnotherNode(start, end, nodes, fromNode, toNode) {
  return nodes.some((node) => {
    if (node === fromNode || node === toNode) return false;
    const rect = {
      x: node.x - 10,
      y: node.y - 10,
      width: node.width + 20,
      height: node.height + 20
    };
    return segmentIntersectsRect(start, end, rect);
  });
}

function segmentIntersectsRect(start, end, rect) {
  const left = rect.x;
  const right = rect.x + rect.width;
  const top = rect.y;
  const bottom = rect.y + rect.height;
  if (pointInRect(start, rect) || pointInRect(end, rect)) return true;
  return segmentsIntersect(start, end, { x: left, y: top }, { x: right, y: top })
    || segmentsIntersect(start, end, { x: right, y: top }, { x: right, y: bottom })
    || segmentsIntersect(start, end, { x: right, y: bottom }, { x: left, y: bottom })
    || segmentsIntersect(start, end, { x: left, y: bottom }, { x: left, y: top });
}

function pointInRect(point, rect) {
  return point.x >= rect.x
    && point.x <= rect.x + rect.width
    && point.y >= rect.y
    && point.y <= rect.y + rect.height;
}

function segmentsIntersect(a, b, c, d) {
  const ccw = (p1, p2, p3) => (p3.y - p1.y) * (p2.x - p1.x) > (p2.y - p1.y) * (p3.x - p1.x);
  return ccw(a, c, d) !== ccw(b, c, d) && ccw(a, b, c) !== ccw(a, b, d);
}

function getNodeEdgePoint(node, towardNode) {
  const center = {
    x: node.x + node.width / 2,
    y: node.y + node.height / 2
  };
  const targetCenter = {
    x: towardNode.x + towardNode.width / 2,
    y: towardNode.y + towardNode.height / 2
  };
  const dx = targetCenter.x - center.x;
  const dy = targetCenter.y - center.y;
  if (dx === 0 && dy === 0) return center;

  const halfWidth = node.width / 2 + 4;
  const halfHeight = node.height / 2 + 4;
  const scaleX = dx === 0 ? Infinity : halfWidth / Math.abs(dx);
  const scaleY = dy === 0 ? Infinity : halfHeight / Math.abs(dy);
  const scale = Math.min(scaleX, scaleY);
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale
  };
}

function createArrowDefs() {
  const defs = createSvgElement("defs");
  const marker = createSvgElement("marker", {
    id: "arrow-head",
    markerWidth: 10,
    markerHeight: 10,
    refX: 9,
    refY: 5,
    orient: "auto",
    markerUnits: "userSpaceOnUse"
  });
  marker.appendChild(createSvgElement("path", {
    d: "M 0 0 L 10 5 L 0 10 z",
    fill: "#2f5f83"
  }));
  defs.appendChild(marker);

  const dot = createSvgElement("marker", {
    id: "line-start-dot",
    markerWidth: 7,
    markerHeight: 7,
    refX: 3.5,
    refY: 3.5,
    orient: "auto",
    markerUnits: "userSpaceOnUse"
  });
  dot.appendChild(createSvgElement("circle", {
    cx: 3.5,
    cy: 3.5,
    r: 2.6,
    fill: "#2f5f83"
  }));
  defs.appendChild(dot);
  return defs;
}

function renderDetail() {
  const character = getSelectedCharacter();
  els.detailPanel.innerHTML = "";
  if (!character) {
    els.detailPanel.appendChild(createEmptyState());
    return;
  }

  const outgoing = (character.relationships || []).map((relation) => ({
    ...relation,
    direction: "to",
    other: getCharacterById(relation.targetId)
  }));
  const incoming = state.characters.flatMap((source) => {
    return (source.relationships || [])
      .filter((relation) => relation.targetId === character.id)
      .map((relation) => ({
        ...relation,
        direction: "from",
        other: source
      }));
  });

  els.detailPanel.innerHTML = `
    <div class="detail-hero">
      ${renderImageTag(character.icon, "detail-icon", character.name)}
      <div>
        <h3 class="detail-name">${escapeHtml(character.name)}</h3>
        <div class="affiliation-chips">${renderChips(character.affiliations)}</div>
      </div>
    </div>
    <section class="detail-section">
      <h3>説明</h3>
      <div class="description-box">${escapeHtml(character.description || "説明未登録")}</div>
    </section>
    <section class="detail-section">
      <h3>画像</h3>
      <div class="detail-gallery">
        ${(character.images || []).map((image) => `<img src="${image.url}" alt="${escapeHtml(image.name || character.name)}">`).join("") || "<div class=\"empty-state\"><span>画像未登録</span></div>"}
      </div>
    </section>
    <section class="detail-section">
      <h3>関係線</h3>
      <div class="detail-relations">
        ${renderDetailRelations(outgoing, incoming)}
      </div>
    </section>
  `;
}

function renderDetailRelations(outgoing, incoming) {
  const rows = [];
  outgoing.forEach((relation) => {
    rows.push(`<div class="relation-row"><span><strong>${escapeHtml(relation.other?.name || "削除済み")}</strong> <span>${escapeHtml(relation.label)}</span></span></div>`);
  });
  incoming.forEach((relation) => {
    rows.push(`<div class="relation-row"><span><strong>${escapeHtml(relation.other?.name || "削除済み")}</strong> <span>から ${escapeHtml(relation.label)}</span></span></div>`);
  });
  return rows.join("") || "<div class=\"empty-state\"><span>関係線未登録</span></div>";
}

function renderAffiliationFilter() {
  const current = els.listAffiliation.value || "all";
  els.listAffiliation.innerHTML = "";
  els.listAffiliation.appendChild(new Option("すべて", "all"));
  getAllAffiliations().forEach((affiliation) => {
    els.listAffiliation.appendChild(new Option(affiliation, affiliation));
  });
  els.listAffiliation.value = [...els.listAffiliation.options].some((option) => option.value === current) ? current : "all";
}

function renderCharacterListView() {
  renderAffiliationFilter();
  const search = els.listSearch.value.trim().toLowerCase();
  const affiliation = els.listAffiliation.value;
  const sortMode = els.listSort.value;
  let characters = [...state.characters];

  if (search) {
    characters = characters.filter((character) => character.name.toLowerCase().includes(search));
  }
  if (affiliation !== "all") {
    characters = characters.filter((character) => (character.affiliations || []).includes(affiliation));
  }
  if (sortMode === "affiliation") {
    characters.sort((a, b) => {
      const affiliationCompare = comparePrimaryAffiliation(a, b);
      return affiliationCompare || COLLATOR.compare(a.name, b.name);
    });
  } else {
    characters = sortByName(characters);
  }

  els.characterListView.innerHTML = "";
  if (characters.length === 0) {
    els.characterListView.appendChild(createEmptyState());
    return;
  }

  characters.forEach((character) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "character-cell";
    button.innerHTML = `
      ${renderImageTag(character.icon, "list-icon", character.name)}
      <span>
        <span class="list-name">${escapeHtml(character.name)}</span>
        <span class="list-affiliations">${renderChips(character.affiliations)}</span>
      </span>
      <span class="secondary-button">詳細</span>
    `;
    button.addEventListener("click", async () => {
      await openDetailDialog(character.id);
    });
    els.characterListView.appendChild(button);
  });
}

async function openCropper(file) {
  const dataUrl = await fileToDataUrl(file);
  const image = new Image();
  image.onload = () => {
    state.crop.image = image;
    state.crop.scale = 1;
    state.crop.offsetX = 0;
    state.crop.offsetY = 0;
    els.cropScale.value = "1";
    els.cropModal.classList.add("is-open");
    els.cropModal.setAttribute("aria-hidden", "false");
    drawCropCanvas();
  };
  image.src = dataUrl;
}

function closeCropper() {
  els.cropModal.classList.remove("is-open");
  els.cropModal.setAttribute("aria-hidden", "true");
  state.crop.image = null;
}

function drawCropCanvas() {
  const image = state.crop.image;
  const canvas = els.cropCanvas;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawCanvasBackdrop(ctx, canvas.width, canvas.height);
  if (!image) return;
  const transform = getCropTransform();
  ctx.save();
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2, 0, Math.PI * 2);
  ctx.clip();
  ctx.drawImage(image, transform.x, transform.y, transform.width, transform.height);
  ctx.restore();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(canvas.width / 2, canvas.height / 2, canvas.width / 2 - 2, 0, Math.PI * 2);
  ctx.stroke();
}

function drawCanvasBackdrop(ctx, width, height) {
  ctx.fillStyle = "#ece5dc";
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = "#ded5ca";
  for (let y = 0; y < height; y += 24) {
    for (let x = 0; x < width; x += 24) {
      if ((x + y) % 48 === 0) ctx.fillRect(x, y, 24, 24);
    }
  }
}

function getCropTransform() {
  const image = state.crop.image;
  const canvas = els.cropCanvas;
  const baseScale = Math.max(canvas.width / image.width, canvas.height / image.height);
  const scale = baseScale * state.crop.scale;
  const width = image.width * scale;
  const height = image.height * scale;
  return {
    width,
    height,
    x: (canvas.width - width) / 2 + state.crop.offsetX,
    y: (canvas.height - height) / 2 + state.crop.offsetY
  };
}

function constrainCropOffset() {
  const image = state.crop.image;
  if (!image) return;
  const canvas = els.cropCanvas;
  const transform = getCropTransform();
  const maxX = Math.max(0, (transform.width - canvas.width) / 2);
  const maxY = Math.max(0, (transform.height - canvas.height) / 2);
  state.crop.offsetX = clamp(state.crop.offsetX, -maxX, maxX);
  state.crop.offsetY = clamp(state.crop.offsetY, -maxY, maxY);
}

function startCropDrag(event) {
  if (!state.crop.image) return;
  state.crop.dragging = true;
  state.crop.lastX = event.clientX;
  state.crop.lastY = event.clientY;
  els.cropCanvas.setPointerCapture(event.pointerId);
}

function moveCropDrag(event) {
  if (!state.crop.dragging) return;
  state.crop.offsetX += event.clientX - state.crop.lastX;
  state.crop.offsetY += event.clientY - state.crop.lastY;
  state.crop.lastX = event.clientX;
  state.crop.lastY = event.clientY;
  constrainCropOffset();
  drawCropCanvas();
}

function endCropDrag(event) {
  if (!state.crop.dragging) return;
  state.crop.dragging = false;
  if (els.cropCanvas.hasPointerCapture(event.pointerId)) {
    els.cropCanvas.releasePointerCapture(event.pointerId);
  }
}

function zoomCropWithWheel(event) {
  if (!state.crop.image) return;
  event.preventDefault();
  const nextScale = clamp(state.crop.scale + (event.deltaY > 0 ? -0.08 : 0.08), 1, 4);
  state.crop.scale = nextScale;
  els.cropScale.value = String(nextScale);
  constrainCropOffset();
  drawCropCanvas();
}

function saveCroppedIcon() {
  const image = state.crop.image;
  if (!image) return;
  const sourceCanvas = els.cropCanvas;
  const output = document.createElement("canvas");
  output.width = ICON_OUTPUT_SIZE;
  output.height = ICON_OUTPUT_SIZE;
  const outputCtx = output.getContext("2d");
  outputCtx.clearRect(0, 0, ICON_OUTPUT_SIZE, ICON_OUTPUT_SIZE);
  outputCtx.save();
  outputCtx.beginPath();
  outputCtx.arc(ICON_OUTPUT_SIZE / 2, ICON_OUTPUT_SIZE / 2, ICON_OUTPUT_SIZE / 2, 0, Math.PI * 2);
  outputCtx.clip();
  outputCtx.drawImage(sourceCanvas, 0, 0, ICON_OUTPUT_SIZE, ICON_OUTPUT_SIZE);
  outputCtx.restore();
  state.draftIcon = output.toDataURL("image/png");
  renderIconPreview();
  closeCropper();
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

async function fileToImageRecord(file) {
  return {
    id: createId(),
    name: file.name,
    url: await fileToDataUrl(file)
  };
}

function createExportPayload() {
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    characters: sortByName(state.characters).map(normalizeCharacter)
  };
}

async function copyCharactersJson() {
  const payload = createExportPayload();
  const text = JSON.stringify(payload, null, 2);
  try {
    await copyTextToClipboard(text);
    setShareStatus("JSONをクリップボードにコピーしました。");
  } catch (error) {
    console.error(error);
    setShareStatus("JSONをコピーできませんでした。ブラウザのクリップボード許可を確認してください。", true);
  }
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const ok = document.execCommand("copy");
  textarea.remove();
  if (!ok) throw new Error("copy command failed");
}

async function loadCharactersFromDefaultJson() {
  if (window.location.protocol === "file:") {
    setShareStatus("ローカル確認中はブラウザ保存データを表示します。公開後は characters.json を自動読み込みします。");
    return getAllCharacters();
  }

  try {
    const response = await fetch(`${DEFAULT_DATA_URL}?t=${Date.now()}`, {
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const payload = await response.json();
    const characters = parseCharactersPayload(payload);
    await applyImportedCharacters(characters);
    setShareStatus(`characters.json から${characters.length}件を読み込みました。`);
    return state.characters;
  } catch (error) {
    console.error(error);
    const localCharacters = await getAllCharacters();
    setShareStatus("characters.json を読み込めなかったため、ブラウザ保存データを表示しています。", true);
    return localCharacters;
  }
}

async function applyImportedCharacters(characters) {
  await replaceAllCharacters(characters);
  state.characters = await getAllCharacters();
  state.selectedId = state.characters[0]?.id || null;
  resetForm();
  renderAll();
}

function parseCharactersPayload(payload) {
  const source = Array.isArray(payload) ? payload : payload?.characters;
  if (!Array.isArray(source)) {
    throw new Error("characters array is missing");
  }

  return sortByName(source.map((item) => normalizeCharacter({
    id: item.id || createId(),
    name: item.name || "名称未設定",
    icon: item.icon || "",
    images: Array.isArray(item.images) ? item.images : [],
    description: item.description || "",
    affiliations: Array.isArray(item.affiliations) ? item.affiliations : [],
    relationships: Array.isArray(item.relationships) ? item.relationships : [],
    updatedAt: item.updatedAt || new Date().toISOString()
  })));
}

function normalizeCharacter(character) {
  return {
    id: character.id || createId(),
    name: character.name || "名称未設定",
    icon: character.icon || "",
    images: (character.images || []).map((image) => ({
      id: image.id || createId(),
      name: image.name || "",
      url: image.url || ""
    })).filter((image) => image.url),
    description: character.description || "",
    affiliations: [...new Set((character.affiliations || []).map((item) => String(item).trim()).filter(Boolean))],
    relationships: (character.relationships || []).map((relation) => ({
      id: relation.id || createId(),
      targetId: relation.targetId || "",
      label: relation.label || ""
    })).filter((relation) => relation.targetId && relation.label),
    updatedAt: character.updatedAt || new Date().toISOString()
  };
}

function setShareStatus(message, isError = false) {
  els.shareStatus.textContent = message;
  els.shareStatus.classList.toggle("is-error", isError);
}

function getAllAffiliations() {
  const set = new Set();
  state.characters.forEach((character) => {
    (character.affiliations || []).forEach((affiliation) => set.add(affiliation));
  });
  return [...set].sort(COLLATOR.compare);
}

function parseAffiliations(value) {
  return [...new Set(
    value
      .split(/[,\n、]/)
      .map((item) => item.trim())
      .filter(Boolean)
  )];
}

function cleanRelations(relations) {
  return relations
    .filter((relation) => relation.targetId && relation.label)
    .map((relation) => ({
      id: relation.id || createId(),
      targetId: relation.targetId,
      label: relation.label
    }));
}

function sortByName(characters) {
  return [...characters].sort((a, b) => COLLATOR.compare(a.name || "", b.name || ""));
}

function comparePrimaryAffiliation(a, b) {
  const aAffiliation = a.affiliations?.[0] || "";
  const bAffiliation = b.affiliations?.[0] || "";
  if (!aAffiliation && !bAffiliation) return 0;
  if (!aAffiliation) return 1;
  if (!bAffiliation) return -1;
  return COLLATOR.compare(aAffiliation, bAffiliation);
}

function getCharacterById(id) {
  return state.characters.find((character) => character.id === id);
}

function getSelectedCharacter() {
  if (!state.selectedId && state.characters.length > 0) {
    state.selectedId = state.characters[0].id;
  }
  return getCharacterById(state.selectedId);
}

function renderImageTag(src, className, alt) {
  if (src) {
    return `<img class="${className}" src="${src}" alt="${escapeHtml(alt || "")}">`;
  }
  const initials = (alt || "?").trim().slice(0, 2).toUpperCase();
  return `<svg class="${className}" viewBox="0 0 100 100" role="img" aria-label="${escapeHtml(alt || "画像なし")}">
    <rect width="100" height="100" rx="50" fill="#e7ded4"></rect>
    <text x="50" y="56" text-anchor="middle" font-size="24" font-weight="800" fill="#746d65">${escapeHtml(initials)}</text>
  </svg>`;
}

function renderChips(items) {
  if (!items?.length) return "";
  return items.map((item) => `<span class="chip">${escapeHtml(item)}</span>`).join("");
}

function createEmptyState() {
  return els.emptyTemplate.content.firstElementChild.cloneNode(true);
}

function createId() {
  if (window.crypto?.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function createSvgElement(name, attributes = {}, text = "") {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, value);
  });
  if (text) element.textContent = text;
  return element;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
