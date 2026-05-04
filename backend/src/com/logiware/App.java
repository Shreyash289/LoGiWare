package com.logiware;

import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;

public class App {
    private static final Path PUBLIC_DIR = Path.of("frontend", "public").toAbsolutePath().normalize();
    private static final Map<String, String> sessions = new ConcurrentHashMap<>();
    private static final SecureRandom random = new SecureRandom();

    private static Store store;

    public static void main(String[] args) throws Exception {
        int port = Integer.parseInt(System.getenv().getOrDefault("PORT", "8080"));
        store = Store.create();

        HttpServer server = HttpServer.create(new InetSocketAddress(port), 0);
        server.createContext("/api", new ApiHandler());
        server.createContext("/", new StaticHandler());
        server.setExecutor(Executors.newCachedThreadPool());
        server.start();
        System.out.println("LoGiWare running at http://localhost:" + port);
        System.out.println(store.mode());
    }

    static final class ApiHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            try {
                route(exchange);
            } catch (BadRequest ex) {
                json(exchange, 400, Map.of("error", ex.getMessage()));
            } catch (Unauthorized ex) {
                json(exchange, 401, Map.of("error", "Unauthorized"));
            } catch (Exception ex) {
                ex.printStackTrace();
                json(exchange, 500, Map.of("error", "Server error"));
            }
        }

        private void route(HttpExchange exchange) throws Exception {
            String method = exchange.getRequestMethod();
            String path = exchange.getRequestURI().getPath();
            String normalizedPath = (path.endsWith("/") && path.length() > 1) ? path.substring(0, path.length() - 1) : path;

            if ("OPTIONS".equals(method)) {
                cors(exchange);
                exchange.sendResponseHeaders(204, -1);
                return;
            }

            if ("/api/login".equals(normalizedPath) && "POST".equals(method)) {
                Map<String, Object> body = Json.parseObject(readBody(exchange));
                String username = requiredText(body, "username");
                String password = requiredText(body, "password");
                if (!store.validAdmin(username, password)) {
                    throw new Unauthorized();
                }
                String token = token();
                sessions.put(token, username);
                Headers headers = exchange.getResponseHeaders();
                headers.add("Set-Cookie", "LWSESSION=" + token + "; HttpOnly; SameSite=Lax; Path=/");
                json(exchange, 200, Map.of("user", username));
                return;
            }

            if ("/api/logout".equals(normalizedPath) && "POST".equals(method)) {
                currentUser(exchange).ifPresent(token -> sessions.remove(token));
                exchange.getResponseHeaders().add("Set-Cookie", "LWSESSION=; Max-Age=0; Path=/");
                json(exchange, 200, Map.of("ok", true));
                return;
            }

            requireAuth(exchange);

            if ("/api/me".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, Map.of("user", "admin"));
                return;
            }
            if ("/api/stats".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, store.stats());
                return;
            }
            if ("/api/forecast".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, forecastPayload());
                return;
            }
            if ("/api/routing".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, routingPayload());
                return;
            }
            if (("/api/insights".equals(normalizedPath) || "/api/insghts".equals(normalizedPath)) && "GET".equals(method)) {
                json(exchange, 200, insightsPayload());
                return;
            }
            if ("/api/rca".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, rcaPayload());
                return;
            }
            if ("/api/finance".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, financePayload());
                return;
            }
            if ("/api/billing".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, billingPayload());
                return;
            }
            if ("/api/credit".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, creditPayload());
                return;
            }
            if ("/api/approvals".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, approvalsPayload());
                return;
            }
            if ("/api/pricing".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, pricingPayload());
                return;
            }
            if ("/api/batches/summary".equals(normalizedPath) && "GET".equals(method)) {
                json(exchange, 200, batchesPayload());
                return;
            }
            if ("/api/stream".equals(normalizedPath) && "GET".equals(method)) {
                stream(exchange);
                return;
            }

            String[] parts = normalizedPath.substring("/api/".length()).split("/");
            if (parts.length == 0 || parts[0].isBlank()) {
                throw new BadRequest("Missing resource");
            }
            Entity entity = Entity.byRoute(parts[0]);
            Integer id = parts.length > 1 ? parseId(parts[1]) : null;

            if ("GET".equals(method) && id == null) {
                json(exchange, 200, store.list(entity, query(exchange, "q"), query(exchange, "status")));
                return;
            }
            if ("POST".equals(method) && id == null) {
                Map<String, Object> body = Json.parseObject(readBody(exchange));
                json(exchange, 201, store.create(entity, body));
                return;
            }
            if ("PUT".equals(method) && id != null) {
                Map<String, Object> body = Json.parseObject(readBody(exchange));
                json(exchange, 200, store.update(entity, id, body));
                return;
            }
            if ("DELETE".equals(method) && id != null) {
                store.delete(entity, id);
                json(exchange, 200, Map.of("ok", true));
                return;
            }

            json(exchange, 404, Map.of("error", "Not found"));
        }

        private void stream(HttpExchange exchange) throws Exception {
            Headers headers = exchange.getResponseHeaders();
            cors(exchange);
            headers.set("Content-Type", "text/event-stream");
            headers.set("Cache-Control", "no-cache");
            exchange.sendResponseHeaders(200, 0);
            try (OutputStream out = exchange.getResponseBody()) {
                for (int i = 0; i < 120; i++) {
                    String payload = "event: update\ndata: " + Json.stringify(store.stats()) + "\n\n";
                    out.write(payload.getBytes(StandardCharsets.UTF_8));
                    out.flush();
                    Thread.sleep(5000);
                }
            }
        }

        private Map<String, Object> analyticsData() throws Exception {
            Map<String, Object> data = new LinkedHashMap<>();
            data.put("products", store.list(Entity.PRODUCTS, null, null));
            data.put("warehouses", store.list(Entity.WAREHOUSES, null, null));
            data.put("inventory", store.list(Entity.INVENTORY, null, null));
            data.put("orders", store.list(Entity.ORDERS, null, null));
            data.put("shipments", store.list(Entity.SHIPMENTS, null, null));
            data.put("returns", store.list(Entity.RETURNS, null, null));
            data.put("suppliers", store.list(Entity.SUPPLIERS, null, null));
            data.put("payments", store.list(Entity.PAYMENTS, null, null));
            data.put("batches", store.list(Entity.BATCHES, null, null));
            return data;
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> forecastPayload() throws Exception {
            Map<String, Object> analytics = analyticsData();
            List<Map<String, Object>> products = (List<Map<String, Object>>) analytics.get("products");
            List<Map<String, Object>> inventory = (List<Map<String, Object>>) analytics.get("inventory");
            List<Map<String, Object>> orders = (List<Map<String, Object>>) analytics.get("orders");
            List<Map<String, Object>> shipments = (List<Map<String, Object>>) analytics.get("shipments");
            List<Map<String, Object>> returns = (List<Map<String, Object>>) analytics.get("returns");
            long delayed = shipments.stream().filter(item -> {
                String status = String.valueOf(item.getOrDefault("status", "")).toLowerCase();
                return "pending".equals(status) || "shipped".equals(status);
            }).count();
            int returnPct = shipments.isEmpty() ? 0 : (int) Math.round((returns.size() * 100.0) / shipments.size());
            List<Map<String, Object>> forecast = new ArrayList<>();
            for (Map<String, Object> product : products) {
                int productId = number(product.get("id"));
                int stock = inventory.stream().filter(item -> number(item.get("productId")) == productId).mapToInt(item -> number(item.get("quantity"))).sum();
                int demand = orders.stream().filter(item -> number(item.get("productId")) == productId).mapToInt(item -> number(item.get("quantity"))).sum();
                int projectedDemand = Math.max(1, (int) Math.round((demand * 0.65) + ((delayed + returnPct) * 0.4)));
                int projectedStock = Math.max(0, stock - projectedDemand);
                int reorderLevel = number(product.get("reorderLevel"));
                int reorderQty = projectedStock <= reorderLevel ? Math.max((reorderLevel * 2) - projectedStock, 1) : 0;
                String risk = projectedStock <= reorderLevel ? "High" : projectedStock <= (int) (reorderLevel * 1.5) ? "Medium" : "Low";
                forecast.add(Map.of(
                        "product", String.valueOf(product.get("name")),
                        "projectedDemand", projectedDemand,
                        "projectedStock", projectedStock,
                        "reorderLevel", reorderLevel,
                        "reorderQty", reorderQty,
                        "risk", risk
                ));
            }
            forecast.sort((a, b) -> Integer.compare(number(b.get("reorderQty")), number(a.get("reorderQty"))));
            return Map.of("generatedAt", Instant.now().toString(), "forecast", forecast);
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> routingPayload() throws Exception {
            Map<String, Object> analytics = analyticsData();
            List<Map<String, Object>> warehouses = (List<Map<String, Object>>) analytics.get("warehouses");
            List<Map<String, Object>> inventory = (List<Map<String, Object>>) analytics.get("inventory");
            List<Map<String, Object>> orders = (List<Map<String, Object>>) analytics.get("orders");
            List<Map<String, Object>> products = (List<Map<String, Object>>) analytics.get("products");
            Map<Integer, String> productNames = new HashMap<>();
            for (Map<String, Object> product : products) {
                productNames.put(number(product.get("id")), String.valueOf(product.get("name")));
            }
            List<Map<String, Object>> routes = new ArrayList<>();
            orders.stream().filter(order -> "pending".equalsIgnoreCase(String.valueOf(order.get("status")))).limit(6).forEach(order -> {
                int productId = number(order.get("productId"));
                int required = number(order.get("quantity"));
                Map<String, Object> bestInventory = inventory.stream()
                        .filter(item -> number(item.get("productId")) == productId && number(item.get("quantity")) > 0)
                        .max((a, b) -> Integer.compare(number(a.get("quantity")), number(b.get("quantity"))))
                        .orElse(null);
                Map<String, Object> warehouse = null;
                if (bestInventory != null) {
                    int whId = number(bestInventory.get("warehouseId"));
                    warehouse = warehouses.stream().filter(item -> number(item.get("id")) == whId).findFirst().orElse(null);
                }
                routes.add(Map.of(
                        "orderRef", "Order #" + order.get("id") + " (" + productNames.getOrDefault(productId, "Product " + productId) + ")",
                        "warehouse", warehouse != null ? String.valueOf(warehouse.get("name")) : "No feasible warehouse",
                        "location", warehouse != null ? String.valueOf(warehouse.get("location")) : "N/A",
                        "available", bestInventory != null ? number(bestInventory.get("quantity")) : 0,
                        "required", required,
                        "reason", bestInventory != null ? (number(bestInventory.get("quantity")) >= required ? "Sufficient stock with highest availability" : "Partial fulfillment; reorder or split suggested") : "No inventory candidates for product"
                ));
            });
            List<Map<String, Object>> warehouseLoad = new ArrayList<>();
            for (int i = 0; i < warehouses.size(); i++) {
                Map<String, Object> warehouse = warehouses.get(i);
                int whId = number(warehouse.get("id"));
                int used = inventory.stream().filter(item -> number(item.get("warehouseId")) == whId).mapToInt(item -> number(item.get("quantity"))).sum();
                int cap = Math.max(1, number(warehouse.get("capacity")));
                warehouseLoad.add(Map.of(
                        "code", String.valueOf((char) ('A' + i)),
                        "name", String.valueOf(warehouse.get("name")),
                        "utilization", Math.min(100, (int) Math.round((used * 100.0) / cap))
                ));
            }
            return Map.of("generatedAt", Instant.now().toString(), "routes", routes, "warehouseLoad", warehouseLoad);
        }

        private Map<String, Object> insightsPayload() throws Exception {
            Map<String, Object> stats = store.stats();
            Map<String, Object> forecast = forecastPayload();
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> forecastRows = (List<Map<String, Object>>) forecast.get("forecast");
            long highRisk = forecastRows.stream().filter(item -> "High".equals(String.valueOf(item.get("risk")))).count();
            List<String> insights = List.of(
                    "Low stock alerts currently affect " + ((List<?>) stats.get("lowStock")).size() + " inventory lines.",
                    "Pending orders are " + stats.get("orders") + ", while active shipments are " + stats.get("shipments") + ".",
                    "High forecast risk products: " + highRisk + " of " + forecastRows.size() + ".",
                    "Total stock in system is " + stats.get("stock") + ", across " + stats.get("warehouses") + " warehouses."
            );
            List<String> relationships = forecastRows.isEmpty() ? List.of() : List.of(
                    String.valueOf(forecastRows.get(0).get("product")),
                    "Projected demand " + forecastRows.get(0).get("projectedDemand"),
                    "Projected stock " + forecastRows.get(0).get("projectedStock"),
                    "Recommended reorder " + forecastRows.get(0).get("reorderQty")
            );
            return Map.of("generatedAt", Instant.now().toString(), "insights", insights, "relationships", relationships);
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> rcaPayload() throws Exception {
            Map<String, Object> analytics = analyticsData();
            List<Map<String, Object>> products = (List<Map<String, Object>>) analytics.get("products");
            List<Map<String, Object>> inventory = (List<Map<String, Object>>) analytics.get("inventory");
            List<Map<String, Object>> orders = (List<Map<String, Object>>) analytics.get("orders");
            List<Map<String, Object>> shipments = (List<Map<String, Object>>) analytics.get("shipments");
            List<Map<String, Object>> returns = (List<Map<String, Object>>) analytics.get("returns");
            Map<Integer, Map<String, Object>> productMap = new HashMap<>();
            for (Map<String, Object> product : products) productMap.put(number(product.get("id")), product);

            List<Map<String, Object>> rootCauses = new ArrayList<>();
            for (Map<String, Object> item : inventory) {
                Map<String, Object> product = productMap.get(number(item.get("productId")));
                if (product == null) continue;
                int stock = number(item.get("quantity"));
                int reorder = number(product.get("reorderLevel"));
                if (stock > reorder) continue;
                int demand = orders.stream().filter(o -> number(o.get("productId")) == number(product.get("id"))).mapToInt(o -> number(o.get("quantity"))).sum();
                long activeShipment = shipments.stream().filter(s -> {
                    String st = String.valueOf(s.getOrDefault("status", "")).toLowerCase();
                    return "pending".equals(st) || "shipped".equals(st);
                }).count();
                long productReturns = returns.stream().filter(r -> number(r.get("productId")) == number(product.get("id"))).count();
                String severity = activeShipment > 2 || productReturns > 1 || demand > reorder * 2 ? "high" : demand > reorder ? "medium" : "low";
                rootCauses.add(Map.of(
                        "title", String.valueOf(product.get("name")),
                        "detail", "Stock " + stock + " vs reorder " + reorder + "; demand " + demand + "; return hits " + productReturns + ".",
                        "severity", severity
                ));
            }
            List<Integer> orderIds = orders.stream().map(row -> number(row.get("id"))).toList();
            List<Map<String, Object>> consistency = List.of(
                    Map.of("title", "Inventory relations",
                            "detail", inventory.stream().filter(row -> !productMap.containsKey(number(row.get("productId")))).count() + " invalid row(s)",
                            "severity", "low"),
                    Map.of("title", "Shipment order links",
                            "detail", shipments.stream().filter(row -> row.get("orderId") != null && !orderIds.contains(number(row.get("orderId")))).count() + " invalid row(s)",
                            "severity", "low")
            );
            return Map.of("generatedAt", Instant.now().toString(), "rootCauses", rootCauses, "consistency", consistency);
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> financePayload() throws Exception {
            Map<String, Object> analytics = analyticsData();
            List<Map<String, Object>> suppliers = (List<Map<String, Object>>) analytics.get("suppliers");
            List<Map<String, Object>> orders = (List<Map<String, Object>>) analytics.get("orders");
            List<Map<String, Object>> products = (List<Map<String, Object>>) analytics.get("products");
            List<Map<String, Object>> payments = (List<Map<String, Object>>) analytics.get("payments");
            Map<Integer, Map<String, Object>> productMap = byIntId(products);
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Map<String, Object> supplier : suppliers) {
                int supplierId = number(supplier.get("id"));
                double orderValue = orders.stream().filter(order -> number(order.get("supplierId")) == supplierId).mapToDouble(order -> orderValue(order, productMap)).sum();
                double totalPaid = payments.stream().filter(payment -> number(payment.get("supplierId")) == supplierId && !"failed".equalsIgnoreCase(String.valueOf(payment.get("status")))).mapToDouble(payment -> decimal(payment.get("amount"))).sum();
                long paymentCount = payments.stream().filter(payment -> number(payment.get("supplierId")) == supplierId).count();
                String lastPayment = payments.stream().filter(payment -> number(payment.get("supplierId")) == supplierId).map(payment -> "Last payment " + money(decimal(payment.get("amount"))) + " on " + payment.get("paymentDate")).findFirst().orElse("No payment recorded");
                rows.add(Map.of("supplier", String.valueOf(supplier.get("name")), "orderValue", round(orderValue), "totalPaid", round(totalPaid), "outstanding", round(Math.max(0, orderValue - totalPaid)), "paymentCount", paymentCount, "lastPayment", lastPayment));
            }
            return Map.of("generatedAt", Instant.now().toString(), "suppliers", rows);
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> billingPayload() throws Exception {
            Map<String, Object> analytics = analyticsData();
            List<Map<String, Object>> orders = (List<Map<String, Object>>) analytics.get("orders");
            List<Map<String, Object>> products = (List<Map<String, Object>>) analytics.get("products");
            List<Map<String, Object>> suppliers = (List<Map<String, Object>>) analytics.get("suppliers");
            Map<Integer, Map<String, Object>> productMap = byIntId(products);
            Map<Integer, Map<String, Object>> supplierMap = byIntId(suppliers);
            List<Map<String, Object>> invoices = new ArrayList<>();
            for (Map<String, Object> order : orders) {
                double cost = orderValue(order, productMap);
                double tax = cost * 0.18;
                int supplierId = number(order.get("supplierId"));
                int productId = number(order.get("productId"));
                invoices.add(Map.of("id", order.get("id"), "orderId", order.get("id"), "product", String.valueOf(productMap.getOrDefault(productId, Map.of("name", "Product " + productId)).get("name")), "supplier", String.valueOf(supplierMap.getOrDefault(supplierId, Map.of("name", "Supplier " + supplierId)).get("name")), "orderCost", round(cost), "taxAmount", round(tax), "totalAmount", round(cost + tax), "invoiceDate", String.valueOf(order.getOrDefault("createdAt", Instant.now().toString())), "status", order.get("status")));
            }
            return Map.of("generatedAt", Instant.now().toString(), "invoices", invoices);
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> creditPayload() throws Exception {
            Map<String, Object> finance = financePayload();
            Map<String, Object> analytics = analyticsData();
            List<Map<String, Object>> suppliers = (List<Map<String, Object>>) analytics.get("suppliers");
            List<Map<String, Object>> ledger = (List<Map<String, Object>>) finance.get("suppliers");
            List<Map<String, Object>> credit = new ArrayList<>();
            for (int i = 0; i < suppliers.size(); i++) {
                Map<String, Object> supplier = suppliers.get(i);
                Map<String, Object> row = ledger.get(i);
                double limit = decimal(supplier.getOrDefault("creditLimit", 0));
                double outstanding = decimal(row.get("outstanding"));
                double remaining = limit - outstanding;
                int usedPercent = limit <= 0 ? (outstanding > 0 ? 100 : 0) : (int) Math.round((outstanding * 100.0) / limit);
                credit.add(Map.of("supplier", supplier.get("name"), "creditLimit", round(limit), "usedCredit", round(outstanding), "remainingCredit", round(remaining), "outstanding", round(outstanding), "usedPercent", usedPercent));
            }
            return Map.of("generatedAt", Instant.now().toString(), "credit", credit);
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> approvalsPayload() throws Exception {
            Map<String, Object> analytics = analyticsData();
            List<Map<String, Object>> orders = (List<Map<String, Object>>) analytics.get("orders");
            Map<Integer, Map<String, Object>> products = byIntId((List<Map<String, Object>>) analytics.get("products"));
            Map<Integer, Map<String, Object>> suppliers = byIntId((List<Map<String, Object>>) analytics.get("suppliers"));
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Map<String, Object> order : orders) {
                String status = String.valueOf(order.get("status"));
                String next = "Approved".equalsIgnoreCase(status) ? "Create shipment"
                        : "Received".equalsIgnoreCase(status) ? "Completed"
                        : "Rejected".equalsIgnoreCase(status) || "Cancelled".equalsIgnoreCase(status) ? "Closed"
                        : "Admin approval required";
                int productId = number(order.get("productId"));
                int supplierId = number(order.get("supplierId"));
                rows.add(Map.of("id", order.get("id"), "product", products.getOrDefault(productId, Map.of("name", "Product " + productId)).get("name"), "supplier", suppliers.getOrDefault(supplierId, Map.of("name", "Supplier " + supplierId)).get("name"), "quantity", order.get("quantity"), "status", status, "expectedDate", String.valueOf(order.getOrDefault("expectedDate", "")), "nextStep", next));
            }
            return Map.of("generatedAt", Instant.now().toString(), "orders", rows);
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> pricingPayload() throws Exception {
            Map<String, Object> analytics = analyticsData();
            List<Map<String, Object>> products = (List<Map<String, Object>>) analytics.get("products");
            List<Map<String, Object>> inventory = (List<Map<String, Object>>) analytics.get("inventory");
            List<Map<String, Object>> orders = (List<Map<String, Object>>) analytics.get("orders");
            List<Map<String, Object>> prices = new ArrayList<>();
            for (Map<String, Object> product : products) {
                int productId = number(product.get("id"));
                int stock = inventory.stream().filter(row -> number(row.get("productId")) == productId).mapToInt(row -> number(row.get("quantity"))).sum();
                int demand = orders.stream().filter(row -> number(row.get("productId")) == productId).mapToInt(row -> number(row.get("quantity"))).sum();
                int reorder = number(product.get("reorderLevel"));
                int adjustment = stock <= reorder ? 12 : demand > stock ? 8 : stock > reorder * 4 ? -7 : 0;
                double current = decimal(product.get("price"));
                String reason = adjustment > 0 ? "Low stock or demand pressure" : adjustment < 0 ? "High stock availability" : "Stable demand";
                prices.add(Map.of("product", product.get("name"), "stock", stock, "demand", demand, "currentPrice", round(current), "suggestedPrice", round(current * (1 + adjustment / 100.0)), "adjustment", adjustment, "reason", reason));
            }
            return Map.of("generatedAt", Instant.now().toString(), "prices", prices);
        }

        @SuppressWarnings("unchecked")
        private Map<String, Object> batchesPayload() throws Exception {
            Map<String, Object> analytics = analyticsData();
            List<Map<String, Object>> batches = (List<Map<String, Object>>) analytics.get("batches");
            Map<Integer, Map<String, Object>> products = byIntId((List<Map<String, Object>>) analytics.get("products"));
            Map<Integer, Map<String, Object>> suppliers = byIntId((List<Map<String, Object>>) analytics.get("suppliers"));
            List<Map<String, Object>> rows = new ArrayList<>();
            for (Map<String, Object> batch : batches) {
                int productId = number(batch.get("productId"));
                int supplierId = number(batch.get("supplierId"));
                rows.add(Map.of("batchCode", batch.get("batchCode"), "product", products.getOrDefault(productId, Map.of("name", "Product " + productId)).get("name"), "supplier", suppliers.getOrDefault(supplierId, Map.of("name", "Supplier " + supplierId)).get("name"), "quantity", batch.get("quantity"), "receivedDate", batch.get("receivedDate"), "expiryDate", String.valueOf(batch.getOrDefault("expiryDate", "")), "status", batch.get("status")));
            }
            return Map.of("generatedAt", Instant.now().toString(), "batches", rows);
        }
    }

    static final class StaticHandler implements HttpHandler {
        @Override
        public void handle(HttpExchange exchange) throws IOException {
            String rawPath = exchange.getRequestURI().getPath();
            String route = "/".equals(rawPath) ? "/index.html" : rawPath;
            Path file = PUBLIC_DIR.resolve(route.substring(1)).normalize();
            if (!file.startsWith(PUBLIC_DIR) || !Files.exists(file) || Files.isDirectory(file)) {
                file = PUBLIC_DIR.resolve("index.html");
            }
            byte[] bytes = Files.readAllBytes(file);
            exchange.getResponseHeaders().set("Content-Type", contentType(file));
            exchange.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    enum Entity {
        PRODUCTS("products", "products", List.of("name", "category", "price", "weight", "reorderLevel"), "name"),
        WAREHOUSES("warehouses", "warehouses", List.of("name", "location", "capacity", "storageType"), "name"),
        INVENTORY("inventory", "inventory", List.of("productId", "warehouseId", "quantity"), "quantity"),
        SUPPLIERS("suppliers", "suppliers", List.of("name", "contactPerson", "email", "phone", "address", "creditLimit"), "name"),
        ORDERS("orders", "purchase_orders", List.of("supplierId", "productId", "quantity", "status", "expectedDate"), "status"),
        SHIPMENTS("shipments", "shipments", List.of("orderId", "trackingNumber", "carrier", "status", "origin", "destination", "shipDate", "deliveryDate"), "status"),
        RETURNS("returns", "product_returns", List.of("productId", "shipmentId", "quantity", "reason", "status"), "status"),
        PAYMENTS("payments", "payments", List.of("supplierId", "orderId", "amount", "paymentDate", "method", "status"), "status"),
        BATCHES("batches", "product_batches", List.of("batchCode", "productId", "supplierId", "quantity", "receivedDate", "expiryDate", "status"), "batchCode");

        final String route;
        final String table;
        final List<String> fields;
        final String label;

        Entity(String route, String table, List<String> fields, String label) {
            this.route = route;
            this.table = table;
            this.fields = fields;
            this.label = label;
        }

        static Entity byRoute(String route) {
            for (Entity entity : values()) {
                if (entity.route.equals(route)) {
                    return entity;
                }
            }
            throw new BadRequest("Unknown resource: " + route);
        }
    }

    interface Store {
        String mode();
        boolean validAdmin(String username, String password) throws Exception;
        List<Map<String, Object>> list(Entity entity, String search, String status) throws Exception;
        Map<String, Object> create(Entity entity, Map<String, Object> body) throws Exception;
        Map<String, Object> update(Entity entity, int id, Map<String, Object> body) throws Exception;
        void delete(Entity entity, int id) throws Exception;
        Map<String, Object> stats() throws Exception;

        static Store create() {
            String url = System.getenv().getOrDefault("DB_URL", "jdbc:mysql://localhost:3306/logiware");
            String user = System.getenv().getOrDefault("DB_USER", "root");
            String password = System.getenv().getOrDefault("DB_PASSWORD", "");
            try {
                JdbcStore jdbc = new JdbcStore(url, user, password);
                jdbc.init();
                return jdbc;
            } catch (Exception ex) {
                System.out.println("MySQL unavailable, using in-memory demo store: " + ex.getMessage());
                return new MemoryStore();
            }
        }
    }

    static final class JdbcStore implements Store {
        private final String url;
        private final String user;
        private final String password;

        JdbcStore(String url, String user, String password) {
            this.url = url;
            this.user = user;
            this.password = password;
        }

        public String mode() {
            return "Connected to MySQL through JDBC: " + url;
        }

        private Connection connection() throws SQLException {
            return DriverManager.getConnection(url, user, password);
        }

        void init() throws Exception {
            try (Connection con = connection(); Statement st = con.createStatement()) {
                st.execute("CREATE TABLE IF NOT EXISTS admin_users (id INT AUTO_INCREMENT PRIMARY KEY, username VARCHAR(80) UNIQUE NOT NULL, password_hash VARCHAR(128) NOT NULL)");
                st.execute("CREATE TABLE IF NOT EXISTS products (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, category VARCHAR(80) NOT NULL, price DECIMAL(10,2) NOT NULL, weight DECIMAL(10,2) NOT NULL, reorderLevel INT NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                st.execute("CREATE TABLE IF NOT EXISTS warehouses (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, location VARCHAR(160) NOT NULL, capacity INT NOT NULL, storageType VARCHAR(80) NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                st.execute("CREATE TABLE IF NOT EXISTS suppliers (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(120) NOT NULL, contactPerson VARCHAR(120), email VARCHAR(120), phone VARCHAR(40), address VARCHAR(220), creditLimit DECIMAL(12,2) NOT NULL DEFAULT 0, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                st.execute("CREATE TABLE IF NOT EXISTS inventory (id INT AUTO_INCREMENT PRIMARY KEY, productId INT NOT NULL, warehouseId INT NOT NULL, quantity INT NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                st.execute("CREATE TABLE IF NOT EXISTS purchase_orders (id INT AUTO_INCREMENT PRIMARY KEY, supplierId INT NOT NULL, productId INT NOT NULL, quantity INT NOT NULL, status VARCHAR(40) NOT NULL, expectedDate VARCHAR(40), createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                st.execute("CREATE TABLE IF NOT EXISTS shipments (id INT AUTO_INCREMENT PRIMARY KEY, orderId INT, trackingNumber VARCHAR(120), carrier VARCHAR(120), status VARCHAR(40) NOT NULL, origin VARCHAR(160), destination VARCHAR(160), shipDate VARCHAR(40), deliveryDate VARCHAR(40), createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                st.execute("CREATE TABLE IF NOT EXISTS product_returns (id INT AUTO_INCREMENT PRIMARY KEY, productId INT NOT NULL, shipmentId INT, quantity INT NOT NULL, reason VARCHAR(220), status VARCHAR(40) NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                st.execute("CREATE TABLE IF NOT EXISTS payments (id INT AUTO_INCREMENT PRIMARY KEY, supplierId INT NOT NULL, orderId INT, amount DECIMAL(12,2) NOT NULL, paymentDate VARCHAR(40) NOT NULL, method VARCHAR(60) NOT NULL, status VARCHAR(40) NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                st.execute("CREATE TABLE IF NOT EXISTS supplier_ledger (id INT AUTO_INCREMENT PRIMARY KEY, supplierId INT NOT NULL, entryType VARCHAR(40) NOT NULL, referenceId INT, debit DECIMAL(12,2) NOT NULL DEFAULT 0, credit DECIMAL(12,2) NOT NULL DEFAULT 0, entryDate VARCHAR(40) NOT NULL, note VARCHAR(220), createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                st.execute("CREATE TABLE IF NOT EXISTS invoices (id INT AUTO_INCREMENT PRIMARY KEY, orderId INT NOT NULL UNIQUE, orderCost DECIMAL(12,2) NOT NULL, taxAmount DECIMAL(12,2) NOT NULL, totalAmount DECIMAL(12,2) NOT NULL, invoiceDate VARCHAR(40) NOT NULL, status VARCHAR(40) NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                st.execute("CREATE TABLE IF NOT EXISTS product_batches (id INT AUTO_INCREMENT PRIMARY KEY, batchCode VARCHAR(80) NOT NULL UNIQUE, productId INT NOT NULL, supplierId INT NOT NULL, quantity INT NOT NULL, receivedDate VARCHAR(40) NOT NULL, expiryDate VARCHAR(40), status VARCHAR(40) NOT NULL, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP)");
                try {
                    st.execute("ALTER TABLE suppliers ADD COLUMN creditLimit DECIMAL(12,2) NOT NULL DEFAULT 0");
                } catch (SQLException ignored) {
                }
            }
            seed();
        }

        private void seed() throws Exception {
            try (Connection con = connection()) {
                try (PreparedStatement count = con.prepareStatement("SELECT COUNT(*) FROM admin_users"); ResultSet rs = count.executeQuery()) {
                    rs.next();
                    if (rs.getInt(1) == 0) {
                        try (PreparedStatement ps = con.prepareStatement("INSERT INTO admin_users (username, password_hash) VALUES (?, ?)")) {
                            ps.setString(1, "admin");
                            ps.setString(2, hash("admin123"));
                            ps.executeUpdate();
                        }
                    }
                }
                try (PreparedStatement count = con.prepareStatement("SELECT COUNT(*) FROM products"); ResultSet rs = count.executeQuery()) {
                    rs.next();
                    if (rs.getInt(1) > 0) {
                        return;
                    }
                }
            }
            create(Entity.PRODUCTS, Map.of("name", "Barcode Scanner", "category", "Electronics", "price", 4200, "weight", 0.6, "reorderLevel", 25));
            create(Entity.PRODUCTS, Map.of("name", "Packing Tape", "category", "Packaging", "price", 75, "weight", 0.2, "reorderLevel", 120));
            create(Entity.WAREHOUSES, Map.of("name", "North Hub", "location", "Delhi", "capacity", 25000, "storageType", "Ambient"));
            create(Entity.WAREHOUSES, Map.of("name", "Cold Bay", "location", "Pune", "capacity", 8000, "storageType", "Cold"));
            create(Entity.SUPPLIERS, Map.of("name", "Swift Supply Co", "contactPerson", "Riya Sharma", "email", "riya@swift.example", "phone", "+91 98765 43210", "address", "Noida", "creditLimit", 250000));
            create(Entity.INVENTORY, Map.of("productId", 1, "warehouseId", 1, "quantity", 18));
            create(Entity.INVENTORY, Map.of("productId", 2, "warehouseId", 1, "quantity", 420));
            create(Entity.ORDERS, Map.of("supplierId", 1, "productId", 1, "quantity", 100, "status", "Pending", "expectedDate", "2026-05-08"));
            create(Entity.SHIPMENTS, Map.of("orderId", 1, "trackingNumber", "LGW-88342", "carrier", "BlueDart", "status", "Shipped", "origin", "Delhi", "destination", "Mumbai", "shipDate", "2026-05-01", "deliveryDate", "2026-05-04"));
            create(Entity.PAYMENTS, Map.of("supplierId", 1, "orderId", 1, "amount", 50000, "paymentDate", "2026-05-03", "method", "Bank Transfer", "status", "Recorded"));
            create(Entity.BATCHES, Map.of("batchCode", "BATCH-LGW-001", "productId", 1, "supplierId", 1, "quantity", 100, "receivedDate", "2026-05-01", "expiryDate", "2027-05-01", "status", "Active"));
        }

        public boolean validAdmin(String username, String password) throws Exception {
            try (Connection con = connection(); PreparedStatement ps = con.prepareStatement("SELECT password_hash FROM admin_users WHERE username = ?")) {
                ps.setString(1, username);
                try (ResultSet rs = ps.executeQuery()) {
                    return rs.next() && Objects.equals(rs.getString(1), hash(password));
                }
            }
        }

        public List<Map<String, Object>> list(Entity entity, String search, String status) throws Exception {
            StringBuilder sql = new StringBuilder("SELECT * FROM " + entity.table);
            List<Object> params = new ArrayList<>();
            List<String> where = new ArrayList<>();
            if (search != null && !search.isBlank()) {
                where.add(entity.label + " LIKE ?");
                params.add("%" + search + "%");
            }
            if (status != null && !status.isBlank() && entity.fields.contains("status")) {
                where.add("status = ?");
                params.add(status);
            }
            if (!where.isEmpty()) {
                sql.append(" WHERE ").append(String.join(" AND ", where));
            }
            sql.append(" ORDER BY id DESC");
            try (Connection con = connection(); PreparedStatement ps = con.prepareStatement(sql.toString())) {
                for (int i = 0; i < params.size(); i++) {
                    ps.setObject(i + 1, params.get(i));
                }
                try (ResultSet rs = ps.executeQuery()) {
                    return rows(rs);
                }
            }
        }

        public Map<String, Object> create(Entity entity, Map<String, Object> body) throws Exception {
            validate(entity, body, false);
            String columns = String.join(", ", entity.fields);
            String marks = "?,".repeat(entity.fields.size());
            marks = marks.substring(0, marks.length() - 1);
            try (Connection con = connection(); PreparedStatement ps = con.prepareStatement("INSERT INTO " + entity.table + " (" + columns + ") VALUES (" + marks + ")", Statement.RETURN_GENERATED_KEYS)) {
                bind(ps, entity.fields, body);
                ps.executeUpdate();
                try (ResultSet keys = ps.getGeneratedKeys()) {
                    keys.next();
                    int id = keys.getInt(1);
                    if (entity == Entity.ORDERS) {
                        syncInvoice(id);
                    }
                    return byId(entity, id);
                }
            }
        }

        public Map<String, Object> update(Entity entity, int id, Map<String, Object> body) throws Exception {
            validate(entity, body, true);
            List<String> fields = entity.fields.stream().filter(body::containsKey).toList();
            if (fields.isEmpty()) {
                throw new BadRequest("No valid fields");
            }
            String set = String.join(", ", fields.stream().map(f -> f + " = ?").toList());
            try (Connection con = connection(); PreparedStatement ps = con.prepareStatement("UPDATE " + entity.table + " SET " + set + " WHERE id = ?")) {
                bind(ps, fields, body);
                ps.setInt(fields.size() + 1, id);
                ps.executeUpdate();
                if (entity == Entity.ORDERS) {
                    syncInvoice(id);
                }
                return byId(entity, id);
            }
        }

        public void delete(Entity entity, int id) throws Exception {
            try (Connection con = connection(); PreparedStatement ps = con.prepareStatement("DELETE FROM " + entity.table + " WHERE id = ?")) {
                ps.setInt(1, id);
                ps.executeUpdate();
            }
        }

        public Map<String, Object> stats() throws Exception {
            try (Connection con = connection(); Statement st = con.createStatement()) {
                Map<String, Object> stats = new LinkedHashMap<>();
                stats.put("products", scalar(st, "SELECT COUNT(*) FROM products"));
                stats.put("warehouses", scalar(st, "SELECT COUNT(*) FROM warehouses"));
                stats.put("stock", scalar(st, "SELECT COALESCE(SUM(quantity), 0) FROM inventory"));
                stats.put("shipments", scalar(st, "SELECT COUNT(*) FROM shipments WHERE status <> 'Delivered'"));
                stats.put("orders", scalar(st, "SELECT COUNT(*) FROM purchase_orders WHERE status = 'Pending'"));
                stats.put("lowStock", lowStock(con));
                return stats;
            }
        }

        private Map<String, Object> byId(Entity entity, int id) throws Exception {
            try (Connection con = connection(); PreparedStatement ps = con.prepareStatement("SELECT * FROM " + entity.table + " WHERE id = ?")) {
                ps.setInt(1, id);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) {
                        throw new BadRequest("Record not found");
                    }
                    return row(rs);
                }
            }
        }

        private void syncInvoice(int orderId) throws Exception {
            String read = "SELECT po.id, po.quantity, po.status, p.price FROM purchase_orders po JOIN products p ON p.id = po.productId WHERE po.id = ?";
            try (Connection con = connection(); PreparedStatement ps = con.prepareStatement(read)) {
                ps.setInt(1, orderId);
                try (ResultSet rs = ps.executeQuery()) {
                    if (!rs.next()) return;
                    double cost = rs.getInt("quantity") * rs.getDouble("price");
                    double tax = cost * 0.18;
                    String status = rs.getString("status");
                    String upsert = "INSERT INTO invoices (orderId, orderCost, taxAmount, totalAmount, invoiceDate, status) VALUES (?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE orderCost = VALUES(orderCost), taxAmount = VALUES(taxAmount), totalAmount = VALUES(totalAmount), status = VALUES(status)";
                    try (PreparedStatement invoice = con.prepareStatement(upsert)) {
                        invoice.setInt(1, orderId);
                        invoice.setDouble(2, round(cost));
                        invoice.setDouble(3, round(tax));
                        invoice.setDouble(4, round(cost + tax));
                        invoice.setString(5, Instant.now().toString().substring(0, 10));
                        invoice.setString(6, status);
                        invoice.executeUpdate();
                    }
                }
            }
        }
    }

    static final class MemoryStore implements Store {
        private final Map<Entity, List<Map<String, Object>>> data = new ConcurrentHashMap<>();
        private final Map<Entity, Integer> ids = new ConcurrentHashMap<>();

        MemoryStore() {
            for (Entity entity : Entity.values()) {
                data.put(entity, new ArrayList<>());
                ids.put(entity, 0);
            }
            try {
                create(Entity.PRODUCTS, Map.of("name", "Barcode Scanner", "category", "Electronics", "price", 4200, "weight", 0.6, "reorderLevel", 25));
                create(Entity.PRODUCTS, Map.of("name", "Packing Tape", "category", "Packaging", "price", 75, "weight", 0.2, "reorderLevel", 120));
                create(Entity.WAREHOUSES, Map.of("name", "North Hub", "location", "Delhi", "capacity", 25000, "storageType", "Ambient"));
                create(Entity.WAREHOUSES, Map.of("name", "Cold Bay", "location", "Pune", "capacity", 8000, "storageType", "Cold"));
                create(Entity.SUPPLIERS, Map.of("name", "Swift Supply Co", "contactPerson", "Riya Sharma", "email", "riya@swift.example", "phone", "+91 98765 43210", "address", "Noida", "creditLimit", 250000));
                create(Entity.INVENTORY, Map.of("productId", 1, "warehouseId", 1, "quantity", 18));
                create(Entity.INVENTORY, Map.of("productId", 2, "warehouseId", 1, "quantity", 420));
                create(Entity.ORDERS, Map.of("supplierId", 1, "productId", 1, "quantity", 100, "status", "Pending", "expectedDate", "2026-05-08"));
                create(Entity.SHIPMENTS, Map.of("orderId", 1, "trackingNumber", "LGW-88342", "carrier", "BlueDart", "status", "Shipped", "origin", "Delhi", "destination", "Mumbai", "shipDate", "2026-05-01", "deliveryDate", "2026-05-04"));
                create(Entity.PAYMENTS, Map.of("supplierId", 1, "orderId", 1, "amount", 50000, "paymentDate", "2026-05-03", "method", "Bank Transfer", "status", "Recorded"));
                create(Entity.BATCHES, Map.of("batchCode", "BATCH-LGW-001", "productId", 1, "supplierId", 1, "quantity", 100, "receivedDate", "2026-05-01", "expiryDate", "2027-05-01", "status", "Active"));
            } catch (Exception ignored) {
            }
        }

        public String mode() {
            return "Running with in-memory demo data. Configure DB_URL, DB_USER, and DB_PASSWORD for MySQL.";
        }

        public boolean validAdmin(String username, String password) {
            return "admin".equals(username) && "admin123".equals(password);
        }

        public synchronized List<Map<String, Object>> list(Entity entity, String search, String status) {
            List<Map<String, Object>> rows = new ArrayList<>();
            data.get(entity).stream()
                    .filter(row -> search == null || search.isBlank() || String.valueOf(row.getOrDefault(entity.label, "")).toLowerCase().contains(search.toLowerCase()))
                    .filter(row -> status == null || status.isBlank() || Objects.equals(String.valueOf(row.get("status")), status))
                    .forEach(row -> rows.add(new LinkedHashMap<>(row)));
            return rows;
        }

        public synchronized Map<String, Object> create(Entity entity, Map<String, Object> body) {
            validate(entity, body, false);
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("id", ids.compute(entity, (key, value) -> value + 1));
            for (String field : entity.fields) {
                row.put(field, body.get(field));
            }
            row.put("createdAt", Instant.now().toString());
            data.get(entity).add(0, row);
            return new LinkedHashMap<>(row);
        }

        public synchronized Map<String, Object> update(Entity entity, int id, Map<String, Object> body) {
            validate(entity, body, true);
            Map<String, Object> row = data.get(entity).stream().filter(item -> number(item.get("id")) == id).findFirst().orElseThrow(() -> new BadRequest("Record not found"));
            for (String field : entity.fields) {
                if (body.containsKey(field)) {
                    row.put(field, body.get(field));
                }
            }
            return new LinkedHashMap<>(row);
        }

        public synchronized void delete(Entity entity, int id) {
            data.get(entity).removeIf(row -> number(row.get("id")) == id);
        }

        public synchronized Map<String, Object> stats() {
            Map<String, Object> stats = new LinkedHashMap<>();
            stats.put("products", data.get(Entity.PRODUCTS).size());
            stats.put("warehouses", data.get(Entity.WAREHOUSES).size());
            stats.put("stock", data.get(Entity.INVENTORY).stream().mapToInt(row -> number(row.get("quantity"))).sum());
            stats.put("shipments", data.get(Entity.SHIPMENTS).stream().filter(row -> !"Delivered".equals(row.get("status"))).count());
            stats.put("orders", data.get(Entity.ORDERS).stream().filter(row -> "Pending".equals(row.get("status"))).count());
            stats.put("lowStock", lowStockMemory());
            return stats;
        }

        private List<Map<String, Object>> lowStockMemory() {
            List<Map<String, Object>> alerts = new ArrayList<>();
            for (Map<String, Object> inv : data.get(Entity.INVENTORY)) {
                int productId = number(inv.get("productId"));
                Map<String, Object> product = data.get(Entity.PRODUCTS).stream().filter(p -> number(p.get("id")) == productId).findFirst().orElse(null);
                if (product != null && number(inv.get("quantity")) <= number(product.get("reorderLevel"))) {
                    alerts.add(Map.of("product", product.get("name"), "quantity", inv.get("quantity"), "reorderLevel", product.get("reorderLevel")));
                }
            }
            return alerts;
        }
    }

    static final class Json {
        static Map<String, Object> parseObject(String json) {
            Parser parser = new Parser(json);
            Object value = parser.parseValue();
            if (!(value instanceof Map<?, ?> map)) {
                throw new BadRequest("Expected JSON object");
            }
            Map<String, Object> result = new LinkedHashMap<>();
            for (Map.Entry<?, ?> entry : map.entrySet()) {
                result.put(String.valueOf(entry.getKey()), entry.getValue());
            }
            return result;
        }

        static String stringify(Object value) {
            if (value == null) return "null";
            if (value instanceof String text) return "\"" + escape(text) + "\"";
            if (value instanceof Number || value instanceof Boolean) return String.valueOf(value);
            if (value instanceof Map<?, ?> map) {
                List<String> parts = new ArrayList<>();
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    parts.add(stringify(String.valueOf(entry.getKey())) + ":" + stringify(entry.getValue()));
                }
                return "{" + String.join(",", parts) + "}";
            }
            if (value instanceof Iterable<?> list) {
                List<String> parts = new ArrayList<>();
                for (Object item : list) {
                    parts.add(stringify(item));
                }
                return "[" + String.join(",", parts) + "]";
            }
            return stringify(String.valueOf(value));
        }

        private static String escape(String text) {
            return text.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
        }
    }

    static final class Parser {
        private final String text;
        private int pos;

        Parser(String text) {
            this.text = text == null || text.isBlank() ? "{}" : text;
        }

        Object parseValue() {
            skip();
            if (peek() == '{') return object();
            if (peek() == '[') return array();
            if (peek() == '"') return string();
            if (starts("true")) { pos += 4; return true; }
            if (starts("false")) { pos += 5; return false; }
            if (starts("null")) { pos += 4; return null; }
            return number();
        }

        private Map<String, Object> object() {
            expect('{');
            Map<String, Object> map = new LinkedHashMap<>();
            skip();
            if (peek() == '}') { pos++; return map; }
            while (true) {
                String key = string();
                skip();
                expect(':');
                map.put(key, parseValue());
                skip();
                if (peek() == '}') { pos++; return map; }
                expect(',');
            }
        }

        private List<Object> array() {
            expect('[');
            List<Object> list = new ArrayList<>();
            skip();
            if (peek() == ']') { pos++; return list; }
            while (true) {
                list.add(parseValue());
                skip();
                if (peek() == ']') { pos++; return list; }
                expect(',');
            }
        }

        private String string() {
            expect('"');
            StringBuilder sb = new StringBuilder();
            while (pos < text.length()) {
                char c = text.charAt(pos++);
                if (c == '"') return sb.toString();
                if (c == '\\') {
                    char next = text.charAt(pos++);
                    sb.append(next == 'n' ? '\n' : next == 'r' ? '\r' : next == 't' ? '\t' : next);
                } else {
                    sb.append(c);
                }
            }
            throw new BadRequest("Invalid string");
        }

        private Number number() {
            int start = pos;
            while (pos < text.length() && "-0123456789.".indexOf(text.charAt(pos)) >= 0) pos++;
            String raw = text.substring(start, pos);
            if (raw.isBlank()) throw new BadRequest("Invalid JSON");
            return raw.contains(".") ? new BigDecimal(raw) : Integer.parseInt(raw);
        }

        private boolean starts(String value) {
            return text.startsWith(value, pos);
        }

        private char peek() {
            skip();
            return pos < text.length() ? text.charAt(pos) : '\0';
        }

        private void expect(char c) {
            skip();
            if (pos >= text.length() || text.charAt(pos) != c) {
                throw new BadRequest("Expected " + c);
            }
            pos++;
        }

        private void skip() {
            while (pos < text.length() && Character.isWhitespace(text.charAt(pos))) pos++;
        }
    }

    private static void validate(Entity entity, Map<String, Object> body, boolean partial) {
        for (String field : entity.fields) {
            if (!partial && !body.containsKey(field)) {
                throw new BadRequest("Missing field: " + field);
            }
        }
        for (String field : List.of("price", "weight", "reorderLevel", "capacity", "quantity", "productId", "warehouseId", "supplierId", "orderId", "shipmentId", "amount", "creditLimit")) {
            if (body.containsKey(field) && body.get(field) != null && number(body.get(field)) < 0) {
                throw new BadRequest(field + " cannot be negative");
            }
        }
        if (body.containsKey("email") && body.get("email") != null && !String.valueOf(body.get("email")).contains("@")) {
            throw new BadRequest("Invalid email");
        }
        if (entity.fields.contains("status") && body.containsKey("status") && String.valueOf(body.get("status")).isBlank()) {
            throw new BadRequest("Status is required");
        }
    }

    private static void bind(PreparedStatement ps, List<String> fields, Map<String, Object> body) throws SQLException {
        for (int i = 0; i < fields.size(); i++) {
            ps.setObject(i + 1, body.get(fields.get(i)));
        }
    }

    private static List<Map<String, Object>> rows(ResultSet rs) throws SQLException {
        List<Map<String, Object>> rows = new ArrayList<>();
        while (rs.next()) {
            rows.add(row(rs));
        }
        return rows;
    }

    private static Map<String, Object> row(ResultSet rs) throws SQLException {
        Map<String, Object> row = new LinkedHashMap<>();
        int count = rs.getMetaData().getColumnCount();
        for (int i = 1; i <= count; i++) {
            Object value = rs.getObject(i);
            if (value instanceof BigDecimal decimal) {
                value = decimal.stripTrailingZeros();
            }
            row.put(rs.getMetaData().getColumnLabel(i), value);
        }
        return row;
    }

    private static long scalar(Statement st, String sql) throws SQLException {
        try (ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getLong(1);
        }
    }

    private static List<Map<String, Object>> lowStock(Connection con) throws SQLException {
        String sql = "SELECT p.name AS product, i.quantity, p.reorderLevel FROM inventory i JOIN products p ON p.id = i.productId WHERE i.quantity <= p.reorderLevel ORDER BY i.quantity ASC";
        try (PreparedStatement ps = con.prepareStatement(sql); ResultSet rs = ps.executeQuery()) {
            return rows(rs);
        }
    }

    private static String requiredText(Map<String, Object> body, String field) {
        String value = String.valueOf(body.getOrDefault(field, "")).trim();
        if (value.isBlank()) {
            throw new BadRequest("Missing field: " + field);
        }
        return value;
    }

    private static int parseId(String raw) {
        try {
            return Integer.parseInt(raw);
        } catch (NumberFormatException ex) {
            throw new BadRequest("Invalid id");
        }
    }

    private static int number(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        return Integer.parseInt(String.valueOf(value));
    }

    private static double decimal(Object value) {
        if (value == null) return 0;
        if (value instanceof Number number) return number.doubleValue();
        return Double.parseDouble(String.valueOf(value));
    }

    private static double round(double value) {
        return Math.round(value * 100.0) / 100.0;
    }

    private static String money(double value) {
        return "Rs " + Math.round(value);
    }

    private static Map<Integer, Map<String, Object>> byIntId(List<Map<String, Object>> rows) {
        Map<Integer, Map<String, Object>> map = new HashMap<>();
        for (Map<String, Object> row : rows) {
            map.put(number(row.get("id")), row);
        }
        return map;
    }

    private static double orderValue(Map<String, Object> order, Map<Integer, Map<String, Object>> productMap) {
        Map<String, Object> product = productMap.get(number(order.get("productId")));
        return number(order.get("quantity")) * decimal(product == null ? 0 : product.get("price"));
    }

    private static String query(HttpExchange exchange, String key) {
        String query = exchange.getRequestURI().getRawQuery();
        if (query == null) return null;
        for (String part : query.split("&")) {
            String[] pair = part.split("=", 2);
            if (pair.length == 2 && pair[0].equals(key)) {
                return URLDecoder.decode(pair[1], StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private static void requireAuth(HttpExchange exchange) {
        if (currentUser(exchange).isEmpty()) {
            throw new Unauthorized();
        }
    }

    private static Optional<String> currentUser(HttpExchange exchange) {
        List<String> cookies = exchange.getRequestHeaders().getOrDefault("Cookie", List.of());
        for (String header : cookies) {
            for (String cookie : header.split(";")) {
                String[] parts = cookie.trim().split("=", 2);
                if (parts.length == 2 && "LWSESSION".equals(parts[0]) && sessions.containsKey(parts[1])) {
                    return Optional.of(parts[1]);
                }
            }
        }
        return Optional.empty();
    }

    private static String token() {
        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private static String hash(String password) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-256");
        byte[] hashed = digest.digest(("logiware:" + password).getBytes(StandardCharsets.UTF_8));
        return Base64.getEncoder().encodeToString(hashed);
    }

    private static String readBody(HttpExchange exchange) throws IOException {
        try (InputStream is = exchange.getRequestBody()) {
            return new String(is.readAllBytes(), StandardCharsets.UTF_8);
        }
    }

    private static void json(HttpExchange exchange, int status, Object body) throws IOException {
        cors(exchange);
        byte[] bytes = Json.stringify(body).getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().set("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        try (OutputStream os = exchange.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static void cors(HttpExchange exchange) {
        Headers headers = exchange.getResponseHeaders();
        headers.set("Access-Control-Allow-Origin", "http://localhost:8080");
        headers.set("Access-Control-Allow-Credentials", "true");
        headers.set("Access-Control-Allow-Headers", "Content-Type");
        headers.set("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
    }

    private static String contentType(Path path) {
        String file = path.getFileName().toString();
        if (file.endsWith(".css")) return "text/css";
        if (file.endsWith(".js")) return "application/javascript";
        if (file.endsWith(".svg")) return "image/svg+xml";
        return "text/html";
    }

    static final class BadRequest extends RuntimeException {
        BadRequest(String message) {
            super(message);
        }
    }

    static final class Unauthorized extends RuntimeException {
    }
}
