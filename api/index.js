const crypto = require("crypto");

let mysql;
try {
  mysql = require("mysql2/promise");
} catch {
  mysql = null;
}

const sessions = globalThis.__logiwareSessions || new Map();
const memory = globalThis.__logiwareMemory || createMemory();
globalThis.__logiwareSessions = sessions;
globalThis.__logiwareMemory = memory;

const entities = {
  products: {
    table: "products",
    label: "name",
    fields: ["name", "category", "price", "weight", "reorderLevel"],
  },
  warehouses: {
    table: "warehouses",
    label: "name",
    fields: ["name", "location", "capacity", "storageType"],
  },
  inventory: {
    table: "inventory",
    label: "quantity",
    fields: ["productId", "warehouseId", "quantity"],
  },
  suppliers: {
    table: "suppliers",
    label: "name",
    fields: ["name", "contactPerson", "email", "phone", "address"],
  },
  orders: {
    table: "purchase_orders",
    label: "status",
    fields: ["supplierId", "productId", "quantity", "status", "expectedDate"],
  },
  shipments: {
    table: "shipments",
    label: "status",
    fields: ["orderId", "trackingNumber", "carrier", "status", "origin", "destination", "shipDate", "deliveryDate"],
  },
  returns: {
    table: "product_returns",
    label: "status",
    fields: ["productId", "shipmentId", "quantity", "reason", "status"],
  },
};

module.exports = async function handler(req, res) {
  try {
    const url = new URL(req.url, `https://${req.headers.host || "localhost"}`);
    const path = url.pathname;

    if (req.method === "OPTIONS") return send(res, 204, {});

    if (path === "/api/login" && req.method === "POST") {
      const body = await readJson(req);
      if (body.username !== "admin" || body.password !== "admin123") {
        return send(res, 401, { error: "Unauthorized" });
      }
      const token = crypto.randomBytes(32).toString("base64url");
      sessions.set(token, "admin");
      res.setHeader("Set-Cookie", `LWSESSION=${token}; HttpOnly; SameSite=Lax; Path=/; Secure`);
      return send(res, 200, { user: "admin" });
    }

    if (path === "/api/logout" && req.method === "POST") {
      const token = getToken(req);
      if (token) sessions.delete(token);
      res.setHeader("Set-Cookie", "LWSESSION=; Max-Age=0; Path=/");
      return send(res, 200, { ok: true });
    }

    if (!isAuthed(req)) return send(res, 401, { error: "Unauthorized" });

    if (path === "/api/me" && req.method === "GET") {
      return send(res, 200, { user: "admin" });
    }

    if (path === "/api/stats" && req.method === "GET") {
      return send(res, 200, await stats());
    }

    if (path === "/api/forecast" && req.method === "GET") {
      return send(res, 200, await forecastPayload());
    }

    if (path === "/api/routing" && req.method === "GET") {
      return send(res, 200, await routingPayload());
    }

    if (path === "/api/insights" && req.method === "GET") {
      return send(res, 200, await insightsPayload());
    }

    if (path === "/api/rca" && req.method === "GET") {
      return send(res, 200, await rcaPayload());
    }

    if (path === "/api/stream" && req.method === "GET") {
      return send(res, 200, await stats());
    }

    const parts = path.replace(/^\/api\/?/, "").split("/").filter(Boolean);
    const route = parts[0];
    const id = parts[1] ? Number(parts[1]) : null;
    const entity = entities[route];
    if (!entity) return send(res, 404, { error: "Not found" });

    if (req.method === "GET" && !id) {
      return send(res, 200, await list(route, url.searchParams.get("q"), url.searchParams.get("status")));
    }
    if (req.method === "POST" && !id) {
      return send(res, 201, await create(route, await readJson(req)));
    }
    if (req.method === "PUT" && id) {
      return send(res, 200, await update(route, id, await readJson(req)));
    }
    if (req.method === "DELETE" && id) {
      await remove(route, id);
      return send(res, 200, { ok: true });
    }

    return send(res, 404, { error: "Not found" });
  } catch (error) {
    return send(res, error.status || 500, { error: error.message || "Server error" });
  }
};

