const coreModules = {
  dashboard: { label: "Dashboard", icon: "DB", kicker: "Overview", pageType: "dashboard" },
  products: {
    label: "Products",
    icon: "PR",
    endpoint: "/api/products",
    kicker: "Catalog",
    pageType: "table",
    fields: [["name", "Name"], ["category", "Category"], ["price", "Price", "number"], ["weight", "Weight", "number"], ["reorderLevel", "Reorder", "number"]],
  },
  warehouses: {
    label: "Warehouses",
    icon: "WH",
    endpoint: "/api/warehouses",
    kicker: "Storage",
    pageType: "table",
    fields: [["name", "Name"], ["location", "Location"], ["capacity", "Capacity", "number"], ["storageType", "Storage"]],
  },
  inventory: {
    label: "Inventory",
    icon: "IN",
    endpoint: "/api/inventory",
    kicker: "Stock",
    pageType: "table",
    fields: [["productId", "Product ID", "number"], ["warehouseId", "Warehouse ID", "number"], ["quantity", "Qty", "number"]],
  },
  suppliers: {
    label: "Suppliers",
    icon: "SP",
    endpoint: "/api/suppliers",
    kicker: "Partners",
    pageType: "table",
    fields: [["name", "Name"], ["contactPerson", "Contact"], ["email", "Email", "email"], ["phone", "Phone"], ["address", "Address"], ["creditLimit", "Credit Limit", "number"]],
  },
  orders: {
    label: "Orders",
    icon: "PO",
    endpoint: "/api/orders",
    kicker: "Purchasing",
    pageType: "table",
    statuses: ["Pending", "Approved", "Received", "Cancelled"],
    fields: [["supplierId", "Supplier ID", "number"], ["productId", "Product ID", "number"], ["quantity", "Qty", "number"], ["status", "Status", "select", ["Pending", "Approved", "Received", "Cancelled"]], ["expectedDate", "ETA", "date"]],
  },
  shipments: {
    label: "Shipments",
    icon: "SH",
    endpoint: "/api/shipments",
    kicker: "Tracking",
    pageType: "table",
    statuses: ["Pending", "Shipped", "Delivered"],
    fields: [["orderId", "Order ID", "number"], ["trackingNumber", "Track #"], ["carrier", "Carrier"], ["status", "Status", "select", ["Pending", "Shipped", "Delivered"]], ["origin", "Origin"], ["destination", "Destination"], ["shipDate", "Ship", "date"], ["deliveryDate", "Delivery", "date"]],
  },
  returns: {
    label: "Returns",
    icon: "RT",
    endpoint: "/api/returns",
    kicker: "Reverse Flow",
    pageType: "table",
    statuses: ["Requested", "Approved", "Rejected", "Restocked"],
    fields: [["productId", "Product ID", "number"], ["shipmentId", "Shipment ID", "number"], ["quantity", "Qty", "number"], ["reason", "Reason"], ["status", "Status", "select", ["Requested", "Approved", "Rejected", "Restocked"]]],
  },
  payments: {
    label: "Payments",
    icon: "PY",
    endpoint: "/api/payments",
    kicker: "Finance",
    pageType: "table",
    statuses: ["Recorded", "Cleared", "Failed"],
    fields: [["supplierId", "Supplier ID", "number"], ["orderId", "Order ID", "number"], ["amount", "Amount", "number"], ["paymentDate", "Payment Date", "date"], ["method", "Method"], ["status", "Status", "select", ["Recorded", "Cleared", "Failed"]]],
  },
  batches: {
    label: "Product Batches",
    icon: "BT",
    endpoint: "/api/batches",
    kicker: "Traceability",
    pageType: "table",
    statuses: ["Active", "Hold", "Expired", "Recalled"],
    fields: [["batchCode", "Batch Code"], ["productId", "Product ID", "number"], ["supplierId", "Supplier ID", "number"], ["quantity", "Qty", "number"], ["receivedDate", "Received", "date"], ["expiryDate", "Expiry", "date"], ["status", "Status", "select", ["Active", "Hold", "Expired", "Recalled"]]],
  },
};

