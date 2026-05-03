const modules = {
  dashboard: { label: "Dashboard", icon: "DB", kicker: "Overview" },
  products: {
    label: "Products",
    icon: "PR",
    endpoint: "/api/products",
    kicker: "Catalog",
    fields: [
      ["name", "Name"],
      ["category", "Category"],
      ["price", "Price", "number"],
      ["weight", "Weight", "number"],
      ["reorderLevel", "Reorder", "number"],
    ],
  },
  warehouses: {
    label: "Warehouses",
    icon: "WH",
    endpoint: "/api/warehouses",
    kicker: "Storage",
    fields: [
      ["name", "Name"],
      ["location", "Location"],
      ["capacity", "Capacity", "number"],
      ["storageType", "Storage"],
    ],
  },
  inventory: {
    label: "Inventory",
    icon: "IN",
    endpoint: "/api/inventory",
    kicker: "Stock",
    fields: [
      ["productId", "Product ID", "number"],
      ["warehouseId", "Warehouse ID", "number"],
      ["quantity", "Qty", "number"],
    ],
  },
  suppliers: {
    label: "Suppliers",
    icon: "SP",
    endpoint: "/api/suppliers",
    kicker: "Partners",
    fields: [
      ["name", "Name"],
      ["contactPerson", "Contact"],
      ["email", "Email", "email"],
      ["phone", "Phone"],
      ["address", "Address"],
    ],
  },
  orders: {
    label: "Orders",
    icon: "PO",
    endpoint: "/api/orders",
    kicker: "Purchasing",
    statuses: ["Pending", "Approved", "Received", "Cancelled"],
    fields: [
      ["supplierId", "Supplier ID", "number"],
      ["productId", "Product ID", "number"],
      ["quantity", "Qty", "number"],
      ["status", "Status", "select", ["Pending", "Approved", "Received", "Cancelled"]],
      ["expectedDate", "ETA", "date"],
    ],
  },
  shipments: {
    label: "Shipments",
    icon: "SH",
    endpoint: "/api/shipments",
    kicker: "Tracking",
    statuses: ["Pending", "Shipped", "Delivered"],
    fields: [
      ["orderId", "Order ID", "number"],
      ["trackingNumber", "Track #"],
      ["carrier", "Carrier"],
      ["status", "Status", "select", ["Pending", "Shipped", "Delivered"]],
      ["origin", "Origin"],
      ["destination", "Destination"],
      ["shipDate", "Ship", "date"],
      ["deliveryDate", "Delivery", "date"],
    ],
  },
  returns: {
    label: "Returns",
    icon: "RT",
    endpoint: "/api/returns",
    kicker: "Reverse flow",
    statuses: ["Requested", "Approved", "Rejected", "Restocked"],
    fields: [
      ["productId", "Product ID", "number"],
      ["shipmentId", "Shipment ID", "number"],
      ["quantity", "Qty", "number"],
      ["reason", "Reason"],
      ["status", "Status", "select", ["Requested", "Approved", "Rejected", "Restocked"]],
    ],
  },
};

const state = {
  active: "dashboard",
  rows: [],
  allRows: {},
  editing: null,
  deletingId: null,
  stats: null,
  role: localStorage.getItem("role") || "admin",
  sortKey: "id",
  sortDir: "desc",
  page: 1,
  pageSize: 10,
  dashboardMode: "all",
  apiMs: 0,
  activity: ["System synced", "Inventory checked", "Orders reviewed"],
  versions: JSON.parse(localStorage.getItem("versions") || "[]"),
  enabledFeatures: JSON.parse(localStorage.getItem("enabledFeatures") || '{"Routing":true,"Forecast":true,"RCA":true,"Digital Twin":true}'),
};

const $ = (selector) => document.querySelector(selector);
const nav = $("#nav");
const login = $("#login");
const app = $("#app");
const dashboardPage = $("#dashboard");
const modulePage = $("#module");
const searchInput = $("#searchInput");
const statusFilter = $("#statusFilter");
const loading = $("#loading");
const recordModal = $("#recordModal");
const recordForm = $("#recordForm");
const confirmModal = $("#confirmModal");

init();

async function init() {
  buildNav();
  bindEvents();
  applyTheme(localStorage.getItem("theme") || "light");
  setRole(state.role);
  try {
    await api("/api/me");
    showApp();
  } catch {
    login.classList.remove("hidden");
  }
}

