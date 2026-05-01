const modules = {
  dashboard: { label: "Dashboard", icon: "DB" },
  products: {
    label: "Products",
    icon: "PR",
    endpoint: "/api/products",
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
  editing: null,
  stats: null,
};

const $ = (selector) => document.querySelector(selector);
const nav = $("#nav");
const login = $("#login");
const app = $("#app");
const dashboardPage = $("#dashboard");
const modulePage = $("#module");
const formPanel = $("#formPanel");
const recordForm = $("#recordForm");
const searchInput = $("#searchInput");
const statusFilter = $("#statusFilter");
const loading = $("#loading");

init();

async function init() {
  buildNav();
  bindEvents();
  document.documentElement.dataset.theme = localStorage.getItem("theme") || "light";
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
    const body = Object.fromEntries(new FormData(event.currentTarget));
    try {
      await api("/api/login", { method: "POST", body });
      showApp();
    } catch (error) {
      toast(error.message);
    }
  });

  nav.addEventListener("click", (event) => {
    const button = event.target.closest("[data-route]");
    if (button) navigate(button.dataset.route);
  });

  $("#logoutBtn").addEventListener("click", async () => {
    await api("/api/logout", { method: "POST", body: {} });
    app.classList.add("hidden");
    login.classList.remove("hidden");
  });

  $("#themeToggle").addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    localStorage.setItem("theme", next);
  });

  $("#newBtn").addEventListener("click", () => openForm());
  searchInput.addEventListener("input", debounce(loadRows, 240));
  statusFilter.addEventListener("change", loadRows);

  recordForm.addEventListener("submit", saveRecord);
}

async function showApp() {
  login.classList.add("hidden");
  app.classList.remove("hidden");
  navigate("dashboard");
  connectStream();
}

function navigate(route) {
  state.active = route;
  state.editing = null;
  formPanel.classList.add("hidden");
  $("#pageTitle").textContent = modules[route].label;
  document.querySelectorAll(".nav-btn").forEach((btn) => btn.classList.toggle("active", btn.dataset.route === route));
  dashboardPage.classList.toggle("active", route === "dashboard");
  modulePage.classList.toggle("active", route !== "dashboard");
  if (route === "dashboard") loadStats();
  else setupModule(route);
}

async function loadStats() {
  state.stats = await api("/api/stats");
  renderStats();
}

function renderStats() {
  const stats = state.stats || {};
  const items = [
    ["Products", stats.products || 0, "PR"],
    ["Warehouses", stats.warehouses || 0, "WH"],
    ["Stock", stats.stock || 0, "IN"],
    ["Shipments", stats.shipments || 0, "SH"],
    ["Orders", stats.orders || 0, "PO"],
  ];
  $("#statGrid").innerHTML = items
    .map(([label, value, icon]) => `
      <article class="stat-card">
        <div class="stat-top"><span>${label}</span><span class="stat-icon">${icon}</span></div>
        <strong>${value}</strong>
      </article>
    `)
    .join("");

  const alerts = stats.lowStock || [];
  $("#alerts").innerHTML = alerts.length
    ? alerts.map((item) => `
      <div class="alert-row">
        <strong>${escapeHtml(item.product)}</strong>
        <span class="pill danger">${item.quantity}/${item.reorderLevel}</span>
      </div>
    `).join("")
    : `<div class="alert-row"><strong>All clear</strong><span class="pill ok">OK</span></div>`;
}

function setupModule(route) {
  const mod = modules[route];
  searchInput.value = "";
  if (mod.statuses) {
    statusFilter.classList.remove("hidden");
    statusFilter.innerHTML = `<option value="">All</option>` + mod.statuses.map((status) => `<option>${status}</option>`).join("");
  } else {
    statusFilter.classList.add("hidden");
  }
  renderForm();
  loadRows();
}

