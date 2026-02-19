# Deploy Farmhouse Logistic (2.0) for presentation

This guide covers copying the project to **D:\logistic_OS**, pushing to your server with Git, and letting users choose between **Version 2.0 (React)** and **Legacy**, plus uploading the current database.

---

## 1. Copy project to D:\logistic_OS

Copy the entire project folder (this repo) to `D:\logistic_OS`:

- **Option A (Windows):** Copy the folder `logistic_OS_react` (or the folder that contains `package.json`, `server/`, `src/`) to `D:\logistic_OS`. You can rename it to `logistic_OS` if you want the root to be `D:\logistic_OS`.
- **Option B (command line):**
  ```bat
  xcopy /E /I "d:\logistic_OS_v2\Reference\logistic_OS_react" "D:\logistic_OS"
  ```

Make sure `D:\logistic_OS` contains at least: `package.json`, `server/`, `src/`, `database/`, `vite.config.js`, `.env.example` (or `.env`).

---

## 2. Add the database file

1. Copy your current database dump (e.g. `bread_logistics_v2 (2).sql` from Downloads) into the project’s **`database/`** folder.
2. Rename it to **`bread_logistics_v2.sql`** (or keep the name and use that in the import command; see `database/README.md`).

This file will be committed and pushed so the server (or your teacher) can import the same DB.

---

## 3. Git: push to server

From `D:\logistic_OS` (your project root):

```bash
cd D:\logistic_OS

# If this folder is not yet a Git repo:
git init
git add .
git commit -m "Farmhouse Logistic 2.0 – presentation ready"

# Add your server remote (replace with your repo URL)
git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
# or: git remote add origin git@server:path/repo.git

# Push (first time: set upstream)
git push -u origin main
# or, if your branch is master:
# git push -u origin master
```

If the project was already cloned from a repo, just:

```bash
cd D:\logistic_OS
git add .
git commit -m "Presentation: landing page, database folder, deploy notes"
git push origin main
```

---

## 4. Two alternative versions for users

After deployment, users open the app URL and see a **landing page** with two options:

| Option | Description |
|--------|-------------|
| **Logistic OS 2.0** | React app: Orders, Return Order, Create Order, Route (legacy), AI. |
| **Legacy version** | Classic Route Radar (map) in an iframe. |

- **Root URL** (e.g. `https://yourserver.com/`) → Landing page → user chooses 2.0 or Legacy.
- **Direct links** you can share:
  - 2.0: `https://yourserver.com/orders`
  - Legacy: `https://yourserver.com/radar-legacy`

No extra configuration is needed; the app already includes both versions and the landing page.

---

## 5. Upload / import current database on the server

Whoever runs the app (you or your teacher) should import the database once:

1. Ensure MySQL (or MariaDB) is installed on the server.
2. Put the dump file in the project’s `database/` folder (or get it from the Git repo after you push).
3. Create the database and import (see **database/README.md**):
   ```bash
   mysql -u root -p -e "CREATE DATABASE IF NOT EXISTS bread_logistics_v2 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
   mysql -u root -p bread_logistics_v2 < database/bread_logistics_v2.sql
   ```
4. Configure `.env` on the server with `DB_NAME_V2=bread_logistics_v2`, `DB_HOST`, `DB_USER`, `DB_PASSWORD`, etc.

---

## 6. Run the app (local or server)

```bash
cd D:\logistic_OS
npm install
cp .env.example .env   # then edit .env with DB and API keys
npm run build          # build React frontend
npm run server         # run Express (serves API + built frontend)
```

- Dev (frontend hot reload): run `npm run dev` in one terminal and `npm run server` in another; open the URL shown by Vite (e.g. http://localhost:5173).
- Production: after `npm run build`, run `npm run server` and (if needed) point a reverse proxy (e.g. Nginx) to the Node port (default 3001).

---

## Summary checklist for presentation

- [ ] Project copied to **D:\logistic_OS**
- [ ] **database/bread_logistics_v2.sql** added (current DB dump)
- [ ] **Git**: `git add .` → `git commit` → `git push` to server
- [ ] On server (or teacher’s machine): clone repo, `npm install`, create `.env`, import DB from `database/README.md`, then run `npm run build` and `npm run server`
- [ ] Users open the app → landing page → choose **2.0** or **Legacy**; database is the one you uploaded and imported
