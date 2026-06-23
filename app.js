const DEFAULT_DATA_URL = "characters.json";
const STORAGE_KEY = "relationship-chart-data-v2";
const LEGACY_DB_NAME = "relationship-chart-tool";
const LEGACY_STORE_NAME = "characters";
const BOARD_SIZE = { width: 2400, height: 1800 };
const NODE_SIZE = { width: 116, height: 118 };
const MIN_SCALE = 0.25;
const MAX_SCALE = 1.4;
const CROP_OUTPUT_SIZE = 512;
const COLLATOR = new Intl.Collator("ja", { numeric: true, sensitivity: "base" });

const DEFAULT_RELATION_TYPES = [
  { id: "trust", name: "信頼", defaultColor: "#2563eb", defaultLineType: "solid", description: "信頼・協力関係" },
  { id: "enemy", name: "敵対", defaultColor: "#ef4444", defaultLineType: "solid", description: "敵対関係" },
  { id: "family", name: "家族", defaultColor: "#8b5cf6", defaultLineType: "bold", description: "家族・血縁関係" },
  { id: "love", name: "恋愛", defaultColor: "#ec4899", defaultLineType: "solid", description: "恋愛・好意" },
  { id: "unknown", name: "不明", defaultColor: "#94a3b8", defaultLineType: "dashed", description: "不明・調査中" }
];

const GROUP_COLORS = ["#2563eb", "#8b5cf6", "#ef4444", "#16a34a", "#f59e0b", "#ec4899", "#0f766e"];

const state = {
  data: createEmptyData(),
  activeTab: "chart",
  canEdit: false,
  editMode: false,
  tool: "move",
  selected: null,
  detailEntity: null,
  relationSource: null,
  relationTarget: null,
  chartPinch: null,
  sidePanelOpen: false,
  jsonFileHandle: null,
  scale: 1,
  manualScale: false,
  characterEditingId: null,
  characterCrop: null,
  termEditingId: null,
  dragging: null,
  chartPan: null,
  justDragged: false,
  toastTimer: null
};

const els = {};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindElements();
  state.canEdit = isLocalEditingHost();
  bindEvents();
  updateAccessUi();
  state.data = await loadInitialData();
  ensureDataLayout(state.data);
  state.selected = null;
  state.characterEditingId = state.data.characters[0]?.id || null;
  state.termEditingId = state.data.terms[0]?.id || null;
  renderAll();
  fitChart(true, false);
}

function bindElements() {
  els.tabs = Array.from(document.querySelectorAll(".tab-button"));
  els.views = {
    chart: document.getElementById("chart-view"),
    characters: document.getElementById("characters-view"),
    terms: document.getElementById("terms-view")
  };
  els.accessBadge = document.getElementById("access-badge");
  els.editToggleWrap = document.getElementById("edit-toggle-wrap");
  els.editToggle = document.getElementById("edit-toggle");
  els.importButton = document.getElementById("import-button");
  els.importInput = document.getElementById("import-input");
  els.exportButton = document.getElementById("export-button");
  els.sidePanel = document.getElementById("side-panel");
  els.sidePanelToggle = document.getElementById("side-panel-toggle");
  els.editOnly = Array.from(document.querySelectorAll(".edit-only"));
  els.chartSearch = document.getElementById("chart-search");
  els.searchResults = document.getElementById("search-results");
  els.relationLegend = document.getElementById("relation-legend");
  els.toolButtons = Array.from(document.querySelectorAll(".tool-button"));
  els.placementEditor = document.getElementById("placement-editor");
  els.relationEditor = document.getElementById("relation-editor");
  els.placeCharacterSelect = document.getElementById("place-character-select");
  els.placeCharacterButton = document.getElementById("place-character-button");
  els.groupNameInput = document.getElementById("group-name-input");
  els.addGroupButton = document.getElementById("add-group-button");
  els.deleteSelectedButton = document.getElementById("delete-selected-button");
  els.relationDraftStatus = document.getElementById("relation-draft-status");
  els.relationTypeSelect = document.getElementById("relation-type-select");
  els.relationLabelInput = document.getElementById("relation-label-input");
  els.relationColorInput = document.getElementById("relation-color-input");
  els.relationLineTypeSelect = document.getElementById("relation-line-type-select");
  els.relationDirectionSelect = document.getElementById("relation-direction-select");
  els.createRelationButton = document.getElementById("create-relation-button");
  els.selectedEditor = document.getElementById("selected-editor");
  els.chartStatus = document.getElementById("chart-status");
  els.chartViewport = document.getElementById("chart-viewport");
  els.chartBoard = document.getElementById("chart-board");
  els.zoomLabel = document.getElementById("zoom-label");
  els.zoomOutButton = document.getElementById("zoom-out-button");
  els.zoomInButton = document.getElementById("zoom-in-button");
  els.fitButton = document.getElementById("fit-button");
  els.detailPanel = document.getElementById("detail-panel");
  els.clearSelectionButton = document.getElementById("clear-selection-button");
  els.detailContent = document.getElementById("detail-content");
  els.characterSearch = document.getElementById("character-search");
  els.characterGrid = document.getElementById("character-grid");
  els.characterForm = document.getElementById("character-form");
  els.characterIdInput = document.getElementById("character-id-input");
  els.characterNameInput = document.getElementById("character-name-input");
  els.characterDisplayInput = document.getElementById("character-display-input");
  els.characterImageInput = document.getElementById("character-image-input");
  els.characterImageFileInput = document.getElementById("character-image-file-input");
  els.characterImageButton = document.getElementById("character-image-button");
  els.characterImageClearButton = document.getElementById("character-image-clear-button");
  els.characterImagePreview = document.getElementById("character-image-preview");
  els.characterCropper = document.getElementById("character-cropper");
  els.characterCropFrame = document.getElementById("character-crop-frame");
  els.characterCropImage = document.getElementById("character-crop-image");
  els.characterCropZoom = document.getElementById("character-crop-zoom");
  els.characterCropX = document.getElementById("character-crop-x");
  els.characterCropY = document.getElementById("character-crop-y");
  els.characterCropApplyButton = document.getElementById("character-crop-apply-button");
  els.characterCropCancelButton = document.getElementById("character-crop-cancel-button");
  els.characterUrlInput = document.getElementById("character-url-input");
  els.characterAffiliationsInput = document.getElementById("character-affiliations-input");
  els.characterTagsInput = document.getElementById("character-tags-input");
  els.characterDescriptionInput = document.getElementById("character-description-input");
  els.characterMemoInput = document.getElementById("character-memo-input");
  els.newCharacterButton = document.getElementById("new-character-button");
  els.deleteCharacterButton = document.getElementById("delete-character-button");
  els.termSearch = document.getElementById("term-search");
  els.termCategoryFilter = document.getElementById("term-category-filter");
  els.termList = document.getElementById("term-list");
  els.termForm = document.getElementById("term-form");
  els.termIdInput = document.getElementById("term-id-input");
  els.termNameInput = document.getElementById("term-name-input");
  els.termCategoryInput = document.getElementById("term-category-input");
  els.termDescriptionInput = document.getElementById("term-description-input");
  els.termUrlInput = document.getElementById("term-url-input");
  els.termMemoInput = document.getElementById("term-memo-input");
  els.newTermButton = document.getElementById("new-term-button");
  els.deleteTermButton = document.getElementById("delete-term-button");
  els.toast = document.getElementById("toast");
  els.emptyTemplate = document.getElementById("empty-template");
}

function bindEvents() {
  els.tabs.forEach((button) => {
    button.addEventListener("click", () => setActiveTab(button.dataset.tab));
  });

  els.editToggle.addEventListener("change", () => {
    if (!state.canEdit) return;
    state.editMode = els.editToggle.checked;
    state.relationSource = null;
    state.relationTarget = null;
    state.detailEntity = null;
    closeDetail();
    updateEditUi();
    renderAll();
  });

  els.importButton.addEventListener("click", chooseJsonFile);
  els.sidePanelToggle.addEventListener("click", toggleSidePanel);
  els.exportButton.addEventListener("click", exportJson);
  els.importInput.addEventListener("change", importJson);
  els.chartSearch.addEventListener("input", renderSearchResults);
  els.characterSearch.addEventListener("input", renderCharacterGrid);
  els.termSearch.addEventListener("input", renderTermList);
  els.termCategoryFilter.addEventListener("change", renderTermList);

  els.toolButtons.forEach((button) => {
    button.addEventListener("click", () => {
      state.tool = button.dataset.tool;
      state.relationSource = null;
      state.relationTarget = null;
      updateEditUi();
      renderChart();
    });
  });

  els.placeCharacterButton.addEventListener("click", placeCharacterAtCenter);
  els.addGroupButton.addEventListener("click", addGroupFromInput);
  els.deleteSelectedButton.addEventListener("click", deleteSelected);
  els.relationTypeSelect.addEventListener("change", applyRelationTypeDefaults);
  els.createRelationButton.addEventListener("click", createRelationFromDraft);
  els.zoomOutButton.addEventListener("click", () => setScale(state.scale - 0.1));
  els.zoomInButton.addEventListener("click", () => setScale(state.scale + 0.1));
  els.fitButton.addEventListener("click", () => fitChart(true, true));
  els.chartViewport.addEventListener("pointerdown", startChartPan);
  els.chartViewport.addEventListener("touchstart", startChartPinch, { passive: false, capture: true });
  els.chartViewport.addEventListener("touchmove", moveChartPinch, { passive: false, capture: true });
  els.chartViewport.addEventListener("touchend", endChartPinch);
  els.chartViewport.addEventListener("touchcancel", endChartPinch);
  els.chartBoard.addEventListener("click", (event) => {
    if (!event.target.closest("[data-entity-type]")) {
      clearSelection();
    }
  });
  els.clearSelectionButton.addEventListener("click", () => {
    clearSelection();
  });
  els.detailPanel.addEventListener("click", (event) => {
    if (event.target === els.detailPanel) {
      clearSelection();
    }
  });

  els.characterForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveCharacterForm();
  });
  els.newCharacterButton.addEventListener("click", startNewCharacter);
  els.deleteCharacterButton.addEventListener("click", deleteEditingCharacter);
  els.characterImageButton.addEventListener("click", () => els.characterImageFileInput.click());
  els.characterImageFileInput.addEventListener("change", handleCharacterImageFile);
  els.characterImageClearButton.addEventListener("click", clearCharacterImage);
  els.characterCropApplyButton.addEventListener("click", applyCharacterCrop);
  els.characterCropCancelButton.addEventListener("click", closeCharacterCropper);
  els.characterCropZoom.addEventListener("input", updateCharacterCropPreview);
  els.characterCropX.addEventListener("input", updateCharacterCropPreview);
  els.characterCropY.addEventListener("input", updateCharacterCropPreview);
  els.characterCropFrame.addEventListener("pointerdown", startCharacterCropDrag);

  els.termForm.addEventListener("submit", (event) => {
    event.preventDefault();
    saveTermForm();
  });
  els.newTermButton.addEventListener("click", startNewTerm);
  els.deleteTermButton.addEventListener("click", deleteEditingTerm);

  window.addEventListener("resize", () => {
    if (state.activeTab === "chart" && !state.manualScale && !state.chartPinch) fitChart(false, false);
  });
}