const advancedModules = {
  routing: { label: "Smart Routing", icon: "SR", kicker: "Operations", endpoint: "/api/routing", description: "Find the best fulfillment warehouse from inventory and order context." },
  twin: { label: "Digital Twin", icon: "DT", kicker: "Operations", endpoint: "/api/routing", description: "Monitor warehouse utilization as a spatial operational twin." },
  forecast: { label: "Forecast & Predictions", icon: "FC", kicker: "Analytics", endpoint: "/api/forecast", description: "Generate demand and delivery risk forecast from historical flow." },
  rca: { label: "Root Cause Analysis", icon: "RC", kicker: "Analytics", endpoint: "/api/rca", description: "Explain why low stock, delays, and return pressure are happening." },
  insights: { label: "Business Insights", icon: "BI", kicker: "Analytics", endpoint: "/api/insights", description: "Convert live operations data into actionable recommendations." },
  ledger: { label: "Supplier Ledger", icon: "SL", kicker: "Finance", endpoint: "/api/finance", description: "Track supplier payments, total paid amount, and outstanding dues." },
  billing: { label: "Order Billing & Invoices", icon: "IV", kicker: "Finance", endpoint: "/api/billing", description: "Generate order invoice totals with tax and downloadable invoice data." },
  credit: { label: "Supplier Credit Control", icon: "CR", kicker: "Finance", endpoint: "/api/credit", description: "Monitor supplier credit limits, used credit, and remaining credit." },
  approvals: { label: "Order Approval Workflow", icon: "AP", kicker: "Workflow", endpoint: "/api/approvals", description: "Review purchase orders by approval state before shipment processing." },
  pricing: { label: "Dynamic Pricing Engine", icon: "DP", kicker: "Analytics", endpoint: "/api/pricing", description: "Calculate price movement from demand and stock level signals." },
  batchflow: { label: "Batch Tracking", icon: "BT", kicker: "Traceability", endpoint: "/api/batches/summary", description: "Trace product batches by product, supplier, quantity, and quality status." },
};

const navGroups = [
  { title: "Core Modules", routes: Object.keys(coreModules) },
  { title: "Advanced Intelligence", routes: Object.keys(advancedModules) },
];

const allModules = { ...coreModules, ...advancedModules };
const routeAliases = { insghts: "insights" };
const endpointAliases = { "/api/insghts": "/api/insights" };

const state = {
  active: "dashboard",
  rows: [],
  allRows: {},
  editing: null,
  deletingId: null,
  role: localStorage.getItem("role") || "admin",
  sortKey: "id",
  sortDir: "desc",
  page: 1,
  pageSize: 10,
  activity: ["System synced", "Inventory checked", "Orders reviewed"],
  dashboardStats: null,
  advancedCache: {},
};

const $ = (s) => document.querySelector(s);
const nav = $("#nav");
const login = $("#login");
const app = $("#app");
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
  nav.innerHTML = navGroups.map((group) => `
    <section class="nav-group">
      <h4>${group.title}</h4>
      ${group.routes.map((key) => {
        const mod = allModules[key];
        return `<button class="nav-btn ${key === state.active ? "active" : ""}" data-route="${key}" title="${mod.label}"><span class="nav-ico">${mod.icon}</span><span>${mod.label}</span></button>`;
      }).join("")}
    </section>
  `).join("");
}

