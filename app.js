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

  function renderProducts(products, categoryId, platformId) {
    const grid = document.getElementById("productGrid");
    const emptyNote = document.getElementById("emptyNote");

    let visible = products.filter(isExposed);
    if (categoryId && categoryId !== "all") {
      visible = visible.filter((p) => p.category_id === categoryId);
    }
    if (platformId && platformId !== "all") {
      visible = visible.filter((p) => p.platform_id === platformId);
    }
    visible.sort(byPriority);

    if (visible.length === 0) {
      grid.innerHTML = "";
      emptyNote.hidden = false;
      return;
    }
    emptyNote.hidden = true;

    grid.innerHTML = visible
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

    function refresh() {
      renderBanners(banners, currentPlatform);
      renderProducts(products, currentCategory, currentPlatform);
    }

    function refreshCategoryBar() {
      renderCategoryBar(categories, currentPlatform, (categoryId) => {
        currentCategory = categoryId;
        refresh();
      });
    }

    refreshCategoryBar();
    renderPlatformBar(platforms, (platformId) => {
      currentPlatform = platformId;
      // 플랫폼이 바뀌면 이전에 고른 카테고리가 새 플랫폼에 없을 수 있으니
      // "전체"로 리셋하고 카테고리 칩 목록 자체를 새로 그린다.
      currentCategory = "all";
      refreshCategoryBar();
      refresh();
    });

    refresh();
  }

  init();
})();