function isLocalEditingHost() {
  const host = window.location.hostname;
  return window.location.protocol === "file:" || host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "";
}

function updateAccessUi() {
  if (!state.canEdit) state.editMode = false;
  els.accessBadge.textContent = state.canEdit ? "編集可能版" : "閲覧専用";
  els.accessBadge.hidden = !state.canEdit;
  els.sidePanelToggle.textContent = state.canEdit ? "検索・凡例・編集" : "検索・凡例";
  els.editToggleWrap.hidden = !state.canEdit;
  els.importButton.hidden = !state.canEdit;
  updateEditUi();
}

function updateEditUi() {
  els.editToggle.checked = state.editMode;
  if (state.editMode) state.sidePanelOpen = true;
  if (state.editMode) {
    state.detailEntity = null;
    closeDetail();
  }
  updateSidePanelUi();
  els.editOnly.forEach((el) => {
    el.hidden = !(state.canEdit && state.editMode);
  });
  els.toolButtons.forEach((button) => {
    button.classList.toggle("is-active", button.dataset.tool === state.tool);
  });
  els.placementEditor.hidden = state.tool !== "move";
  els.relationEditor.hidden = state.tool !== "relation";
  const selectedExists = Boolean(state.selected);
  els.deleteSelectedButton.disabled = !(state.editMode && selectedExists);
  renderRelationDraftStatus();
}

function toggleSidePanel() {
  state.sidePanelOpen = !state.sidePanelOpen;
  updateSidePanelUi();
}

function updateSidePanelUi() {
  els.sidePanel.classList.toggle("is-collapsed", !state.sidePanelOpen);
  els.sidePanelToggle.setAttribute("aria-expanded", String(state.sidePanelOpen));
}

function setActiveTab(tab) {
  state.activeTab = tab;
  els.tabs.forEach((button) => button.classList.toggle("is-active", button.dataset.tab === tab));
  Object.entries(els.views).forEach(([key, view]) => view.classList.toggle("is-active", key === tab));
  if (tab === "chart" && !state.manualScale) {
    requestAnimationFrame(() => fitChart(false, false));
  }
}