function bindEvents() {
  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await api("/api/login", { method: "POST", body: Object.fromEntries(new FormData(e.currentTarget)) });
      showApp();
      toast("Welcome back", "success");
    } catch (error) { toast(error.message, "error"); }
  });

  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-route]");
    if (!btn) return;
    navigate(btn.dataset.route);
  });

  $("#collapseBtn").addEventListener("click", () => app.classList.toggle("collapsed"));
  $("#themeToggle").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
  $("#quickAddBtn").addEventListener("click", () => navigate("products", true));
  $("#fabBtn").addEventListener("click", () => openForm());
  $("#newBtn").addEventListener("click", () => openForm());
  $("#closeModal").addEventListener("click", closeForm);
  recordModal.addEventListener("click", (e) => { if (e.target === recordModal) closeForm(); });
  recordForm.addEventListener("submit", saveRecord);

  searchInput.addEventListener("input", debounce(() => { state.page = 1; loadRows(); }, 200));
  statusFilter.addEventListener("change", () => { state.page = 1; loadRows(); });
  $("#pageSize").addEventListener("change", (e) => { state.pageSize = Number(e.target.value); state.page = 1; renderTable(); });
  $("#prevPage").addEventListener("click", () => changePage(-1));
  $("#nextPage").addEventListener("click", () => changePage(1));
  $("#exportCsvBtn").addEventListener("click", exportCsv);
  $("#exportPdfBtn").addEventListener("click", () => window.print());

  $("#cancelDelete").addEventListener("click", () => confirmModal.classList.add("hidden"));
  $("#confirmDelete").addEventListener("click", deleteConfirmed);

  $("#profileBtn").addEventListener("click", () => $("#profileMenu").classList.toggle("hidden"));
  $("#roleToggle").addEventListener("click", () => setRole(state.role === "admin" ? "staff" : "admin"));
  $("#logoutBtn").addEventListener("click", logout);
  $("#notificationBtn").addEventListener("click", () => $("#notificationMenu").classList.toggle("hidden"));

  $("#globalSearch").addEventListener("input", debounce(globalSearch, 150));
  $("#advancedRunBtn").addEventListener("click", () => runAdvancedModule(state.active, true));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeForm();
      confirmModal.classList.add("hidden");
      $("#profileMenu").classList.add("hidden");
      $("#notificationMenu").classList.add("hidden");
      $("#globalResults").classList.add("hidden");
    }
  });

  window.addEventListener("hashchange", () => {
    const rawRoute = (window.location.hash || "#dashboard").slice(1);
    const route = routeAliases[rawRoute] || rawRoute;
    if (allModules[route]) navigate(route);
    else navigate("dashboard");
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
}

async function showApp() {
  login.classList.add("hidden");
  app.classList.remove("hidden");
  const rawRoute = (window.location.hash || "#dashboard").slice(1);
  navigate(routeAliases[rawRoute] || rawRoute);
  connectStream();
}

function navigate(route, autoOpen = false) {
  route = routeAliases[route] || route;
  if (!allModules[route]) route = "dashboard";
  const mod = allModules[route];
  state.active = route;
  state.page = 1;
  state.sortKey = "id";
  state.sortDir = "desc";
  $("#pageTitle").textContent = mod.label;
  $("#pageKicker").textContent = mod.kicker || "Workspace";
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.route === route));
  $("#dashboard").classList.toggle("active", route === "dashboard");
  $("#module").classList.toggle("active", coreModules[route]?.pageType === "table");
  $("#advanced").classList.toggle("active", Boolean(advancedModules[route]));
  window.history.replaceState(null, "", `#${route}`);

  if (route === "dashboard") loadDashboard();
  else if (coreModules[route]?.pageType === "table") setupModule(route, autoOpen);
  else if (advancedModules[route]) runAdvancedModule(route, false);
}

async function preloadData() {
  const targets = ["products", "warehouses", "inventory", "orders", "shipments", "suppliers", "returns", "payments", "batches"];
  await Promise.all(targets.map(async (key) => {
    try { state.allRows[key] = await api(coreModules[key].endpoint); }
    catch { state.allRows[key] = []; }
  }));
}

async function loadDashboard() {
  state.dashboardStats = await api("/api/stats");
  await preloadData();
  renderDashboard();
}

function renderDashboard() {
  const stats = state.dashboardStats || {};
  renderStats([
    ["Products", stats.products || 0, "PR"],
    ["Warehouses", stats.warehouses || 0, "WH"],
    ["Available Stock", stats.stock || 0, "IN"],
    ["Active Shipments", stats.shipments || 0, "SH"],
    ["Pending Orders", stats.orders || 0, "PO"],
  ]);
  renderAlerts();
  renderPendingOrders();
  renderCapacity();
  renderActivity();
  drawCharts();
}

function renderStats(items) {
  $("#statGrid").classList.remove("skeleton-grid");
  $("#statGrid").innerHTML = items.map(([label, value, icon]) => cardStat(label, formatNumber(value), icon)).join("");
}

function renderAlerts() {
  const alerts = state.dashboardStats?.lowStock || [];
  $("#alerts").innerHTML = alerts.length ? alerts.slice(0, 6).map((item) => rowSmart(item.product, `Qty ${item.quantity} / Reorder ${item.reorderLevel}`, "Low", "danger")).join("") : `<div class="empty">No low stock alerts</div>`;
  $("#noticeCount").textContent = String(Math.max(1, alerts.length));
}

function renderPendingOrders() {
  const orders = (state.allRows.orders || []).filter((o) => String(o.status || "").toLowerCase() === "pending").slice(0, 6);
  $("#pendingOrders").innerHTML = orders.length ? orders.map((item) => rowSmart(`Order #${item.id}`, `Product ${item.productId} | Qty ${item.quantity}`, item.expectedDate || "No ETA", "warn")).join("") : `<div class="empty">No pending orders</div>`;
}