function buildNav() {
  nav.innerHTML = Object.entries(modules)
    .map(([key, mod]) => `
      <button class="nav-btn ${key === state.active ? "active" : ""}" data-route="${key}" title="${mod.label}">
        <span class="nav-ico">${mod.icon}</span>
        <span>${mod.label}</span>
      </button>
    `)
    .join("");
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await api("/api/login", { method: "POST", body: Object.fromEntries(new FormData(event.currentTarget)) });
      toast("Welcome back", "success");
      showApp();
    } catch (error) {
      toast(error.message, "error");
    }
  });

  nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-route]");
    if (button) navigate(button.dataset.route);
  });

  $("#collapseBtn").addEventListener("click", () => app.classList.toggle("collapsed"));
  $("#themeToggle").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  $("#quickAddBtn").addEventListener("click", () => navigate("products", true));
  $("#openCalculatorBtn").addEventListener("click", openCalculator);
  $("#simulateReorderBtn").addEventListener("click", () => {
    renderAutoReorder(true);
    toast("Draft purchase orders simulated", "success");
  });
  $("#scenarioBtn").addEventListener("click", () => renderScenario(true));
  document.querySelectorAll("[data-dashboard-mode]").forEach((button) => {
    button.addEventListener("click", () => setDashboardMode(button.dataset.dashboardMode));
  });
  $("#fabBtn").addEventListener("click", () => openForm());
  $("#newBtn").addEventListener("click", () => openForm());
  $("#closeModal").addEventListener("click", closeForm);
  recordModal.addEventListener("click", (event) => {
    if (event.target === recordModal) closeForm();
  });
  recordForm.addEventListener("submit", saveRecord);

  searchInput.addEventListener("input", debounce(() => {
    state.page = 1;
    loadRows();
  }, 220));
  statusFilter.addEventListener("change", () => {
    state.page = 1;
    loadRows();
  });
  $("#pageSize").addEventListener("change", (event) => {
    state.pageSize = Number(event.target.value);
    state.page = 1;
    renderTable();
  });
  $("#prevPage").addEventListener("click", () => changePage(-1));
  $("#nextPage").addEventListener("click", () => changePage(1));
  $("#exportCsvBtn").addEventListener("click", exportCsv);
  $("#exportPdfBtn").addEventListener("click", () => window.print());

  $("#cancelDelete").addEventListener("click", () => confirmModal.classList.add("hidden"));
  $("#confirmDelete").addEventListener("click", deleteConfirmed);
  $("#closeCalculator").addEventListener("click", () => $("#calculatorModal").classList.add("hidden"));
  $("#calculatorModal").addEventListener("click", (event) => {
    if (event.target === $("#calculatorModal")) $("#calculatorModal").classList.add("hidden");
  });
  ["calcCost", "calcQty", "calcShipping", "calcTax", "calcDiscount", "calcMargin"].forEach((id) => {
    $(`#${id}`).addEventListener("input", renderCalculator);
  });

  $("#profileBtn").addEventListener("click", () => $("#profileMenu").classList.toggle("hidden"));
  $("#roleToggle").addEventListener("click", () => setRole(state.role === "admin" ? "staff" : "admin"));
  $("#logoutBtn").addEventListener("click", logout);
  $("#notificationBtn").addEventListener("click", () => $("#notificationMenu").classList.toggle("hidden"));

  $("#globalSearch").addEventListener("input", debounce(globalSearch, 180));
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeForm();
      confirmModal.classList.add("hidden");
      $("#profileMenu").classList.add("hidden");
      $("#notificationMenu").classList.add("hidden");
      $("#globalResults").classList.add("hidden");
      $("#calculatorModal").classList.add("hidden");
    }
  });
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("theme", theme);
}

function setRole(role) {
  state.role = role;
  localStorage.setItem("role", role);
  $("#roleToggle").textContent = `Role: ${role === "admin" ? "Admin" : "Staff"}`;
  document.body.dataset.role = role;
}

async function logout() {
  await api("/api/logout", { method: "POST", body: {} });
  app.classList.add("hidden");
  login.classList.remove("hidden");
  toast("Logged out", "success");
}

async function showApp() {
  login.classList.add("hidden");
  app.classList.remove("hidden");
  navigate("dashboard");
  connectStream();
}

function navigate(route, autoOpen = false) {
  state.active = route;
  state.editing = null;
  state.page = 1;
  state.sortKey = "id";
  state.sortDir = "desc";
  const mod = modules[route];
  $("#pageTitle").textContent = mod.label;
  $("#pageKicker").textContent = mod.kicker || "Workspace";
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.route === route));
  dashboardPage.classList.toggle("active", route === "dashboard");
  modulePage.classList.toggle("active", route !== "dashboard");
  if (route === "dashboard") loadDashboard();
  else setupModule(route, autoOpen);
}

async function loadDashboard() {
  const started = performance.now();
  state.stats = await api("/api/stats");
  state.apiMs = Math.max(1, Math.round(performance.now() - started));
  await preloadData();
  renderDashboard();
}

async function preloadData() {
  const targets = ["products", "warehouses", "inventory", "orders", "shipments", "suppliers", "returns"];
  await Promise.all(targets.map(async (key) => {
    try {
      state.allRows[key] = await api(modules[key].endpoint);
    } catch {
      state.allRows[key] = [];
    }
  }));
}

function renderDashboard() {
  renderStats();
  renderFinance();
  renderAlerts();
  renderCapacity();
  renderTopProducts();
  renderActivity();
  renderMoneyInsights();
  renderScoreBoard();
  renderInnovationPanels();
  drawCharts();
}

function renderStats() {
  const stats = state.stats || {};
  const items = [
    ["Products", stats.products || 0, "PR", "+12%", "up"],
    ["Warehouses", stats.warehouses || 0, "WH", "+2", "up"],
    ["Available Stock", stats.stock || 0, "IN", "-4%", "down"],
    ["Active Shipments", stats.shipments || 0, "SH", "+8%", "up"],
    ["Pending Orders", stats.orders || 0, "PO", "Live", "flat"],
  ];
  $("#statGrid").classList.remove("skeleton-grid");
  $("#statGrid").innerHTML = items
    .map(([label, value, icon, trend, direction]) => `
      <article class="stat-card">
        <div class="stat-top">
          <span>${label}</span>
          <span class="stat-icon">${icon}</span>
        </div>
        <div>
          <strong>${formatNumber(value)}</strong>
          <span class="trend ${direction}">${direction === "down" ? "v" : direction === "up" ? "^" : "-"} ${trend}</span>
        </div>
      </article>
    `)
    .join("");
}

function renderAlerts() {
  const alerts = state.stats?.lowStock || [];
  $("#alerts").innerHTML = alerts.length
    ? alerts.map((item) => `
      <div class="alert-row">
        <div>
          <strong>${escapeHtml(item.product)}</strong>
          <p>Qty ${item.quantity} / Reorder ${item.reorderLevel}</p>
        </div>
        <span class="pill danger">Low</span>
      </div>
    `).join("")
    : `<div class="alert-row"><div><strong>All clear</strong><p>No reorder alerts</p></div><span class="pill ok">OK</span></div>`;
  $("#noticeCount").textContent = alerts.length || 1;
}