async function loadInitialData() {
  if (state.canEdit) {
    const stored = loadStoredData();
    if (stored) {
      persistData(stored);
      return stored;
    }
  }

  if (window.location.protocol !== "file:") {
    try {
      const response = await fetch(`${DEFAULT_DATA_URL}?t=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = normalizeData(await response.json());
      if (state.canEdit) persistData(data);
      return data;
    } catch (error) {
      console.error(error);
    }
  }

  const legacyCharacters = await loadLegacyIndexedDbCharacters();
  if (legacyCharacters.length) {
    const data = normalizeData({ schemaVersion: 1, characters: legacyCharacters });
    if (state.canEdit) persistData(data);
    return data;
  }

  return normalizeData({ schemaVersion: 2, characters: [] });
}

function loadStoredData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeData(JSON.parse(raw)) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function persistData(data = state.data) {
  if (!state.canEdit) return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(createExportPayload(data)));
}

function loadLegacyIndexedDbCharacters() {
  return new Promise((resolve) => {
    if (!window.indexedDB) {
      resolve([]);
      return;
    }

    const request = indexedDB.open(LEGACY_DB_NAME);
    request.onerror = () => resolve([]);
    request.onupgradeneeded = () => {
      request.transaction.abort();
      resolve([]);
    };
    request.onsuccess = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(LEGACY_STORE_NAME)) {
        db.close();
        resolve([]);
        return;
      }
      const tx = db.transaction(LEGACY_STORE_NAME, "readonly");
      const getAll = tx.objectStore(LEGACY_STORE_NAME).getAll();
      getAll.onsuccess = () => resolve(getAll.result || []);
      getAll.onerror = () => resolve([]);
      tx.oncomplete = () => db.close();
    };
  });
}

function createEmptyData() {
  return {
    schemaVersion: 2,
    characters: [],
    groups: [],
    relationships: [],
    relationTypes: DEFAULT_RELATION_TYPES.map((item) => ({ ...item })),
    terms: [],
    layout: { characters: {} },
    updatedAt: new Date().toISOString()
  };
}

function normalizeData(payload) {
  const data = createEmptyData();
  const sourceCharacters = Array.isArray(payload) ? payload : payload?.characters || [];
  data.characters = sourceCharacters.map(normalizeCharacter).sort(compareByDisplayName);
  data.relationTypes = normalizeRelationTypes(payload?.relationTypes);
  data.groups = normalizeGroups(payload?.groups, data.characters);
  data.relationships = normalizeRelationships(payload, data);
  data.terms = normalizeTerms(payload?.terms);
  data.layout = {
    characters: normalizeCharacterLayout(payload?.layout?.characters, data.characters)
  };

  for (const character of data.characters) {
    if (character.position) {
      data.layout.characters[character.id] = sanitizePosition(character.position);
    }
  }

  data.updatedAt = payload?.updatedAt || payload?.exportedAt || new Date().toISOString();
  ensureDataLayout(data);
  return data;
}

function normalizeCharacter(character) {
  const id = character?.id || createId("character");
  const name = String(character?.name || character?.displayName || "名称未設定").trim() || "名称未設定";
  const displayName = String(character?.displayName || name).trim() || name;
  return {
    id,
    name,
    displayName,
    image: character?.image || character?.icon || "",
    url: character?.url || "",
    description: character?.description || "",
    affiliations: cleanStringList(character?.affiliations),
    tags: cleanStringList(character?.tags),
    memo: character?.memo || "",
    chartVisible: character?.chartVisible !== false,
    position: character?.position ? sanitizePosition(character.position) : null
  };
}

function normalizeRelationTypes(relationTypes) {
  const byId = new Map(DEFAULT_RELATION_TYPES.map((item) => [item.id, { ...item }]));
  const byName = new Map(DEFAULT_RELATION_TYPES.map((item) => [item.name, item.id]));
  if (Array.isArray(relationTypes)) {
    relationTypes.forEach((item) => {
      if (!item?.id && !item?.name) return;
      const id = safeId(item.id || item.name, "relationType");
      const name = String(item.name || id);
      const sameNameId = byName.get(name);
      if (sameNameId && sameNameId !== id) {
        const existing = byId.get(sameNameId);
        if (existing) {
          existing.defaultColor = existing.defaultColor || item.defaultColor || item.color || "#2563eb";
          existing.defaultLineType = existing.defaultLineType || item.defaultLineType || item.lineType || "solid";
          existing.description = existing.description || item.description || "";
        }
        return;
      }
      byId.set(id, {
        id,
        name,
        defaultColor: item.defaultColor || item.color || "#2563eb",
        defaultLineType: item.defaultLineType || item.lineType || "solid",
        description: item.description || ""
      });
      byName.set(name, id);
    });
  }
  return Array.from(byId.values());
}

function normalizeGroups(groups, characters) {
  const normalized = [];
  const seen = new Set();
  if (Array.isArray(groups)) {
    groups.forEach((group, index) => {
      const name = String(group?.name || "所属").trim();
      if (!name) return;
      const id = group.id || groupIdFromName(name);
      seen.add(id);
      normalized.push({
        id,
        name,
        color: group.color || GROUP_COLORS[index % GROUP_COLORS.length],
        description: group.description || "",
        position: group.position ? sanitizePosition(group.position) : null,
        size: group.size ? sanitizeSize(group.size) : null,
        manualSize: group.manualSize ? sanitizeSize(group.manualSize) : null,
        memo: group.memo || ""
      });
    });
  }

  const names = new Set();
  characters.forEach((character) => character.affiliations.forEach((name) => names.add(name)));
  Array.from(names).sort(COLLATOR.compare).forEach((name) => {
    const id = groupIdFromName(name);
    if (seen.has(id)) return;
    seen.add(id);
    normalized.push({
      id,
      name,
      color: GROUP_COLORS[normalized.length % GROUP_COLORS.length],
      description: "",
      position: null,
      size: null,
      memo: ""
    });
  });
  return normalized;
}

function normalizeRelationships(payload, data) {
  const relationTypes = new Map(data.relationTypes.map((item) => [item.id, item]));
  const relationships = [];
  const sourceRelationships = Array.isArray(payload?.relationships) ? payload.relationships : [];

  sourceRelationships.forEach((relationship) => {
    const normalized = normalizeRelationship(relationship, relationTypes);
    if (normalized && entityExists(normalized.from, data) && entityExists(normalized.to, data)) {
      relationships.push(normalized);
    }
  });

  const legacyCharacters = Array.isArray(payload) ? payload : payload?.characters || [];
  legacyCharacters.forEach((character) => {
    const sourceId = character.id;
    (character.relationships || []).forEach((legacy) => {
      const targetId = legacy.targetId;
      if (!sourceId || !targetId) return;
      const label = legacy.label || "";
      const relationTypeId = guessRelationType(label);
      const relationType = relationTypes.get(relationTypeId) || relationTypes.get("trust");
      const normalized = {
        id: legacy.id || createId("relationship"),
        from: { type: "character", id: sourceId },
        to: { type: "character", id: targetId },
        relationTypeId,
        label: label || relationType.name,
        color: legacy.color || relationType.defaultColor,
        lineType: legacy.lineType || relationType.defaultLineType,
        direction: legacy.direction || "forward",
        memo: legacy.memo || ""
      };
      if (entityExists(normalized.from, data) && entityExists(normalized.to, data)) {
        relationships.push(normalized);
      }
    });
  });

  return dedupeRelationships(relationships);
}

function normalizeRelationship(relationship, relationTypes) {
  if (!relationship?.from || !relationship?.to) return null;
  const relationTypeId = relationship.relationTypeId || guessRelationType(relationship.label || "");
  const relationType = relationTypes.get(relationTypeId) || relationTypes.get("trust") || DEFAULT_RELATION_TYPES[0];
  return {
    id: relationship.id || createId("relationship"),
    from: normalizeEndpoint(relationship.from),
    to: normalizeEndpoint(relationship.to),
    relationTypeId,
    label: relationship.label || relationType.name,
    color: relationship.color || relationType.defaultColor,
    lineType: relationship.lineType || relationType.defaultLineType,
    direction: relationship.direction || "forward",
    memo: relationship.memo || ""
  };
}

function normalizeEndpoint(endpoint) {
  return {
    type: endpoint.type === "group" ? "group" : "character",
    id: endpoint.id
  };
}

function normalizeTerms(terms) {
  if (!Array.isArray(terms)) return [];
  return terms.map((term) => ({
    id: term.id || createId("term"),
    term: String(term.term || term.name || "名称未設定").trim() || "名称未設定",
    description: term.description || "",
    category: term.category || "その他",
    url: term.url || "",
    memo: term.memo || ""
  })).sort((a, b) => COLLATOR.compare(a.term, b.term));
}

function normalizeCharacterLayout(layout, characters) {
  const result = {};
  if (layout && typeof layout === "object") {
    characters.forEach((character) => {
      if (layout[character.id]) result[character.id] = sanitizePosition(layout[character.id]);
    });
  }
  return result;
}

function ensureDataLayout(data) {
  ensureGroupsForAffiliations(data);
  data.groups.forEach((group, index) => {
    if (!group.position) {
      const column = index % 2;
      const row = Math.floor(index / 2);
      group.position = {
        x: 54 + column * 610,
        y: 62 + row * 290
      };
    }
    if (!group.size) {
      group.size = { width: 520, height: 230 };
    }
    group.position.x = clamp(group.position.x, 0, BOARD_SIZE.width - 120);
    group.position.y = clamp(group.position.y, 0, BOARD_SIZE.height - 100);
    group.size.width = Math.max(group.size.width, 240);
    group.size.height = Math.max(group.size.height, 170);
  });

  const groupSlots = new Map();
  getChartCharacters(data).forEach((character, index) => {
    if (data.layout.characters[character.id]) return;
    const group = findPrimaryGroup(character, data);
    if (group) {
      const used = groupSlots.get(group.id) || 0;
      groupSlots.set(group.id, used + 1);
      const columns = Math.max(1, Math.floor((group.size.width - 80) / 150));
      data.layout.characters[character.id] = {
        x: group.position.x + 34 + (used % columns) * 150,
        y: group.position.y + 54 + Math.floor(used / columns) * 160
      };
      return;
    }
    data.layout.characters[character.id] = {
      x: 72 + (index % 5) * 160,
      y: 80 + Math.floor(index / 5) * 170
    };
  });

  getChartCharacters(data).forEach((character) => {
    const position = data.layout.characters[character.id];
    position.x = clamp(position.x, 0, BOARD_SIZE.width - NODE_SIZE.width);
    position.y = clamp(position.y, 0, BOARD_SIZE.height - NODE_SIZE.height);
  });

  autoShapeGroups(data);
}

function autoShapeGroups(data) {
  data.groups.forEach((group) => {
    const members = getChartCharacters(data).filter((character) => character.affiliations.includes(group.name));
    if (!members.length) return;

    const boxes = members
      .map((character) => data.layout.characters[character.id])
      .filter(Boolean)
      .map((position) => ({
        left: position.x,
        top: position.y,
        right: position.x + NODE_SIZE.width,
        bottom: position.y + NODE_SIZE.height
      }));
    if (!boxes.length) return;

    const paddingX = 46;
    const paddingTop = 54;
    const paddingBottom = 36;
    const minWidth = group.manualSize?.width || 240;
    const minHeight = group.manualSize?.height || 170;
    const left = Math.min(...boxes.map((box) => box.left));
    const top = Math.min(...boxes.map((box) => box.top));
    const right = Math.max(...boxes.map((box) => box.right));
    const bottom = Math.max(...boxes.map((box) => box.bottom));
    const contentWidth = right - left + paddingX * 2;
    const contentHeight = bottom - top + paddingTop + paddingBottom;

    group.position = {
      x: clamp(left - paddingX, 0, BOARD_SIZE.width - 120),
      y: clamp(top - paddingTop, 0, BOARD_SIZE.height - 100)
    };
    group.size = {
      width: Math.max(minWidth, contentWidth),
      height: Math.max(minHeight, contentHeight)
    };
  });
}

function ensureGroupsForAffiliations(data) {
  const known = new Map(data.groups.map((group) => [group.name, group]));
  data.characters.forEach((character) => {
    character.affiliations.forEach((name) => {
      if (known.has(name)) return;
      const group = {
        id: groupIdFromName(name),
        name,
        color: GROUP_COLORS[data.groups.length % GROUP_COLORS.length],
        description: "",
        position: null,
        size: null,
        manualSize: null,
        memo: ""
      };
      data.groups.push(group);
      known.set(name, group);
    });
  });
}

function renderAll() {
  updateEditUi();
  renderRelationTypeOptions();
  renderPlaceCharacterOptions();
  renderLegend();
  renderChart();
  renderSearchResults();
  renderDetail();
  renderSelectedEditor();
  renderCharacterGrid();
  renderCharacterForm();
  renderTermCategoryFilter();
  renderTermList();
  renderTermForm();
}

function renderRelationTypeOptions() {
  const current = els.relationTypeSelect.value;
  els.relationTypeSelect.innerHTML = state.data.relationTypes
    .map((type) => `<option value="${escapeHtml(type.id)}">${escapeHtml(type.name)}</option>`)
    .join("") + "<option value=\"custom\">新規作成</option>";
  els.relationTypeSelect.value = current || state.data.relationTypes[0]?.id || "custom";
  applyRelationTypeDefaults(false);
}

function renderPlaceCharacterOptions() {
  const candidates = state.data.characters.filter((character) => !character.chartVisible);
  els.placeCharacterSelect.innerHTML = candidates
    .map((character) => `<option value="${escapeHtml(character.id)}">${escapeHtml(displayName(character))}</option>`)
    .join("");
  els.placeCharacterButton.disabled = !candidates.length;
}

function renderLegend() {
  els.relationLegend.innerHTML = "";
  if (!state.data.relationTypes.length) {
    els.relationLegend.appendChild(createEmptyState());
    return;
  }
  els.relationLegend.innerHTML = state.data.relationTypes.map((type) => `
    <div class="legend-item">
      <span class="legend-line ${escapeHtml(type.defaultLineType)}" style="border-color:${escapeHtml(type.defaultColor)}"></span>
      <span>${escapeHtml(type.name)}</span>
    </div>
  `).join("");
}

function renderChart() {
  ensureDataLayout(state.data);
  els.chartBoard.innerHTML = "";
  els.chartBoard.style.width = `${BOARD_SIZE.width}px`;
  els.chartBoard.style.height = `${BOARD_SIZE.height}px`;
  els.chartBoard.classList.toggle("has-selection", Boolean(state.selected));
  els.chartBoard.classList.toggle("has-relation-source", Boolean(state.relationSource));
  els.chartStatus.hidden = !state.canEdit;
  if (state.canEdit) {
    els.chartStatus.textContent = state.editMode ? `編集中：${state.tool === "move" ? "配置" : "関係線"}` : "閲覧モード";
  }

  const svg = createSvgElement("svg", {
    class: "chart-lines",
    width: BOARD_SIZE.width,
    height: BOARD_SIZE.height,
    viewBox: `0 0 ${BOARD_SIZE.width} ${BOARD_SIZE.height}`
  });
  const defs = createSvgElement("defs");
  svg.appendChild(defs);

  state.data.groups.forEach((group) => els.chartBoard.appendChild(createGroupElement(group)));
  getChartRelationships().forEach((relationship) => drawRelationship(svg, defs, relationship));
  els.chartBoard.appendChild(svg);
  getChartCharacters().forEach((character) => els.chartBoard.appendChild(createCharacterNode(character)));
  applySelectionClasses();
  applyScale();
}

function createGroupElement(group) {
  const box = document.createElement("div");
  box.className = "group-box";
  box.dataset.entityType = "group";
  box.dataset.entityId = group.id;
  box.style.left = `${group.position.x}px`;
  box.style.top = `${group.position.y}px`;
  box.style.width = `${group.size.width}px`;
  box.style.height = `${group.size.height}px`;
  box.style.setProperty("--group-color", group.color);
  box.classList.toggle("is-editing", state.editMode && state.tool === "move");
  if (isSelected("group", group.id)) box.classList.add("is-selected");
  if (isRelationSource("group", group.id)) box.classList.add("is-source");
  if (state.relationSource && canConnectRelationTarget(state.relationSource, { type: "group", id: group.id })) {
    box.classList.add("is-connectable");
  }

  const label = document.createElement("div");
  label.className = "group-name";
  label.textContent = group.name;
  box.appendChild(label);

  box.addEventListener("pointerdown", (event) => startDrag(event, "group", group.id));
  box.addEventListener("click", (event) => handleEntityClick(event, "group", group.id));
  return box;
}

function createCharacterNode(character) {
  const position = state.data.layout.characters[character.id];
  const node = document.createElement("button");
  node.type = "button";
  node.className = "chart-node";
  node.dataset.entityType = "character";
  node.dataset.entityId = character.id;
  node.style.left = `${position.x}px`;
  node.style.top = `${position.y}px`;
  node.classList.toggle("is-editing", state.editMode && state.tool === "move");
  if (isSelected("character", character.id)) node.classList.add("is-selected");
  if (isRelationSource("character", character.id)) node.classList.add("is-source");
  if (state.relationSource && canConnectRelationTarget(state.relationSource, { type: "character", id: character.id })) {
    node.classList.add("is-connectable");
  }

  node.innerHTML = `
    ${renderAvatar(character.image, "node-avatar", displayName(character))}
    <div class="node-name">${escapeHtml(displayName(character))}</div>
  `;

  node.addEventListener("pointerdown", (event) => startDrag(event, "character", character.id));
  node.addEventListener("click", (event) => handleEntityClick(event, "character", character.id));
  return node;
}

function drawRelationship(svg, defs, relationship) {
  const fromBounds = getEntityBounds(relationship.from);
  const toBounds = getEntityBounds(relationship.to);
  if (!fromBounds || !toBounds) return;

  const fromCenter = centerOf(fromBounds);
  const toCenter = centerOf(toBounds);
  const start = edgePoint(fromBounds, toCenter);
  const end = edgePoint(toBounds, fromCenter);
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  const markerId = `arrow-${relationship.id}`;
  const reverseMarkerId = `arrow-rev-${relationship.id}`;

  if (relationship.direction === "forward" || relationship.direction === "both") {
    defs.appendChild(createArrowMarker(markerId, relationship.color));
  }
  if (relationship.direction === "backward" || relationship.direction === "both") {
    defs.appendChild(createArrowMarker(reverseMarkerId, relationship.color));
  }

  const group = createSvgElement("g", {
    "data-entity-type": "relationship",
    "data-entity-id": relationship.id
  });
  const d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
  const hit = createSvgElement("path", { class: "relation-path-hit", d });
  const path = createSvgElement("path", {
    class: `relation-path ${relationship.lineType}`,
    d,
    stroke: relationship.color,
    "marker-end": relationship.direction === "forward" || relationship.direction === "both" ? `url(#${markerId})` : null,
    "marker-start": relationship.direction === "backward" || relationship.direction === "both" ? `url(#${reverseMarkerId})` : null
  });

  hit.addEventListener("click", (event) => {
    event.stopPropagation();
    handleRelationshipClick(relationship.id);
  });
  path.addEventListener("click", (event) => {
    event.stopPropagation();
    handleRelationshipClick(relationship.id);
  });

  group.append(hit, path);
  svg.appendChild(group);

  const label = document.createElement("button");
  label.type = "button";
  label.className = "relation-label";
  label.dataset.entityType = "relationship";
  label.dataset.entityId = relationship.id;
  label.style.left = `${mid.x}px`;
  label.style.top = `${mid.y}px`;
  label.style.color = relationship.color;
  label.textContent = relationship.label;
  label.addEventListener("click", () => handleRelationshipClick(relationship.id));
  els.chartBoard.appendChild(label);
}

function handleRelationshipClick(id) {
  state.selected = { type: "relationship", id };
  state.detailEntity = null;
  closeDetail();
  renderDetail();
  renderCharacterForm();
  renderTermForm();
  renderSelectedEditor();
  renderChart();
}

function createArrowMarker(id, color) {
  const marker = createSvgElement("marker", {
    id,
    viewBox: "0 0 10 10",
    refX: "8",
    refY: "5",
    markerWidth: "7",
    markerHeight: "7",
    orient: "auto-start-reverse"
  });
  marker.appendChild(createSvgElement("path", {
    d: "M 0 0 L 10 5 L 0 10 z",
    fill: color
  }));
  return marker;
}

function applySelectionClasses() {
  if (!state.selected) return;
  const related = getRelatedEntities(state.selected);
  const selector = "[data-entity-type][data-entity-id], [data-entity-type='relationship'][data-entity-id]";
  els.chartBoard.querySelectorAll(selector).forEach((element) => {
    const type = element.dataset.entityType;
    const id = element.dataset.entityId;
    const selected = state.selected?.type === type && state.selected?.id === id;
    const key = `${type}:${id}`;
    element.classList.toggle("is-selected", selected);
    element.classList.toggle("is-related", selected || related.has(key));
  });
}

function getRelatedEntities(entity) {
  const related = new Set();
  const groupMemberIds = entity.type === "group" ? getGroupMemberIds(entity.id) : null;
  if (groupMemberIds) {
    groupMemberIds.forEach((id) => related.add(`character:${id}`));
  }
  state.data.relationships.forEach((relationship) => {
    const fromKey = endpointKey(relationship.from);
    const toKey = endpointKey(relationship.to);
    const relKey = `relationship:${relationship.id}`;
    const selectedKey = `${entity.type}:${entity.id}`;
    if (entity.type === "relationship" && relationship.id === entity.id) {
      related.add(fromKey);
      related.add(toKey);
      related.add(relKey);
    }
    if (selectedKey === fromKey || selectedKey === toKey) {
      related.add(fromKey);
      related.add(toKey);
      related.add(relKey);
    }
    if (
      groupMemberIds &&
      relationship.from.type === "character" &&
      relationship.to.type === "character" &&
      groupMemberIds.has(relationship.from.id) &&
      groupMemberIds.has(relationship.to.id)
    ) {
      related.add(fromKey);
      related.add(toKey);
      related.add(relKey);
    }
  });
  return related;
}

function getGroupMemberIds(groupId) {
  const group = getGroup(groupId);
  if (!group) return new Set();
  return new Set(getChartCharacters()
    .filter((character) => character.affiliations.includes(group.name))
    .map((character) => character.id));
}

function handleEntityClick(event, type, id) {
  event.stopPropagation();
  if (state.justDragged) return;
  if (state.editMode && state.tool === "relation") {
    if (!state.relationSource) {
      state.relationSource = { type, id };
      state.relationTarget = null;
      state.selected = { type, id };
      renderRelationDraftStatus();
      renderChart();
      renderSelectedEditor();
      return;
    }
    if (state.relationSource.type === type && state.relationSource.id === id) {
      state.relationSource = null;
      state.relationTarget = null;
      state.selected = null;
      renderRelationDraftStatus();
      renderChart();
      renderSelectedEditor();
      return;
    }
    const target = { type, id };
    if (!canConnectRelationTarget(state.relationSource, target)) return;
    createRelationBetween(state.relationSource, target);
    return;
  }
  selectEntity(type, id, false, type === "character");
}

function selectEntity(type, id, shouldScroll = true, openDetail = true) {
  state.selected = { type, id };
  if (type === "character") state.characterEditingId = id;
  if (type === "term") state.termEditingId = id;
  if (openDetail && !state.editMode) {
    state.detailEntity = { type, id };
  } else {
    state.detailEntity = null;
    closeDetail();
  }
  renderDetail();
  renderCharacterForm();
  renderTermForm();
  renderSelectedEditor();
  renderChart();
  if (shouldScroll && (type === "character" || type === "group")) {
    scrollToEntity(type, id);
  }
}

function clearSelection() {
  state.selected = null;
  state.detailEntity = null;
  state.relationSource = null;
  state.relationTarget = null;
  closeDetail();
  renderChart();
  renderRelationDraftStatus();
  renderSelectedEditor();
}

function openDetail() {
  els.detailPanel.classList.add("is-open");
  els.detailPanel.setAttribute("aria-hidden", "false");
}

function closeDetail() {
  els.detailPanel.classList.remove("is-open");
  els.detailPanel.setAttribute("aria-hidden", "true");
}

function renderSearchResults() {
  const query = els.chartSearch.value.trim().toLowerCase();
  if (!query) {
    els.searchResults.innerHTML = "";
    return;
  }

  const characterMatches = getChartCharacters()
    .filter((character) => `${character.name} ${character.displayName}`.toLowerCase().includes(query))
    .map((character) => ({ type: "character", id: character.id, title: displayName(character), meta: "キャラ" }));
  const groupMatches = state.data.groups
    .filter((group) => group.name.toLowerCase().includes(query))
    .map((group) => ({ type: "group", id: group.id, title: group.name, meta: "所属" }));
  const matches = [...characterMatches, ...groupMatches].slice(0, 8);

  if (!matches.length) {
    els.searchResults.replaceChildren(createEmptyState());
    return;
  }

  els.searchResults.innerHTML = matches.map((item) => `
    <button type="button" class="search-result" data-type="${item.type}" data-id="${escapeHtml(item.id)}">
      <strong>${escapeHtml(item.title)}</strong>
      <span>${escapeHtml(item.meta)}</span>
    </button>
  `).join("");

  els.searchResults.querySelectorAll(".search-result").forEach((button) => {
    button.addEventListener("click", () => selectEntity(button.dataset.type, button.dataset.id, true, button.dataset.type === "character"));
  });
}

function renderDetail() {
  const selected = state.detailEntity;
  if (!selected) {
    els.detailContent.replaceChildren(createEmptyState());
    closeDetail();
    return;
  }
  if (state.editMode) {
    closeDetail();
    return;
  }
  openDetail();
  if (selected.type === "character") renderCharacterDetail(selected.id);
  if (selected.type === "group") renderGroupDetail(selected.id);
  if (selected.type === "relationship") renderRelationshipDetail(selected.id);
}

function renderCharacterDetail(id) {
  const character = getCharacter(id);
  if (!character) {
    els.detailContent.replaceChildren(createEmptyState());
    return;
  }
  const relations = getCharacterRelations(id);
  els.detailContent.innerHTML = `
    <div class="detail-head">
      ${renderAvatar(character.image, "detail-avatar", displayName(character))}
      <div>
        <div class="detail-name">${escapeHtml(displayName(character))}</div>
        <div class="detail-meta">${escapeHtml(character.affiliations.join(" / ") || "所属なし")}</div>
        <div class="chip-row">${renderChips(character.tags.concat(character.affiliations), 6)}</div>
      </div>
    </div>
    ${character.url ? `
      <section class="detail-section">
        <h3>リンク</h3>
        <p><a class="text-link" href="${escapeAttribute(character.url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(character.url)}</a></p>
      </section>
    ` : ""}
    <section class="detail-section">
      <h3>説明</h3>
      <p>${escapeHtml(character.description || "未設定")}</p>
    </section>
    <section class="detail-section">
      <h3>関係一覧</h3>
      ${renderRelationRows(relations)}
    </section>
    <section class="detail-section">
      <h3>メモ</h3>
      <p>${escapeHtml(character.memo || "未設定")}</p>
    </section>
  `;
  bindRelationRows();
}

function renderGroupDetail(id) {
  const group = getGroup(id);
  if (!group) {
    els.detailContent.replaceChildren(createEmptyState());
    return;
  }
  const members = getChartCharacters().filter((character) => character.affiliations.includes(group.name));
  els.detailContent.innerHTML = `
    <div class="detail-head">
      <div class="detail-avatar" style="color:${escapeHtml(group.color)};background:${escapeHtml(group.color)}22">${escapeHtml(group.name.slice(0, 2))}</div>
      <div>
        <div class="detail-name">${escapeHtml(group.name)}</div>
        <div class="detail-meta">${members.length}人</div>
      </div>
    </div>
    <section class="detail-section">
      <h3>説明</h3>
      <p>${escapeHtml(group.description || "未設定")}</p>
    </section>
    <section class="detail-section">
      <h3>所属キャラ</h3>
      <div class="relation-list">
        ${members.map((member) => `
          <button type="button" class="relation-row" data-type="character" data-id="${escapeHtml(member.id)}">
            <span class="relation-dot" style="background:${escapeHtml(group.color)}"></span>
            <strong>${escapeHtml(displayName(member))}</strong>
            <span>詳細</span>
          </button>
        `).join("") || "<div class=\"empty-state\">該当なし</div>"}
      </div>
    </section>
    ${state.editMode ? renderGroupEditFields(group) : ""}
  `;
  bindRelationRows();
  bindGroupDetailInputs(group);
}

function renderGroupEditFields(group) {
  return `
    <section class="detail-section editor-stack">
      <h3>編集</h3>
      <label class="field">
        <span>グループ名</span>
        <input id="detail-group-name" type="text" value="${escapeHtml(group.name)}">
      </label>
      <label class="field">
        <span>色</span>
        <input id="detail-group-color" type="color" value="${escapeHtml(group.color)}">
      </label>
      <div class="form-grid compact">
        <label class="field">
          <span>幅</span>
          <input id="detail-group-width" type="number" min="240" value="${Math.round(group.manualSize?.width || group.size.width)}">
        </label>
        <label class="field">
          <span>高さ</span>
          <input id="detail-group-height" type="number" min="170" value="${Math.round(group.manualSize?.height || group.size.height)}">
        </label>
      </div>
      <label class="field">
        <span>説明</span>
        <textarea id="detail-group-description" rows="3">${escapeHtml(group.description)}</textarea>
      </label>
      <label class="field">
        <span>メモ</span>
        <textarea id="detail-group-memo" rows="3">${escapeHtml(group.memo)}</textarea>
      </label>
    </section>
  `;
}

function bindGroupDetailInputs(group) {
  if (!state.editMode) return;
  const name = document.getElementById("detail-group-name");
  const color = document.getElementById("detail-group-color");
  const width = document.getElementById("detail-group-width");
  const height = document.getElementById("detail-group-height");
  const description = document.getElementById("detail-group-description");
  const memo = document.getElementById("detail-group-memo");
  [name, color, width, height, description, memo].forEach((input) => {
    input?.addEventListener("change", () => {
      const oldName = group.name;
      const nextName = name.value.trim() || oldName;
      group.name = nextName;
      if (oldName !== nextName) {
        state.data.characters.forEach((character) => {
          character.affiliations = character.affiliations.map((affiliation) => affiliation === oldName ? nextName : affiliation);
        });
      }
      group.color = color.value;
      group.manualSize = {
        width: Math.max(Number(width.value) || group.size.width, 240),
        height: Math.max(Number(height.value) || group.size.height, 170)
      };
      group.size.width = group.manualSize.width;
      group.size.height = group.manualSize.height;
      group.description = description.value;
      group.memo = memo.value;
      saveAndRender();
    });
  });
}

function renderRelationshipDetail(id) {
  const relationship = getRelationship(id);
  if (!relationship) {
    els.detailContent.replaceChildren(createEmptyState());
    return;
  }
  const from = entityLabel(relationship.from);
  const to = entityLabel(relationship.to);
  els.detailContent.innerHTML = `
    <div class="detail-section" style="border-top:0;padding-top:0">
      <h3>${escapeHtml(relationship.label)}</h3>
      <p>${escapeHtml(from)} ${directionText(relationship.direction)} ${escapeHtml(to)}</p>
    </div>
    <section class="detail-section">
      <h3>設定</h3>
      <div class="relation-list">
        <div class="relation-row">
          <span class="relation-dot" style="background:${escapeHtml(relationship.color)}"></span>
          <strong>${escapeHtml(relationTypeName(relationship.relationTypeId))}</strong>
          <span>${escapeHtml(lineTypeName(relationship.lineType))}</span>
        </div>
      </div>
    </section>
    <section class="detail-section">
      <h3>メモ</h3>
      <p>${escapeHtml(relationship.memo || "未設定")}</p>
    </section>
    ${state.editMode ? `
      <section class="detail-section editor-stack">
        <h3>編集</h3>
        <label class="field">
          <span>関係設定</span>
          <select id="detail-relation-type">
            ${state.data.relationTypes.map((type) => `
              <option value="${escapeHtml(type.id)}" ${type.id === relationship.relationTypeId ? "selected" : ""}>${escapeHtml(type.name)}</option>
            `).join("")}
          </select>
        </label>
        <label class="field">
          <span>ラベル</span>
          <input id="detail-relation-label" type="text" value="${escapeHtml(relationship.label)}">
        </label>
        <div class="form-grid compact">
          <label class="field">
            <span>色</span>
            <input id="detail-relation-color" type="color" value="${escapeHtml(relationship.color)}">
          </label>
          <label class="field">
            <span>線のタイプ</span>
            <select id="detail-relation-line-type">
              <option value="solid" ${relationship.lineType === "solid" ? "selected" : ""}>実線</option>
              <option value="dashed" ${relationship.lineType === "dashed" ? "selected" : ""}>点線</option>
              <option value="bold" ${relationship.lineType === "bold" ? "selected" : ""}>太線</option>
            </select>
          </label>
        </div>
        <label class="field">
          <span>方向</span>
          <select id="detail-relation-direction">
            <option value="forward" ${relationship.direction === "forward" ? "selected" : ""}>A → B</option>
            <option value="backward" ${relationship.direction === "backward" ? "selected" : ""}>A ← B</option>
            <option value="both" ${relationship.direction === "both" ? "selected" : ""}>A ↔ B</option>
            <option value="none" ${relationship.direction === "none" ? "selected" : ""}>方向なし</option>
          </select>
        </label>
        <label class="field">
          <span>メモ</span>
          <textarea id="detail-relation-memo" rows="3">${escapeHtml(relationship.memo)}</textarea>
        </label>
        <button type="button" id="delete-relation-detail-button" class="danger-button">関係線を削除</button>
      </section>
    ` : ""}
  `;
  bindRelationshipDetailInputs(relationship);
  document.getElementById("delete-relation-detail-button")?.addEventListener("click", () => {
    state.data.relationships = state.data.relationships.filter((item) => item.id !== id);
    state.selected = null;
    saveAndRender();
  });
}

function bindRelationshipDetailInputs(relationship) {
  if (!state.editMode) return;
  const type = document.getElementById("detail-relation-type");
  const label = document.getElementById("detail-relation-label");
  const color = document.getElementById("detail-relation-color");
  const lineType = document.getElementById("detail-relation-line-type");
  const direction = document.getElementById("detail-relation-direction");
  const memo = document.getElementById("detail-relation-memo");

  type?.addEventListener("change", () => {
    const nextType = state.data.relationTypes.find((item) => item.id === type.value);
    if (!nextType) return;
    relationship.relationTypeId = nextType.id;
    relationship.label = nextType.name;
    relationship.color = nextType.defaultColor;
    relationship.lineType = nextType.defaultLineType;
    saveAndRender();
  });

  label?.addEventListener("change", () => {
    relationship.label = label.value.trim() || relationTypeName(relationship.relationTypeId);
    saveAndRender();
  });

  color?.addEventListener("change", () => {
    applyRelationStyleToType(relationship.relationTypeId, { color: color.value });
    saveAndRender();
  });

  lineType?.addEventListener("change", () => {
    applyRelationStyleToType(relationship.relationTypeId, { lineType: lineType.value });
    saveAndRender();
  });

  direction?.addEventListener("change", () => {
    relationship.direction = direction.value;
    saveAndRender();
  });

  memo?.addEventListener("change", () => {
    relationship.memo = memo.value.trim();
    saveAndRender();
  });
}

function renderSelectedEditor() {
  if (!els.selectedEditor) return;
  if (!state.editMode) {
    els.selectedEditor.innerHTML = "";
    return;
  }
  if (!state.selected) {
    els.selectedEditor.innerHTML = "<div class=\"empty-state\">未選択</div>";
    return;
  }

  if (state.selected.type === "group") {
    const group = getGroup(state.selected.id);
    if (!group) {
      els.selectedEditor.innerHTML = "<div class=\"empty-state\">未選択</div>";
      return;
    }
    els.selectedEditor.innerHTML = renderGroupEditFields(group);
    bindGroupDetailInputs(group);
    return;
  }

  if (state.selected.type === "relationship") {
    const relationship = getRelationship(state.selected.id);
    if (!relationship) {
      els.selectedEditor.innerHTML = "<div class=\"empty-state\">未選択</div>";
      return;
    }
    els.selectedEditor.innerHTML = renderRelationshipEditFields(relationship);
    bindRelationshipDetailInputs(relationship);
    document.getElementById("delete-relation-detail-button")?.addEventListener("click", () => {
      state.data.relationships = state.data.relationships.filter((item) => item.id !== relationship.id);
      state.selected = null;
      saveAndRender();
    });
    return;
  }

  els.selectedEditor.innerHTML = "<div class=\"empty-state\">キャラはドラッグで配置できます</div>";
}

function renderRelationshipEditFields(relationship) {
  return `
    <section class="detail-section editor-stack">
      <label class="field">
        <span>関係設定</span>
        <select id="detail-relation-type">
          ${state.data.relationTypes.map((type) => `
            <option value="${escapeHtml(type.id)}" ${type.id === relationship.relationTypeId ? "selected" : ""}>${escapeHtml(type.name)}</option>
          `).join("")}
        </select>
      </label>
      <label class="field">
        <span>ラベル</span>
        <input id="detail-relation-label" type="text" value="${escapeHtml(relationship.label)}">
      </label>
      <div class="form-grid compact">
        <label class="field">
          <span>色</span>
          <input id="detail-relation-color" type="color" value="${escapeHtml(relationship.color)}">
        </label>
        <label class="field">
          <span>線のタイプ</span>
          <select id="detail-relation-line-type">
            <option value="solid" ${relationship.lineType === "solid" ? "selected" : ""}>実線</option>
            <option value="dashed" ${relationship.lineType === "dashed" ? "selected" : ""}>点線</option>
            <option value="bold" ${relationship.lineType === "bold" ? "selected" : ""}>太線</option>
          </select>
        </label>
      </div>
      <label class="field">
        <span>方向</span>
        <select id="detail-relation-direction">
          <option value="forward" ${relationship.direction === "forward" ? "selected" : ""}>A → B</option>
          <option value="backward" ${relationship.direction === "backward" ? "selected" : ""}>A ← B</option>
          <option value="both" ${relationship.direction === "both" ? "selected" : ""}>A ↔ B</option>
          <option value="none" ${relationship.direction === "none" ? "selected" : ""}>方向なし</option>
        </select>
      </label>
      <label class="field">
        <span>メモ</span>
        <textarea id="detail-relation-memo" rows="3">${escapeHtml(relationship.memo)}</textarea>
      </label>
      <button type="button" id="delete-relation-detail-button" class="danger-button">関係線を削除</button>
    </section>
  `;
}

function applyRelationStyleToType(relationTypeId, patch) {
  const relationType = state.data.relationTypes.find((item) => item.id === relationTypeId);
  if (relationType) {
    if (patch.color) relationType.defaultColor = patch.color;
    if (patch.lineType) relationType.defaultLineType = patch.lineType;
  }
  state.data.relationships.forEach((relationship) => {
    if (relationship.relationTypeId !== relationTypeId) return;
    if (patch.color) relationship.color = patch.color;
    if (patch.lineType) relationship.lineType = patch.lineType;
  });
}

function renderRelationRows(relations) {
  if (!relations.length) return "<div class=\"empty-state\">該当なし</div>";
  return `
    <div class="relation-list">
      ${relations.map(({ relationship, other }) => `
        <button type="button" class="relation-row" data-type="relationship" data-id="${escapeHtml(relationship.id)}">
          <span class="relation-dot" style="background:${escapeHtml(relationship.color)}"></span>
          <strong>${escapeHtml(entityLabel(other))}</strong>
          <span>${escapeHtml(relationship.label)}</span>
        </button>
      `).join("")}
    </div>
  `;
}

function bindRelationRows() {
  els.detailContent.querySelectorAll(".relation-row[data-type][data-id]").forEach((button) => {
    button.addEventListener("click", () => selectEntity(button.dataset.type, button.dataset.id));
  });
}

function renderCharacterGrid() {
  const query = els.characterSearch.value.trim().toLowerCase();
  const characters = state.data.characters
    .filter((character) => `${character.name} ${character.displayName} ${character.url} ${character.affiliations.join(" ")} ${character.tags.join(" ")}`.toLowerCase().includes(query))
    .sort(compareByDisplayName);

  if (!characters.length) {
    els.characterGrid.replaceChildren(createEmptyState());
    return;
  }

  els.characterGrid.innerHTML = characters.map((character) => `
    <button type="button" class="character-card" data-id="${escapeHtml(character.id)}">
      ${renderAvatar(character.image, "character-avatar", displayName(character))}
      <span>
        <strong>${escapeHtml(displayName(character))}</strong>
        <p>${escapeHtml(character.description || character.affiliations.join(" / ") || "未設定")}</p>
      </span>
    </button>
  `).join("");

  els.characterGrid.querySelectorAll(".character-card").forEach((button) => {
    button.addEventListener("click", () => {
      state.characterEditingId = button.dataset.id;
      if (state.editMode) {
        state.detailEntity = null;
        closeDetail();
      } else {
        state.detailEntity = { type: "character", id: button.dataset.id };
      }
      renderCharacterForm();
      renderCharacterGrid();
      renderDetail();
    });
  });
}

function renderCharacterForm() {
  if (!state.canEdit || !state.editMode) return;
  const character = getCharacter(state.characterEditingId);
  const empty = {
    id: "",
    name: "",
    displayName: "",
    image: "",
    url: "",
    affiliations: [],
    tags: [],
    description: "",
    memo: ""
  };
  const item = character || empty;
  els.characterIdInput.value = item.id;
  els.characterNameInput.value = item.name;
  els.characterDisplayInput.value = item.displayName === item.name ? "" : item.displayName;
  els.characterImageInput.value = item.image;
  els.characterUrlInput.value = item.url;
  els.characterAffiliationsInput.value = item.affiliations.join(", ");
  els.characterTagsInput.value = item.tags.join(", ");
  els.characterDescriptionInput.value = item.description;
  els.characterMemoInput.value = item.memo;
  els.deleteCharacterButton.disabled = !character;
  closeCharacterCropper();
  renderCharacterImagePreview();
}

function renderCharacterImagePreview() {
  const src = els.characterImageInput.value.trim();
  els.characterImagePreview.innerHTML = src
    ? `<img src="${escapeAttribute(src)}" alt="">`
    : "<span>未設定</span>";
  els.characterImageClearButton.disabled = !src;
}

function handleCharacterImageFile() {
  const file = els.characterImageFileInput.files?.[0];
  els.characterImageFileInput.value = "";
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    showToast("画像ファイルを選択してください。");
    return;
  }
  const reader = new FileReader();
  reader.addEventListener("load", () => openCharacterCropper(String(reader.result || "")));
  reader.addEventListener("error", () => showToast("画像を読み込めませんでした。"));
  reader.readAsDataURL(file);
}

function openCharacterCropper(src) {
  if (!src) return;
  els.characterCropper.hidden = false;
  els.characterCropZoom.value = "1";
  els.characterCropX.value = "0";
  els.characterCropY.value = "0";
  els.characterCropImage.onload = () => {
    state.characterCrop = {
      image: els.characterCropImage,
      zoom: 1,
      x: 0,
      y: 0,
      dragging: null
    };
    updateCharacterCropPreview();
  };
  els.characterCropImage.src = src;
}

function closeCharacterCropper() {
  state.characterCrop = null;
  if (els.characterCropper) els.characterCropper.hidden = true;
  if (els.characterCropImage) {
    els.characterCropImage.onload = null;
    els.characterCropImage.removeAttribute("src");
  }
}

function clearCharacterImage() {
  els.characterImageInput.value = "";
  closeCharacterCropper();
  renderCharacterImagePreview();
}

function updateCharacterCropPreview() {
  const crop = state.characterCrop;
  if (!crop?.image?.naturalWidth) return;
  const frame = getCropFrameMetrics();
  crop.zoom = Number(els.characterCropZoom.value) || 1;
  const maxX = Math.max(0, (frame.scaledWidth - frame.size) / 2);
  const maxY = Math.max(0, (frame.scaledHeight - frame.size) / 2);
  setRangeBounds(els.characterCropX, -maxX, maxX);
  setRangeBounds(els.characterCropY, -maxY, maxY);
  crop.x = clamp(Number(els.characterCropX.value) || 0, -maxX, maxX);
  crop.y = clamp(Number(els.characterCropY.value) || 0, -maxY, maxY);
  els.characterCropX.value = String(Math.round(crop.x));
  els.characterCropY.value = String(Math.round(crop.y));
  crop.image.style.width = `${frame.baseWidth}px`;
  crop.image.style.height = `${frame.baseHeight}px`;
  crop.image.style.transform = `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px)) scale(${crop.zoom})`;
}

function setRangeBounds(input, min, max) {
  input.min = String(Math.round(min));
  input.max = String(Math.round(max));
  input.disabled = Math.round(max - min) === 0;
}

function startCharacterCropDrag(event) {
  if (!state.characterCrop) return;
  event.preventDefault();
  els.characterCropFrame.setPointerCapture?.(event.pointerId);
  state.characterCrop.dragging = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    cropX: Number(els.characterCropX.value) || 0,
    cropY: Number(els.characterCropY.value) || 0
  };
  window.addEventListener("pointermove", moveCharacterCropDrag);
  window.addEventListener("pointerup", stopCharacterCropDrag, { once: true });
  window.addEventListener("pointercancel", stopCharacterCropDrag, { once: true });
}