function renderCapacity() {
  const warehouses = state.allRows.warehouses || [];
  const inventory = state.allRows.inventory || [];
  $("#capacityList").innerHTML = warehouses.length ? warehouses.map((warehouse) => {
    const used = inventory.filter((i) => Number(i.warehouseId) === Number(warehouse.id)).reduce((sum, i) => sum + Number(i.quantity || 0), 0);
    const pct = Math.min(100, Math.round((used / Math.max(1, Number(warehouse.capacity || 1))) * 100));
    return `<div class="progress-row"><div><strong>${escapeHtml(warehouse.name)}</strong><span>${escapeHtml(warehouse.location)}</span></div><div class="progress-track"><span style="width:${pct}%"></span></div><b>${pct}%</b></div>`;
  }).join("") : `<div class="empty">No warehouses</div>`;
}

function renderActivity() {
  $("#activityList").innerHTML = state.activity.slice(0, 5).map((item) => `<div class="timeline-row"><span></span><p>${escapeHtml(item)}</p><b>now</b></div>`).join("");
}

async function runAdvancedModule(route, userInitiated) {
  const meta = advancedModules[route];
  if (!meta) return;
  $("#advancedTitle").textContent = meta.label;
  $("#advancedDescription").textContent = meta.description;
  $("#advancedRunBtn").textContent = userInitiated ? "Refresh" : "Run Analysis";

  const content = $("#advancedContent");
  content.innerHTML = `<div class="empty">Running ${escapeHtml(meta.label)}...</div>`;
  try {
    const payload = await api(meta.endpoint);
    state.advancedCache[route] = payload;
  } catch (error) {
    content.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
    return;
  }

  renderAdvanced(route, state.advancedCache[route]);
}