async function list(route, search, status) {
  const entity = entities[route];
  const db = await getDb();
  if (db) {
    const where = [];
    const params = [];
    if (search) {
      where.push(`${entity.label} LIKE ?`);
      params.push(`%${search}%`);
    }
    if (status && entity.fields.includes("status")) {
      where.push("status = ?");
      params.push(status);
    }
    const [rows] = await db.execute(`SELECT * FROM ${entity.table}${where.length ? ` WHERE ${where.join(" AND ")}` : ""} ORDER BY id DESC`, params);
    return rows;
  }
  return memory[route].filter((row) => {
    const matchesSearch = !search || String(row[entity.label] || "").toLowerCase().includes(search.toLowerCase());
    const matchesStatus = !status || row.status === status;
    return matchesSearch && matchesStatus;
  });
}

async function create(route, body) {
  const entity = entities[route];
  validate(entity, body, false);
  const db = await getDb();
  if (db) {
    const fields = entity.fields;
    const marks = fields.map(() => "?").join(",");
    const [result] = await db.execute(`INSERT INTO ${entity.table} (${fields.join(",")}) VALUES (${marks})`, fields.map((field) => body[field]));
    const [rows] = await db.execute(`SELECT * FROM ${entity.table} WHERE id = ?`, [result.insertId]);
    return rows[0];
  }
  const row = { id: nextId(route), ...pick(body, entity.fields), createdAt: new Date().toISOString() };
  memory[route].unshift(row);
  return row;
}

async function update(route, id, body) {
  const entity = entities[route];
  validate(entity, body, true);
  const fields = entity.fields.filter((field) => Object.hasOwn(body, field));
  if (!fields.length) throw bad("No valid fields");
  const db = await getDb();
  if (db) {
    await db.execute(`UPDATE ${entity.table} SET ${fields.map((field) => `${field} = ?`).join(",")} WHERE id = ?`, [...fields.map((field) => body[field]), id]);
    const [rows] = await db.execute(`SELECT * FROM ${entity.table} WHERE id = ?`, [id]);
    return rows[0];
  }
  const row = memory[route].find((item) => Number(item.id) === Number(id));
  if (!row) throw bad("Record not found");
  fields.forEach((field) => {
    row[field] = body[field];
  });
  return row;
}

async function remove(route, id) {
  const entity = entities[route];
  const db = await getDb();
  if (db) {
    await db.execute(`DELETE FROM ${entity.table} WHERE id = ?`, [id]);
    return;
  }
  memory[route] = memory[route].filter((item) => Number(item.id) !== Number(id));
}

async function stats() {
  const db = await getDb();
  if (db) {
    const count = async (sql) => {
      const [rows] = await db.query(sql);
      return Number(Object.values(rows[0])[0] || 0);
    };
    const [lowStock] = await db.query("SELECT p.name AS product, i.quantity, p.reorderLevel FROM inventory i JOIN products p ON p.id = i.productId WHERE i.quantity <= p.reorderLevel ORDER BY i.quantity ASC");
    return {
      products: await count("SELECT COUNT(*) FROM products"),
      warehouses: await count("SELECT COUNT(*) FROM warehouses"),
      stock: await count("SELECT COALESCE(SUM(quantity), 0) FROM inventory"),
      shipments: await count("SELECT COUNT(*) FROM shipments WHERE status <> 'Delivered'"),
      orders: await count("SELECT COUNT(*) FROM purchase_orders WHERE status = 'Pending'"),
      lowStock,
    };
  }
  const lowStock = memory.inventory
    .map((inv) => {
      const product = memory.products.find((item) => Number(item.id) === Number(inv.productId));
      return product && Number(inv.quantity) <= Number(product.reorderLevel)
        ? { product: product.name, quantity: inv.quantity, reorderLevel: product.reorderLevel }
        : null;
    })
    .filter(Boolean);
  return {
    products: memory.products.length,
    warehouses: memory.warehouses.length,
    stock: memory.inventory.reduce((sum, row) => sum + Number(row.quantity || 0), 0),
    shipments: memory.shipments.filter((row) => row.status !== "Delivered").length,
    orders: memory.orders.filter((row) => row.status === "Pending").length,
    lowStock,
  };
}

async function analyticsData() {
  const [products, warehouses, inventory, orders, shipments, returns] = await Promise.all([
    list("products"),
    list("warehouses"),
    list("inventory"),
    list("orders"),
    list("shipments"),
    list("returns"),
  ]);
  return { products, warehouses, inventory, orders, shipments, returns };
}