function moveCharacterCropDrag(event) {
  const drag = state.characterCrop?.dragging;
  if (!drag || event.pointerId !== drag.pointerId) return;
  els.characterCropX.value = String(drag.cropX + event.clientX - drag.startX);
  els.characterCropY.value = String(drag.cropY + event.clientY - drag.startY);
  updateCharacterCropPreview();
}

function stopCharacterCropDrag(event) {
  if (state.characterCrop?.dragging?.pointerId === event.pointerId) {
    state.characterCrop.dragging = null;
  }
  window.removeEventListener("pointermove", moveCharacterCropDrag);
}

function applyCharacterCrop() {
  const crop = state.characterCrop;
  if (!crop?.image?.naturalWidth) return;
  updateCharacterCropPreview();
  const frame = getCropFrameMetrics();
  const scale = frame.baseScale * crop.zoom;
  const left = frame.size / 2 + crop.x - frame.scaledWidth / 2;
  const top = frame.size / 2 + crop.y - frame.scaledHeight / 2;
  const sourceX = clamp(-left / scale, 0, crop.image.naturalWidth);
  const sourceY = clamp(-top / scale, 0, crop.image.naturalHeight);
  const sourceSize = Math.min(frame.size / scale, crop.image.naturalWidth - sourceX, crop.image.naturalHeight - sourceY);
  const canvas = document.createElement("canvas");
  canvas.width = CROP_OUTPUT_SIZE;
  canvas.height = CROP_OUTPUT_SIZE;
  const context = canvas.getContext("2d");
  context.drawImage(crop.image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, CROP_OUTPUT_SIZE, CROP_OUTPUT_SIZE);
  els.characterImageInput.value = canvas.toDataURL("image/png");
  closeCharacterCropper();
  renderCharacterImagePreview();
}

