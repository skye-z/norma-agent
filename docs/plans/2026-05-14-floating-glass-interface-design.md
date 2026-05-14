# Floating Glass Interface Design Spec

## 1. Core Aesthetic
- **Theme:** Silicon Valley Modern + Nordic Minimalism
- **Material:** Glassmorphism (macOS Vibrancy)
- **Vibe:** Floating, breathable, refined, and highly legible.

## 2. Global Environment
- **Root Background:** The application window acts as a large sheet of frosted glass. It features a tinted vibrancy effect (e.g., a very low-opacity titanium white or carbon gray) that blurs and slightly desaturates whatever is behind the OS window. This ensures text readability while maintaining an authentic, deep glass texture.

## 3. Layout Architecture: "The Dual-Island"
The UI avoids flush, edge-to-edge full-bleed panels. Instead, it relies on a "Dual-Island" floating architecture to create spatial tension and elegance.

### 3.1 Left Island (Global Navigation & Sessions)
- **Positioning:** Floating panel. Maintains a ~20px margin from the top, left, and bottom edges of the application window.
- **Dimensions:** Fixed width (~280px - 320px), taking up the full remaining height.
- **Structure:**
  - **Top Section:** Main navigation buttons (Chat, Automation, Capabilities, Knowledge Base). Designed as minimal icon + text with soft hover states.
  - **Divider:** 1px ultra-thin, low-opacity hairline.
  - **Middle Section (Sessions):** Card-in-Card design. The session list is not flat text. Each session history item is an independent "micro-card" with subtle drop shadows, appearing to nest and float atop the left island's glass base.
  - **Divider:** 1px hairline.
  - **Bottom Section:** Global settings.

### 3.2 Right Island (Main Stage / Chat Area)
- **Positioning:** Floating area for content. Maintains ~20px margins from the top, right, bottom, and left (distanced from the Left Island).
- **Structure:**
  - **Chat Bubbles:** AI and User messages are contained within rounded floating bubbles (border-radius 16px+). They feature minimal shadows and delicate inner highlights to lift them off the glass background.
  - **Spacing:** Extreme emphasis on negative space. Wide margins between bubbles and screen edges.
  - **Input Area ("The Pill"):** A pill-shaped (capsule) floating card positioned at the bottom center of the Right Island. It abandons the traditional full-width footer input. It expands smoothly vertically when typing multi-line messages, casting a refined shadow on the content underneath.

## 4. Interaction Details
- **Hover States:** Soft, pill-shaped background highlights for navigational elements.
- **Expansion:** Silky smooth height animations for the input pill.
- **Scroll:** Content scrolls seamlessly under the floating input pill.