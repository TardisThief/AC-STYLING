# AC Styling - Premier Personal Styling Platform

**AC Styling** is a high-end personal styling website built with modern web technologies, designed to reflect elegance, minimalism, and professional expertise.

## 🎨 Design System: "Liquid Glass & Taupe"

The project implements a bespoke design system focusing on:

-   **Aesthetic**: "Liquid Glass" (Translucent layers, blur effects, refined borders).
-   **Palette**:
    -   **Primary**: Deep Taupe (`#5A4F44`)
    -   **Base**: Warm Sand (`#E6DED6`)
    -   **Accents**: Muted Olive (`#7F8968`), Gold (`#D4AF37`)
-   **Typography**:
    -   **Headings**: *Didot* (Classic, Editorial, Serif)
    -   **Body**: *Inter* (Clean, Modern, Sans)
-   **Layout**: "Ultra-Compact" & "Editorial"
    -   Tight vertical spacing for modern feel.
    -   2-Column grids for storytelling sections.

## Phase 1: Website Redesign & Public Landing Page

The website has completed Phase 1, which includes the redesign of the public landing page and the implementation of the new design system.

## ✨ Key Features

### 1. Photo Carousel (`components/PhotoCarousel.tsx`)
-   **Behavior**: Auto-playing, swipeable carousel for portrait editorial shots.
-   **Design**: 3:4 aspect ratio with glass-morphism control overlays.

### 2. Services & Testimonials (`components/Services.tsx`, `Testimonials.tsx`)
-   **Effect**: Cards feature a "Liquid Glass" effect (`bg-white/80` + `backdrop-blur`).
-   **Interaction**: Hover-lift effects with deepened shadows.

### 3. Smart Navbar (`components/Navbar.tsx`)
-   **Dynamic**: Changes from transparent to white on scroll.
-   **Assets**: Logo adapts color (Taupe/White) using CSS masks for perfect contrast.

## 🛠 Tech Stack & Integrations