function renderForm(row = {}) {
  const mod = modules[state.active];
  recordForm.innerHTML = mod.fields.map(([key, label, type = "text", options]) => {
    if (type === "select") {
      return `<label><span>${label}</span><select name="${key}" required>${options.map((opt) => `<option ${row[key] === opt ? "selected" : ""}>${opt}</option>`).join("")}</select></label>`;
    }
    return `<label><span>${label}</span><input name="${key}" type="${type}" value="${escapeAttr(row[key] ?? "")}" required /></label>`;
  }).join("") + `
    <div class="form-actions">
      <button class="primary" type="submit"><span class="icon">OK</span>Save</button>
      <button class="ghost" type="button" id="cancelForm" title="Cancel">x</button>
    </div>
  `;
  $("#cancelForm").addEventListener("click", () => {
    state.editing = null;
    formPanel.classList.add("hidden");
  });
}

function openForm(row = null) {
  state.editing = row;
  renderForm(row || {});
  formPanel.classList.remove("hidden");
  formPanel.animate([{ opacity: 0, transform: "translateY(-6px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 180, easing: "ease-out" });
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
    renderTable();
  } finally {
    loading.classList.add("hidden");
  }
}

function renderTable() {
  const mod = modules[state.active];
  const heads = ["ID", ...mod.fields.map((field) => field[1]), "Actions"];
  $("#tableHead").innerHTML = `<tr>${heads.map((head) => `<th>${head}</th>`).join("")}</tr>`;
  $("#tableBody").innerHTML = state.rows.length
    ? state.rows.map((row) => `
      <tr>
        <td>#${row.id}</td>
        ${mod.fields.map(([key]) => `<td>${cell(key, row[key], row)}</td>`).join("")}
        <td>
          <div class="row-actions">
            <button class="icon-btn" title="Edit" onclick="editRow(${row.id})">ED</button>
            <button class="icon-btn" title="Delete" onclick="deleteRow(${row.id})">x</button>
          </div>
        </td>
      </tr>
    `).join("")
    : `<tr><td colspan="${heads.length}">No records</td></tr>`;
}

function cell(key, value, row) {
  if (key === "status") return badge(value);
  if (key === "quantity" && state.active === "inventory") {
    const low = Number(value) <= 25;
    const width = Math.max(8, Math.min(100, Number(value) / 5));
    return `<div class="stock-bar ${low ? "low" : ""}"><span style="width:${width}%"></span></div><span class="pill ${low ? "danger" : "ok"}">${value}</span>`;
  }
  if (key === "price") return `Rs ${Number(value).toLocaleString("en-IN")}`;
  return escapeHtml(value ?? "");
}

function badge(value) {
  const text = escapeHtml(value || "Open");
  const lower = String(value).toLowerCase();
  const cls = lower.includes("delivered") || lower.includes("received") || lower.includes("approved") || lower.includes("restocked")
    ? "ok"
    : lower.includes("cancelled") || lower.includes("rejected")
      ? "danger"
      : lower.includes("shipped")
        ? "info"
        : "warn";
  return `<span class="badge ${cls}">${text}</span>`;
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
    toast("Saved");
    formPanel.classList.add("hidden");
    state.editing = null;
    await loadRows();
    await loadStats();
  } catch (error) {
    toast(error.message);
  }
}

window.editRow = (id) => {
  const row = state.rows.find((item) => Number(item.id) === Number(id));
  if (row) openForm(row);
};

window.deleteRow = async (id) => {
  const mod = modules[state.active];
  await api(`${mod.endpoint}/${id}`, { method: "DELETE" });
  toast("Deleted");
  await loadRows();
  await loadStats();
};

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

function connectStream() {
  if (window.liveEvents) window.liveEvents.close();
  if (window.livePoll) clearInterval(window.livePoll);
  window.liveEvents = new EventSource("/api/stream", { withCredentials: true });
  window.liveEvents.addEventListener("update", (event) => {
    state.stats = JSON.parse(event.data);
    if (state.active === "dashboard") renderStats();
    $("#liveState").textContent = "Live";
  });
  window.liveEvents.onerror = () => {
    $("#liveState").textContent = "Offline";
    window.liveEvents.close();
    window.livePoll = setInterval(async () => {
      if (!app.classList.contains("hidden")) {
        state.stats = await api("/api/stats");
        if (state.active === "dashboard") renderStats();
        $("#liveState").textContent = "Live";
      }
    }, 5000);
  };
}

function toast(message) {
  const box = $("#toast");
  box.textContent = message;
  box.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => box.classList.remove("show"), 2200);
}

function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
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
