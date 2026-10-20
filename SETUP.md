# Chi-Best store: setup and operations guide

Chi-Best is a complete online store for imported goods. It has a customer storefront, checkout, order tracking and product sourcing requests, plus an admin back office for products, inventory and orders.

It runs in two modes:

| Mode | When | Where data lives |
|---|---|---|
| **Demo** | `supabase.url` in `js/config.js` is empty (the default) | In the current browser only. Good for trying everything out. |
| **Live** | Supabase URL and key are filled in | A shared Supabase (PostgreSQL) database. Every customer and admin sees the same data. |

> The Supabase project the old code pointed to (`niuvzotnbjjbxeifkiqx`) no longer exists, so the store starts in demo mode. Follow "Going live" below to connect a new project.

---

## 1. Try it locally

The site is plain HTML, CSS and JavaScript. There is no build step.

```bash
# from the project folder
python -m http.server 8000
```

Then open:

- Storefront: http://localhost:8000/
- Admin: http://localhost:8000/admin.html (demo passcode `chibest-admin`)

In the admin dashboard, click **Generate sample orders** to fill the reports with realistic demo data. Use **Settings → Reset demo data** to start again.

---

## 2. Running the store (for the owner)

### Products
- **Add a product:** Admin → Products → **Add product**. Fill in name, photos, price, cost per item, category and opening stock. The SKU is generated automatically.
- **Options:** add sizes or colours with the quick buttons (Kids ages, EU sizes, S–XL, Colour). Customers must choose every option before adding to cart.
- **Draft / archived:** set the status to hide a product without deleting it. Archive products you no longer sell so their sales history stays in your reports.
- **Bulk changes:** tick several products to activate, hide, feature or delete them together.
- **Spreadsheet updates:** Products → **Export** downloads a CSV. Edit prices or stock in Excel or Google Sheets, then use **Import** to apply the changes. Products are matched by SKU, and stock changes are recorded in the inventory ledger.

### Inventory
Stock never changes silently. Every change is a recorded **movement**: opening stock, stock received, sale, order cancelled, customer return, write-off or stock count. Each one stores who made it, when, the quantity, the balance afterwards and a reference.

- **Receive a shipment:** Inventory → **Receive shipment**. Add every product that arrived, with quantities and landed unit cost. The cost price updates automatically as a weighted average.
- **Stock count:** use the scan icon to set the exact quantity you counted. The difference is recorded.
- **Write off:** record damaged, lost or sample items.
- **Movement history:** the full ledger, filterable by product, type and date, and exportable to CSV.
- **Purchase list:** what to buy from suppliers. It lists items customers have pre-ordered and products below their reorder level, with suggested quantities.
- **Pre-orders:** turn on "Allow pre-orders" for a product to keep selling when stock reaches 0. Those order lines are marked *pre-order*.

### Orders
1. New orders arrive as **Pending**. The sidebar shows how many are waiting.
2. Open an order to see the items, customer, delivery address, profit and full timeline.
3. When payment arrives, click **Mark as paid**, then update the status: Confirmed → Processing → Shipped → Out for delivery → Delivered.
4. After each update, click **Send update** to message the customer on WhatsApp with a ready-written message that includes their tracking link.
5. **Cancel order** returns ready-stock items to inventory automatically.
6. **Invoice** opens a printable invoice.

Customers track their orders at `track.html` with their order number and phone number. Notes marked *Internal only* are never shown to them.

### Sourcing requests
Customers can ask you to find any product (request.html). In Admin → Sourcing requests, enter a quoted price and delivery time, then **Send quote** opens WhatsApp with the quote written out.

### Settings
Update your WhatsApp number, delivery fees and times, free-delivery threshold, **bank account details** (shown to customers after checkout), pay-on-delivery rules and the announcement bar. Changes apply to the storefront immediately.

> **Before launch:** replace the placeholder prices, costs and stock levels in the starter catalogue, and add your real WhatsApp number and bank details.

---

## 3. Going live with Supabase

