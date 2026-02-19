# Database for Farmhouse Logistic

## Current database: `bread_logistics_v2`

Place the MySQL dump file here so you can upload or import it on the server.

### File to add

- **`bread_logistics_v2.sql`** — Export of the `bread_logistics_v2` database (includes `returns`, `return_items`, `orders`, `branch`, `product`, `shipments`, `routes`, etc.)

If your dump file has a different name (e.g. `bread_logistics_v2 (2).sql`), rename it to `bread_logistics_v2.sql` or update the import command below.

### Import on server (MySQL / MariaDB)

1. Create the database (if it does not exist):
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bread_logistics_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   ```

2. Import the dump:
   ```bash
   mysql -u root -p bread_logistics_v2 < database/bread_logistics_v2.sql
   ```
   Or from the project root:
   ```bash
   mysql -u root -p bread_logistics_v2 < database/bread_logistics_v2.sql
   ```

3. Configure the app to use this database via `.env`:
   ```env
   DB_NAME_V2=bread_logistics_v2
   DB_HOST=localhost
   DB_PORT=3306
   DB_USER=your_user
   DB_PASSWORD=your_password
   ```

### Optional: legacy DB `bread_logistics`

The app can also use a legacy database `bread_logistics` for some features. If you have a dump for that, add `bread_logistics.sql` here and import similarly with `DB_NAME=bread_logistics` in `.env`.
