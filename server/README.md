# Portable classroom API (Node 24)

No npm runtime dependencies. The API uses built-in HTTP, Web Crypto and SQLite.

## Local run

Set ADMIN_PASSWORD (at least 8 characters), FRONTEND_ORIGIN (exact browser origin, no trailing slash), DATA_DIR (private persistent folder), then run node server/server.mjs. ADMIN_USERNAME defaults to krutoey. PORT defaults to 3000. PUBLIC_ORIGIN can identify the backend's own public origin for same-origin browser requests.

By default 37 numbered students are created with student login disabled. No real roster or password belongs in Git, public assets or config.js. Optionally set ROSTER_FILE to an absolute private JSON file outside the repository before the first start: an array of {id,name,schoolId}. Blank schoolId is allowed and disables login. Bootstrap import only applies when the database is first created. Later changes use teacher importRoster.

## Deployment

1. Connect this GitHub repository to your Node/container hosting account. No deployment account or paid service has been provisioned automatically.
2. Build the root Dockerfile. Keep one application instance and attach a persistent disk at /var/data; set DATA_DIR=/var/data. Ephemeral storage loses records when replaced.
3. Set ADMIN_PASSWORD as a secret, ADMIN_USERNAME=krutoey, and FRONTEND_ORIGIN to the exact GitHub Pages origin (for example https://ACCOUNT.github.io, without a repository path). Use your actual origin. Render supplies RENDER_EXTERNAL_URL for same-origin access; other hosts must set PUBLIC_ORIGIN to their actual HTTPS backend origin.
4. The Render blueprint in ../render.yaml is an optional **paid starter plan plus persistent disk** example. Review its cost in the provider before creating it. It is not a free persistent hosting promise.
5. Open the backend HTTPS URL: it serves the complete frontend itself using a strict file allowlist. Its /config.js automatically selects the same-origin API. Alternatively set the GitHub Pages config.js apiBase to this actual HTTPS URL and rebuild Pages.
6. Sign in as teacher. Import the private roster through the frontend or POST /api/action with a teacher bearer token and {action:'importRoster',students:[...],requestId:'unique-request-id'}. Do not publish that import payload. Existing savings/merit are retained. Changing a schoolId resets its password and revokes sessions.
7. Validate a deposit, a purchase and a refresh from another device before classroom use. Protect and regularly back up the SQLite database and its WAL consistently using SQLite's online backup tooling or a stopped application. Never copy private backups into the public repository.

## API contract

- POST /api/login {username,password} returns {ok,token,teacher,studentId}. Teacher uses configured credentials. Student username and initial password are schoolId.
- Send Authorization: Bearer TOKEN on requests. Keep tokens in browser memory, never URLs or public files. No cross-site cookies are required. Sessions expire in 24 hours; sign-in replaces the previous account session.
- POST /api/login {action:'logout'} revokes the bearer session.
- POST /api/password {currentPassword,newPassword}: student password change, minimum 6 characters.
- GET /api/state: public numbered profiles; teacher sees names/savings/IDs; students see their own name/savings. Password hashes, session tokens and login attempts never serialize.
- POST /api/action: teacher attendance, merit, deposit, withdraw, rename, setSchoolId, resetStudentPassword, importRoster, duty; students may buy/equip only for themselves. Every action requires a unique requestId. Money amounts in requests are baht; state savings is integer satang.
- duty requires studentId, date YYYY-MM-DD and amount 5 or -5. +5 means completed and -5 means not completed. Merit applies the difference from the previous signed contribution (initially zero); correcting +5 to -5 subtracts 10 merit and revokes its 5 awarded coins. Repeated status is idempotent. Correction requires enough coins and merit, so toggling cannot create free coins. Attendance uses Bangkok dates.
- Five failed attempts lock an existing account for 15 minutes. Password hashes use PBKDF2 SHA-256 with individual salt and 100,000 iterations. Use HTTPS and provider request-rate limiting in production.

Run node --test server/*.test.mjs. The integration test invokes the real HTTP handler through streams, without opening network sockets, and uses only fictitious student records.