function renderAdvanced(route, payload) {
  const content = $("#advancedContent");
  if (route === "routing") {
    const rows = payload.routes || [];
    content.innerHTML = `<div class="advanced-grid">${rows.map((row) => `<article class="panel"><div class="panel-head"><div><h3>${escapeHtml(row.orderRef)}</h3><p>${escapeHtml(row.reason)}</p></div><span class="pill ok">Best</span></div><div class="smart-list">${rowSmart("Warehouse", row.warehouse, row.location, "info")}${rowSmart("Coverage", `${row.available} units`, `Required ${row.required}`, "ok")}</div></article>`).join("") || `<div class="empty">No route suggestions</div>`}</div>`;
    return;
  }
  if (route === "twin") {
    const zones = payload.warehouseLoad || [];
    content.innerHTML = `<div class="twin-grid">${zones.map((z) => `<div class="twin-cell ${z.utilization >= 85 ? "over" : z.utilization < 40 ? "free" : ""}"><strong>${escapeHtml(String(z.code || "Z"))}</strong><span>${escapeHtml(z.name)}</span><p>${z.utilization}% utilized</p></div>`).join("")}</div>`;
    return;
  }
  if (route === "forecast") {
    const rows = payload.forecast || [];
    content.innerHTML = `<div class="advanced-grid">${rows.map((row) => `<article class="panel"><div class="panel-head"><div><h3>${escapeHtml(row.product)}</h3><p>Projected demand ${row.projectedDemand}</p></div><span class="pill ${row.projectedStock <= row.reorderLevel ? "warn" : "ok"}">${row.risk}</span></div><div class="smart-list">${rowSmart("Projected Stock", String(row.projectedStock), `Reorder ${row.reorderLevel}`, "info")}${rowSmart("Recommended Reorder", String(row.reorderQty), "Units", "warn")}</div></article>`).join("")}</div>`;
    return;
  }
  if (route === "rca" || route === "consistency") {
    const issues = route === "rca" ? payload.rootCauses || [] : payload.consistency || [];
    content.innerHTML = `<div class="advanced-grid">${issues.map((issue) => `<article class="panel"><div class="panel-head"><div><h3>${escapeHtml(issue.title)}</h3><p>${escapeHtml(issue.detail)}</p></div><span class="pill ${issue.severity === "high" ? "danger" : issue.severity === "medium" ? "warn" : "ok"}">${escapeHtml(issue.severity)}</span></div></article>`).join("") || `<div class="empty">No issues detected</div>`}</div>`;
    return;
  }
  if (route === "insights") {
    content.innerHTML = `<div class="insight-grid">${(payload.insights || []).map((text) => `<div class="insight-card">${escapeHtml(text)}</div>`).join("")}</div>`;
    return;
  }
  if (route === "ledger") {
    content.innerHTML = `<div class="advanced-grid">${(payload.suppliers || []).map((row) => `<article class="panel"><div class="panel-head"><div><h3>${escapeHtml(row.supplier)}</h3><p>${escapeHtml(row.lastPayment || "No payment recorded")}</p></div><span class="pill ${Number(row.outstanding) > 0 ? "warn" : "ok"}">${formatMoney(row.outstanding)}</span></div><div class="smart-list">${rowSmart("Total Paid", formatMoney(row.totalPaid), "Paid", "ok")}${rowSmart("Order Value", formatMoney(row.orderValue), "Debit", "info")}${rowSmart("Transactions", String(row.paymentCount), "Rows", "info")}</div></article>`).join("") || `<div class="empty">No supplier ledger data</div>`}</div>`;
    return;
  }
  if (route === "billing") {
    content.innerHTML = `<div class="advanced-grid">${(payload.invoices || []).map((row) => `<article class="panel"><div class="panel-head"><div><h3>Invoice #${escapeHtml(row.id)}</h3><p>Order #${escapeHtml(row.orderId)} | ${escapeHtml(row.product)}</p></div><button class="btn btn-secondary" onclick="downloadInvoice(${Number(row.id)})">PDF</button></div><div class="smart-list">${rowSmart("Order Cost", formatMoney(row.orderCost), "Base", "info")}${rowSmart("Tax", formatMoney(row.taxAmount), "18%", "warn")}${rowSmart("Total", formatMoney(row.totalAmount), escapeHtml(row.status), "ok")}</div></article>`).join("") || `<div class="empty">No invoices generated</div>`}</div>`;
    return;
  }
  if (route === "credit") {
    content.innerHTML = `<div class="advanced-grid">${(payload.credit || []).map((row) => `<article class="panel"><div class="panel-head"><div><h3>${escapeHtml(row.supplier)}</h3><p>Credit limit ${formatMoney(row.creditLimit)}</p></div><span class="pill ${row.remainingCredit < 0 ? "danger" : row.remainingCredit < row.creditLimit * 0.25 ? "warn" : "ok"}">${formatMoney(row.remainingCredit)}</span></div><div class="smart-list">${rowSmart("Used Credit", formatMoney(row.usedCredit), `${row.usedPercent}%`, row.usedPercent > 80 ? "danger" : "warn")}${rowSmart("Outstanding", formatMoney(row.outstanding), "Due", "info")}</div></article>`).join("") || `<div class="empty">No supplier credit data</div>`}</div>`;
    return;
  }
  if (route === "approvals") {
    content.innerHTML = `<div class="advanced-grid">${(payload.orders || []).map((row) => `<article class="panel"><div class="panel-head"><div><h3>Order #${escapeHtml(row.id)}</h3><p>${escapeHtml(row.product)} from ${escapeHtml(row.supplier)}</p></div><span class="pill ${String(row.status).toLowerCase() === "approved" ? "ok" : String(row.status).toLowerCase() === "rejected" ? "danger" : "warn"}">${escapeHtml(row.status)}</span></div><div class="smart-list">${rowSmart("Quantity", String(row.quantity), "Units", "info")}${rowSmart("Next Step", row.nextStep, row.expectedDate || "No ETA", "warn")}</div></article>`).join("") || `<div class="empty">No orders in workflow</div>`}</div>`;
    return;
  }
  if (route === "pricing") {
    content.innerHTML = `<div class="advanced-grid">${(payload.prices || []).map((row) => `<article class="panel"><div class="panel-head"><div><h3>${escapeHtml(row.product)}</h3><p>Demand ${row.demand} | Stock ${row.stock}</p></div><span class="pill ${row.adjustment > 0 ? "warn" : row.adjustment < 0 ? "ok" : "info"}">${row.adjustment > 0 ? "+" : ""}${row.adjustment}%</span></div><div class="smart-list">${rowSmart("Current Price", formatMoney(row.currentPrice), "Base", "info")}${rowSmart("Suggested Price", formatMoney(row.suggestedPrice), row.reason, row.adjustment > 0 ? "warn" : "ok")}</div></article>`).join("") || `<div class="empty">No pricing data</div>`}</div>`;
    return;
  }
  if (route === "batchflow") {
    content.innerHTML = `<div class="advanced-grid">${(payload.batches || []).map((row) => `<article class="panel"><div class="panel-head"><div><h3>${escapeHtml(row.batchCode)}</h3><p>${escapeHtml(row.product)} | ${escapeHtml(row.supplier)}</p></div><span class="pill ${String(row.status).toLowerCase() === "active" ? "ok" : "warn"}">${escapeHtml(row.status)}</span></div><div class="smart-list">${rowSmart("Quantity", String(row.quantity), "Units", "info")}${rowSmart("Received", row.receivedDate, row.expiryDate || "No expiry", "ok")}</div></article>`).join("") || `<div class="empty">No product batches recorded</div>`}</div>`;
    return;
  }
}