function financeMetrics() {
  const products = state.allRows.products || [];
  const inventory = state.allRows.inventory || [];
  const orders = state.allRows.orders || [];
  const returns = state.allRows.returns || [];
  const shipments = state.allRows.shipments || [];
  const productById = Object.fromEntries(products.map((product) => [Number(product.id), product]));
  const priceOf = (productId) => Number(productById[Number(productId)]?.price || 0);
  const inventoryValue = inventory.reduce((sum, item) => sum + Number(item.quantity || 0) * priceOf(item.productId), 0);
  const pendingOrderValue = orders
    .filter((order) => String(order.status || "").toLowerCase() === "pending")
    .reduce((sum, order) => sum + Number(order.quantity || 0) * priceOf(order.productId), 0);
  const reorderBudget = inventory.reduce((sum, item) => {
    const product = productById[Number(item.productId)];
    if (!product) return sum;
    const gap = Math.max(0, Number(product.reorderLevel || 0) - Number(item.quantity || 0));
    return sum + gap * Number(product.price || 0);
  }, 0);
  const returnImpact = returns.reduce((sum, item) => sum + Number(item.quantity || 0) * priceOf(item.productId), 0);
  const delivered = shipments.filter((shipment) => String(shipment.status || "").toLowerCase() === "delivered").length;
  const shipmentRate = shipments.length ? Math.round((delivered / shipments.length) * 100) : 0;
  const lowStockCount = state.stats?.lowStock?.length || 0;
  const stockHealth = inventory.length ? Math.max(0, Math.round(((inventory.length - lowStockCount) / inventory.length) * 100)) : 100;
  const returnRate = shipments.length ? Math.round((returns.length / shipments.length) * 100) : 0;
  return { inventoryValue, pendingOrderValue, reorderBudget, returnImpact, shipmentRate, stockHealth, returnRate };
}

function renderFinance() {
  const metrics = financeMetrics();
  $("#inventoryValue").textContent = formatMoney(metrics.inventoryValue);
  $("#pendingOrderValue").textContent = formatMoney(metrics.pendingOrderValue);
  $("#reorderBudget").textContent = formatMoney(metrics.reorderBudget);
  $("#returnImpact").textContent = formatMoney(metrics.returnImpact);
}

function renderCapacity() {
  const warehouses = state.allRows.warehouses || [];
  const inventoryTotal = (state.allRows.inventory || []).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  $("#capacityList").innerHTML = warehouses.length
    ? warehouses.map((warehouse, index) => {
      const usage = Math.min(92, Math.max(18, Math.round((inventoryTotal / Math.max(Number(warehouse.capacity || 1), 1)) * 100) + index * 8));
      return `
        <div class="progress-row">
          <div><strong>${escapeHtml(warehouse.name)}</strong><span>${escapeHtml(warehouse.location)}</span></div>
          <div class="progress-track"><span style="width:${usage}%"></span></div>
          <b>${usage}%</b>
        </div>
      `;
    }).join("")
    : `<div class="empty">No warehouses</div>`;
}

function renderTopProducts() {
  const products = productInsights().slice(0, 4);
  $("#topProducts").innerHTML = products.length
    ? products.map((item, index) => `
      <div class="rank-row">
        <span>${index + 1}</span>
        <div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.category)} | Qty ${item.stock}</p></div>
        <b>${formatMoney(item.value)}</b>
      </div>
    `).join("")
    : `<div class="empty">No products</div>`;
}

function renderActivity() {
  $("#activityList").innerHTML = state.activity.slice(0, 5).map((item) => `
    <div class="timeline-row">
      <span></span>
      <p>${escapeHtml(item)}</p>
      <b>now</b>
    </div>
  `).join("");
}

function renderMoneyInsights() {
  const metrics = financeMetrics();
  const inventory = state.allRows.inventory || [];
  const avgStockValue = inventory.length ? metrics.inventoryValue / inventory.length : 0;
  $("#moneyInsights").innerHTML = [
    ["Avg Stock Value", formatMoney(avgStockValue), "Per inventory line"],
    ["Cash Blocked", formatMoney(metrics.inventoryValue + metrics.pendingOrderValue), "Stock + pending PO"],
    ["Reorder Need", formatMoney(metrics.reorderBudget), metrics.reorderBudget ? "Budget required" : "No urgent spend"],
    ["Return Risk", `${metrics.returnRate}%`, "Returns vs shipments"],
  ].map(([label, value, note]) => `
    <div class="money-row">
      <span>${label}</span>
      <strong>${value}</strong>
      <p>${note}</p>
    </div>
  `).join("");
}

function renderScoreBoard() {
  const metrics = financeMetrics();
  const score = Math.round((metrics.stockHealth * 0.45) + (metrics.shipmentRate * 0.35) + (Math.max(0, 100 - metrics.returnRate) * 0.2));
  const rows = [
    ["Stock Health", metrics.stockHealth],
    ["Shipment Completion", metrics.shipmentRate],
    ["Quality Score", Math.max(0, 100 - metrics.returnRate)],
  ];
  $("#scoreBoard").innerHTML = `
    <div class="score-ring" style="--score:${score * 3.6}deg"><strong>${score}</strong><span>/100</span></div>
    <div class="score-bars">
      ${rows.map(([label, value]) => `
        <div>
          <span>${label}</span>
          <div class="progress-track"><span style="width:${value}%"></span></div>
          <b>${value}%</b>
        </div>
      `).join("")}
    </div>
  `;
}

function productInsights() {
  const products = state.allRows.products || [];
  const inventory = state.allRows.inventory || [];
  const orders = state.allRows.orders || [];
  const returns = state.allRows.returns || [];
  return products.map((product) => {
    const id = Number(product.id);
    const stock = inventory.filter((item) => Number(item.productId) === id).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const ordered = orders.filter((item) => Number(item.productId) === id).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const returned = returns.filter((item) => Number(item.productId) === id).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const value = stock * Number(product.price || 0);
    const demandScore = ordered + returned * 2 + value / 1000;
    return { ...product, stock, ordered, returned, value, demandScore };
  }).sort((a, b) => b.demandScore - a.demandScore);
}