function getCropFrameMetrics() {
  const crop = state.characterCrop;
  const size = els.characterCropFrame.clientWidth || 280;
  const baseScale = Math.max(size / crop.image.naturalWidth, size / crop.image.naturalHeight);
  const baseWidth = crop.image.naturalWidth * baseScale;
  const baseHeight = crop.image.naturalHeight * baseScale;
  const zoom = Number(els.characterCropZoom.value) || 1;
  return {
    size,
    baseScale,
    baseWidth,
    baseHeight,
    scaledWidth: baseWidth * zoom,
    scaledHeight: baseHeight * zoom
  };
}

function startNewCharacter() {
  state.characterEditingId = null;
  renderCharacterForm();
  els.characterNameInput.focus();
}

function saveCharacterForm() {
  if (!state.editMode) return;
  const existingId = els.characterIdInput.value;
  const id = existingId || createId("character");
  const existing = getCharacter(id);
  const character = {
    id,
    name: els.characterNameInput.value.trim() || "名称未設定",
    displayName: els.characterDisplayInput.value.trim() || els.characterNameInput.value.trim() || "名称未設定",
    image: els.characterImageInput.value.trim(),
    url: els.characterUrlInput.value.trim(),
    affiliations: splitInputList(els.characterAffiliationsInput.value),
    tags: splitInputList(els.characterTagsInput.value),
    description: els.characterDescriptionInput.value.trim(),
    memo: els.characterMemoInput.value.trim(),
    chartVisible: existing ? existing.chartVisible : false,
    position: null
  };

  if (existing) {
    Object.assign(existing, character);
  } else {
    state.data.characters.push(character);
  }

  state.data.characters.sort(compareByDisplayName);
  ensureDataLayout(state.data);
  state.characterEditingId = id;
  state.selected = character.chartVisible ? { type: "character", id } : null;
  saveAndRender();
  showToast("保存しました。");
}