async function forecastPayload() {
  const { products, inventory, orders, shipments, returns } = await analyticsData();
  const productMap = Object.fromEntries(products.map((item) => [Number(item.id), item]));
  const delayedShipments = shipments.filter((shipment) => ["pending", "shipped"].includes(String(shipment.status || "").toLowerCase())).length;
  const returnPct = shipments.length ? Math.round((returns.length / shipments.length) * 100) : 0;
  const forecast = products.map((product) => {
    const productId = Number(product.id);
    const stock = inventory.filter((row) => Number(row.productId) === productId).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const demand = orders.filter((row) => Number(row.productId) === productId).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const projectedDemand = Math.max(1, Math.round((demand * 0.65) + ((delayedShipments + returnPct) * 0.4)));
    const projectedStock = Math.max(0, stock - projectedDemand);
    const reorderLevel = Number(product.reorderLevel || 0);
    const reorderQty = projectedStock <= reorderLevel ? Math.max(reorderLevel * 2 - projectedStock, 1) : 0;
    return {
      product: product.name,
      projectedDemand,
      projectedStock,
      reorderLevel,
      reorderQty,
      risk: projectedStock <= reorderLevel ? "High" : projectedStock <= reorderLevel * 1.5 ? "Medium" : "Low",
      stockValue: Math.round(stock * Number(productMap[productId]?.price || 0)),
    };
  }).sort((a, b) => b.reorderQty - a.reorderQty);
  return { generatedAt: new Date().toISOString(), forecast };
}

async function routingPayload() {
  const { warehouses, inventory, orders, products } = await analyticsData();
  const productMap = Object.fromEntries(products.map((item) => [Number(item.id), item]));
  const pending = orders.filter((order) => String(order.status || "").toLowerCase() === "pending").slice(0, 6);
  const routes = pending.map((order) => {
    const required = Number(order.quantity || 0);
    const productId = Number(order.productId);
    const candidates = inventory
      .filter((row) => Number(row.productId) === productId && Number(row.quantity || 0) > 0)
      .map((row) => {
        const warehouse = warehouses.find((item) => Number(item.id) === Number(row.warehouseId));
        return {
          warehouse: warehouse?.name || `Warehouse ${row.warehouseId}`,
          location: warehouse?.location || "Unknown",
          available: Number(row.quantity || 0),
        };
      })
      .sort((a, b) => b.available - a.available);
    const best = candidates[0];
    return {
      orderRef: `Order #${order.id} (${productMap[productId]?.name || `Product ${productId}`})`,
      warehouse: best?.warehouse || "No feasible warehouse",
      location: best?.location || "N/A",
      available: best?.available || 0,
      required,
      reason: best ? (best.available >= required ? "Sufficient stock with highest availability" : "Partial fulfillment; reorder or split suggested") : "No inventory candidates for product",
    };
  });
  const warehouseLoad = warehouses.map((warehouse, index) => {
    const used = inventory.filter((row) => Number(row.warehouseId) === Number(warehouse.id)).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const cap = Math.max(Number(warehouse.capacity || 1), 1);
    return {
      code: String.fromCharCode(65 + index),
      name: warehouse.name,
      utilization: Math.min(100, Math.round((used / cap) * 100)),
    };
  });
  return { generatedAt: new Date().toISOString(), routes, warehouseLoad };
}

async function insightsPayload() {
  const statsData = await stats();
  const forecast = await forecastPayload();
  const highRisk = forecast.forecast.filter((row) => row.risk === "High").length;
  const insights = [
    `Low stock alerts currently affect ${statsData.lowStock.length} inventory lines.`,
    `Pending orders are ${statsData.orders}, while active shipments are ${statsData.shipments}.`,
    `High forecast risk products: ${highRisk} of ${forecast.forecast.length}.`,
    `Total stock in system is ${statsData.stock}, across ${statsData.warehouses} warehouses.`,
  ];
  const top = forecast.forecast[0];
  const relationships = top
    ? [top.product, `Inventory value Rs ${top.stockValue}`, `Projected demand ${top.projectedDemand}`, `Projected stock ${top.projectedStock}`, `Recommended reorder ${top.reorderQty}`]
    : [];
  return { generatedAt: new Date().toISOString(), insights, relationships };
}