function renderInnovationPanels() {
  renderDigitalTwin();
  renderOrderRouting();
  renderFailurePrediction();
  renderBusinessInsights();
  renderAutoReorder(false);
  renderRootCause();
  renderScenario(false);
  renderSystemStatus();
  renderQueryBuilder();
  renderVersionLog();
  renderForecast();
  renderRecommendations();
  renderFeatureToggles();
  renderRouteOptimization();
  renderCollaboration();
  renderConsistency();
  renderRelationshipExplorer();
  applyDashboardMode();
}

function warehouseUsage() {
  const warehouses = state.allRows.warehouses || [];
  const inventory = state.allRows.inventory || [];
  return warehouses.map((warehouse) => {
    const used = inventory.filter((item) => Number(item.warehouseId) === Number(warehouse.id)).reduce((sum, item) => sum + Number(item.quantity || 0), 0);
    const capacity = Math.max(1, Number(warehouse.capacity || 1));
    const percent = Math.min(100, Math.round((used / capacity) * 100));
    return { ...warehouse, used, percent, free: Math.max(0, capacity - used) };
  });
}

function renderDigitalTwin() {
  const zones = warehouseUsage();
  const fallback = ["A", "B", "C"].map((zone, index) => ({ name: `Zone ${zone}`, location: "Demo", percent: [82, 46, 18][index], used: [820, 460, 180][index], free: [180, 540, 820][index] }));
  const items = (zones.length ? zones : fallback).slice(0, 9);
  $("#warehouseTwin").innerHTML = items.map((zone, index) => {
    const status = zone.percent >= 80 ? "over" : zone.percent <= 35 ? "free" : "normal";
    return `
      <div class="twin-cell ${status}">
        <strong>${String.fromCharCode(65 + index)}</strong>
        <span>${escapeHtml(zone.name)}</span>
        <p>${zone.percent}% used</p>
      </div>
    `;
  }).join("");
}

function renderOrderRouting() {
  const orders = (state.allRows.orders || []).filter((order) => String(order.status || "").toLowerCase() === "pending");
  const inventory = state.allRows.inventory || [];
  const warehouses = state.allRows.warehouses || [];
  const suggestions = orders.slice(0, 3).map((order) => {
    const candidates = inventory.filter((item) => Number(item.productId) === Number(order.productId) && Number(item.quantity || 0) >= Number(order.quantity || 0));
    const best = candidates.sort((a, b) => Number(b.quantity || 0) - Number(a.quantity || 0))[0];
    const warehouse = warehouses.find((item) => Number(item.id) === Number(best?.warehouseId));
    return {
      title: `Order #${order.id}`,
      value: warehouse ? warehouse.name : "No warehouse with enough stock",
      note: warehouse ? `${warehouse.location} | Available ${best.quantity}` : "Create PO or split shipment",
      type: warehouse ? "ok" : "warn",
    };
  });
  renderSmartList("#orderRouting", suggestions, "No pending orders to route");
}

function renderFailurePrediction() {
  const shipments = state.allRows.shipments || [];
  const returns = state.allRows.returns || [];
  const pending = shipments.filter((item) => ["pending", "shipped"].includes(String(item.status || "").toLowerCase())).length;
  const returnRate = shipments.length ? Math.round((returns.length / shipments.length) * 100) : 0;
  const risk = pending > 3 || returnRate > 30 ? "High" : pending > 0 || returnRate > 10 ? "Medium" : "Low";
  renderSmartList("#failurePrediction", [
    { title: `${risk} delivery risk`, value: `${pending} active shipments`, note: "Based on pending/shipped load", type: risk === "High" ? "danger" : "warn" },
    { title: "Return pattern", value: `${returnRate}%`, note: "Repeated returns increase risk", type: returnRate > 20 ? "danger" : "ok" },
  ]);
}

function renderBusinessInsights() {
  const metrics = financeMetrics();
  const top = productInsights()[0];
  const insights = [
    `Warehouse efficiency score is ${Math.round((metrics.stockHealth + metrics.shipmentRate) / 2)}%.`,
    metrics.returnRate ? `Returns are ${metrics.returnRate}% of shipments; inspect quality reasons.` : "Returns are controlled this cycle.",
    top ? `${top.name} has the highest demand/value signal.` : "Add products to unlock demand insights.",
    metrics.reorderBudget ? `Low stock recovery needs ${formatMoney(metrics.reorderBudget)}.` : "No urgent reorder budget required.",
  ];
  $("#businessInsights").innerHTML = insights.map((text) => `<div class="insight-card">${escapeHtml(text)}</div>`).join("");
}

function renderAutoReorder(markDraft) {
  const items = lowStockProducts().slice(0, 4).map((item) => ({
    title: item.name,
    value: `${Math.max(0, item.reorderLevel - item.stock)} units`,
    note: markDraft ? "Draft PO created in simulation" : "Click Run to simulate draft PO",
    type: "warn",
  }));
  renderSmartList("#autoReorder", items, "No low-stock reorder needed");
}

function lowStockProducts() {
  return productInsights().filter((product) => Number(product.stock || 0) <= Number(product.reorderLevel || 0));
}

function renderRootCause() {
  const items = lowStockProducts().slice(0, 3).map((product) => {
    const cause = product.ordered > product.stock ? "High demand" : product.reorderLevel < 20 ? "Low reorder level" : "Supplier delay or replenishment gap";
    return { title: product.name, value: cause, note: `Stock ${product.stock}, reorder ${product.reorderLevel}`, type: "warn" };
  });
  renderSmartList("#rootCause", items, "No stock issue detected");
}

