# TeleCheck Pro

TeleCheck Pro is the Next.js web UI for the TeleCheck API. It validates Telegram and MEGA links, shows metadata-rich results, browses saved database links, and tracks anonymous contributor activity with a stable browser/device identity.

![TeleCheck Pro Dashboard](public/preview.png)

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Motion
- Lucide React
- Sonner
- TanStack React Virtual
- Vercel Analytics
- Optional Databuddy analytics

## Getting Started

Prerequisites:

- Node.js 20.9 or newer
- npm

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

The app runs at `http://localhost:3000`.

On Windows PowerShell, use `npm.cmd` if script execution policy blocks `npm`:

```powershell
npm.cmd install
npm.cmd run dev
```

## Environment Variables

Copy `.env.example` to `.env.local` when you want to override the API origin or enable Databuddy:

```env
NEXT_PUBLIC_TELECHECK_API_URL=https://telecheck.vercel.app
NEXT_PUBLIC_DATABUDDY_CLIENT_ID=
```

If `NEXT_PUBLIC_TELECHECK_API_URL` is empty, the frontend falls back to `https://telecheck.vercel.app`.

## Scripts

```bash
npm run dev
npm run build
npm run start
```

## Features

- Single-link validation through `GET /?link=...`.
- Bulk validation through `POST /`.
- URL extraction, normalization, and deduplication before bulk checks.
- Saved links dashboard with pagination, search, platform filtering, tag filtering, and contributor filtering.
- Saved-link detail cards with Telegram/MEGA metadata, member counts, status, database id, saved date, and contributor details.
- Copy helpers for individual results, filtered result groups, all saved links, and the saved-link copy modal.
- Saved-link revalidation through `/links/validate`; invalid or expired database links are removed by the backend.
- Global tags stored on saved links with `/tags` and `/links/tags`.
- Contributors leaderboard based on currently active valid links.
- Stable anonymous contributor identity stored in browser `localStorage` with recovery-key support.
- Theme toggle, keyboard navigation shortcuts, installable PWA assets, and mobile zoom support.

## API Integration

The frontend API layer is in `services/api.ts`. It calls:

- `GET /stats?period=24h` for rolling statistics.
- `GET /?link=...` for one link.
- `POST /` for bulk checks.
- `GET /links?platform=...&limit=...&offset=...&search=...&tag=...&username=...` for saved links.
- `POST /links/validate?limit=...&offset=...&platform=...` to re-check saved links and clean invalid ones.
- `GET /links/stats` for saved-link totals.
- `GET /tags` for available tags.
- `POST /links/tags` to update tags for a saved link.
- `GET /contributors` for the leaderboard.
- `GET /contributors/me` for the current browser/device contributor profile.
- `POST /contributors/recover` for recovery-key based profile recovery.

Contributor identity is sent through query parameters or JSON body fields using `contributor_id`, `device_id`, `recovery_key`, and `contributor_username`. The browser stores identity data under `telecheck_contributor_identity`.

## Project Structure

```text
app/                     Next.js App Router pages and metadata
app/page.tsx             Main single/bulk validation UI
app/saved/               Saved links route
app/contributors/        Contributors route
components/              Shared UI and route components
components/SavedLinksPage.tsx
components/ContributorsPage.tsx
components/ResultCard.tsx
components/LinkCopyModal.tsx
services/api.ts          TeleCheck API client helpers and cache
utils/                   Clipboard, tracking, DB, identity, and link helpers
public/                  Icons, manifest, service worker, and preview assets
types.ts                 Shared frontend TypeScript types
```

## Notes

- Saved-link fetching uses a short in-memory cache and aborts older saved-link requests while search input changes.
- The saved-link validation UI currently calls the backend by page-sized chunks from the client. For very large databases, a backend job endpoint with progress would be faster and more resilient.
- The service worker is intentionally small and only supports app shell/static asset caching.

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
