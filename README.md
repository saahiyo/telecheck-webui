# TeleCheck Pro

TeleCheck Pro is a Next.js 16 app for validating Telegram links in bulk or one at a time. It keeps the existing client-side workflow, talks to the TeleCheck API, and includes dark mode, saved-link browsing, clipboard helpers, and Vercel Analytics.

![TeleCheck Pro Dashboard](public/preview.png)

## Stack

- Next.js 16 App Router
- React 19
- TypeScript
- Tailwind CSS v4
- Lucide React
- Sonner
- Vercel Analytics

## Getting Started

Prerequisites:

- Node.js 20.9 or newer
- npm

Install dependencies and start the dev server:

```bash
npm install
npm run dev
```

The app will be available at `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env.local` if you want to override the default API origin.

```bash
NEXT_PUBLIC_TELECHECK_API_URL=https://telecheck.vercel.app
```

## Project Structure

```text
app/             Next.js App Router files
components/      Reusable UI components
services/        API service helpers
utils/           Utility functions
public/          Static assets
App.tsx          Client-side application shell
types.ts         Shared TypeScript types
```

## API Integration

The frontend calls the TeleCheck API for:

- `GET /stats`
- `GET /?link=...`
- `POST /`
- `GET /links?platform=telegram&limit=...&offset=...`

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
