# Jobharts Backend

This is a minimal Node.js + Express backend for the Jobharts app.

Features
- SQLite database (data/db.sqlite)
- User registration + login (JWT)
- CRUD endpoints for "charts" (title + arbitrary JSON data)

Quick start

1. Install dependencies

   npm install

2. Provide a JWT secret (recommended) or use default in development

   export JWT_SECRET="a-strong-secret"

3. Run migrations (creates the SQLite DB and tables)

   npm run migrate

4. Start the server

   npm start

API
- GET /api/health
- POST /api/register { name, email, password } -> { user, token }
- POST /api/login { email, password } -> { user, token }
- GET /api/charts (auth) -> list
- POST /api/charts (auth) { title, data } -> created chart
- GET /api/charts/:id (auth)
- PUT /api/charts/:id (auth) { title, data }
- DELETE /api/charts/:id (auth)

Notes
- The DB file is created in `data/db.sqlite`.
- In production set `JWT_SECRET` to a secure value and run behind a reverse proxy.