function deleteEditingCharacter() {
  if (!state.editMode || !state.characterEditingId) return;
  const id = state.characterEditingId;
  state.data.characters = state.data.characters.filter((character) => character.id !== id);
  state.data.relationships = state.data.relationships.filter((relationship) => (
    !(relationship.from.type === "character" && relationship.from.id === id) &&
    !(relationship.to.type === "character" && relationship.to.id === id)
  ));
  delete state.data.layout.characters[id];
  state.characterEditingId = state.data.characters[0]?.id || null;
  state.selected = firstSelectableEntity();
  saveAndRender();
}

function renderTermCategoryFilter() {
  const current = els.termCategoryFilter.value;
  const categories = Array.from(new Set(state.data.terms.map((term) => term.category || "その他"))).sort(COLLATOR.compare);
  els.termCategoryFilter.innerHTML = "<option value=\"all\">すべて</option>" + categories
    .map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`)
    .join("");
  els.termCategoryFilter.value = categories.includes(current) ? current : "all";
}

function renderTermList() {
  const query = els.termSearch.value.trim().toLowerCase();
  const category = els.termCategoryFilter.value;
  const terms = state.data.terms
    .filter((term) => `${term.term} ${term.description} ${term.url}`.toLowerCase().includes(query))
    .filter((term) => category === "all" || term.category === category)
    .sort((a, b) => COLLATOR.compare(a.term, b.term));

  if (!terms.length) {
    els.termList.replaceChildren(createEmptyState());
    return;
  }

  els.termList.innerHTML = terms.map((term) => `
    <div class="term-card" data-id="${escapeHtml(term.id)}">
      <button type="button" class="term-main" data-id="${escapeHtml(term.id)}">
        <strong>${escapeHtml(term.term)}</strong>
        <p>${escapeHtml(term.description || "未設定")}</p>
      </button>
      <span class="term-card-actions">
        <span class="category-pill">${escapeHtml(term.category || "その他")}</span>
        ${term.url ? `<a class="text-link" href="${escapeAttribute(term.url)}" target="_blank" rel="noopener noreferrer">URL</a>` : ""}
      </span>
    </div>
  `).join("");

  els.termList.querySelectorAll(".term-main").forEach((button) => {
    button.addEventListener("click", () => {
      state.termEditingId = button.dataset.id;
      renderTermForm();
    });
  });
}

function renderTermForm() {
  if (!state.canEdit || !state.editMode) return;
  const term = getTerm(state.termEditingId);
  const item = term || { id: "", term: "", category: "", description: "", url: "", memo: "" };
  els.termIdInput.value = item.id;
  els.termNameInput.value = item.term;
  els.termCategoryInput.value = item.category;
  els.termDescriptionInput.value = item.description;
  els.termUrlInput.value = item.url || "";
  els.termMemoInput.value = item.memo;
  els.deleteTermButton.disabled = !term;
}

function startNewTerm() {
  state.termEditingId = null;
  renderTermForm();
  els.termNameInput.focus();
}

function saveTermForm() {
  if (!state.editMode) return;
  const id = els.termIdInput.value || createId("term");
  const existing = getTerm(id);
  const term = {
    id,
    term: els.termNameInput.value.trim() || "名称未設定",
    category: els.termCategoryInput.value.trim() || "その他",
    description: els.termDescriptionInput.value.trim(),
    url: els.termUrlInput.value.trim(),
    memo: els.termMemoInput.value.trim()
  };
  if (existing) {
    Object.assign(existing, term);
  } else {
    state.data.terms.push(term);
  }
  state.data.terms.sort((a, b) => COLLATOR.compare(a.term, b.term));
  state.termEditingId = id;
  saveAndRender();
  showToast("保存しました。");
}

function deleteEditingTerm() {
  if (!state.editMode || !state.termEditingId) return;
  const id = state.termEditingId;
  state.data.terms = state.data.terms.filter((term) => term.id !== id);
  state.termEditingId = state.data.terms[0]?.id || null;
  saveAndRender();
}

function placeCharacterAtCenter() {
  if (!state.editMode) return;
  const id = els.placeCharacterSelect.value;
  if (!id) return;
  const character = getCharacter(id);
  if (!character) return;
  character.chartVisible = true;
  state.data.layout.characters[id] = viewportCenterPosition();
  selectEntity("character", id);
  saveAndRender();
}

function addGroupFromInput() {
  if (!state.editMode) return;
  const name = els.groupNameInput.value.trim();
  if (!name) return;
  const id = groupIdFromName(name);
  if (getGroup(id)) {
    selectEntity("group", id);
    return;
  }
  const position = viewportCenterPosition();
  const group = {
    id,
    name,
    color: GROUP_COLORS[state.data.groups.length % GROUP_COLORS.length],
    description: "",
    position: { x: position.x - 120, y: position.y - 80 },
    size: { width: 360, height: 220 },
    manualSize: null,
    memo: ""
  };
  state.data.groups.push(group);
  els.groupNameInput.value = "";
  state.selected = { type: "group", id };
  saveAndRender();
}

function deleteSelected() {
  if (!state.editMode || !state.selected) return;
  const { type, id } = state.selected;
  if (type === "character") {
    const character = getCharacter(id);
    if (character) character.chartVisible = false;
    delete state.data.layout.characters[id];
    state.selected = null;
    state.relationSource = null;
    state.relationTarget = null;
    saveAndRender();
    return;
  }
  if (type === "group") {
    const group = getGroup(id);
    state.data.groups = state.data.groups.filter((item) => item.id !== id);
    state.data.characters.forEach((character) => {
      character.affiliations = character.affiliations.filter((name) => name !== group?.name);
    });
    state.data.relationships = state.data.relationships.filter((relationship) => (
      !(relationship.from.type === "group" && relationship.from.id === id) &&
      !(relationship.to.type === "group" && relationship.to.id === id)
    ));
  }
  if (type === "relationship") {
    state.data.relationships = state.data.relationships.filter((relationship) => relationship.id !== id);
  }
  state.selected = firstSelectableEntity();
  saveAndRender();
}

function renderRelationDraftStatus() {
  const source = state.relationSource ? entityLabel(state.relationSource) : "基準キャラ・所属枠を選択";
  els.relationDraftStatus.textContent = state.relationSource ? `${source} から伸ばす対象を選択` : source;
  els.createRelationButton.disabled = !(state.editMode && state.relationSource && state.relationTarget);
}

function applyRelationTypeDefaults(shouldOverwriteLabel = true) {
  const type = state.data.relationTypes.find((item) => item.id === els.relationTypeSelect.value);
  if (!type) return;
  els.relationColorInput.value = type.defaultColor;
  els.relationLineTypeSelect.value = type.defaultLineType;
  if (shouldOverwriteLabel || !els.relationLabelInput.value.trim()) {
    els.relationLabelInput.value = type.name;
  }
}

function createRelationFromDraft() {
  if (!state.editMode || !state.relationSource || !state.relationTarget) return;
  createRelationBetween(state.relationSource, state.relationTarget);
}

function createRelationBetween(source, target) {
  if (!state.editMode || !source || !target) return;
  let relationTypeId = els.relationTypeSelect.value;
  let label = els.relationLabelInput.value.trim();
  if (!label) label = relationTypeName(relationTypeId);

  if (relationTypeId === "custom") {
    relationTypeId = safeId(label || "relation", "relationType");
    if (!state.data.relationTypes.some((type) => type.id === relationTypeId)) {
      state.data.relationTypes.push({
        id: relationTypeId,
        name: label || "新規関係",
        defaultColor: els.relationColorInput.value,
        defaultLineType: els.relationLineTypeSelect.value,
        description: ""
      });
    }
  }

  const relationship = {
    id: createId("relationship"),
    from: { ...source },
    to: { ...target },
    relationTypeId,
    label,
    color: els.relationColorInput.value,
    lineType: els.relationLineTypeSelect.value,
    direction: els.relationDirectionSelect.value,
    memo: ""
  };

  state.data.relationships.push(relationship);
  state.selected = { type: "relationship", id: relationship.id };
  state.relationSource = null;
  state.relationTarget = null;
  saveAndRender();
}

function canConnectRelationTarget(source, target) {
  if (!source || !target || !entityVisibleOnChart(source)) return false;
  if (source.type === target.type && source.id === target.id) return false;
  if (!entityVisibleOnChart(target)) return false;

  if (source.type === "character" && target.type === "group") {
    const sourceCharacter = getCharacter(source.id);
    const group = getGroup(target.id);
    if (!sourceCharacter || sourceCharacter.chartVisible === false || !group || sourceCharacter.affiliations.includes(group.name)) return false;
  }

  return !state.data.relationships.some((relationship) => (
    relationship.from.type === source.type &&
    relationship.from.id === source.id &&
    relationship.to.type === target.type &&
    relationship.to.id === target.id
  ));
}

function startDrag(event, type, id) {
  if (!state.editMode || state.tool !== "move" || event.button !== 0) return;
  if (state.chartPinch) return;
  event.preventDefault();
  const point = pointerToBoard(event);
  const original = type === "character" ? state.data.layout.characters[id] : getGroup(id)?.position;
  if (!original) return;
  const group = type === "group" ? getGroup(id) : null;
  const memberPositions = {};
  if (group) {
    getChartCharacters().forEach((character) => {
      if (character.affiliations.includes(group.name) && state.data.layout.characters[character.id]) {
        memberPositions[character.id] = { ...state.data.layout.characters[character.id] };
      }
    });
  }
  state.dragging = {
    type,
    id,
    start: point,
    original: { ...original },
    memberPositions,
    moved: false
  };
  document.addEventListener("pointermove", moveDrag);
  document.addEventListener("pointerup", endDrag);
}

function moveDrag(event) {
  if (!state.dragging || state.chartPinch) return;
  const point = pointerToBoard(event);
  const dx = point.x - state.dragging.start.x;
  const dy = point.y - state.dragging.start.y;
  if (Math.abs(dx) + Math.abs(dy) > 3) state.dragging.moved = true;

  if (state.dragging.type === "character") {
    const next = {
      x: clamp(state.dragging.original.x + dx, 12, BOARD_SIZE.width - NODE_SIZE.width - 12),
      y: clamp(state.dragging.original.y + dy, 12, BOARD_SIZE.height - NODE_SIZE.height - 12)
    };
    state.data.layout.characters[state.dragging.id] = next;
  } else {
    const group = getGroup(state.dragging.id);
    if (!group) return;
    const next = {
      x: clamp(state.dragging.original.x + dx, 12, BOARD_SIZE.width - group.size.width - 12),
      y: clamp(state.dragging.original.y + dy, 12, BOARD_SIZE.height - group.size.height - 12)
    };
    group.position = next;
    Object.entries(state.dragging.memberPositions).forEach(([characterId, position]) => {
      state.data.layout.characters[characterId] = {
        x: clamp(position.x + dx, 12, BOARD_SIZE.width - NODE_SIZE.width - 12),
        y: clamp(position.y + dy, 12, BOARD_SIZE.height - NODE_SIZE.height - 12)
      };
    });
  }
  renderChart();
}

function endDrag() {
  if (state.dragging?.moved) {
    state.justDragged = true;
    setTimeout(() => {
      state.justDragged = false;
    }, 80);
    persistData();
  }
  state.dragging = null;
  document.removeEventListener("pointermove", moveDrag);
  document.removeEventListener("pointerup", endDrag);
}

function cancelDrag() {
  state.dragging = null;
  document.removeEventListener("pointermove", moveDrag);
  document.removeEventListener("pointerup", endDrag);
}

function pointerToBoard(event) {
  const rect = els.chartBoard.getBoundingClientRect();
  return {
    x: (event.clientX - rect.left) / state.scale,
    y: (event.clientY - rect.top) / state.scale
  };
}

function setScale(nextScale) {
  state.scale = clamp(Number(nextScale.toFixed(2)), MIN_SCALE, MAX_SCALE);
  state.manualScale = true;
  applyScale();
}

function applyScale() {
  els.chartBoard.style.transform = `scale(${state.scale})`;
  els.zoomLabel.textContent = `${Math.round(state.scale * 100)}%`;
}

function startChartPan(event) {
  if (event.button !== 0 || event.pointerType === "mouse") return;
  if (state.editMode && state.tool === "move" && event.target.closest("[data-entity-type]")) return;
  if (event.target.closest(".detail-panel")) return;
  state.chartPan = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    scrollLeft: els.chartViewport.scrollLeft,
    scrollTop: els.chartViewport.scrollTop,
    moved: false
  };
  els.chartViewport.setPointerCapture?.(event.pointerId);
  els.chartViewport.addEventListener("pointermove", moveChartPan);
  els.chartViewport.addEventListener("pointerup", endChartPan, { once: true });
  els.chartViewport.addEventListener("pointercancel", endChartPan, { once: true });
}

function moveChartPan(event) {
  const pan = state.chartPan;
  if (!pan || pan.pointerId !== event.pointerId || state.chartPinch) return;
  const dx = event.clientX - pan.startX;
  const dy = event.clientY - pan.startY;
  if (Math.abs(dx) + Math.abs(dy) > 3) pan.moved = true;
  if (!pan.moved) return;
  event.preventDefault();
  els.chartViewport.scrollLeft = pan.scrollLeft - dx;
  els.chartViewport.scrollTop = pan.scrollTop - dy;
}

function endChartPan(event) {
  if (state.chartPan?.pointerId === event.pointerId && state.chartPan.moved) {
    state.justDragged = true;
    setTimeout(() => {
      state.justDragged = false;
    }, 80);
  }
  state.chartPan = null;
  els.chartViewport.removeEventListener("pointermove", moveChartPan);
}

function startChartPinch(event) {
  if (event.touches.length !== 2) return;
  event.preventDefault();
  event.stopPropagation();
  cancelDrag();
  state.chartPan = null;
  els.chartViewport.removeEventListener("pointermove", moveChartPan);
  state.manualScale = true;
  const center = getTouchCenter(event.touches);
  state.chartPinch = {
    distance: getTouchDistance(event.touches),
    scale: state.scale,
    center,
    boardX: (els.chartViewport.scrollLeft + center.x) / state.scale,
    boardY: (els.chartViewport.scrollTop + center.y) / state.scale
  };
}

function moveChartPinch(event) {
  if (!state.chartPinch || event.touches.length !== 2) return;
  event.preventDefault();
  event.stopPropagation();
  const center = getTouchCenter(event.touches);
  const distance = getTouchDistance(event.touches);
  const nextScale = clamp(state.chartPinch.scale * (distance / state.chartPinch.distance), MIN_SCALE, MAX_SCALE);
  state.scale = Number(nextScale.toFixed(2));
  applyScale();
  els.chartViewport.scrollLeft = state.chartPinch.boardX * state.scale - center.x;
  els.chartViewport.scrollTop = state.chartPinch.boardY * state.scale - center.y;
}

function endChartPinch(event) {
  if (event.touches.length < 2) {
    state.chartPinch = null;
  }
}

function getTouchCenter(touches) {
  const rect = els.chartViewport.getBoundingClientRect();
  return {
    x: ((touches[0].clientX + touches[1].clientX) / 2) - rect.left,
    y: ((touches[0].clientY + touches[1].clientY) / 2) - rect.top
  };
}

function getTouchDistance(touches) {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.hypot(dx, dy);
}

function fitChart(center = true, markManual = false) {
  const viewport = els.chartViewport;
  if (!viewport?.clientWidth) return;
  const scaleX = viewport.clientWidth / BOARD_SIZE.width;
  const scaleY = viewport.clientHeight / BOARD_SIZE.height;
  state.scale = clamp(Math.min(scaleX, scaleY, 1), MIN_SCALE, 1);
  state.manualScale = markManual;
  renderChart();
  if (center) {
    viewport.scrollLeft = Math.max(0, (BOARD_SIZE.width * state.scale - viewport.clientWidth) / 2);
    viewport.scrollTop = 0;
  }
}

function viewportCenterPosition() {
  const viewport = els.chartViewport;
  return {
    x: clamp((viewport.scrollLeft + viewport.clientWidth / 2) / state.scale - NODE_SIZE.width / 2, 12, BOARD_SIZE.width - NODE_SIZE.width - 12),
    y: clamp((viewport.scrollTop + viewport.clientHeight / 2) / state.scale - NODE_SIZE.height / 2, 12, BOARD_SIZE.height - NODE_SIZE.height - 12)
  };
}

function scrollToEntity(type, id) {
  const bounds = getEntityBounds({ type, id });
  if (!bounds) return;
  els.chartViewport.scrollTo({
    left: Math.max(0, (bounds.x + bounds.width / 2) * state.scale - els.chartViewport.clientWidth / 2),
    top: Math.max(0, (bounds.y + bounds.height / 2) * state.scale - els.chartViewport.clientHeight / 2),
    behavior: "smooth"
  });
}

async function exportJson() {
  const payload = createExportPayload(state.data);
  const text = JSON.stringify(payload, null, 2);
  if (state.canEdit && "showSaveFilePicker" in window) {
    try {
      if (!state.jsonFileHandle) {
        state.jsonFileHandle = await window.showSaveFilePicker({
          suggestedName: "characters.json",
          types: [{
            description: "JSON",
            accept: { "application/json": [".json"] }
          }]
        });
      }
      await writeJsonToHandle(state.jsonFileHandle, text);
      showToast("ローカルJSONを上書きしました。");
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error(error);
      showToast("直接上書きできなかったため、ダウンロードに切り替えます。");
    }
  }

  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `relationship-data-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
  showToast("JSONを書き出しました。");
}

