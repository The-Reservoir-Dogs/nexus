# NEXUS — API Contract (v1)

Shared contract between the **Next.js web app** (frontend + `/api` backend) and the frontend built on dummy JSON. Build the frontend against these shapes; swap dummy data for live `/api` at integration.

- Base path: `/api`
- Format: JSON. `Content-Type: application/json`.
- IDs: strings (Postgres BIGINT serialized as string to avoid JS precision loss).
- Timestamps: ISO-8601 UTC strings (`2025-07-25T14:45:00Z`).
- Auth: handled by Databricks Apps OAuth; backend reads identity from request headers. Frontend does **not** send tokens. Use `GET /api/me` for the current user.
- The **agent never writes.** Approved episodes are persisted via `POST /api/episodes`.

---

## Conventions

**Success envelope**
```json
{ "data": <object|array>, "meta": { ...optional } }
```

**Error envelope** (non-2xx)
```json
{ "error": { "code": "NOT_FOUND", "message": "Episode not found" } }
```
Codes: `BAD_REQUEST` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `SERVER_ERROR` (500).

**List meta (pagination)**
```json
{ "meta": { "page": 1, "pageSize": 20, "total": 42 } }
```
Query params: `?page=1&pageSize=20`.

**Access model (no role column):** a user is the **author** of an episode if `episode.authorId === me.id`, and the **co-author** if `episode.coAuthorId === me.id`. Everyone else is a reader. The backend enforces this; the frontend can use the same check to show/hide the edit + verify controls.

---

## Resource shapes

### User
```json
{ "id": "1", "username": "sriman", "createdAt": "2025-07-25T10:00:00Z" }
```

### Series (card + detail)
```json
{
  "id": "10",
  "title": "The Hollow Crown",
  "description": "A kingdom fractured by a single choice.",
  "summary": "Political fantasy across warring houses.",
  "genre": "Fantasy",
  "tag": "political,drama",
  "authorId": "1",
  "authorName": "sriman",
  "episodeCount": 4,
  "contributorCount": 3,
  "avgRating": 4.3,
  "coverUrl": "https://placehold.co/400x600",
  "createdAt": "2025-07-20T10:00:00Z"
}
```

### Season
```json
{ "id": "100", "seriesId": "10", "title": "Season 1", "summary": "The fall begins.", "orderIndex": 1 }
```

### Episode (list item + reader)
```json
{
  "id": "1001",
  "seriesId": "10",
  "seasonId": "100",
  "title": "The Spared Blade",
  "content": "Full episode text...",
  "summary": "The hero spares the villain.",
  "prevEpisodeSummary": "...",
  "orderIndex": 3,
  "authorId": "1",
  "authorName": "sriman",
  "coAuthorId": null,
  "coAuthorName": null,
  "forkedFromEpisodeId": null,
  "decisionPoint": null,
  "isCanonical": true,
  "verifiedByAuthor": false,
  "avgRating": 4.5,
  "ratingCount": 12,
  "audioUrl": null,
  "createdAt": "2025-07-22T10:00:00Z"
}
```
For an **alternate-timeline episode** (a fork), `isCanonical: false`, `coAuthorId` set, `forkedFromEpisodeId` = the decision-point episode id, and `decisionPoint` describes the "what if".

### Review / comment (threaded)
```json
{
  "id": "5001",
  "episodeId": "1001",
  "createdBy": "2",
  "authorName": "reader_amy",
  "reviewText": "What if she killed him instead?",
  "parentReviewId": null,
  "replies": [],
  "createdAt": "2025-07-23T09:00:00Z"
}
```

### Character
```json
{
  "id": "700",
  "seriesId": "10",
  "name": "Lady Corvin",
  "description": "The spared villain.",
  "role": "antagonist",
  "personality": "Calculating, proud, secretly loyal.",
  "backstory": "...",
  "goals": "Reclaim her house.",
  "speechStyle": "Formal, clipped, uses old proverbs.",
  "status": "alive"
}
```

---

## Endpoints

### Auth / current user
`GET /api/me` → `{ "data": <User> }` (401 if not logged in)

### Series
- `GET /api/series` → list of `Series` (dashboard). Query: `?page&pageSize&genre&q`.
- `GET /api/series/:id` → `Series` detail.
- `GET /api/series/:id/characters` → `Character[]` (for the reader/editor context panel).

