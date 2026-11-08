# AI Usage Log

## 1. AI Tools Used & Scope

- **Tool Used:** Google Antigravity (AI pair-programming assistant).
- **Parts Assisted:**
  - Project scaffolding for the .NET 8 Minimal API (`backend/`) and React + TypeScript + Vite SPA (`frontend/`).
  - Writing the PostgreSQL transactional SQL in `HoldService`, `ClassService`, and `DbMigrator`.
  - Writing the xUnit integration/concurrency test suite (`SchoolAdmission.Tests`) and Vitest frontend test suite (`App.test.tsx`).
  - Configuring multi-stage `Dockerfile`s, runtime `/config.js` injection for Nginx, and `docker-compose.yml` profiles (`multi` and `test`).

---

## 2. Mistakes / Bugs Encountered and How They Were Caught & Fixed

*(Running log of real issues hit and resolved during development — review and edit in your own words before final submission)*

1. **Stray `.md` rule in `.gitignore` from an earlier draft**:
   - **What happened:** A leftover `.md` line at the bottom of `.gitignore` would have caused Git to ignore `README.md`, `ASSUMPTIONS.md`, and `AI_USAGE.md`.
   - **How it was caught:** Inspected `git status` and `.gitignore` before staging files.
   - **Fix:** Restored `.gitignore` without the `.md` pattern so documentation files are tracked properly.

2. **`dotnet run` inside a container bound to `localhost` instead of `0.0.0.0`**:
   - **What happened:** When smoke-testing the API container with `dotnet run --project SchoolAdmission.Api`, `Properties/launchSettings.json` had `"applicationUrl": "http://localhost:8080"`, which overrode the container's `ASPNETCORE_URLS=http://+:8080` environment variable and made Kestrel listen only on loopback inside the container.
   - **How it was caught:** Running `curl http://localhost:18080/classes` from the host returned an empty response right after container startup.
   - **Fix:** Passed `--no-launch-profile` when using `dotnet run` in dev containers, and used the published assembly (`dotnet SchoolAdmission.Api.dll`) in the production `Dockerfile` where `launchSettings.json` is not used.

3. **PostgreSQL `53300: sorry, too many clients already` during parallel multi-host tests**:
   - **What happened:** When running the 200-concurrent-applicants test (`ConcurrencyTests`) and the 160-concurrent-applicants two-instance test (`MultiInstanceTests`) in parallel across multiple xUnit test classes, each `WebApplicationFactory` host created its own `NpgsqlDataSource` with a large connection pool, exceeding PostgreSQL's default `max_connections = 100`.
   - **How it was caught:** Running `dotnet test` against the real PostgreSQL container failed in `ConcurrencyTests` and `MultiInstanceTests` with `Npgsql.PostgresException (0x80004005): 53300: sorry, too many clients already`.
   - **Fix:** Capped the default per-process Npgsql connection pool size in `AdmissionSettings` (`DefaultMaxPoolSize = 35`, and `15` per in-process test host in `TestDatabase`) so concurrent requests queue inside Npgsql's pool rather than exhausting PostgreSQL server connections, and set `-c max_connections=200` on the Postgres service in `docker-compose.yml`. Re-running `dotnet test` passed all 48 tests.

4. **Empty `Program.cs` caused `CS5001` during test build**:
   - **What happened:** `Program.cs` was open in the editor and became empty before the first test run, resulting in `CSC : error CS5001: Program does not contain a static 'Main' method suitable for an entry point`.
   - **How it was caught:** Immediately caught by the compiler when running `dotnet test`.
   - **Fix:** Rewrote `Program.cs` with all service registrations and endpoint mappings and re-ran the build.

5. **`dotnet test --no-build` in `backend/Dockerfile` `test` target failed because only `SchoolAdmission.Api` had been built**:
   - **What happened:** The `build` stage ran `dotnet publish SchoolAdmission.Api/... -c Release`, so `SchoolAdmission.Tests.dll` did not exist when `dotnet test --no-build` executed in `docker compose --profile test run --rm backend-tests`.
   - **How it was caught:** Running `docker compose --profile test run --rm backend-tests` failed with `The argument /src/SchoolAdmission.Tests/bin/Debug/net8.0/SchoolAdmission.Tests.dll is invalid`.
   - **Fix:** Added `RUN dotnet build SchoolAdmission.Tests/SchoolAdmission.Tests.csproj -c Release --no-restore` in the `test` stage and passed `-c Release --no-build` to `ENTRYPOINT`.