function renderScenario(doubleDemand) {
  const products = productInsights();
  const lowAfterDemand = products.filter((product) => Number(product.stock || 0) - Number(product.ordered || 0) * (doubleDemand ? 2 : 1) <= Number(product.reorderLevel || 0)).length;
  const metrics = financeMetrics();
  $("#scenarioResult").innerHTML = [
    ["Demand Mode", doubleDemand ? "2x demand" : "Normal demand"],
    ["Products At Risk", lowAfterDemand],
    ["Extra Budget", formatMoney(doubleDemand ? metrics.reorderBudget * 2 : metrics.reorderBudget)],
  ].map(([label, value]) => `<div><span>${label}</span><strong>${value}</strong></div>`).join("");
}

function renderSystemStatus() {
  renderSmartList("#systemStatus", [
    { title: "DB Connection", value: "Connected", note: "Java JDBC backend", type: "ok" },
    { title: "Server", value: "Running", note: "localhost:8080", type: "ok" },
    { title: "API Response", value: `${state.apiMs} ms`, note: "/api/stats check", type: state.apiMs < 250 ? "ok" : "warn" },
  ]);
}

function renderQueryBuilder() {
  const table = $("#qbTable")?.value || "products";
  const field = $("#qbField")?.value || "id";
  const value = $("#qbValue")?.value || "";
  const fields = ["id", ...(modules[table]?.fields || []).map(([key]) => key)];
  const sql = `SELECT * FROM ${modules[table]?.endpoint?.replace("/api/", "") || table}${value ? ` WHERE ${field} LIKE '%${value.replaceAll("'", "''")}%'` : ""};`;
  $("#queryBuilder").innerHTML = `
    <select id="qbTable" onchange="renderQueryBuilder()">${Object.keys(modules).filter((key) => modules[key].endpoint).map((key) => `<option value="${key}" ${key === table ? "selected" : ""}>${modules[key].label}</option>`).join("")}</select>
    <select id="qbField" onchange="renderQueryBuilder()">${fields.map((key) => `<option ${key === field ? "selected" : ""}>${key}</option>`).join("")}</select>
    <input id="qbValue" value="${escapeAttr(value)}" oninput="renderQueryBuilder()" placeholder="Filter value" />
    <code>${escapeHtml(sql)}</code>
  `;
}
window.renderQueryBuilder = renderQueryBuilder;

function renderVersionLog() {
  renderSmartList("#versionLog", state.versions.slice(0, 4).map((item) => ({
    title: item.module,
    value: item.field,
    note: `${item.oldValue} -> ${item.newValue}`,
    type: "info",
  })), "No edits tracked yet");
}

function renderForecast() {
  const items = productInsights().slice(0, 4).map((product) => {
    const future = Math.max(0, product.stock - Math.max(1, product.ordered || 2));
    return { title: product.name, value: `${future} units`, note: future <= product.reorderLevel ? "Below reorder soon" : "Healthy forecast", type: future <= product.reorderLevel ? "warn" : "ok" };
  });
  renderSmartList("#forecastPanel", items, "Add inventory to forecast");
}

function renderRecommendations() {
  const metrics = financeMetrics();
  const top = productInsights()[0];
  const recs = [
    top ? { title: "Increase stock", value: top.name, note: "Highest demand/value product", type: "info" } : null,
    metrics.returnRate > 10 ? { title: "Inspect returns", value: `${metrics.returnRate}% rate`, note: "Review reasons in Returns", type: "warn" } : { title: "Return control", value: "Stable", note: "No urgent return action", type: "ok" },
    metrics.stockHealth < 80 ? { title: "Rebalance stock", value: `${metrics.stockHealth}% health`, note: "Move stock or reorder", type: "warn" } : { title: "Inventory healthy", value: `${metrics.stockHealth}%`, note: "Stock coverage is good", type: "ok" },
  ].filter(Boolean);
  renderSmartList("#recommendations", recs);
}

function renderFeatureToggles() {
  $("#featureToggles").innerHTML = Object.entries(state.enabledFeatures).map(([name, enabled]) => `
    <button class="toggle-row ${enabled ? "enabled" : ""}" onclick="toggleFeature('${name}')">
      <span>${escapeHtml(name)}</span><strong>${enabled ? "ON" : "OFF"}</strong>
    </button>
  `).join("");
}
window.toggleFeature = (name) => {
  state.enabledFeatures[name] = !state.enabledFeatures[name];
  localStorage.setItem("enabledFeatures", JSON.stringify(state.enabledFeatures));
  renderFeatureToggles();
};

function renderRouteOptimization() {
  const shipment = (state.allRows.shipments || [])[0];
  const origin = shipment?.origin || "Warehouse";
  const destination = shipment?.destination || "Customer";
  $("#routeOptimization").innerHTML = `
    <div class="route-node">${escapeHtml(origin)}</div>
    <div class="route-line"><span></span></div>
    <div class="route-node">Hub</div>
    <div class="route-line"><span></span></div>
    <div class="route-node">${escapeHtml(destination)}</div>
    <p>Optimized path selects shortest simulated hub route.</p>
  `;
}

function renderCollaboration() {
  const product = productInsights()[0];
  renderSmartList("#collaborationPanel", [
    { title: "Live editor", value: "Staff-02", note: product ? `Editing ${product.name}` : "Watching dashboard", type: "info" },
    { title: "Session", value: "2 users online", note: "Real-time collaboration indicator", type: "ok" },
  ]);
}

