# Claude SSH Web Interface - Design System

## Overview

Two design directions have been explored for the Claude SSH web interface:

1. **Full-Featured Dark Theme** - Comprehensive dashboard with sidebar panels
2. **Minimalist Light Theme** - Clean, focused chat experience with floating panels

Both designs avoid common "AI slop" patterns (purple gradients, emoji icons, generic card styles) and prioritize:
- **Professional aesthetics** suitable for developer tools
- **High information density** without visual clutter
- **Clear visual hierarchy** with purposeful use of color
- **Modern typography** with excellent readability

---

## Design Direction 1: Full-Featured Dark Theme

### Philosophy
Developer-centric dashboard that maximizes visibility of concurrent information (sessions, processes, files) while maintaining a clean, modern aesthetic.

### Color Palette

**Backgrounds:**
```
--bg-primary: #0a0a0b     // Deepest background (chat area)
--bg-secondary: #141415   // Secondary backgrounds (sidebar, header)
--bg-tertiary: #1c1c1e    // Tertiary backgrounds (panels, inputs)
--bg-hover: #252528       // Hover states
```

**Borders:**
```
--border-color: #2a2a2d   // Default borders
--border-light: #3a3a3d   // Lighter borders (hover, focus)
```

**Text:**
```
--text-primary: #f5f5f5   // Main content
--text-secondary: #a1a1aa // Secondary text, timestamps
--text-tertiary: #71717a  // Tertiary text, placeholders
```

**Accents:**
```
--accent-blue: #3b82f6    // Primary actions, links
--accent-green: #22c55e   // Success, running processes
--accent-orange: #f97316  // Warnings
--accent-red: #ef4444     // Errors, stopped processes
```

**Rationale:**
- Near-black backgrounds reduce eye strain during long sessions
- High contrast text ensures readability
- Accent colors are semantic (green for running, red for stopped)
- No purple gradients - uses blue as primary accent (professional, trustworthy)

### Typography

**Font Stack:**
```
-system-ui, -apple-system, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu'
```

**Sizes:**
```
Header: 18px (logo), 14px (buttons)
Body: 15px (messages), 14px (UI text)
Small: 13px (metadata), 12px (labels), 11px (code)
```

**Line Heights:**
```
Messages: 1.6 (optimal readability)
UI Text: 1.5 (standard interface)
Code: 1.4 (dense but readable)
```

**Mono Font (Code):**
```
'SF Mono', 'Monaco', 'Inconsolata', 'Fira Sans', monospace
```

### Component Specifications

**Message Bubble:**
- No background/border (direct text rendering)
- Avatar: 36px rounded square with gradient (assistant) or border (user)
- Spacing: 24px vertical gap between messages
- Max width: 900px (prevents overly wide text on large screens)

**Input Area:**
- Background: `--bg-tertiary` with `--border-color` border
- Focus state: Blue ring (3px, 10% opacity) + border brightens
- Textarea: Auto-resize up to 200px max height
- Actions: Attach, Voice, Send buttons (Send is primary accent)

**Sidebar:**
- Width: 280px (compact but functional)
- Sections: Sessions, Processes, Files
- Session items: 10px padding, 8px border radius
- Active state: `--bg-hover` background

**Process Cards:**
- Background: `--bg-tertiary` with border
- Output: Monospace, 11px, max 80px height with scroll
- Status badges: Pill-shaped with semantic colors

**File Browser:**
- Tree structure with folder/file icons
- File size shown in tertiary text
- Hover: `--bg-tertiary` highlight

### Layout

**Header:**
- Height: 60px
- Left: Logo, status indicator, MCP status
- Right: Settings, Monitor buttons

**Main Content:**
- Flex container with sidebar (280px) + chat area (flex: 1)
- Chat area max-width: 900px centered

**Responsiveness:**
- Desktop: Full sidebar visible
- Tablet: Sidebar collapses to icons
- Mobile: Sidebar hidden behind hamburger menu

---

## Design Direction 2: Minimalist Light Theme

### Philosophy
Reductionist approach that focuses purely on the conversation, with supplementary information (sessions, processes) available in floating panels when needed.

### Color Palette

**Backgrounds:**
```
--bg-primary: #ffffff   // Main background
--bg-secondary: #f9fafb // Light gray (hover states)
--bg-tertiary: #f3f4f6  // Panel backgrounds
```

**Borders:**
```
--border-color: #e5e7eb  // Default borders
--border-light: #d1d5db  // Focus/active borders
```

**Text:**
```
--text-primary: #111827  // Near-black (better than pure #000)
--text-secondary: #6b7280 // Gray text
--text-tertiary: #9ca3af  // Placeholder text
```

**Accents:**
```
--accent-blue: #2563eb   // Primary actions
--accent-blue-hover: #1d4ed8 // Hover state
```