function cardStat(label, value, icon) {
  return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div><div><strong>${value}</strong><span class="trend flat">- live</span></div></article>`;
}

function rowSmart(title, note, value, type = "info") {
  return `<div class="smart-row ${type}"><div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(note || "")}</p></div><span>${escapeHtml(String(value ?? ""))}</span></div>`;
}

function drawCharts() {
  const stock = Number(state.dashboardStats?.stock || 0);
  const orders = Number(state.dashboardStats?.orders || 0);
  const shipments = Number(state.dashboardStats?.shipments || 0);
  drawLineChart($("#inventoryChart"), [18, 24, 21, 34, Math.max(8, stock / 20), Math.max(12, stock / 16)], "Stock");
  drawBarChart($("#flowChart"), [
    { label: "Orders", value: Math.max(orders, 1), color: "#8b5cf6" },
    { label: "Shipments", value: Math.max(shipments, 1), color: "#14b8a6" },
    { label: "Returns", value: Math.max((state.allRows.returns || []).length, 1), color: "#f97316" },
  ]);
}

function setupModule(route, autoOpen) {
  const mod = coreModules[route];
  $("#moduleTitle").textContent = mod.label;
  searchInput.value = "";
  if (mod.statuses) {
    statusFilter.classList.remove("hidden");
    statusFilter.innerHTML = `<option value="">All status</option>${mod.statuses.map((status) => `<option>${status}</option>`).join("")}`;
  } else {
    statusFilter.classList.add("hidden");
  }
  loadRows().then(() => { if (autoOpen) openForm(); });
}

async function loadRows() {
  const mod = coreModules[state.active];
  if (!mod?.endpoint) return;
  loading.classList.remove("hidden");
  const params = new URLSearchParams();
  if (searchInput.value.trim()) params.set("q", searchInput.value.trim());
  if (!statusFilter.classList.contains("hidden") && statusFilter.value) params.set("status", statusFilter.value);
  try {
    state.rows = await api(`${mod.endpoint}?${params.toString()}`);
    state.allRows[state.active] = state.rows;
    renderTable();
  } catch (error) { toast(error.message, "error"); }
  finally { loading.classList.add("hidden"); }
}

function renderTable() {
  const mod = coreModules[state.active];
  if (!mod) return;
  const heads = [["id", "ID"], ...mod.fields.map((f) => [f[0], f[1]]), ["actions", "Actions"]];
  const sorted = sortedRows();
  const totalPages = Math.max(1, Math.ceil(sorted.length / state.pageSize));
  state.page = Math.min(state.page, totalPages);
  const start = (state.page - 1) * state.pageSize;
  const visible = sorted.slice(start, start + state.pageSize);
  $("#moduleMeta").textContent = `${sorted.length} records`;
  $("#tableHead").innerHTML = `<tr>${heads.map(([key, label]) => `<th>${key === "actions" ? label : `<button class="sort-btn" onclick="sortBy('${key}')">${label}${state.sortKey === key ? ` ${state.sortDir === "asc" ? "^" : "v"}` : ""}</button>`}</th>`).join("")}</tr>`;
  $("#tableBody").innerHTML = visible.length ? visible.map((row) => `<tr><td>#${row.id}</td>${mod.fields.map(([key]) => `<td>${cell(key, row[key])}</td>`).join("")}<td><div class="row-actions"><button class="icon-button" onclick="editRow(${row.id})">ED</button><button class="icon-button danger-button" onclick="askDelete(${row.id})">DL</button></div></td></tr>`).join("") : `<tr><td colspan="${heads.length}"><div class="empty">No records found</div></td></tr>`;
  $("#pageInfo").textContent = `Page ${state.page} of ${totalPages}`;
  $("#prevPage").disabled = state.page <= 1;
  $("#nextPage").disabled = state.page >= totalPages;
}

function sortedRows() {
  return [...state.rows].sort((a, b) => {
    const left = a[state.sortKey];
    const right = b[state.sortKey];
    const lv = Number.isFinite(Number(left)) ? Number(left) : String(left || "").toLowerCase();
    const rv = Number.isFinite(Number(right)) ? Number(right) : String(right || "").toLowerCase();
    const out = lv > rv ? 1 : lv < rv ? -1 : 0;
    return state.sortDir === "asc" ? out : -out;
  });
}

