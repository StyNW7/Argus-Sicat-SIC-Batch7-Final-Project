This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

---

## Argus Extra Pages & Setup

This repo includes additional pages: `/login`, `/register`, `/teacher-monitoring`, and `/student-dashboard`.

Quick setup:

1. Create a `.env.local` with values from `.env.sample` (Supabase URL and anon key, and admin credential).
2. Run the SQL in `db/schema.sql` on your Supabase project to create `students` and `seats` tables and populate the 6x6 seats.
3. Install dependencies and run dev server:

```bash
npm install
npm run dev
```

Notes:

- Teacher monitoring access is gated by the single admin credential defined in `NEXT_PUBLIC_ADMIN_NIM` and `NEXT_PUBLIC_ADMIN_PASS`.
- Student registration uses Supabase Auth (email/password) and inserts a student record (nim, name, email) in `students` table.
- Login uses NIM + password: the app looks up the student email by NIM and signs in via Supabase Auth.