**Rationale:**
- White background is familiar and non-fatiguing
- High contrast text (#111827) ensures accessibility (WCAG AAA)
- Minimal use of color - blue only for primary actions
- Gray scale for everything else creates visual calm

### Typography

**Font:**
```
'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif
```

**Characteristics:**
- Slightly tighter letter-spacing (-0.02em on headers)
- Optimized for screen readability
- Excellent numeral rendering (important for code/terminal output)

**Sizes:**
```
Header: 16px
Messages: 15px
UI Elements: 13px (buttons), 12px (labels)
```

### Component Specifications

**Message Layout:**
- Avatar: 32px circular (smaller than dark theme)
- Assistant: Light gray background
- User: Blue accent background
- Spacing: 32px between messages (more breathing room)

**Input Area:**
- Shadow: `box-shadow: 0 1px 2px rgb(0 0 0 / 0.05)`
- Focus: Shadow increases + blue ring (3px, 10% opacity)
- Minimal buttons: Icon-only (32px circular)

**Floating Panels:**
- Position: Fixed (top-right: 80px, right: 32px)
- Background: White with border and shadow
- Min-width: 280px
- Rounded corners: 12px
- Can be dismissed or toggled

**Header:**
- Minimal: Logo left, navigation right
- No status indicators (move to floating panel)
- Height: 56px (shorter than dark theme)

### Layout

**Single Column:**
- Chat area centered, max-width: 800px
- No permanent sidebar
- Floating panels for supplementary info

**Focus Mode:**
- When actively typing, panels can auto-hide
- User controls panel visibility via header buttons

---

## Shared Design Principles (Both Directions)

### 1. Anti-AI-Slop Guidelines

**What We Avoid:**
- ❌ Purple/violet gradients (overused in AI products)
- ❌ Emoji as icons (unprofessional in dev tools)
- ❌ Rounded cards with colored left borders (generic SaaS look)
- ❌ Excessive shadows and glows
- ❌ Generic "tech" background patterns

**What We Do Instead:**
- ✅ Semantic color usage (green for running, red for stopped)
- ✅ High contrast for readability
- ✅ Purposeful visual hierarchy
- ✅ Professional aesthetics suitable for developer tools
- ✅ Clean borders with subtle hover states

### 2. Typography Excellence

**text-wrap: pretty**
- Applied to all message content
- Prevents orphans and widows
- Better hyphenation and word breaks

**Line Length:**
- Max width: 800-900px for messages
- Optimal reading: 60-75 characters per line
- Prevents eye fatigue on wide screens

**Font Rendering:**
- `-webkit-font-smoothing: antialiased`
- `-moz-osx-font-smoothing: grayscale`
- Crisp text at all sizes

### 3. Animation & Transitions

**Fade In Messages:**
```css
@keyframes fadeIn {
    from { opacity: 0; transform: translateY(8px); }
    to { opacity: 1; transform: translateY(0); }
}
```
- Duration: 300ms
- Easing: ease-out
- Applied to new messages only

**Hover States:**
- Duration: 150-200ms
- Subtle background color changes
- No scale or position transforms (feels "jumpy")

**Focus Rings:**
- 3px offset, 10% opacity of accent color
- Appears on keyboard navigation and mouse focus
- Critical for accessibility

### 4. Accessibility

**Color Contrast:**
- All text meets WCAG AAA (7:1+ contrast ratio)
- Focus indicators visible on all interactive elements
- Status indicators use both color + icon/text

**Keyboard Navigation:**
- Tab order: Header → Sidebar → Messages → Input
- Enter to send, Shift+Enter for new line
- Escape closes floating panels (minimal theme)

**Screen Reader Support:**
- Semantic HTML (button, nav, main)
- ARIA labels where needed (status indicators)
- Message roles announced correctly

### 5. Responsive Design

**Breakpoints:**
- Desktop: 1280px+ (full layout)
- Tablet: 768px-1279px (sidebar collapses)
- Mobile: <768px (single column, panels hidden)

**Touch Targets:**
- Minimum: 44×44px (iOS guideline)
- Buttons: 32-44px height
- Spacing: 8-12px gaps

---

## Implementation Recommendations

### For Phase 1 (MVP)

**Start with Dark Theme:**
- Better for developer tools (most devs prefer dark mode)
- Higher perceived complexity/polish
- Easier to make colors pop

**Key Components:**
1. Chat interface (messages + input)
2. Basic session management (new session, list sessions)
3. Process monitoring (list, status, output)

**Optional for MVP:**
- File browser (can add in Phase 2)
- Voice input/output (Phase 5)
- Advanced MCP UI (Phase 3)

### Technology Choices

**CSS Approach:**
- CSS Custom Properties (variables) for theming
- Flexbox for layout (Grid not needed for this layout)
- Container queries (if browser support allows)

**Component Library:**
- shadcn/ui (recommended)
- Why: Not a dependency (copied source), highly customizable, modern defaults

**Icons:**
- Phosphor Icons or Heroicons (SVG)
- Avoid emoji as icons (unprofessional)
- Use semantic icons (folder for files, terminal for processes)

---

## Design Tokens Reference

### Spacing Scale
```
4px   - xs (tight gaps)
8px   - sm (component gaps)
12px  - md (padding, margins)
16px  - lg (section spacing)
24px  - xl (message gaps, section padding)
32px  - 2xl (large spacing)
48px  - 3xl (page margins)
```

### Border Radius
```
4px   - sm (tags, badges)
6px   - md (buttons, small inputs)
8px   - lg (cards, large inputs)
12px  - xl (panels, modals)
```

### Shadows
```
sm: 0 1px 2px rgb(0 0 0 / 0.05)
md: 0 4px 6px -1px rgb(0 0 0 / 0.1)
lg: 0 10px 15px -3px rgb(0 0 0 / 0.1)
```

### Z-Index Scale
```
1: Header
10: Sidebar
50: Dropdowns
100: Modals, floating panels
```

---

## Next Steps

1. **Choose direction:** Dark theme (recommended) or Light theme
2. **Create component library:** Extract reusable React components
3. **Set up Tailwind:** Convert design tokens to Tailwind config
4. **Build MVP:** Chat + Session management first
5. **Iterate:** Add processes, files, MCP support based on feedback

The mockups can be opened directly in a browser to see the interactive prototypes.
