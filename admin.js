(function () {
  "use strict";

  const REPO = "yozeumlab/yozeumlab.github.io";
  const BRANCH = "main";
  const CONTENTS_API = `https://api.github.com/repos/${REPO}/contents`;
  const TOKEN_KEY = "yozeumlab_hub_admin_token";

  // ---------- token / gate ----------

  function getToken() {
    return localStorage.getItem(TOKEN_KEY) || "";
  }
  function setToken(t) {
    localStorage.setItem(TOKEN_KEY, t);
  }
  function clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  // ---------- UTF-8 safe base64 (GitHub Contents API encodes raw file bytes) ----------

  function b64DecodeUnicode(str) {
    const binary = atob(str.replace(/\n/g, ""));
    const percentEncoded = binary
      .split("")
      .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
      .join("");
    return decodeURIComponent(percentEncoded);
  }

  function b64EncodeUnicode(str) {
    const percentEncoded = encodeURIComponent(str).replace(
      /%([0-9A-F]{2})/g,
      (_, hex) => String.fromCharCode("0x" + hex)
    );
    return btoa(percentEncoded);
  }

  // ---------- GitHub API ----------

  async function ghRequest(path, options = {}) {
    const res = await fetch(`${CONTENTS_API}/${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        Accept: "application/vnd.github+json",
        ...(options.headers || {}),
      },
    });
    if (!res.ok) {
      let detail = "";
      try {
        detail = (await res.json()).message || "";
      } catch (_) {}
      throw new Error(`GitHub API 오류 (${res.status}) ${detail}`);
    }
    return res.json();
  }

  async function loadFile(path) {
    const json = await ghRequest(`${path}?ref=${BRANCH}`);
    return { data: JSON.parse(b64DecodeUnicode(json.content)), sha: json.sha };
  }

  async function saveFile(path, dataArray, sha, message) {
    const content = b64EncodeUnicode(JSON.stringify(dataArray, null, 2) + "\n");
    const json = await ghRequest(path, {
      method: "PUT",
      body: JSON.stringify({ message, content, sha, branch: BRANCH }),
    });
    return json.content.sha;
  }

  // ---------- state ----------

  const state = {
    platforms: null,
    categories: null,
    products: null,
    banners: null,
  };

  const ENTITY_CONFIG = {
    platforms: {
      file: "data/platforms.json",
      idPrefix: "platform",
      label: "플랫폼",
      fields: [
        { key: "name", label: "플랫폼명", type: "text", required: true },
        { key: "logo", label: "로고 URL", type: "text" },
        { key: "description", label: "설명", type: "textarea" },
        { key: "affiliate_base_url", label: "제휴 사이트 기본 URL", type: "text" },
        { key: "api_enabled", label: "API 사용", type: "checkbox" },
        { key: "sort_order", label: "노출 순서", type: "number", default: 1 },
        { key: "is_active", label: "활성화", type: "checkbox", default: true },
      ],
    },
    categories: {
      file: "data/categories.json",
      idPrefix: "category",
      label: "카테고리",
      fields: [
        { key: "name", label: "카테고리명", type: "text", required: true },
        { key: "platform_id", label: "소속 플랫폼 (비우면 모든 플랫폼 공용)", type: "platform_select_optional" },
        { key: "sort_order", label: "노출 순서", type: "number", default: 1 },
        { key: "is_active", label: "활성화", type: "checkbox", default: true },
      ],
    },
    products: {
      file: "data/products.json",
      idPrefix: "product",
      label: "상품",
      fields: [
        { key: "platform_id", label: "플랫폼", type: "platform_select", required: true },
        { key: "category_id", label: "카테고리", type: "category_select", required: true },
        { key: "name", label: "상품명", type: "text", required: true },
        { key: "description", label: "설명", type: "textarea" },
        { key: "image_url", label: "이미지 URL", type: "text" },
        { key: "affiliate_url", label: "제휴 링크", type: "text", required: true },
        { key: "source_type", label: "등록 방식", type: "select", options: [["MANUAL", "수동"], ["API", "API"]], default: "MANUAL" },
        { key: "is_featured", label: "특가(HOT) 표시", type: "checkbox" },
        { key: "start_date", label: "노출 시작일", type: "date" },
        { key: "end_date", label: "노출 종료일 (비우면 무기한 노출)", type: "date" },
        { key: "sort_order", label: "노출 순서", type: "number", default: 1 },
        { key: "is_active", label: "활성화", type: "checkbox", default: true },
      ],
    },
    banners: {
      file: "data/banners.json",
      idPrefix: "banner",
      label: "배너",
      fields: [
        { key: "platform_id", label: "플랫폼", type: "platform_select", required: true },
        { key: "title", label: "제목", type: "text", required: true },
        { key: "description", label: "설명", type: "textarea" },
        { key: "image_url", label: "이미지 URL", type: "text" },
        { key: "link_url", label: "연결 링크", type: "text", required: true },
        { key: "start_date", label: "노출 시작일", type: "date" },
        { key: "end_date", label: "노출 종료일 (비우면 무기한 노출)", type: "date" },
        { key: "sort_order", label: "노출 순서", type: "number", default: 1 },
        { key: "is_active", label: "활성화", type: "checkbox", default: true },
      ],
    },
  };

  function byPriority(a, b) {
    return (a.sort_order ?? 999) - (b.sort_order ?? 999);
  }

  function platformName(id) {
    const p = (state.platforms.data || []).find((x) => x.id === id);
    return p ? p.name : "(삭제됨)";
  }

  function categoryName(id) {
    const c = (state.categories.data || []).find((x) => x.id === id);
    return c ? c.name : "(삭제됨)";
  }

  function exposureLabel(item) {
    const start = item.start_date || "제한없음";
    const end = item.end_date || "무기한";
    return `${start} ~ ${end}`;
  }

  // ---------- toast ----------

  let toastTimer = null;
  function toast(message, type = "ok") {
    const el = document.getElementById("toast");
    el.textContent = message;
    el.className = type;
    el.style.display = "block";
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (el.style.display = "none"), 3500);
  }

  // ---------- table rendering ----------

  function renderPlatformsTable() {
    const tbody = document.getElementById("table-platforms");
    const rows = [...state.platforms.data].sort(byPriority);
    tbody.innerHTML = rows
      .map(
        (p) => `
      <tr>
        <td><strong>${escapeHtml(p.name)}</strong><br><span style="color:var(--text-dim);font-size:12px">${escapeHtml(p.description || "")}</span></td>
        <td>${p.api_enabled ? "지원" : "-"}</td>
        <td>${p.sort_order ?? ""}</td>
        <td>${statusBadge(p.is_active)}</td>
        <td class="actions">
          <button data-edit="platforms" data-id="${p.id}">수정</button>
          <button class="btn-danger" data-del="platforms" data-id="${p.id}">삭제</button>
        </td>
      </tr>`
      )
      .join("") || emptyRow(5);
  }

  function renderCategoriesTable() {
    const tbody = document.getElementById("table-categories");
    const rows = [...state.categories.data].sort(byPriority);
    tbody.innerHTML = rows
      .map(
        (c) => `
      <tr>
        <td>${escapeHtml(c.name)}</td>
        <td>${c.platform_id ? escapeHtml(platformName(c.platform_id)) : "공용"}</td>
        <td>${c.sort_order ?? ""}</td>
        <td>${statusBadge(c.is_active)}</td>
        <td class="actions">
          <button data-edit="categories" data-id="${c.id}">수정</button>
          <button class="btn-danger" data-del="categories" data-id="${c.id}">삭제</button>
        </td>
      </tr>`
      )
      .join("") || emptyRow(5);
  }

  function renderProductsTable() {
    const tbody = document.getElementById("table-products");
    const rows = [...state.products.data].sort(byPriority);
    tbody.innerHTML = rows
      .map(
        (p) => `
      <tr>
        <td>${escapeHtml(p.name)}${p.is_featured ? ' <span class="badge on">특가</span>' : ""}</td>
        <td>${escapeHtml(platformName(p.platform_id))}</td>
        <td>${escapeHtml(categoryName(p.category_id))}</td>
        <td>${p.source_type === "API" ? "API" : "수동"}</td>
        <td style="font-size:12px">${exposureLabel(p)}</td>
        <td>${statusBadge(p.is_active)}</td>
        <td class="actions">
          <button data-edit="products" data-id="${p.id}">수정</button>
          <button class="btn-danger" data-del="products" data-id="${p.id}">삭제</button>
        </td>
      </tr>`
      )
      .join("") || emptyRow(7);
  }

  function renderBannersTable() {
    const tbody = document.getElementById("table-banners");
    const rows = [...state.banners.data].sort(byPriority);
    tbody.innerHTML = rows
      .map(
        (b) => `
      <tr>
        <td>${escapeHtml(b.title)}</td>
        <td>${escapeHtml(platformName(b.platform_id))}</td>
        <td style="font-size:12px">${exposureLabel(b)}</td>
        <td>${statusBadge(b.is_active)}</td>
        <td class="actions">
          <button data-edit="banners" data-id="${b.id}">수정</button>
          <button class="btn-danger" data-del="banners" data-id="${b.id}">삭제</button>
        </td>
      </tr>`
      )
      .join("") || emptyRow(5);
  }

  function statusBadge(active) {
    return active ? '<span class="badge on">활성</span>' : '<span class="badge off">비활성</span>';
  }
  function emptyRow(colspan) {
    return `<tr><td colspan="${colspan}" style="color:var(--text-dim)">아직 등록된 항목이 없습니다.</td></tr>`;
  }
  function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }

  const RENDERERS = {
    platforms: renderPlatformsTable,
    categories: renderCategoriesTable,
    products: renderProductsTable,
    banners: renderBannersTable,
  };

  function renderAll() {
    Object.values(RENDERERS).forEach((fn) => fn());
  }

  // ---------- form modal ----------

  function fieldHtml(field, item) {
    const value = item ? item[field.key] : field.default;
    const id = `f_${field.key}`;

    if (field.type === "textarea") {
      return `<div class="field"><label for="${id}">${field.label}</label><textarea id="${id}">${escapeHtml(value || "")}</textarea></div>`;
    }
    if (field.type === "checkbox") {
      return `<div class="field checkbox-field"><input type="checkbox" id="${id}" ${value ? "checked" : ""}><label for="${id}">${field.label}</label></div>`;
    }
    if (field.type === "date") {
      return `<div class="field"><label for="${id}">${field.label}</label><input type="date" id="${id}" value="${value || ""}"></div>`;
    }
    if (field.type === "number") {
      return `<div class="field"><label for="${id}">${field.label}</label><input type="number" id="${id}" value="${value ?? field.default ?? 0}"></div>`;
    }
    if (field.type === "select") {
      const opts = field.options
        .map(([v, label]) => `<option value="${v}" ${value === v ? "selected" : ""}>${label}</option>`)
        .join("");
      return `<div class="field"><label for="${id}">${field.label}</label><select id="${id}">${opts}</select></div>`;
    }
    if (field.type === "platform_select" || field.type === "platform_select_optional") {
      const opts = state.platforms.data
        .slice()
        .sort(byPriority)
        .map((p) => `<option value="${p.id}" ${value === p.id ? "selected" : ""}>${escapeHtml(p.name)}</option>`)
        .join("");
      const emptyOpt = field.type === "platform_select_optional" ? `<option value="" ${!value ? "selected" : ""}>공용 (모든 플랫폼)</option>` : "";
      return `<div class="field"><label for="${id}">${field.label}</label><select id="${id}">${emptyOpt}${opts}</select></div>`;
    }
    if (field.type === "category_select") {
      return `<div class="field"><label for="${id}">${field.label}</label><select id="${id}"></select></div>`;
    }
    return `<div class="field"><label for="${id}">${field.label}</label><input type="text" id="${id}" value="${escapeHtml(value || "")}"></div>`;
  }

  function refreshCategorySelectOptions(item) {
    const platformSel = document.getElementById("f_platform_id");
    const categorySel = document.getElementById("f_category_id");
    if (!platformSel || !categorySel) return;

    const chosenPlatform = platformSel.value;
    const available = state.categories.data
      .filter((c) => c.is_active && (!c.platform_id || c.platform_id === chosenPlatform))
      .sort(byPriority);

    const currentValue = item && item.category_id;
    categorySel.innerHTML = available
      .map((c) => `<option value="${c.id}" ${currentValue === c.id ? "selected" : ""}>${escapeHtml(c.name)}${c.platform_id ? "" : " (공용)"}</option>`)
      .join("");
  }

  function openForm(entityKey, item) {
    const config = ENTITY_CONFIG[entityKey];
    const isEdit = !!item;

    const backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop";
    backdrop.innerHTML = `
      <div class="modal">
        <h3>${isEdit ? config.label + " 수정" : config.label + " 추가"}</h3>
        <div id="formFields">${config.fields.map((f) => fieldHtml(f, item)).join("")}</div>
        <div class="modal-actions">
          <button class="btn-ghost" id="formCancel">취소</button>
          <button class="btn-primary" id="formSave">저장</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    if (entityKey === "products") {
      refreshCategorySelectOptions(item);
      document.getElementById("f_platform_id").addEventListener("change", () => refreshCategorySelectOptions(null));
    }

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) backdrop.remove();
    });
    document.getElementById("formCancel").addEventListener("click", () => backdrop.remove());
    document.getElementById("formSave").addEventListener("click", () => saveForm(entityKey, item, backdrop));
  }

  function readFieldValue(field) {
    const el = document.getElementById(`f_${field.key}`);
    if (field.type === "checkbox") return el.checked;
    if (field.type === "number") return Number(el.value);
    if (field.type === "platform_select_optional") return el.value || null;
    if (field.type === "date") return el.value || null;
    return el.value;
  }

  async function saveForm(entityKey, existingItem, backdrop) {
    const config = ENTITY_CONFIG[entityKey];

    for (const field of config.fields) {
      if (field.required) {
        const el = document.getElementById(`f_${field.key}`);
        if (!el.value || !el.value.trim()) {
          toast(`"${field.label}" 항목은 필수입니다.`, "error");
          return;
        }
      }
    }

    const values = {};
    config.fields.forEach((f) => {
      values[f.key] = readFieldValue(f);
    });

    const saveBtn = document.getElementById("formSave");
    saveBtn.disabled = true;
    saveBtn.textContent = "저장 중...";

    try {
      const bucket = state[entityKey];
      if (existingItem) {
        Object.assign(existingItem, values);
      } else {
        const newItem = {
          id: `${config.idPrefix}-${Date.now()}`,
          created_at: new Date().toISOString().slice(0, 10),
          ...values,
        };
        bucket.data.push(newItem);
      }

      const newSha = await saveFile(
        config.file,
        bucket.data,
        bucket.sha,
        `${existingItem ? "Update" : "Add"} ${config.label} via admin page`
      );
      bucket.sha = newSha;

      RENDERERS[entityKey]();
      backdrop.remove();
      toast("저장했습니다.", "ok");
    } catch (err) {
      console.error(err);
      toast("저장 실패: " + err.message, "error");
      saveBtn.disabled = false;
      saveBtn.textContent = "저장";
    }
  }

  async function deleteItem(entityKey, id) {
    const config = ENTITY_CONFIG[entityKey];
    if (!confirm(`이 ${config.label}을(를) 삭제할까요? 되돌릴 수 없습니다.`)) return;

    const bucket = state[entityKey];
    const idx = bucket.data.findIndex((x) => x.id === id);
    if (idx === -1) return;
    const removed = bucket.data.splice(idx, 1)[0];

    try {
      const newSha = await saveFile(config.file, bucket.data, bucket.sha, `Delete ${config.label} via admin page`);
      bucket.sha = newSha;
      RENDERERS[entityKey]();
      toast("삭제했습니다.", "ok");
    } catch (err) {
      bucket.data.splice(idx, 0, removed);
      console.error(err);
      toast("삭제 실패: " + err.message, "error");
    }
  }

  // ---------- wiring ----------

  function wireTabs() {
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
        document.querySelectorAll(".panel").forEach((p) => p.classList.remove("active"));
        btn.classList.add("active");
        document.getElementById(`panel-${btn.dataset.tab}`).classList.add("active");
      });
    });
  }

  function wireActions() {
    document.body.addEventListener("click", (e) => {
      const addKey = e.target.dataset.add;
      const editKey = e.target.dataset.edit;
      const delKey = e.target.dataset.del;

      if (addKey) openForm(addKey, null);
      if (editKey) {
        const item = state[editKey].data.find((x) => x.id === e.target.dataset.id);
        if (item) openForm(editKey, item);
      }
      if (delKey) deleteItem(delKey, e.target.dataset.id);
    });
  }

  async function loadAll() {
    const [platforms, categories, products, banners] = await Promise.all([
      loadFile("data/platforms.json"),
      loadFile("data/categories.json"),
      loadFile("data/products.json"),
      loadFile("data/banners.json"),
    ]);
    state.platforms = platforms;
    state.categories = categories;
    state.products = products;
    state.banners = banners;
  }

  async function boot() {
    document.getElementById("gate").hidden = true;
    document.getElementById("app").hidden = false;
    try {
      await loadAll();
      renderAll();
    } catch (err) {
      console.error(err);
      toast("데이터를 불러오지 못했습니다: " + err.message, "error");
      document.getElementById("gate").hidden = false;
      document.getElementById("app").hidden = true;
    }
  }

  function init() {
    wireTabs();
    wireActions();

    document.getElementById("tokenSubmit").addEventListener("click", () => {
      const val = document.getElementById("tokenInput").value.trim();
      if (!val) return;
      setToken(val);
      boot();
    });
    document.getElementById("tokenInput").addEventListener("keydown", (e) => {
      if (e.key === "Enter") document.getElementById("tokenSubmit").click();
    });
    document.getElementById("logoutBtn").addEventListener("click", () => {
      clearToken();
      document.getElementById("app").hidden = true;
      document.getElementById("gate").hidden = false;
      document.getElementById("tokenInput").value = "";
    });

    if (getToken()) {
      boot();
    }
  }

  init();
})();
