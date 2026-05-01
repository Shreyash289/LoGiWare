# LoGiWare

Warehouse & Logistics Tracking System for a DBMS project.

## Features

- Secure admin login with server-side session cookie
- Dashboard stats for products, warehouses, stock, shipments, and pending orders
- CRUD modules for products, warehouses, inventory, suppliers, purchase orders, shipments, and returns
- Search, status filters, low-stock alerts, and live dashboard updates through Server-Sent Events
- Responsive dashboard UI with sidebar navigation, cards, tables, forms, badges, loading states, and light/dark mode
- Java backend using JDBC for MySQL, with an in-memory fallback for quick demos

## Default Login

- Username: `admin`
- Password: `admin123`

## Run

Compile and run:

```powershell
javac -d out backend/src/com/logiware/App.java
java -cp out com.logiware.App
```

Open `http://localhost:8080`.

## MySQL Setup

1. Create the schema:

```powershell
mysql -u root -p < database/schema.sql
```

2. Download MySQL Connector/J and include it in the classpath:

```powershell
javac -d out backend/src/com/logiware/App.java
java -cp "out;path\to\mysql-connector-j.jar" com.logiware.App
```

3. Optional environment variables:

```powershell
$env:DB_URL="jdbc:mysql://localhost:3306/logiware"
$env:DB_USER="root"
$env:DB_PASSWORD="your_password"
$env:PORT="8080"
```

If MySQL is unavailable, the app starts with demo in-memory data so the UI can still be tested.

## Vercel Deployment

This repo includes Vercel support:

- `vercel.json` serves the frontend from `dist/`
- `scripts/build-vercel.js` copies `frontend/public` into `dist/`
- `api/index.js` provides Vercel serverless API routes for `/api/*`

After pushing these files, redeploy the project on Vercel. The 404 page appears when Vercel has no frontend output or route config to serve.

For hosted MySQL on Vercel, set one of these environment variables in Vercel Project Settings:

```text
MYSQL_URL=mysql://user:password@host:3306/database
DATABASE_URL=mysql://user:password@host:3306/database
```

If no MySQL URL is configured, the deployed app uses demo in-memory data.