### Core Framework
| Technology | Version | Purpose |
|------------|---------|---------|
| [Next.js](https://nextjs.org/) | 16.1.3 | App Router, Server Components |
| [React](https://react.dev/) | 19.2.3 | UI Library |
| [TypeScript](https://typescriptlang.org/) | 5.x | Type Safety |
| [Tailwind CSS](https://tailwindcss.com/) | 4.x | Styling |

### Backend & Database
| Service | Purpose |
|---------|---------|
| [Supabase](https://supabase.com/) | PostgreSQL Database, Auth, Storage |
| [Stripe](https://stripe.com/) | Payments, Subscriptions, Webhooks |
| [Vimeo](https://vimeo.com/) | Video Hosting (Domain-locked) |
| [Resend](https://resend.com/) | Transactional Email |

### Key Libraries
| Library | Purpose |
|---------|---------|
| `@supabase/ssr` | Server-side Supabase client |
| `next-intl` | Internationalization (EN/ES) |
| `framer-motion` | Animations |
| `react-dropzone` | File uploads |
| `sonner` | Toast notifications |
| `lucide-react` | Icons |

### Database Schema (17 Tables)
| Table | Purpose |
|-------|---------|
| `profiles` | User profiles with access flags |
| `purchases` | Purchase records |
| `user_access_grants` | Content access control |
| `masterclasses` | Course containers |
| `chapters` | Individual lessons |
| `offers` | Pricing packages (Full Access, Course Pass) |
| `services` | Bookable services |
| `wardrobes` | Client wardrobe containers |
| `wardrobe_items` | Individual clothing items |
| `lookbooks` | Styled outfit collections |
| `boutique_items` | Curated shopping recommendations |
| `partner_brands` | Brand partnerships |
| `tailor_cards` | Client measurements |
| `essence_responses` | Style quiz answers |
| `user_progress` | Content completion tracking |
| `admin_notifications` | Admin inbox |
| `webhook_events` | Stripe event logging |

## 🚀 Getting Started

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run development server**:
    ```bash
    npm run dev
    ```

3.  **Build for production**:
    ```bash
    npm run build
    ```

## 📂 Project Structure

```
AC-STYLING/
├── app/
│   ├── [locale]/           # i18n routes (en, es)
│   │   ├── (auth)/         # Login, Signup
│   │   ├── (marketing)/    # Public landing page
│   │   ├── vault/          # Protected user dashboard
│   │   │   ├── admin/      # Admin dashboard
│   │   │   ├── boutique/   # Curated shopping
│   │   │   ├── courses/    # Masterclasses & chapters
│   │   │   ├── essence/    # Style essence lab
│   │   │   ├── gallery/    # User gallery
│   │   │   ├── profile/    # User profile
│   │   │   ├── services/   # Bookable services
│   │   │   └── studio/     # Wardrobe access
│   │   └── studio/         # Intake & upload flows
│   ├── actions/            # Server actions
│   │   ├── admin/          # Admin CRUD operations
│   │   ├── commerce.ts     # Purchase handling
│   │   ├── stripe.ts       # Checkout sessions
│   │   ├── wardrobes.ts    # Wardrobe management
│   │   └── studio.ts       # Studio operations
│   ├── api/webhooks/stripe/ # Stripe webhook handler
│   └── lib/                # Shared utilities
├── components/
│   ├── admin/              # Admin dashboard components
│   ├── vault/              # Vault UI components
│   ├── studio/             # Studio UI components
│   └── ui/                 # Shared UI primitives
├── utils/
│   ├── supabase/           # Supabase client configs
│   └── stripe.ts           # Stripe client
├── messages/               # i18n translations (en.json, es.json)
└── supabase/migrations/    # Database migrations
```
---

## Phase 2: AC Styling Lab | Ecosystem Overview

### 1. The Vision

The AC Styling Lab is a hybrid digital platform merging high-touch personal styling with scalable digital education. It transforms the styling business from a purely service-based model into a tech-enabled ecosystem.

**Goal:** A seamless "Liquid Glass" luxury experience where users flow effortlessly between curious guests, paying students, and high-ticket private clients.

---

### 2. The Core Pillars

#### 🏛️ The Vault (Education & Passive Income)

**Function:** The scalable monetization engine hosting Masterclasses, Courses, and "The Pulse" (monthly trends).

| Feature | Description |
|---------|-------------|
| **A la Carte** | Individual Masterclass purchases (micro-transactions) |
| **Full Access** | "Super User" state unlocking entire library |
| **Content Security** | Videos on Vimeo, domain-locked to theacstyle.com |

#### 🎨 The Studio (Service & Client Management)

**Function:** The high-touch service engine powering "Remote Closet Detox" and ongoing wardrobe management.

| Feature | Description |
|---------|-------------|
| **Tokenized Intake** | Secure private links for wardrobe upload (no login required) |
| **The Merge** | Guest data grafted onto permanent profile at signup |
| **Digital Wardrobe** | Visual inventory with tagging (Donate/Keep/Tailor) |

#### 🛍️ The Atelier (Booking & Conversion)

**Function:** The gateway handling discovery and booking of services.

**Strategy:** "Soft Gate" offering value (teasers, style quizzes) before "Hard Gate" (Payment/Booking).

---

### 3. The User Hierarchy

| Role | Access Level | Experience |
|------|--------------|------------|
| **Guest** | Landing pages, tokenized intake | "Shop Window" |
| **Member** | Free content, Profile Hub | "Lobby Access" |
| **Student/Client** | Paid content, Wardrobe Tools | "VIP Room" |
| **Admin** | All content, CMS, User Management | "Control Tower" |

---

### 4. Technical Philosophy

| Principle | Implementation |
|-----------|----------------|
| **Seamless Entry** | No email verification until value exchanged |
| **Economic Engine** | Stripe webhooks auto-grant access |
| **Liquid UI** | Didot typography, luxury palettes, mobile-first |

---

### 5. Future Roadmap

- **Styling 2.0:** Canva integration for outfit design
- **AI Stylist:** Automated pairing suggestions from wardrobe data

---

**System Status:** Live / Production  
**Deployment:** Vercel  
**Database:** Supabase

---
*Maintained by AC Styling Dev Team*