### Episodes (timeline)
- `GET /api/series/:id/episodes` → canonical episodes ordered by `orderIndex` (the sacred timeline). `Episode[]`.
- `GET /api/episodes/:id` → single `Episode` (reader view; includes `content`).
- `GET /api/episodes/:id/timelines` → alternate timelines forked from this decision-point episode, **top-rated first**. `Episode[]` (each `isCanonical:false`). Query: `?limit=5`.

### Ratings
- `POST /api/episodes/:id/ratings` — body `{ "score": 5 }` (1–5). Upsert per user. → `{ "data": { "avgRating": 4.6, "ratingCount": 13 } }`

### Reviews / comments
- `GET /api/episodes/:id/reviews` → `Review[]` (threaded; top-level with nested `replies`).
- `POST /api/episodes/:id/reviews` — body `{ "reviewText": "...", "parentReviewId": null }` → `{ "data": <Review> }`

### Fork + generate (the core loop)
1. **Start a fork** (opens the editor with context)
   `POST /api/episodes/:id/fork` — body `{ "drivingReviewId": "5001" }` (optional)
   → returns the context the editor shows:
   ```json
   { "data": {
       "sourceEpisode": <Episode>,
       "decisionPoint": "The hero spares the villain",
       "drivingComment": <Review|null>,
       "characters": [<Character>]
   }}
   ```
   *(No DB write yet — this just assembles context.)*

2. **Generate the alternate future** (streamed, proxied to the Python agent)
   `POST /api/generate` — body:
   ```json
   {
     "sourceEpisodeId": "1001",
     "decisionPoint": "What if she killed him instead?",
     "drivingReviewId": "5001",
     "instructions": "Keep it dark and fast-paced."
   }
   ```
   → **Server-Sent Events** stream. Event data chunks:
   ```
   event: token   data: {"text":"The blade "}
   event: token   data: {"text":"fell without hesitation..."}
   event: done    data: {"draft":{"title":"The Fallen Blade","content":"...full text...","summary":"..."}}
   ```
   Frontend renders tokens live (left/right split-view), assembles final `draft` on `done`.
   *(For dummy mode: mock a stream or just resolve the final `draft` object.)*

3. **Approve → persist** (HITL accept; backend writes)
   `POST /api/episodes` — body:
   ```json
   {
     "seriesId": "10",
     "seasonId": "100",
     "forkedFromEpisodeId": "1001",
     "decisionPoint": "What if she killed him instead?",
     "title": "The Fallen Blade",
     "content": "...approved text...",
     "summary": "...",
     "isCanonical": false
   }
   ```
   → `{ "data": <Episode> }` (the new alternate-timeline episode; `coAuthorId` = current user).

### Verify / canonize (author only)
- `POST /api/episodes/:id/verify` — body `{ "verified": true }` → `{ "data": <Episode> }`. 403 unless caller is the series/original author.

---

## Endpoint → user story map

| Endpoint | Stories |
|---|---|
| `GET /api/me` | US-1, US-7 |
| `GET /api/series` | US-2 |
| `GET /api/series/:id` + `/episodes` | US-3 |
| `GET /api/episodes/:id` | US-4 |
| `GET /api/episodes/:id/timelines` | US-5 |
| ratings + reviews | US-6, US-12 |
| `POST /fork` + `POST /generate` | US-8, US-9, US-15 |
| `POST /api/episodes` (approve) | US-10, US-11 |
| `POST /verify` | US-14 |

---

## Dummy data for the frontend

Sriman: create `src/mocks/*.json` matching the shapes above. Minimum for the demo path:
- 1 `Series` (`id:"10"`) + author `User`.
- 1 `Season` + **4 canonical `Episode`s** (`orderIndex` 1–4), episode 3 has a `decisionPoint`.
- 2 **alternate-timeline episodes** forked from episode 3 (`isCanonical:false`, different `avgRating`), one `verifiedByAuthor:true`.
- ~5 `Review`s on episode 3, one of them the "driving" comment.
- 3–4 `Character`s.
- A mock `/generate` that streams a hard-coded alternate episode.

Wire the UI to a thin API client (`getSeries()`, `getEpisode(id)`, `forkEpisode(id)`, `generate(body)`, etc.) that reads mocks now and swaps to `fetch('/api/...')` at integration — no component changes needed.

---

## Notes / open items
- Auth header parsing (Databricks OAuth) is backend-only; frontend just calls `/api/me`.
- `avgRating` / `ratingCount` / `episodeCount` / `contributorCount` are derived server-side (not stored).
- SSE format is a suggestion; if the agent template returns a different stream shape, the `/api/generate` proxy normalizes it to the above so the frontend never changes.
- Versioned base (`/api`) — bump to `/api/v2` only on breaking changes.