async function chooseJsonFile() {
  if (!state.canEdit) return;
  if ("showOpenFilePicker" in window) {
    try {
      const [handle] = await window.showOpenFilePicker({
        multiple: false,
        types: [{
          description: "JSON",
          accept: { "application/json": [".json"] }
        }]
      });
      state.jsonFileHandle = handle;
      const file = await handle.getFile();
      await applyJsonText(await file.text());
      showToast(`${file.name} を読み込みました。`);
      return;
    } catch (error) {
      if (error?.name === "AbortError") return;
      console.error(error);
    }
  }
  els.importInput.click();
}

async function importJson() {
  if (!state.canEdit) return;
  const file = els.importInput.files?.[0];
  if (!file) return;
  try {
    state.jsonFileHandle = null;
    await applyJsonText(await file.text());
    showToast("JSONを読み込みました。");
  } catch (error) {
    console.error(error);
    showToast("JSONを読み込めませんでした。");
  } finally {
    els.importInput.value = "";
  }
}

async function applyJsonText(text) {
  const payload = JSON.parse(text);
  state.data = normalizeData(payload);
  state.selected = null;
  state.characterEditingId = state.data.characters[0]?.id || null;
  state.termEditingId = state.data.terms[0]?.id || null;
  state.manualScale = false;
  persistData();
  renderAll();
  fitChart(false, false);
}

