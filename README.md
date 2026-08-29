# Task Manager — Spring Boot backend

A Java (Spring Boot) backend for the Task Manager board. It serves the existing
frontend (`index.html`, `style.css`, `script.js`) as static files and exposes
two REST endpoints that replace the old `window.storage` calls:

- `GET/POST /api/board`  — the board's tasks + next id
- `GET/POST /api/shifts` — the shift list from the Report popup

Data is persisted as JSON files on disk (`./data/board-state.json`,
`./data/shifts.json`) so it survives server restarts. There's deliberately no
database here — the frontend's task shape (subtasks, canvas lines, stopwatches)
is still evolving, so the backend just stores whatever JSON the frontend sends
rather than modeling every field as a strict Java class. That also means:
**anyone hitting this server sees the same shared data**, on any device or
browser — which is the actual problem this migration solves.

## Requirements

- Java 17+
- Maven 3.6+
- Internet access the first time you build (Maven needs to download Spring
  Boot's dependencies)

## Project layout

```
task-manager-backend/
├── pom.xml
├── src/main/java/com/taskmanager/
│   ├── TaskManagerApplication.java     Spring Boot entry point
│   ├── controller/
│   │   ├── BoardController.java        GET/POST /api/board
│   │   └── ShiftController.java        GET/POST /api/shifts
│   └── service/
│       ├── BoardService.java           reads/writes data/board-state.json
│       ├── ShiftService.java           reads/writes data/shifts.json
│       └── JsonFileStore.java          shared file read/write helper
├── src/main/resources/
│   ├── application.properties
│   └── static/                         the frontend (served as-is)
│       ├── index.html
│       ├── style.css
│       └── script.js
└── data/                               created automatically on first save
```

## Running it

```bash
cd task-manager-backend
mvn spring-boot:run
```

Then open **http://localhost:8080** — that's it, frontend and backend are the
same server, so there's no CORS setup needed.

To build a standalone jar instead:

```bash
mvn clean package
java -jar target/task-manager-backend-1.0.0.jar
```

### Changing the port or data folder

```bash
java -jar target/task-manager-backend-1.0.0.jar --server.port=9090 --app.data.dir=/var/lib/taskmanager
```

## What changed on the frontend

`script.js` no longer touches `window.storage` or `localStorage` for board/shift
data — `loadState()`, `saveState()`, `loadShifts()`, and `saveShifts()` now call
`fetch('/api/board')` / `fetch('/api/shifts')` instead. The **role toggle**
(Super User / User) is intentionally left in the browser's own `localStorage`,
since that's a per-person choice, not shared team data — there's no reason to
make everyone else's UI change when you switch your own role.

## Notes / things to decide next

- **No authentication yet.** Anyone who can reach `/api/board` can overwrite
  everyone's tasks — same for the Super User role client-side check, which is
  UI-only, not enforced server-side. If this needs real access control, that's
  the next thing to add (e.g. Spring Security + a login, then move the
  Super User/User check into the backend so it can't be bypassed from the
  browser console).
- **No database.** JSON-file storage is simple and fine for one small team, but
  if you expect concurrent heavy writes or need querying/history, swap
  `JsonFileStore` for a real datastore (Postgres, H2, etc.) behind the same
  `BoardService`/`ShiftService` interface — the controllers wouldn't need to
  change.
