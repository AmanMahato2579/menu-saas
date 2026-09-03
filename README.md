# Menu SaaS — Multi-tenant Restaurant QR Ordering System

Menu SaaS is a production-ready, multi-tenant QR-based restaurant ordering application. Restaurant owners can create and manage digital menus, while customers can scan QR codes to browse menus and place orders without installing an app or creating an account.

## 🚀 Tech Stack

* **Next.js** — App Router
* **Prisma ORM** — Database ORM
* **Tailwind CSS** — Styling
* **Supabase** — PostgreSQL database
* **NextAuth** — Authentication
* **Zod** — Server-side validation
* **bcrypt** — Secure password hashing

---

## 📂 Project Structure

```text
menu-saas/
├── src/
│   ├── app/
│   │   ├── login/             # Public login page
│   │   ├── super-admin/       # Platform owner dashboard
│   │   ├── admin/             # Restaurant admin dashboard
│   │   ├── r/[slug]/          # Customer-facing restaurant menu
│   │   └── api/               # Backend API routes
│   │       ├── admin/
│   │       ├── auth/
│   │       ├── customer/
│   │       └── super-admin/
│   │
│   ├── components/            # Reusable React components
│   └── lib/
│       ├── auth.ts            # Authentication configuration
│       ├── auth-guard.ts      # Role-based authorization
│       └── db.ts               # Database instance
│
├── prisma/
│   ├── schema.prisma          # Database schema
│   └── seed.ts                # Database seed script
│
├── .env.example               # Environment variable template
└── package.json
```

### Main Application Areas

| Route          | Purpose                                           |
| -------------- | ------------------------------------------------- |
| `/login`       | Authentication for platform and restaurant admins |
| `/super-admin` | Super Admin dashboard                             |
| `/admin`       | Restaurant Admin dashboard                        |
| `/r/[slug]`    | Customer-facing restaurant menu                   |
| `/api`         | Backend API endpoints                             |

---

## 🔑 Test Credentials

Run the database seed script to create the default accounts and demo data:

```bash
npx prisma db seed
```

### Super Admin

```text
Email:    admin@menusaas.com
Password: Admin123!
```

### Restaurant Admin

Demo Restaurant:

```text
Email:    owner@demo.com
Password: Owner123!
```

### Customers

Customers do **not** need an account or credentials.

They access the restaurant menu using a table-specific QR code or direct table URL.

Example:

```text
http://localhost:3000/r/demo-restaurant/demo-table-1
```

---

## 🛡️ Security & Multi-Tenant Isolation

Menu SaaS is designed as a multi-tenant application where each restaurant's data is isolated from other restaurants.

### Tenant Isolation

Database queries and API routes use `restaurantId` to ensure that restaurant admins can only access resources belonging to their restaurant.

```text
Restaurant A
   │
   ├── Menu Items
   ├── Tables
   └── Orders

Restaurant B
   │
   ├── Menu Items
   ├── Tables
   └── Orders
```

### Authentication

* NextAuth is used for authentication.
* Passwords are securely hashed using **bcrypt**.
* Sessions use JWT-based authentication.

### Role-Based Access Control

The application supports different administrative roles:

* `SUPER_ADMIN`
* `RESTAURANT_ADMIN`

Role-based guards in `auth-guard.ts` restrict access to protected routes and APIs.

### Server-Side Validation

Input validation is performed on the server using tools such as **Zod**.

Prices and order totals are also calculated server-side to prevent client-side price manipulation.

---

## ⚡ Performance & Production Considerations

For production deployments, consider the following improvements:

### Database Connection Pooling

Use connection pooling such as **pgBouncer** to efficiently handle a large number of concurrent database connections.

### Caching

Consider adding **Redis** for frequently accessed data such as:

* Restaurant menus
* Menu categories
* Frequently accessed table information

### Image Delivery

Use a CDN or optimized object storage for menu item images.

### Real-Time Order Tracking

For high-volume restaurants, consider using:

* WebSockets
* Supabase Realtime
* Another real-time messaging solution

This can provide instant order status updates between customers and restaurant staff.

---

# 🛠️ Getting Started

## 1. Clone the Repository

```bash
git clone <repository-url>
cd menu-saas
```

## 2. Install Dependencies

```bash
npm install
```

---

## 3. Configure Environment Variables

Copy the example environment file.

### macOS / Linux

```bash
cp .env.example .env
```

### Windows PowerShell

```powershell
Copy-Item .env.example .env
```

Fill in the required Supabase database credentials and `NEXTAUTH_SECRET`.

You can generate a secure NextAuth secret using:

```bash
openssl rand -base64 32
```

---

## 4. Set Up the Database

For development, push the Prisma schema to the database:

```bash
npm run db:push
```

### After Pulling New Changes

If you pull new code that includes schema changes (new fields, models, etc.), the local database will be out of sync. Run:

```bash
npm run db:push
npm run db:generate
rm -rf .next
```

Then restart the dev server. This syncs the database schema, regenerates the Prisma Client, and clears the stale Next.js cache.

---

## 4.1 Database Schema Changes (Production Workflow)

When you change `prisma/schema.prisma`, follow these steps:

**Step 1** — Create a migration (run once per schema change):

```bash
npm run db:migrate:dev -- --name describe_your_change
```

**Step 2** — Open the generated SQL file in `prisma/migrations/`, copy the SQL, then:

1. Go to Supabase Dashboard → SQL Editor
2. Paste the SQL
3. Click "Run without RLS"
4. Verify it succeeds

**Step 3** — Regenerate the Prisma client:

```bash
npm run db:generate
```

**Step 4** — Push to GitHub. Vercel auto-deploys.

> **Do NOT run `db:migrate:dev` multiple times** — it creates duplicate migration files.
> **Do NOT run `db:push` for production** — it bypasses migrations and can cause drift.

---

## 5. Seed the Database

Run:

```bash
npx prisma db seed
```

This creates:

* Super Admin account
* Demo Restaurant
* Restaurant Admin account
* Demo menu data
* Demo tables

---

## 6. Start the Development Server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

Then navigate to:

```text
http://localhost:3000/login
```

to sign in as an administrator.

---

# 🍽️ How the Application Works

## 👨‍💼 Super Admin

The Super Admin manages the platform and creates restaurants.

Typical workflow:

```text
Super Admin
     │
     ▼
Create Restaurant
     │
     ▼
Create Restaurant Admin
     │
     ▼
Owner receives credentials
```

---

## 🏪 Restaurant Admin

A Restaurant Admin manages their restaurant through the admin dashboard.

They can:

* Manage menu categories
* Add and edit menu items
* Set item prices
* Configure optional item choices
* Create promotional offers
* Create and manage restaurant tables
* View incoming customer orders
* Accept orders
* Complete orders
* View orders by table

Menu items can include configurable options such as:

```text
Spice Level
├── Low
├── Medium
└── High
```

or:

```text
Sugar
├── No Sugar
├── Less Sugar
└── Normal
```

---

## 👤 Customer

Customers do not need to register or log in.

The customer workflow is:

```text
Scan QR Code
     │
     ▼
Open Table Menu
     │
     ▼
Browse Categories
     │
     ▼
Select Menu Items
     │
     ▼
Choose Options
     │
     ▼
Add Items to Cart
     │
     ▼
Review Total
     │
     ▼
Place Order
```

Customers access a menu through a table-specific URL, for example:

```text
/r/demo-restaurant/demo-table-1
```

The QR code associated with the table points to this URL.

---

# 💳 Checkout & Payments

Menu SaaS currently supports **physical payment at the restaurant**.

The application:

1. Records the customer's order.
2. Calculates the bill.
3. Sends the order to the restaurant admin.
4. Allows the restaurant to accept the order.
5. The customer pays physically.
6. The restaurant marks the order as complete.
7. The table session is reset.

Online payment processing is not currently required.

---

# 🗄️ Database

The application uses **Prisma ORM** with a **Supabase PostgreSQL** database.

The Prisma schema contains core entities such as:

* `User`
* `Restaurant`
* `Table`
* `Order`
* `MenuItem`
* Menu categories
* Order items
* Item options

The database relationships are designed around the restaurant tenant:

```text
User
 │
 └── Restaurant
       │
       ├── Tables
       │
       ├── Menu Categories
       │      └── Menu Items
       │
       └── Orders
              └── Order Items
```

---

# 🧪 Development & Testing

Before submitting changes, it is recommended to run:

```bash
npm run lint
```

and the project's unit tests, if configured:

```bash
npm test
```

For a production build:

```bash
npm run build
```

---

# 📈 Future Improvements

Potential future enhancements include:

* [ ] Online payment integration
* [ ] Restaurant analytics dashboard
* [ ] Revenue and sales reports
* [ ] Real-time order notifications
* [ ] Redis caching
* [ ] CDN-based image optimization
* [ ] Customer order history
* [ ] Restaurant-specific branding
* [ ] Custom QR code generation
* [ ] Multiple restaurant branches
* [ ] Inventory management
* [ ] Kitchen display system
* [ ] WebSocket/Supabase Realtime order updates

---

# 🚀 Next Steps for New Developers

After setting up the project:

### 1. Log in as Super Admin

Use the Super Admin credentials to create and manage restaurants.

### 2. Log in as Restaurant Admin

Use the Demo Restaurant credentials to access the restaurant dashboard.

From there, explore:

* Menu categories
* Menu items
* Tables
* Orders

### 3. Simulate a Customer

Open a table URL from the **Admin → Tables** section.

For example:

```text
http://localhost:3000/r/demo-restaurant/demo-table-1
```

Use this page to simulate the customer ordering experience.

---

# 📌 Summary

Menu SaaS provides a complete digital ordering workflow for restaurants:

```text
                 ┌─────────────────┐
                 │   Super Admin   │
                 └────────┬────────┘
                          │
                    Creates Restaurant
                          │
                          ▼
                 ┌─────────────────┐
                 │ Restaurant Admin│
                 └────────┬────────┘
                          │
             ┌────────────┼────────────┐
             ▼            ▼            ▼
          Menus         Tables       Orders
             │            │
             └──────┬─────┘
                    │
               QR Code / URL
                    │
                    ▼
             ┌──────────────┐
             │   Customer   │
             └──────┬───────┘
                    │
               Places Order
                    │
                    ▼
             Restaurant Admin
                    │
                    ▼
             Accept / Complete
                    │
                    ▼
              Table Reset
```

The system is built around **multi-tenancy, secure role-based access, QR-based customer access, and server-side order validation**, providing a foundation for a production-ready restaurant ordering platform.