async function rcaPayload() {
  const { products, inventory, orders, shipments, returns } = await analyticsData();
  const productMap = Object.fromEntries(products.map((item) => [Number(item.id), item]));
  const rootCauses = [];
  for (const item of inventory) {
    const product = productMap[Number(item.productId)];
    if (!product) continue;
    const stock = Number(item.quantity || 0);
    const reorderLevel = Number(product.reorderLevel || 0);
    if (stock > reorderLevel) continue;
    const demand = orders.filter((row) => Number(row.productId) === Number(product.id)).reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const shipmentDelayLoad = shipments.filter((shipment) => ["pending", "shipped"].includes(String(shipment.status || "").toLowerCase())).length;
    const productReturns = returns.filter((row) => Number(row.productId) === Number(product.id)).length;
    const severity = shipmentDelayLoad > 2 || productReturns > 1 || demand > reorderLevel * 2 ? "high" : demand > reorderLevel ? "medium" : "low";
    rootCauses.push({
      title: product.name,
      detail: `Stock ${stock} vs reorder ${reorderLevel}; demand ${demand}; return hits ${productReturns}.`,
      severity,
    });
  }
  const orderIds = new Set(orders.map((row) => Number(row.id)));
  const productIds = new Set(products.map((row) => Number(row.id)));
  const warehouseIds = new Set((await list("warehouses")).map((row) => Number(row.id)));
  const consistency = [
    {
      title: "Inventory relations",
      detail: `${inventory.filter((row) => !productIds.has(Number(row.productId)) || !warehouseIds.has(Number(row.warehouseId))).length} invalid row(s)`,
      severity: "low",
    },
    {
      title: "Shipment order links",
      detail: `${shipments.filter((row) => row.orderId && !orderIds.has(Number(row.orderId))).length} invalid row(s)`,
      severity: "low",
    },
  ];
  return { generatedAt: new Date().toISOString(), rootCauses, consistency };
}

let pool;
async function getDb() {
  const url = process.env.MYSQL_URL || process.env.DATABASE_URL;
  if (!mysql || !url) return null;
  if (!pool) {
    pool = mysql.createPool({ uri: url, waitForConnections: true, connectionLimit: 2 });
  }
  return pool;
}

function createMemory() {
  return {
    products: [
      { id: 1, name: "Barcode Scanner", category: "Electronics", price: 4200, weight: 0.6, reorderLevel: 25 },
      { id: 2, name: "Packing Tape", category: "Packaging", price: 75, weight: 0.2, reorderLevel: 120 },
    ],
    warehouses: [
      { id: 1, name: "North Hub", location: "Delhi", capacity: 25000, storageType: "Ambient" },
      { id: 2, name: "Cold Bay", location: "Pune", capacity: 8000, storageType: "Cold" },
    ],
    inventory: [
      { id: 1, productId: 1, warehouseId: 1, quantity: 18 },
      { id: 2, productId: 2, warehouseId: 1, quantity: 420 },
    ],
    suppliers: [
      { id: 1, name: "Swift Supply Co", contactPerson: "Riya Sharma", email: "riya@swift.example", phone: "+91 98765 43210", address: "Noida" },
    ],
    orders: [
      { id: 1, supplierId: 1, productId: 1, quantity: 100, status: "Pending", expectedDate: "2026-05-08" },
    ],
    shipments: [
      { id: 1, orderId: 1, trackingNumber: "LGW-88342", carrier: "BlueDart", status: "Shipped", origin: "Delhi", destination: "Mumbai", shipDate: "2026-05-01", deliveryDate: "2026-05-04" },
    ],
    returns: [],
  };
}

function nextId(route) {
  return Math.max(0, ...memory[route].map((row) => Number(row.id))) + 1;
}

function validate(entity, body, partial) {
  for (const field of entity.fields) {
    if (!partial && !Object.hasOwn(body, field)) throw bad(`Missing field: ${field}`);
  }
  for (const field of ["price", "weight", "reorderLevel", "capacity", "quantity", "productId", "warehouseId", "supplierId", "orderId", "shipmentId"]) {
    if (Object.hasOwn(body, field) && body[field] !== null && Number(body[field]) < 0) throw bad(`${field} cannot be negative`);
  }
  if (body.email && !String(body.email).includes("@")) throw bad("Invalid email");
}

function pick(source, fields) {
  return Object.fromEntries(fields.map((field) => [field, source[field]]));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(bad("Invalid JSON"));
      }
    });
  });
}

function getToken(req) {
  const cookie = req.headers.cookie || "";
  const match = cookie.match(/(?:^|;\s*)LWSESSION=([^;]+)/);
  return match ? match[1] : null;
}

function isAuthed(req) {
  const token = getToken(req);
  return Boolean(token && sessions.has(token));
}

function send(res, status, body) {
  res.statusCode = status;
  if (status !== 204) {
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(body));
  } else {
    res.end();
  }
}

function bad(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
