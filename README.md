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

## 🛠 Tech Stack

-   **Framework**: [Next.js 14](https://nextjs.org/) (App Router)
-   **Styling**: [Tailwind CSS](https://tailwindcss.com/)
-   **Animations**: [Framer Motion](https://www.framer.com/motion/) (Smooth transitions, scroll reveals)
-   **Internationalization**: [next-intl](https://next-intl-docs.vercel.app/) (EN/ES support)
-   **Icons**: [Lucide React](https://lucide.dev/)

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

-   `/app`: Next.js App Router pages and global styles.
-   `/components`: Reusable UI components (Hero, About, Carousel, etc.).
-   `/public`: Static assets (images, PDFs).
-   `/messages`: Localization files (en.json, es.json).
-   `/design-system`: Generated design reference (Pro Max workflow).

---
*Maintained by AC Styling Dev Team*
