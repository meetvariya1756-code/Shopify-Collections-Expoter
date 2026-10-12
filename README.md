# 📊 Shopify Collections — Excel Exporter & Importer (Next.js 14)

A modern full-stack **Next.js 14 (App Router)** application to export, manage, and migrate Shopify collections (Automated/Smart & Manual/Custom) with complete rule conditions, product tags, handles, images, and descriptions using professionally styled **Microsoft Excel spreadsheets (`.xlsx`)**.

---

## ✨ Key Capabilities

1. **High-Fidelity Excel (.xlsx) Export & Import**:
   - **Full Rule Preservation**: Preserves column conditions (tags, product titles, vendors, types, prices), relation operators (`equals`, `contains`, etc.), and match criteria (`ANY` or `ALL`).
   - **Product Tag & Handle Mapping**: Automatically extracts and maps all product tags and associated product handles.
   - **Styled Workbooks**: Exports include frozen header rows, styled table headers, auto-calculated column widths, and export metadata summary sheets.
   - **Sample Excel Template**: One-click download of a pre-formatted Excel template (`shopify-collections-template.xlsx`) with sample automated and manual collection rows.

2. **Dual Migration Modes**:
   - **Excel-Based Backup & Sync**: Export to `.xlsx`, edit offline in Microsoft Excel / Google Sheets, and import into any store.
   - **Direct Store-to-Store Sync**: One-click transfer directly from Source to Target Shopify store.

3. **Intelligent Conflict Resolution**:
   - **Skip Existing**: Safe mode that ignores existing collections with the same handle.
   - **Overwrite / Update**: Updates existing collections on the target store with new conditions, descriptions, tags, and images.
   - **Create As New**: Appends unique handles to avoid collision.

4. **Live SSE Streaming Progress Monitor**:
   - Real-time Server-Sent Events (SSE) streaming pipeline.
   - Interactive terminal logs, metric counters (Created / Updated / Skipped / Failed), smooth percentage bar, and celebratory confetti.

5. **Security & Privacy**:
   - Zero database or cloud storage of your tokens. Credentials are held in-memory during requests only.

---

## 🚀 Quick Start

### 1. Install Dependencies
```bash
npm install
```

### 2. Start the Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 3. Production Build
```bash
npm run build
npm run start
```

---

## 🔑 Shopify API Permissions Needed

Create a **Custom App** in your Shopify Admin:
1. Go to **Settings** &rarr; **Apps and sales channels** &rarr; **Develop apps** &rarr; **Create an app**.
2. Under **Configure Admin API scopes**, enable:
   - `read_products` (Source & Target)
   - `write_products` (Target)
   - `read_product_listings` (Optional, for product handle matching)
3. Click **Install app** &rarr; **Reveal token once** &rarr; Copy the token (`shpat_...`).

---

## 📂 Project Architecture

```
d:/Shopify Collections/
├── app/
│   ├── layout.js                      # Root layout with Google Fonts & metadata
│   ├── page.js                        # Main dashboard orchestrator (tabs & state)
│   ├── globals.css                    # Glassmorphic dark design system & tokens
│   ├── not-found.js                   # 404 page handler
│   └── api/shopify/
│       ├── test-connection/route.js   # Validates store credentials
│       ├── fetch-collections/route.js # Fetches enriched collections with rules & tags
│       ├── export-excel/route.js      # Generates styled .xlsx workbook
│       ├── template-excel/route.js    # Streams sample .xlsx template
│       └── import-excel/route.js      # Upload preview + SSE streaming import
├── components/
│   ├── Navbar.jsx                     # Navigation bar & live store indicators
│   ├── StoreConnector.jsx             # Source/Target store credential cards
│   ├── CollectionExplorer.jsx         # Search, filter, inspection, and .xlsx export
│   ├── ExcelImporter.jsx              # Drag-and-drop .xlsx studio & preview
│   ├── LiveProgress.jsx               # Real-time SSE streaming monitor & terminal
│   ├── CollectionDetailModal.jsx      # Rule condition & tag inspector modal
│   └── ApiGuideModal.jsx              # Step-by-step token generation tutorial
├── lib/
│   ├── shopify.js                     # Shopify Admin API client with retry & rate limits
│   └── excel.js                       # SheetJS (.xlsx) generator, template & parser
├── jsconfig.json                      # Path aliases (@/*)
├── next.config.mjs                    # Next.js configuration
└── package.json                       # Dependencies (Next 14, React 18, xlsx, lucide-react)
```
