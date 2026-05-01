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
  activity: ["System synced", "Inventory checked", "Orders reviewed"],
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
  state.stats = await api("/api/stats");
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
  renderAlerts();
  renderCapacity();
  renderTopProducts();
  renderActivity();
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
  const products = [...(state.allRows.products || [])].slice(0, 4);
  $("#topProducts").innerHTML = products.length
    ? products.map((item, index) => `
      <div class="rank-row">
        <span>${index + 1}</span>
        <div><strong>${escapeHtml(item.name)}</strong><p>${escapeHtml(item.category)}</p></div>
        <b>${formatMoney(item.price)}</b>
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