window.sortBy = (key) => {
  if (state.sortKey === key) state.sortDir = state.sortDir === "asc" ? "desc" : "asc";
  else { state.sortKey = key; state.sortDir = "asc"; }
  renderTable();
};

function changePage(delta) { state.page += delta; renderTable(); }

function cell(key, value) {
  if (key === "status") return badge(value);
  if (key === "quantity" && state.active === "inventory") {
    const qty = Number(value || 0);
    const low = qty <= 25;
    return `<div class="stock-cell"><div class="stock-bar ${low ? "low" : ""}"><span style="width:${Math.max(8, Math.min(100, qty / 5))}%"></span></div><span class="pill ${low ? "danger" : "ok"}">${qty}</span></div>`;
  }
  if (["price", "amount", "creditLimit"].includes(key)) return formatMoney(value);
  return escapeHtml(value ?? "");
}

function badge(value) {
  const text = escapeHtml(value || "Open");
  const lower = String(value || "").toLowerCase();
  const cls = lower.includes("delivered") || lower.includes("received") || lower.includes("approved") || lower.includes("restocked") ? "ok" : lower.includes("cancelled") || lower.includes("rejected") ? "danger" : lower.includes("shipped") ? "info" : "warn";
  return `<span class="badge ${cls}">${text}</span>`;
}

function openForm(row = null) {
  if (state.role !== "admin") return toast("Staff view is read only", "error");
  const route = state.active === "dashboard" || advancedModules[state.active] ? "products" : state.active;
  const mod = coreModules[route];
  if (state.active !== route) navigate(route);
  state.editing = row;
  $("#modalTitle").textContent = row ? `Edit ${mod.label}` : `New ${mod.label}`;
  recordForm.innerHTML = mod.fields.map(([key, label, type = "text", options]) => type === "select" ? `<label><span>${label}</span><select name="${key}" required>${options.map((opt) => `<option ${row?.[key] === opt ? "selected" : ""}>${opt}</option>`).join("")}</select></label>` : `<label><span>${label}</span><input name="${key}" type="${type}" value="${escapeAttr(row?.[key] ?? "")}" required /></label>`).join("") + `<div class="modal-actions"><button class="btn btn-secondary" type="button" onclick="closeForm()">Cancel</button><button class="btn btn-primary" type="submit">Save</button></div>`;
  recordModal.classList.remove("hidden");
}

window.closeForm = closeForm;
function closeForm() { recordModal.classList.add("hidden"); state.editing = null; }

async function saveRecord(event) {
  event.preventDefault();
  const mod = coreModules[state.active];
  const body = Object.fromEntries(new FormData(recordForm));
  mod.fields.forEach(([key, , type]) => { if (type === "number") body[key] = Number(body[key]); });
  const url = state.editing ? `${mod.endpoint}/${state.editing.id}` : mod.endpoint;
  const method = state.editing ? "PUT" : "POST";
  try {
    await api(url, { method, body });
    state.activity.unshift(`${state.editing ? "Updated" : "Added"} ${mod.label}`);
    toast("Record saved", "success");
    closeForm();
    await loadRows();
    await loadDashboard();
  } catch (error) { toast(error.message, "error"); }
}

window.editRow = (id) => { const row = state.rows.find((r) => Number(r.id) === Number(id)); if (row) openForm(row); };
window.askDelete = (id) => { if (state.role !== "admin") return toast("Staff view is read only", "error"); state.deletingId = id; confirmModal.classList.remove("hidden"); };

async function deleteConfirmed() {
  const mod = coreModules[state.active];
  try {
    await api(`${mod.endpoint}/${state.deletingId}`, { method: "DELETE" });
    state.activity.unshift(`Deleted ${mod.label}`);
    confirmModal.classList.add("hidden");
    await loadRows();
    await loadDashboard();
    toast("Record deleted", "success");
  } catch (error) { toast(error.message, "error"); }
}