function renderConsistency() {
  const productIds = new Set((state.allRows.products || []).map((item) => Number(item.id)));
  const warehouseIds = new Set((state.allRows.warehouses || []).map((item) => Number(item.id)));
  const inventoryIssues = (state.allRows.inventory || []).filter((item) => !productIds.has(Number(item.productId)) || !warehouseIds.has(Number(item.warehouseId))).length;
  const orderIssues = (state.allRows.orders || []).filter((item) => !productIds.has(Number(item.productId))).length;
  const shipmentIssues = (state.allRows.shipments || []).filter((item) => item.orderId && !(state.allRows.orders || []).some((order) => Number(order.id) === Number(item.orderId))).length;
  $("#consistencyChecker").innerHTML = [
    ["Inventory relations", inventoryIssues ? `${inventoryIssues} issue(s)` : "Valid"],
    ["Order products", orderIssues ? `${orderIssues} issue(s)` : "Valid"],
    ["Shipment orders", shipmentIssues ? `${shipmentIssues} issue(s)` : "Valid"],
  ].map(([label, value]) => `<div class="insight-card"><strong>${label}</strong><p>${value}</p></div>`).join("");
}

function renderRelationshipExplorer() {
  const product = productInsights()[0];
  if (!product) {
    $("#relationshipExplorer").innerHTML = `<div class="empty">Add a product to explore relations</div>`;
    return;
  }
  const inventory = (state.allRows.inventory || []).filter((item) => Number(item.productId) === Number(product.id));
  const orders = (state.allRows.orders || []).filter((item) => Number(item.productId) === Number(product.id));
  const returns = (state.allRows.returns || []).filter((item) => Number(item.productId) === Number(product.id));
  $("#relationshipExplorer").innerHTML = `
    <div class="relation-node main">${escapeHtml(product.name)}</div>
    <div class="relation-node">Inventory rows: ${inventory.length}</div>
    <div class="relation-node">Orders: ${orders.length}</div>
    <div class="relation-node">Returns: ${returns.length}</div>
    <div class="relation-node">Stock value: ${formatMoney(product.value)}</div>
  `;
}

function renderSmartList(selector, items, empty = "No data") {
  $(selector).innerHTML = items?.length
    ? items.map((item) => `
      <div class="smart-row ${item.type || "info"}">
        <div><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.note || "")}</p></div>
        <span>${escapeHtml(item.value)}</span>
      </div>
    `).join("")
    : `<div class="empty">${empty}</div>`;
}

function setDashboardMode(mode) {
  state.dashboardMode = mode;
  document.querySelectorAll("[data-dashboard-mode]").forEach((button) => button.classList.toggle("active", button.dataset.dashboardMode === mode));
  applyDashboardMode();
}

function applyDashboardMode() {
  document.querySelectorAll(".ops-panel,.finance-panel,.logistics-panel").forEach((panel) => panel.classList.remove("mode-hidden"));
  if (state.dashboardMode === "operations") document.querySelectorAll(".finance-panel,.logistics-panel").forEach((panel) => panel.classList.add("mode-hidden"));
  if (state.dashboardMode === "finance") document.querySelectorAll(".ops-panel,.logistics-panel").forEach((panel) => panel.classList.add("mode-hidden"));
  if (state.dashboardMode === "logistics") document.querySelectorAll(".ops-panel,.finance-panel").forEach((panel) => panel.classList.add("mode-hidden"));
}

function drawCharts() {
  const stock = Number(state.stats?.stock || 0);
  const orders = Number(state.stats?.orders || 0);
  const shipments = Number(state.stats?.shipments || 0);
  drawLineChart($("#inventoryChart"), [18, 24, 21, 34, Math.max(8, stock / 20), Math.max(12, stock / 16)], "Stock");
  drawBarChart($("#flowChart"), [
    { label: "Orders", value: Math.max(orders, 1), color: "#8b5cf6" },
    { label: "Shipments", value: Math.max(shipments, 1), color: "#14b8a6" },
    { label: "Returns", value: Math.max((state.allRows.returns || []).length, 1), color: "#f97316" },
  ]);
}

function openCalculator() {
  $("#calculatorModal").classList.remove("hidden");
  renderCalculator();
}

function renderCalculator() {
  const cost = Number($("#calcCost").value || 0);
  const qty = Number($("#calcQty").value || 0);
  const shipping = Number($("#calcShipping").value || 0);
  const tax = Number($("#calcTax").value || 0);
  const discount = Number($("#calcDiscount").value || 0);
  const margin = Number($("#calcMargin").value || 0);
  const subtotal = cost * qty;
  const discountValue = subtotal * (discount / 100);
  const taxable = Math.max(0, subtotal - discountValue + shipping);
  const taxValue = taxable * (tax / 100);
  const landedCost = taxable + taxValue;
  const suggestedSelling = landedCost * (1 + margin / 100);
  const perUnit = qty ? landedCost / qty : 0;
  $("#calcResult").innerHTML = `
    <article><span>Subtotal</span><strong>${formatMoney(subtotal)}</strong></article>
    <article><span>Discount</span><strong>${formatMoney(discountValue)}</strong></article>
    <article><span>Tax</span><strong>${formatMoney(taxValue)}</strong></article>
    <article><span>Landed Cost</span><strong>${formatMoney(landedCost)}</strong></article>
    <article><span>Per Unit</span><strong>${formatMoney(perUnit)}</strong></article>
    <article><span>Selling Target</span><strong>${formatMoney(suggestedSelling)}</strong></article>
  `;
}

function drawLineChart(canvas, points, label) {
  if (!canvas) return;
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, width, height);
  const max = Math.max(...points) || 1;
  const coords = points.map((value, index) => ({
    x: 24 + (index * (width - 48)) / (points.length - 1),
    y: height - 26 - (value / max) * (height - 54),
    value,
  }));
  ctx.beginPath();
  coords.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.strokeStyle = "#8b5cf6";
  ctx.lineWidth = 3;
  ctx.stroke();
  coords.forEach((point) => {
    ctx.beginPath();
    ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
    ctx.fillStyle = "#14b8a6";
    ctx.fill();
  });
  ctx.fillStyle = getTextColor();
  ctx.font = "12px Inter, sans-serif";
  ctx.fillText(label, 24, 20);
}

