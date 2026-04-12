# Design System Document: Gen Z High-Contrast Delivery

## 1. Overview & Creative North Star
**Creative North Star: "The Neon Nocturne"**
This design system moves beyond the "standard" delivery app by embracing a high-energy, editorial-dark aesthetic. It is designed for speed, impact, and thumb-driven navigation. We are rejecting the clinical "white-label" look in favor of a bespoke, premium experience that feels like a night-time digital concierge.

The system breaks the template through **intentional asymmetry** and **kinetic typography**. By utilizing ultra-high contrast between the `background` (#0e0e0e) and the `primary` "Cyber Lime" (#f3ffca), we create a visual vibration that feels modern and urgent. Layouts should favor overlapping elements (e.g., a food item image breaking the container boundary) to create a sense of three-dimensional space.

---

## 2. Colors & Surface Logic
The palette is rooted in deep midnight tones, using the "Cyber Lime" accent as a laser-focused guide for user action.

### The "No-Line" Rule
**Borders are strictly prohibited for sectioning.** To separate a category list from a restaurant feed, use a background shift from `surface` (#0e0e0e) to `surface-container-low` (#131313). High-end UI is defined by tonal transitions, not strokes.

### Surface Hierarchy & Nesting
Treat the UI as a series of stacked, semi-polished plates.
*   **Base:** `surface` (#0e0e0e) – The infinite void.
*   **Sections:** `surface-container-low` (#131313) – For large content groupings.
*   **Cards:** `surface-container-highest` (#262626) – For individual interactive units.
*   **Nesting:** Place a `surface-container-highest` card inside a `surface-container-low` section to create natural, soft lift without a single line of CSS border.

### The Glass & Gradient Rule
Floating elements (like a "View Cart" bar) must utilize **Glassmorphism**. Apply `surface_variant` (#262626) at 60% opacity with a `24px` backdrop-blur. 
*   **Signature Polish:** Use a linear gradient on Primary CTAs transitioning from `primary_container` (#cafd00) to `primary` (#f3ffca) at a 135-degree angle. This adds "soul" and prevents the lime from looking flat or "cheap."

---

## 3. Typography
We use a dual-font strategy to balance editorial flair with high-speed scannability.

*   **Display & Headlines (Plus Jakarta Sans):** Used for "The Hook." These should be bold, tight-leaded, and authoritative. Use `display-lg` for promo headers to grab attention instantly.
*   **UI & Body (Inter):** The workhorse. Inter provides the legibility required for tracking orders and reading menus at a glance.
*   **Hierarchy as Brand:** Use `label-md` in all-caps with 5% letter spacing for metadata (e.g., "DELIVERY TIME") to create a premium, "spec-sheet" feel.

---

## 4. Elevation & Depth
Depth in this system is achieved through **Tonal Layering**, not structural shadows.

*   **The Layering Principle:** Physicality is implied by color. A `primary_fixed` button sits on a `surface_container_highest` card, which sits on a `surface` background. Each step represents a physical step "closer" to the user.
*   **Ambient Shadows:** If a card must float (e.g., a modal), use a shadow with a `48px` blur and `6%` opacity. The shadow color should be `#000000`, creating a "void" glow rather than a grey smudge.
*   **The Ghost Border Fallback:** If a container sits on a background of the same color, use the `outline_variant` token at **15% opacity**. It should be felt, not seen.
*   **Kinetic Glass:** Use semi-transparent layers for navigation bars to allow the vibrant food photography to "bleed" through as the user scrolls, maintaining a sense of place.

---

## 5. Components

### Buttons
*   **Primary:** `primary_fixed` background with `on_primary_fixed` text. Roundedness: `full`. No border.
*   **Secondary:** `surface_container_highest` background. Subtle `ghost border` if against dark backgrounds.
*   **States:** On `hover/active`, use `primary_dim`.

### Cards (The "Hero" Component)
*   **Style:** No borders. Background: `surface_container_highest`. 
*   **Image Handling:** Food images should have a `xl` (1.5rem) corner radius. Use a subtle inner-shadow on the image to make text overlays (like "20-30 min") pop.
*   **Separation:** Never use dividers. Use `spacing-6` (1.5rem) of vertical white space to separate items.

### Input Fields
*   **Style:** `surface_container_low` background with a `none` border. 
*   **Active State:** Transition the background to `surface_container_high` and add a `primary` 1px bottom-only glow.

### Additional Signature Components
*   **The "Speed-Dial" Order Button:** A floating, glassmorphic circular button with a `primary` icon for "Repeat Last Order" – minimizing clicks.
*   **Live Status Tracker:** A horizontal "progress glow" using a gradient of `primary` to `secondary` that pulses subtly.

---

## 6. Do's and Don'ts

### Do
*   **Do** use `primary` (#f3ffca) sparingly. It is a "high-heat" color; use it only for the most important actions.
*   **Do** lean into the `xl` (1.5rem) roundedness for large cards to create a friendly, modern feel.
*   **Do** use asymmetrical spacing (e.g., more padding at the bottom of a card than the top) to create a bespoke editorial look.

### Don't
*   **Don't** use `#000000` for surfaces. It kills the depth. Use `surface_container_lowest` (#000000) only for the absolute background layer.
*   **Don't** use 1px solid lines to separate menu items. Use background tonal shifts or pure whitespace.
*   **Don't** use standard "Error Red." Use our `error` (#ff7351) which is a "Sunset Orange" that fits the neon palette better.