1. **Create a project** at https://supabase.com (the free tier is enough to start). Choose a region close to Nigeria, such as `eu-west`.
2. **Create the database:** open *SQL Editor → New query*, paste the whole of `database/schema.sql` and click **Run**. Then do the same with `database/seed.sql` to load the starting catalogue and its opening stock.
3. **Turn off public sign-ups:** *Authentication → Sign In / Providers → Email*, and disable "Allow new users to sign up". Only people you add can log in.
4. **Create the admin login:** *Authentication → Users → Add user*. Enter the owner's email and a strong password, and tick "Auto confirm". Then run this in the SQL editor with that email:
   ```sql
   insert into public.admins (user_id, email)
   select id, email from auth.users where email = 'owner@example.com'
   on conflict do nothing;
   ```
   Repeat for each staff member who needs admin access.
5. **Connect the site:** in *Project Settings → API*, copy the **Project URL** and the **anon / publishable key** into `js/config.js`:
   ```js
   supabase: {
     url: 'https://YOUR-PROJECT.supabase.co',
     anonKey: 'YOUR-ANON-KEY'
   },
   ```
   The anon key is designed to be public. Security comes from the database rules in `schema.sql`. **Never** put the `service_role` key in the website.
6. **Deploy** the project folder to any static host, such as Netlify, Vercel, Cloudflare Pages or GitHub Pages. Upload the whole folder, including `images/catalog`.
7. Sign in at `/admin.html` with the email and password from step 4, and fill in **Settings**.

### What the database guarantees
- Product stock can **only** change through the inventory functions, and every change is written to `stock_movements`. A direct edit to `products.stock` is rejected.
- Checkout prices are calculated on the server from the products table, not taken from the browser. Stock is locked and decremented in the same transaction.
- Shoppers can read the catalogue (through the `storefront_products` view, which has no cost prices), categories and settings. Orders, customers, the ledger and requests are readable only by admins.
- Product photos uploaded in the admin go to the `product-images` storage bucket. Only admins can upload.

The schema was tested end to end (43 checks) against PostgreSQL 16, covering stock rules, checkout, tracking, cancellation, access rules and ledger reconciliation.

---

## 4. Project structure

```
index.html, shop.html, product.html     storefront pages
cart.html, checkout.html, track.html
wishlist.html, request.html, help.html
admin.html                               back office (single page)

css/store.css      storefront design system
css/admin.css      admin styles
js/config.js       Supabase keys + default settings
js/db.js           data layer: demo (browser) and live (Supabase) backends
js/ui.js           shared storefront UI: header, search, cart drawer, product cards
js/icons.js        SVG icon set
js/catalog.js      starter catalogue for demo mode (generated)
js/pages/*.js      one script per storefront page
js/admin/*.js      admin modules: dashboard, orders, products, inventory, ...

database/schema.sql   tables, rules, functions, security policies
database/seed.sql     starter catalogue for Supabase (generated)
tools/build_catalog.py  turns supplier photos into optimised images + seed files
images/catalog/       optimised product photos (1000px + 480px thumbnails)
images/brand/         logo mark and favicons
```

### Regenerating the starter catalogue
`tools/build_catalog.py` holds the starter product list. It crops and squares the raw photos in `images/`, writes web-optimised copies to `images/catalog/`, and regenerates `js/catalog.js` and `database/seed.sql`:

```bash
pip install pillow numpy
python tools/build_catalog.py           # add --force to re-process every image
```

This only affects a fresh install. Once the store is running, manage products in the admin.

---

## 5. Known limitations and next steps

- **Payments** are by bank transfer, pay on delivery, or confirmation on WhatsApp. Card payments (for example Paystack or Flutterwave) are not integrated yet. They would need a small server function to verify payments.
- **Stock is tracked per product, not per size or colour.** Customers pick sizes and colours, and the choice is saved on the order, but all variants share one stock count.
- **Notifications:** the admin shows a toast when new orders arrive and refreshes every 60 seconds in live mode. There are no email or SMS notifications yet; customer updates are sent with one click on WhatsApp.
- **Demo mode is not secure.** The demo passcode only keeps casual visitors out, and demo data lives in one browser. Use live mode for real customers.
- **Product reviews** are not included. The storefront deliberately shows no ratings or testimonials until there are real ones.
