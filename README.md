# ☕ Cafe OSS - Ultimate Multi-Tenant ShopOS

Cafe OSS is a production-ready, high-performance SaaS platform built for modern cafes and restaurants. It features a stunning, isolated multi-tenant architecture with a real-time POS, AI-driven analytics, and a seamless QR scanner menu system.

![Cafe OSS Dashboard](https://github.com/sujal338864/cafe-oss/raw/main/screenshots/dashboard.png)

## 🚀 Key Features

- **⚡ Real-time POS**: Instant order processing with WebSocket synchronization and automatic stock deduction.
- **📱 Smart QR Menu**: Personalized customer experience with real-time availability and low-latency polling.
- **🏢 Multi-Tenant Isolation**: Robust Row-Level Security (RLS) ensuring total data privacy between shops.
- **📊 AI Analytics**: Deep insights into sales patterns, top products, and financial health using direct SQL-driven analytics.
- **🎁 Loyalty System**: Fully integrated customer loyalty and rewards points system.
- **💹 Financial Management**: Track expenses, purchases, and taxes (GST) with a built-in audit trail.
- **🎨 Stunning UI**: Premium aesthetics featuring Framer Motion animations and responsive glassmorphism.

## 🛠️ Technology Stack

| Backend | Frontend | DevOps |
| :--- | :--- | :--- |
| **Node.js / Express** | **Next.js 14** | **PostgreSQL (Prisma)** |
| **Redis** (Caching) | **TanStack Query** | **Redis / BullMQ** |
| **Socket.io** | **Framer Motion** | **Cloudinary / AWS** |

## 📦 Installation & Setup

### 1. Prerequisites
- Node.js (v18+)
- PostgreSQL Database
- Redis Instance

### 2. Environment Configuration
Create a `.env` file in the `backend` and `frontend` directories using the provided `.env.example`.

### 3. Backend Setup
```bash
cd backend
npm install
npx prisma generate
npx prisma db push
npm run dev
```

### 4. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```

## 🛡️ Security & Performance
- **Atomic Operations**: Raw SQL transactions for stock and financial data prevents race conditions.
- **Double-Layer Cache**: Browser + Redis caching for high-traffic menu routes.
- **Next.js Optimization**: Full migration to `next/image` for sub-300ms LCP (Largest Contentful Paint).

## 📄 License
MIT License - Developed by Antigravity (Advanced Agentic Coding) for Sujal.