async function writeJsonToHandle(handle, text) {
  const writable = await handle.createWritable();
  await writable.write(text);
  await writable.close();
}

function createExportPayload(data) {
  const payload = {
    schemaVersion: 2,
    updatedAt: new Date().toISOString(),
    characters: data.characters.map((character) => ({
      ...character,
      position: data.layout.characters[character.id] || character.position || null
    })),
    groups: data.groups,
    relationships: data.relationships,
    relationTypes: data.relationTypes,
    terms: data.terms,
    layout: data.layout
  };
  return payload;
}

function saveAndRender() {
  ensureDataLayout(state.data);
  persistData();
  renderAll();
}

function firstSelectableEntity() {
  if (getChartCharacters()[0]) return { type: "character", id: getChartCharacters()[0].id };
  if (state.data.groups[0]) return { type: "group", id: state.data.groups[0].id };
  if (getChartRelationships()[0]) return { type: "relationship", id: getChartRelationships()[0].id };
  return null;
}

function getChartCharacters(data = state.data) {
  return data.characters.filter((character) => character.chartVisible !== false);
}

function getChartRelationships(data = state.data) {
  return data.relationships.filter((relationship) => (
    entityVisibleOnChart(relationship.from, data) &&
    entityVisibleOnChart(relationship.to, data)
  ));
}

function entityVisibleOnChart(endpoint, data = state.data) {
  if (endpoint.type === "group") return data.groups.some((group) => group.id === endpoint.id);
  return data.characters.some((character) => character.id === endpoint.id && character.chartVisible !== false);
}

function getCharacter(id) {
  return state.data.characters.find((character) => character.id === id);
}

function getGroup(id) {
  return state.data.groups.find((group) => group.id === id);
}

function getRelationship(id) {
  return state.data.relationships.find((relationship) => relationship.id === id);
}

function getTerm(id) {
  return state.data.terms.find((term) => term.id === id);
}

function getEntityBounds(endpoint) {
  if (endpoint.type === "character") {
    const character = getCharacter(endpoint.id);
    if (!character || character.chartVisible === false) return null;
    const position = state.data.layout.characters[endpoint.id];
    if (!position) return null;
    return { x: position.x, y: position.y, width: NODE_SIZE.width, height: NODE_SIZE.height };
  }
  const group = getGroup(endpoint.id);
  if (!group) return null;
  return { x: group.position.x, y: group.position.y, width: group.size.width, height: group.size.height };
}

function entityExists(endpoint, data = state.data) {
  if (!endpoint?.id) return false;
  if (endpoint.type === "group") return data.groups.some((group) => group.id === endpoint.id);
  return data.characters.some((character) => character.id === endpoint.id);
}

function entityLabel(endpoint) {
  if (endpoint.type === "group") return getGroup(endpoint.id)?.name || "不明";
  const character = getCharacter(endpoint.id);
  return character ? displayName(character) : "不明";
}

function endpointKey(endpoint) {
  return `${endpoint.type}:${endpoint.id}`;
}

function isSelected(type, id) {
  return state.selected?.type === type && state.selected?.id === id;
}

function isRelationSource(type, id) {
  return state.relationSource?.type === type && state.relationSource?.id === id;
}

function getCharacterRelations(id) {
  return getChartRelationships()
    .filter((relationship) => (
      (relationship.from.type === "character" && relationship.from.id === id) ||
      (relationship.to.type === "character" && relationship.to.id === id)
    ))
    .map((relationship) => {
      const other = relationship.from.type === "character" && relationship.from.id === id ? relationship.to : relationship.from;
      return { relationship, other };
    });
}

function relationTypeName(id) {
  return state.data.relationTypes.find((type) => type.id === id)?.name || "関係";
}

function lineTypeName(lineType) {
  return { solid: "実線", dashed: "点線", bold: "太線" }[lineType] || lineType;
}

function directionText(direction) {
  return { forward: "→", backward: "←", both: "↔", none: "—" }[direction] || "→";
}

function findPrimaryGroup(character, data = state.data) {
  const name = character.affiliations[0];
  return name ? data.groups.find((group) => group.name === name) : null;
}

function displayName(character) {
  return character.displayName || character.name || "名称未設定";
}

function renderAvatar(src, className, label) {
  if (src) {
    return `<span class="${className}"><img src="${escapeAttribute(src)}" alt=""></span>`;
  }
  return `<span class="${className}" aria-hidden="true">${escapeHtml(label.slice(0, 2) || "?")}</span>`;
}

function renderChips(items, limit = 4) {
  return cleanStringList(items).slice(0, limit).map((item, index) => {
    const palette = [
      ["#dbeafe", "#bfdbfe", "#1d4ed8"],
      ["#dcfce7", "#bbf7d0", "#15803d"],
      ["#ffedd5", "#fed7aa", "#c2410c"],
      ["#fce7f3", "#fbcfe8", "#be185d"],
      ["#ede9fe", "#ddd6fe", "#6d28d9"]
    ][index % 5];
    return `<span class="chip" style="--chip-bg:${palette[0]};--chip-line:${palette[1]};--chip-ink:${palette[2]}">${escapeHtml(item)}</span>`;
  }).join("");
}

function createEmptyState() {
  return els.emptyTemplate.content.firstElementChild.cloneNode(true);
}

function centerOf(bounds) {
  return { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 };
}

function edgePoint(bounds, toward) {
  const center = centerOf(bounds);
  const dx = toward.x - center.x;
  const dy = toward.y - center.y;
  if (Math.abs(dx) < 0.001 && Math.abs(dy) < 0.001) return center;
  const scale = Math.min((bounds.width / 2) / Math.abs(dx || 1), (bounds.height / 2) / Math.abs(dy || 1));
  return {
    x: center.x + dx * scale,
    y: center.y + dy * scale
  };
}

function dedupeRelationships(relationships) {
  const seen = new Set();
  return relationships.filter((relationship) => {
    const key = `${relationship.from.type}:${relationship.from.id}:${relationship.to.type}:${relationship.to.id}:${relationship.label}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function guessRelationType(label) {
  const text = String(label || "");
  if (/敵|対立|警戒/.test(text)) return "enemy";
  if (/家族|兄|弟|姉|妹|親|子/.test(text)) return "family";
  if (/恋|好意|片想/.test(text)) return "love";
  if (/不明|謎|調査/.test(text)) return "unknown";
  return "trust";
}

function sanitizePosition(position) {
  return {
    x: Number(position.x) || 0,
    y: Number(position.y) || 0
  };
}

function sanitizeSize(size) {
  return {
    width: Number(size.width) || 360,
    height: Number(size.height) || 220
  };
}

function splitInputList(value) {
  return String(value || "")
    .split(/[,\n、]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function cleanStringList(items) {
  if (!Array.isArray(items)) return [];
  return Array.from(new Set(items.map((item) => String(item || "").trim()).filter(Boolean)));
}

function compareByDisplayName(a, b) {
  return COLLATOR.compare(displayName(a), displayName(b));
}

function groupIdFromName(name) {
  return safeId(name, "group");
}

function safeId(value, prefix) {
  const raw = String(value || "").trim();
  const ascii = raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  if (ascii) return `${prefix}_${ascii}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i += 1) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return `${prefix}_${Math.abs(hash).toString(36)}`;
}

function createId(prefix) {
  if (crypto.randomUUID) return `${prefix}_${crypto.randomUUID()}`;
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => {
    if (value !== null && value !== undefined) element.setAttribute(key, value);
  });
  return element;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replaceAll("`", "&#096;");
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("is-visible");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    els.toast.classList.remove("is-visible");
  }, 2400);
}
