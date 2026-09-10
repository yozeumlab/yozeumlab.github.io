(function () {
  // 방문자의 브라우저 시간대와 무관하게, 항상 한국(KST, UTC+9) 기준 오늘 날짜로
  // 노출 여부를 판단한다. UTC 기준으로 계산하면 자정 전후(한국은 이미 다음 날인데
  // UTC로는 아직 전날)에 상품/배너가 하루 일찍 사라지거나 늦게 나타나는 버그가 생긴다.
  const nowKST = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const todayStr = nowKST.toISOString().slice(0, 10);

  function isExposed(item) {
    if (!item.is_active) return false;
    if (item.start_date && item.start_date > todayStr) return false;
    if (item.end_date && item.end_date < todayStr) return false;
    return true;
  }

  function byPriority(a, b) {
    return (a.sort_order ?? 999) - (b.sort_order ?? 999);
  }

  async function loadJSON(path) {
    const res = await fetch(path, { cache: "no-store" });
    return res.json();
  }

  function renderBanners(banners, platformId) {
    const el = document.getElementById("bannerSection");
    let visible = banners.filter(isExposed);
    if (platformId && platformId !== "all") {
      visible = visible.filter((b) => b.platform_id === platformId);
    }
    visible.sort(byPriority);
    el.innerHTML = visible
      .map(
        (b) => `
      <a class="banner-card" href="${b.link_url}" target="_blank" rel="noopener sponsored">
        ${b.image_url ? `<img src="${b.image_url}" alt="${b.title}">` : ""}
        <div class="banner-text">
          <h3>${b.title}</h3>
          <p>${b.description || ""}</p>
        </div>
      </a>`
      )
      .join("");
  }

  function renderCategoryBar(categories, platformId, onSelect) {
    const el = document.getElementById("categoryBar");
    let active = categories.filter((c) => c.is_active);
    // platform_id가 비어있는 카테고리는 모든 플랫폼 공용이라, 특정 플랫폼이
    // 선택된 상태에서도 항상 같이 보여준다. "전체 플랫폼"일 때는 필터링 없이 다 보여준다.
    if (platformId && platformId !== "all") {
      active = active.filter((c) => !c.platform_id || c.platform_id === platformId);
    }
    active.sort(byPriority);
    const all = [{ id: "all", name: "전체" }, ...active];

    el.innerHTML = all
      .map(
        (c, i) =>
          `<button class="chip${i === 0 ? " active" : ""}" data-id="${c.id}">${c.name}</button>`
      )
      .join("");

    el.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        el.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        onSelect(chip.dataset.id);
      });
    });
  }

  function renderPlatformBar(platforms, onSelect) {
    const el = document.getElementById("platformBar");
    const active = platforms.filter((p) => p.is_active).sort(byPriority);
    const all = [{ id: "all", name: "전체 플랫폼" }, ...active];

    el.innerHTML = all
      .map(
        (p, i) =>
          `<button class="chip${i === 0 ? " active" : ""}" data-id="${p.id}">${p.name}</button>`
      )
      .join("");

    el.querySelectorAll(".chip").forEach((chip) => {
      chip.addEventListener("click", () => {
        el.querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
        chip.classList.add("active");
        onSelect(chip.dataset.id);
      });
    });
  }

  const PAGE_SIZE = 8;

  function renderPagination(totalPages, currentPage, onPageChange) {
    const el = document.getElementById("pagination");
    if (totalPages <= 1) {
      el.innerHTML = "";
      return;
    }
    let html = `<button data-page="${currentPage - 1}" ${currentPage === 1 ? "disabled" : ""}>‹</button>`;
    for (let i = 1; i <= totalPages; i++) {
      html += `<button data-page="${i}" class="${i === currentPage ? "active" : ""}">${i}</button>`;
    }
    html += `<button data-page="${currentPage + 1}" ${currentPage === totalPages ? "disabled" : ""}>›</button>`;
    el.innerHTML = html;
    el.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => onPageChange(parseInt(btn.dataset.page, 10)));
    });
  }

  // 반환값: 실제로 적용된(범위 보정된) 페이지 번호 - 호출부가 currentPage 상태를 이걸로
  // 다시 맞춰야 "검색/카테고리 바꿔서 페이지 수가 줄었는데 존재하지 않는 페이지에
  // 머물러있는" 상태가 안 생긴다.
  function renderProducts(products, categoryId, platformId, searchQuery, page, onPageChange) {
    const grid = document.getElementById("productGrid");
    const emptyNote = document.getElementById("emptyNote");
    const pagination = document.getElementById("pagination");

    let visible = products.filter(isExposed);
    if (categoryId && categoryId !== "all") {
      visible = visible.filter((p) => p.category_id === categoryId);
    }
    if (platformId && platformId !== "all") {
      visible = visible.filter((p) => p.platform_id === platformId);
    }
    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      visible = visible.filter(
        (p) =>
          (p.name || "").toLowerCase().includes(q) ||
          (p.description || "").toLowerCase().includes(q)
      );
    }
    visible.sort(byPriority);

    if (visible.length === 0) {
      grid.innerHTML = "";
      pagination.innerHTML = "";
      emptyNote.hidden = false;
      return page;
    }
    emptyNote.hidden = true;

    const totalPages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(1, page), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const pageItems = visible.slice(start, start + PAGE_SIZE);

    grid.innerHTML = pageItems
      .map(
        (p) => `
      <div class="product-card">
        <div class="thumb">
          ${p.is_featured ? `<span class="featured-badge">특가</span>` : ""}
          ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" loading="lazy">` : ""}
        </div>
        <div class="body">
          <div class="name">${p.name}</div>
          <div class="desc">${p.description || ""}</div>
          <a class="go-btn" href="${p.affiliate_url}" target="_blank" rel="noopener sponsored">상품 보러가기</a>
        </div>
      </div>`
      )
      .join("");

    renderPagination(totalPages, safePage, onPageChange);
    return safePage;
  }

  async function init() {
    const [platforms, categories, products, banners] = await Promise.all([
      loadJSON("data/platforms.json"),
      loadJSON("data/categories.json"),
      loadJSON("data/products.json"),
      loadJSON("data/banners.json"),
    ]);

    let currentCategory = "all";
    let currentPlatform = "all";
    let currentSearch = "";
    let currentPage = 1;

    function refresh() {
      renderBanners(banners, currentPlatform);
      currentPage = renderProducts(
        products,
        currentCategory,
        currentPlatform,
        currentSearch,
        currentPage,
        (page) => {
          currentPage = page;
          refresh();
          document.getElementById("productGrid").scrollIntoView({ behavior: "smooth", block: "start" });
        }
      );
    }

    function refreshCategoryBar() {
      renderCategoryBar(categories, currentPlatform, (categoryId) => {
        currentCategory = categoryId;
        currentPage = 1;
        refresh();
      });
    }

    refreshCategoryBar();
    renderPlatformBar(platforms, (platformId) => {
      currentPlatform = platformId;
      // 플랫폼이 바뀌면 이전에 고른 카테고리가 새 플랫폼에 없을 수 있으니
      // "전체"로 리셋하고 카테고리 칩 목록 자체를 새로 그린다.
      currentCategory = "all";
      currentPage = 1;
      refreshCategoryBar();
      refresh();
    });

    const searchInput = document.getElementById("searchInput");
    searchInput.addEventListener("input", () => {
      currentSearch = searchInput.value;
      currentPage = 1;
      refresh();
    });

    refresh();
  }

  init();
})();