async function globalSearch() {
  const query = $("#globalSearch").value.trim().toLowerCase();
  const box = $("#globalResults");
  if (!query) return box.classList.add("hidden");
  await preloadData();
  const results = [];
  ["products", "orders", "suppliers", "shipments", "returns"].forEach((key) => {
    (state.allRows[key] || []).forEach((row) => {
      if (Object.values(row).join(" ").toLowerCase().includes(query)) results.push({ key, row });
    });
  });
  box.innerHTML = results.slice(0, 7).map((item) => `<button onclick="navigate('${item.key}')"><strong>${coreModules[item.key].label}</strong><span>${escapeHtml(item.row.name || item.row.status || item.row.trackingNumber || `#${item.row.id}`)}</span></button>`).join("") || `<p>No matches</p>`;
  box.classList.remove("hidden");
}

window.downloadInvoice = (id) => {
  const invoice = (state.advancedCache.billing?.invoices || []).find((row) => Number(row.id) === Number(id));
  if (!invoice) return toast("Invoice not found", "error");
  const doc = window.open("", "_blank", "width=720,height=840");
  if (!doc) return toast("Popup blocked", "error");
  doc.document.write(`
    <html><head><title>Invoice ${escapeHtml(invoice.id)}</title><style>
      body{font-family:Arial,sans-serif;padding:32px;color:#111}
      h1{margin:0 0 6px}.muted{color:#666}.box{border:1px solid #ddd;padding:16px;margin:18px 0}
      table{width:100%;border-collapse:collapse;margin-top:16px}td,th{border-bottom:1px solid #ddd;padding:10px;text-align:left}
      .total{font-size:22px;font-weight:700}
    </style></head><body>
      <h1>LoGiWare Invoice #${escapeHtml(invoice.id)}</h1>
      <p class="muted">Order #${escapeHtml(invoice.orderId)} | ${escapeHtml(invoice.invoiceDate)}</p>
      <div class="box"><strong>Product:</strong> ${escapeHtml(invoice.product)}<br><strong>Supplier:</strong> ${escapeHtml(invoice.supplier)}</div>
      <table><tr><th>Description</th><th>Amount</th></tr>
        <tr><td>Order Cost</td><td>${formatMoney(invoice.orderCost)}</td></tr>
        <tr><td>Tax</td><td>${formatMoney(invoice.taxAmount)}</td></tr>
        <tr><td class="total">Total</td><td class="total">${formatMoney(invoice.totalAmount)}</td></tr>
      </table>
      <script>window.print();<\/script>
    </body></html>
  `);
  doc.document.close();
};

function exportCsv() {
  const mod = coreModules[state.active];
  const headers = ["id", ...mod.fields.map(([key]) => key)];
  const csv = [headers.join(",")].concat(state.rows.map((row) => headers.map((k) => csvValue(row[k])).join(","))).join("\n");
  const blob = new Blob([csv], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${state.active}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function connectStream() {
  if (window.liveEvents) window.liveEvents.close();
  try {
    window.liveEvents = new EventSource("/api/stream", { withCredentials: true });
    window.liveEvents.addEventListener("update", (event) => {
      state.dashboardStats = JSON.parse(event.data);
      if (state.active === "dashboard") renderDashboard();
      $("#liveState").textContent = "Live Sync";
    });
  } catch {
    setInterval(async () => {
      state.dashboardStats = await api("/api/stats");
      if (state.active === "dashboard") renderDashboard();
    }, 5000);
  }
}

async function api(url, options = {}) {
  const finalUrl = endpointAliases[url] || url;
  const response = await fetch(finalUrl, {
    method: options.method || "GET",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed");
  return data;
}

function drawLineChart(canvas, points, label) {
  if (!canvas) return;
  const ctx = setupCanvas(canvas);
  const { width, height } = canvas.getBoundingClientRect();
  ctx.clearRect(0, 0, width, height);
  drawGrid(ctx, width, height);
  const max = Math.max(...points) || 1;
  const coords = points.map((value, index) => ({ x: 24 + (index * (width - 48)) / (points.length - 1), y: height - 26 - (value / max) * (height - 54) }));
  ctx.beginPath();
  coords.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y));
  ctx.strokeStyle = "#8b5cf6";
  ctx.lineWidth = 3;
  ctx.stroke();
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

function toast(message, type = "success") {
  const item = document.createElement("div");
  item.className = `toast ${type}`;
  item.innerHTML = `<strong>${type === "error" ? "Error" : "Done"}</strong><span>${escapeHtml(message)}</span>`;
  $("#toastHost").appendChild(item);
  setTimeout(() => item.classList.add("show"));
  setTimeout(() => { item.classList.remove("show"); setTimeout(() => item.remove(), 220); }, 2400);
}

function debounce(fn, ms) { let timer; return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); }; }
function formatMoney(value) { return `Rs ${Number(value || 0).toLocaleString("en-IN")}`; }
function formatNumber(value) { return Number(value || 0).toLocaleString("en-IN"); }
function csvValue(value) { const text = String(value ?? ""); return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text; }
function getTextColor() { return getComputedStyle(document.documentElement).getPropertyValue("--text-primary").trim(); }
function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;"); }
function escapeAttr(value) { return escapeHtml(value).replaceAll("'", "&#39;"); }
