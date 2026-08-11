# Facelook Cosmetics - Project Overview & Technical Documentation

## 1. Executive Summary
Facelook Cosmetics is a modern, high-performance e-commerce single-page application (SPA). Designed for a seamless, mobile-first shopping experience, the platform boasts premium aesthetics, offline capabilities (PWA via Service Workers), dynamic rendering, and robust backend integrations. It is architected to be highly scalable, extremely fast, and SEO-friendly.

## 2. Working Structure & Architecture
- **Frontend Architecture:** The frontend is built as an ultra-fast Vanilla JavaScript Single Page Application (SPA), minimizing framework overhead (no React/Vue required) and maximizing load performance. State is managed locally (cart, wishlist) and DOM elements are hydrated dynamically.
- **Backend Architecture:** REST API hosted on Render (`https://facelook-backend.onrender.com`), handling user data, product catalogs, and order processing.
- **Routing:** Client-side routing intercepts URL changes (e.g., `/cart`, `/product/slug`) enabling instant page transitions without full page reloads.
- **Offline / Caching:** Integrated Service Worker (`sw.js`) with a *Stale-While-Revalidate* strategy. Images and API responses are cached in the browser's Cache Storage, enabling ultra-fast subsequent loads and offline resilience.
- **SEO & Social:** Dynamically generated JSON-LD Schema.org tags for rich search engine snippets, and Open Graph meta tags for social media sharing.

## 3. Key User Features
- **Intuitive Browsing & Discovery:** Dynamic hero carousel, categorized filtering (Best Sellers, Lips, Eyes, Face, Nails), and interactive product search.
- **Rich Product Detail Pages (PDP):** Includes swipeable image galleries, variant (shade) selection, related product recommendations, dynamic pricing, and detailed HTML descriptions (accordion style).
- **Persistent Cart & Wishlist:** Synchronized with the backend for logged-in users; maintained in local state for guest users.
- **Seamless Checkout:** Multi-step, streamlined checkout process with integrated digital payments and Cash on Delivery (COD).
- **Customer Profiles & Order Tracking:** Users can view order history and track the real-time status of their shipments.

## 4. Admin Features & Capabilities (Backend Driven)
*Note: Admin operations are driven by the connected backend API and managed via a separate portal or database viewer.*
- **Order Management:** Track, update, and manage incoming orders, capturing transaction IDs and payment statuses.
- **Product Catalog Management:** Add new products (including the ability to group a single product with multiple color/shade variants under one listing), update prices, apply discount badges, and manage inventory dynamically—all without needing frontend code changes.
- **Promotional Control:** Manage the scrolling announcement bar and promotional sections remotely.
- **Customer CRM:** View registered users, their order histories, and wishlist data to drive targeted marketing.

## 5. Third-Party Integrations
- **Razorpay:** Secure, industry-standard payment gateway for processing credit/debit cards, UPI, and net banking seamlessly in the browser.
- **Google Sign-In:** One-click authentication integrated via Google Identity Services (`gsi/client`).
- **Firebase Auth (Infrastructure Ready):** Base scripts included for potential Email/Password and OTP phone authentication.
- **WhatsApp Business:** Floating widget for instant, direct-to-consumer customer support.
- **Analytics Ready:** Pre-configured placeholders for Google Analytics (`gtag.js`) and Meta/Facebook Pixel to track user behavior and conversions.

## 6. Configuration & Required API Keys
To fully configure the project for a production handover, the following keys and settings must be populated:

### Frontend Environment (`index.html.html`)
- **Backend URL (`API_BASE`):** Currently points to `https://facelook-backend.onrender.com`.
- **Razorpay Key ID:** Requires the public key from the Razorpay Dashboard (configured within the Razorpay checkout script initiation).
- **Google Client ID:** Required for Google Sign-In button configuration.
- **WhatsApp Number:** Currently set to `919910215683`, needs to be updated to the client's official business number.
- **Analytics IDs:** 
  - Replace `G-XXXXXXXXXX` with the live Google Analytics Measurement ID.
  - Update the Facebook Pixel ID (`XXXXXXXXXXXXXXXX`).

### Backend Environment (Render/Node.js)
- **Database URI:** Connection string for the production database (e.g., MongoDB/PostgreSQL).
- **Razorpay Key Secret:** For verifying payment signatures via webhooks and processing refunds.
- **JWT Secret:** For secure session handling and API authentication.

## 7. Development & Deployment Workflow
- **Local Development:** Run via a local static server. The `API_BASE` automatically switches to `http://localhost:3000` if local development (`127.0.0.1` or `localhost`) is detected.
- **Production Build:** A simple structure with `index.html.html` and `sw.js` requires zero build steps (no Webpack/Vite overhead). 
- **Deployment:** Extremely portable. Can be deployed on Vercel, Netlify, or AWS S3 instantly due to its static nature. Currently configured for deployment via Vercel CLI (`npx vercel --prod`).