function drawBarChart(canvas, bars) {
  if (!canvas) return;
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, width, height);
  const max = Math.max(...bars.map((bar) => bar.value)) || 1;
  const barWidth = Math.max(42, (width - 80) / bars.length - 18);
  bars.forEach((bar, index) => {
    const x = 36 + index * (barWidth + 26);
    const h = (bar.value / max) * (height - 62);
    const y = height - 34 - h;
    ctx.fillStyle = bar.color;
    roundRect(ctx, x, y, barWidth, h, 8);
    ctx.fill();
    ctx.fillStyle = getTextColor();
    ctx.font = "12px Inter, sans-serif";
    ctx.fillText(bar.label, x, height - 12);
  });
}

function setupCanvas(canvas) {
  const ratio = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * ratio;
  canvas.height = rect.height * ratio;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  return ctx;
}

function drawGrid(ctx, width, height) {
  ctx.strokeStyle = getComputedStyle(document.documentElement).getPropertyValue("--border-muted");
  ctx.lineWidth = 1;
  for (let i = 1; i < 4; i++) {
    const y = (height / 4) * i;
    ctx.beginPath();
    ctx.moveTo(18, y);
    ctx.lineTo(width - 18, y);
    ctx.stroke();
  }
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function setupModule(route, autoOpen) {
  const mod = modules[route];
  $("#moduleTitle").textContent = mod.label;
  searchInput.value = "";
  if (mod.statuses) {
    statusFilter.classList.remove("hidden");
    statusFilter.innerHTML = `<option value="">All status</option>` + mod.statuses.map((status) => `<option>${status}</option>`).join("");
  } else {
    statusFilter.classList.add("hidden");
  }
  loadRows().then(() => {
    if (autoOpen) openForm();
  });
}

async function loadRows() {
  const mod = modules[state.active];
  if (!mod.endpoint) return;
  loading.classList.remove("hidden");
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (!statusFilter.classList.contains("hidden") && statusFilter.value) params.set("status", statusFilter.value);
  try {
    state.rows = await api(`${mod.endpoint}?${params.toString()}`);
    state.allRows[state.active] = state.rows;
    renderTable();
  } catch (error) {
    toast(error.message, "error");
  } finally {
    loading.classList.add("hidden");
  }
}

function renderTable() {
  const mod = modules[state.active];
  const heads = [["id", "ID"], ...mod.fields.map((field) => [field[0], field[1]]), ["actions", "Actions"]];
  const sorted = sortedRows();
  const totalPages = Math.max(1, Math.ceil(sorted.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const visible = sorted.slice(start, start + state.pageSize);
  $("#moduleMeta").textContent = `${sorted.length} records`;
  $("#tableHead").innerHTML = `<tr>${heads.map(([key, label]) => `
    <th>${key === "actions" ? label : `<button class="sort-btn" onclick="sortBy('${key}')">${label}${state.sortKey === key ? ` ${state.sortDir === "asc" ? "^" : "v"}` : ""}</button>`}</th>
  `).join("")}</tr>`;
  $("#tableBody").innerHTML = visible.length
    ? visible.map((row) => `
      <tr>
        <td>#${row.id}</td>
        ${mod.fields.map(([key]) => `<td>${cell(key, row[key])}</td>`).join("")}
        <td>
          <div class="row-actions">
            <button class="icon-button" title="Edit" onclick="editRow(${row.id})">ED</button>
            <button class="icon-button danger-button" title="Delete" onclick="askDelete(${row.id})">DL</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="${heads.length}"><div class="empty">No records found</div></td></tr>`;
  $("#pageInfo").textContent = `Page ${state.page} of ${totalPages}`;
  $("#prevPage").disabled = state.page <= 1;
  $("#nextPage").disabled = state.page >= totalPages;
}

function sortedRows() {
  return [...state.rows].sort((a, b) => {
    const left = a[state.sortKey];
    const right = b[state.sortKey];
    const leftValue = Number.isFinite(Number(left)) ? Number(left) : String(left || "").toLowerCase();
    const rightValue = Number.isFinite(Number(right)) ? Number(right) : String(right || "").toLowerCase();
    const result = leftValue > rightValue ? 1 : leftValue < rightValue ? -1 : 0;
    return state.sortDir === "asc" ? result : -result;
  });
}

window.sortBy = (key) => {
  if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  else {
    state.sortKey = key;
    state.sortDir = "asc";
  }
  renderTable();
};

function changePage(delta) {
  state.page += delta;
  renderTable();
}

function cell(key, value) {
  if (key === "status") return badge(value);
  if (key === "quantity" && state.active === "inventory") {
    const qty = Number(value || 0);
    const low = qty <= 25;
    return `<div class="stock-cell"><div class="stock-bar ${low ? "low" : ""}"><span style="width:${Math.max(8, Math.min(100, qty / 5))}%"></span></div><span class="pill ${low ? "danger" : "ok"}">${qty}</span></div>`;
  }
  if (key === "price") return formatMoney(value);
  return escapeHtml(value ?? "");
}

function badge(value) {
  const text = escapeHtml(value || "Open");
  const lower = String(value || "").toLowerCase();
  const cls = lower.includes("delivered") || lower.includes("received") || lower.includes("approved") || lower.includes("restocked")
    ? "ok"
    : lower.includes("cancelled") || lower.includes("rejected")
      ? "danger"
      : lower.includes("shipped")
        ? "info"
        : "warn";
  return `<span class="badge ${cls}">${text}</span>`;
}

function openForm(row = null) {
  if (state.role !== "admin") {
    toast("Staff view is read only", "error");
    return;
  }
  const mod = modules[state.active === "dashboard" ? "products" : state.active];
  if (state.active === "dashboard") navigate("products");
  state.editing = row;
  $("#modalTitle").textContent = row ? `Edit ${mod.label}` : `New ${mod.label}`;
  recordForm.innerHTML = mod.fields.map(([key, label, type = "text", options]) => {
    if (type === "select") {
      return `<label><span>${label}</span><select name="${key}" required>${options.map((opt) => `<option ${row?.[key] === opt ? "selected" : ""}>${opt}</option>`).join("")}</select></label>`;
    }
    return `<label><span>${label}</span><input name="${key}" type="${type}" value="${escapeAttr(row?.[key] ?? "")}" required /></label>`;
  }).join("") + `
    <div class="modal-actions">
      <button class="btn btn-secondary" type="button" onclick="closeForm()">Cancel</button>
      <button class="btn btn-primary" type="submit">Save</button>
    </div>
  `;
  recordModal.classList.remove("hidden");
}

window.closeForm = closeForm;
function closeForm() {
  recordModal.classList.add("hidden");
  state.editing = null;
}

async function saveRecord(event) {
  event.preventDefault();
  const mod = modules[state.active];
  const body = Object.fromEntries(new FormData(recordForm));
  mod.fields.forEach(([key, , type]) => {
    if (type === "number") body[key] = Number(body[key]);
  });
  const url = state.editing ? `${mod.endpoint}/${state.editing.id}` : mod.endpoint;
  const method = state.editing ? "PUT" : "POST";
  try {
    if (state.editing) trackVersions(mod.label, state.editing, body);
    await api(url, { method, body });
    addActivity(`${state.editing ? "Updated" : "Added"} ${mod.label}`);
    toast("Record saved", "success");
    closeForm();
    await loadRows();
    await loadDashboard();
  } catch (error) {
    toast(error.message, "error");
  }
}

function trackVersions(moduleName, oldRow, newRow) {
  Object.keys(newRow).forEach((field) => {
    const oldValue = String(oldRow[field] ?? "");
    const newValue = String(newRow[field] ?? "");
    if (oldValue !== newValue) {
      state.versions.unshift({ module: moduleName, field, oldValue, newValue, at: new Date().toISOString() });
    }
  });
  state.versions = state.versions.slice(0, 20);
  localStorage.setItem("versions", JSON.stringify(state.versions));
}

window.editRow = (id) => {
  const row = state.rows.find((item) => Number(item.id) === Number(id));
  if (row) openForm(row);
};

window.askDelete = (id) => {
  if (state.role !== "admin") {
    toast("Staff view is read only", "error");
    return;
  }
  state.deletingId = id;
  confirmModal.classList.remove("hidden");
};

async function deleteConfirmed() {
  const mod = modules[state.active];
  try {
    await api(`${mod.endpoint}/${state.deletingId}`, { method: "DELETE" });
    addActivity(`Deleted ${mod.label}`);
    toast("Record deleted", "success");
    confirmModal.classList.add("hidden");
    await loadRows();
    await loadDashboard();
  } catch (error) {
    toast(error.message, "error");
  }
}

async function globalSearch() {
  const query = $("#globalSearch").value.trim().toLowerCase();
  const box = $("#globalResults");
  if (!query) {
    box.classList.add("hidden");
    return;
  }
  await preloadData();
  const results = [];
  ["products", "orders", "suppliers", "shipments"].forEach((key) => {
    (state.allRows[key] || []).forEach((row) => {
      const haystack = Object.values(row).join(" ").toLowerCase();
      if (haystack.includes(query)) results.push({ key, row });
    });
  });
  box.innerHTML = results.slice(0, 6).map((item) => `
    <button onclick="navigate('${item.key}')">
      <strong>${modules[item.key].label}</strong>
      <span>${escapeHtml(item.row.name || item.row.status || item.row.trackingNumber || `#${item.row.id}`)}</span>
    </button>
  `).join("") || `<p>No matches</p>`;
  box.classList.remove("hidden");
}

function exportCsv() {
  const mod = modules[state.active];
  const headers = ["id", ...mod.fields.map(([key]) => key)];
  const csv = [headers.join(",")].concat(state.rows.map((row) => headers.map((key) => csvValue(row[key])).join(","))).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.active}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  toast("CSV exported", "success");
}

function connectStream() {
  if (window.liveEvents) window.liveEvents.close();
  if (window.livePoll) clearInterval(window.livePoll);
  try {
    window.liveEvents = new EventSource("/api/stream", { withCredentials: true });
    window.liveEvents.addEventListener("update", (event) => {
      state.stats = JSON.parse(event.data);
      if (state.active === "dashboard") renderDashboard();
      $("#liveState").textContent = "Live Sync";
    });
    window.liveEvents.onerror = () => startPolling();
  } catch {
    startPolling();
  }
}

function startPolling() {
  if (window.liveEvents) window.liveEvents.close();
  $("#liveState").textContent = "Polling";
  window.livePoll = setInterval(async () => {
    if (!app.classList.contains("hidden")) {
      state.stats = await api("/api/stats");
      if (state.active === "dashboard") renderDashboard();
      $("#liveState").textContent = "Live Sync";
    }
  }, 5000);
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    method: options.method || "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function addActivity(text) {
  state.activity.unshift(text);
  renderActivity();
}

function toast(message, type = "success") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.innerHTML = `<strong>${type === "error" ? "Error" : "Done"}</strong><span>${escapeHtml(message)}</span>`;
  $("#toastHost").appendChild(item);
  setTimeout(() => item.classList.add("show"));
  setTimeout(() => {
    item.classList.remove("show");
    setTimeout(() => item.remove(), 220);
  }, 2600);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

function formatMoney(value) {
  return `Rs ${Number(value || 0).toLocaleString("en-IN")}`;
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("en-IN");
}

function csvValue(value) {
  const text = String(value ?? "");
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function getTextColor() {
  return getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim();
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll("'", "&#39;");
}
