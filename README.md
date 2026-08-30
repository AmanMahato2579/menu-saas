# Menu SaaS — Multi-tenant Restaurant QR Ordering System

Menu SaaS is a production-ready, multi-tenant QR-based restaurant ordering application. Restaurant owners create and manage digital menus, and customers scan QR codes to browse menus and place orders without installing apps or signing up.

## 📂 Project Overview

Tech stack: **Next.js (App Router)**, **Prisma ORM**, **Tailwind CSS**, and **Supabase (Postgres)**.

### Key folders
- `src/app`: Next.js App Router pages and layouts.
   - `login/`: Public login page (NextAuth).
   - `super-admin/`: Platform owner dashboard for managing restaurants.
   - `admin/`: Restaurant admin dashboard to manage menus, tables, and orders.
   - `r/[slug]`: Customer-facing menu (tenant-specific views, e.g. `r/demo-restaurant`).
   - `api/`: Backend API routes (`admin`, `auth`, `customer`, `super-admin`).
- `src/components`: Reusable React components and UI elements.
- `src/lib`: Utilities, DB instances, and auth helpers (`auth.ts`, `auth-guard.ts`, `db.ts`).
- `prisma/schema.prisma`: Database schema (`User`, `Restaurant`, `Table`, `Order`, `MenuItem`, etc.).
- `prisma/seed.ts`: Database seeding script (creates Super Admin and demo data).

## 🔑 Test Credentials
Run the seed script to create default accounts:

```bash
npx prisma db seed
```

Default accounts created by the seed script (for testing):

- Super Admin
   - Email: `admin@menusaas.com`
   - Password: `Admin123!`

- Restaurant Admin (Demo Restaurant)
   - Email: `owner@demo.com`
   - Password: `Owner123!`

Customers do not need credentials. They access menus via table-specific QR codes or direct URLs (e.g. `http://localhost:3000/r/demo-restaurant/demo-table-1`).

## 🛡️ Security & Tenant Isolation

- Database queries and API routes filter by `restaurantId` to ensure tenant isolation.
- Authentication uses NextAuth with secure password hashing (bcrypt) and JWT sessions.
- Role-based guards (`auth-guard.ts`) restrict access to `SUPER_ADMIN` and `RESTAURANT_ADMIN` routes.
- Server-side validation (e.g., `zod`) and server-side price calculation prevent client-side tampering.

## ⚡ Performance Notes

- Use connection pooling (pgBouncer) for production databases to handle many connections.
- Consider adding Redis for caching, a CDN for images, and WebSockets or real-time subscriptions for high-volume order tracking.

## 🛠️ Getting Started (Cross-platform)

1. Install dependencies:

```bash
npm install
```

2. Configure environment variables:

On macOS/Linux:
```bash
cp .env.example .env
```
On Windows (PowerShell):
```powershell
Copy-Item .env.example .env
```

Fill in Supabase connection values and `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32` or another secure generator).

3. Push the Prisma schema (development):

```bash
npx prisma db push
```

For production migrations use:

```bash
npx prisma migrate deploy
```

4. Seed the database:

```bash
npx prisma db seed
```

5. Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000` and use `/login` to sign in.

## How the App Works (Owner & Customer)

- Owner: A restaurant owner is created by the Super Admin. The owner receives credentials, can add menu items (optional options like spice level, sugar, etc.), set prices, and create text offers. Owners view incoming orders by table, accept orders, and mark them complete after payment. Completing an order resets the table session.
- Customer: A customer scans a table QR code (or visits a table URL), browses the menu, selects options (e.g., spice: low/medium/high), adds items to the cart, and views the total bill. Checkout is handled physically; the app records the bill and order status.

## Next Steps for New Users

- Log in as Super Admin to create restaurants.
- Log in as Restaurant Admin to manage menu categories, items, tables, and see customer orders.
- Use the table URL from the Admin Tables view to simulate a customer placing an order.

If you want, I can now run the project's build, start the dev server, and run unit tests to collect failures and begin debugging.
