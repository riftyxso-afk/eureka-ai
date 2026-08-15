---
version: alpha
name: Kreate Bold Play
description: A playful creator economy system with oversized type, bright violet accents, and bold outlined controls.
colors:
  primary: "#7B42F5"
  primary-strong: "#5E2BC7"
  secondary: "#13102B"
  neutral: "#FFFFFF"
  surface: "#FFFFFF"
  on-surface: "#13102B"
  border: "#E5E5E5"
  muted: "#B9B6C7"
  accent: "#7B42F5"
  error: "#D64545"
typography:
  headline-display:
    fontFamily: SN Pro
    fontSize: 104px
    fontWeight: 800
    lineHeight: 125px
    letterSpacing: -3.12px
  headline-lg:
    fontFamily: SN Pro
    fontSize: 69px
    fontWeight: 800
    lineHeight: 83px
    letterSpacing: -1.09px
  headline-md:
    fontFamily: SN Pro
    fontSize: 46px
    fontWeight: 800
    lineHeight: 55px
    letterSpacing: -0.71px
  headline-sm:
    fontFamily: SN Pro
    fontSize: 30px
    fontWeight: 600
    lineHeight: 36px
    letterSpacing: 0px
  body-lg:
    fontFamily: SN Pro
    fontSize: 20px
    fontWeight: 400
    lineHeight: 28px
    letterSpacing: 0px
  body-md:
    fontFamily: SN Pro
    fontSize: 16px
    fontWeight: 400
    lineHeight: 24px
    letterSpacing: 0px
  body-sm:
    fontFamily: SN Pro
    fontSize: 14px
    fontWeight: 400
    lineHeight: 20px
    letterSpacing: 0px
  label-lg:
    fontFamily: SN Pro
    fontSize: 16px
    fontWeight: 800
    lineHeight: 20px
    letterSpacing: 0.02em
  label-md:
    fontFamily: SN Pro
    fontSize: 14px
    fontWeight: 700
    lineHeight: 18px
    letterSpacing: 0.03em
  label-sm:
    fontFamily: SN Pro
    fontSize: 12px
    fontWeight: 800
    lineHeight: 16px
    letterSpacing: 0.08em
  nav:
    fontFamily: SN Pro
    fontSize: 15px
    fontWeight: 700
    lineHeight: 20px
    letterSpacing: 0px
  button:
    fontFamily: SN Pro
    fontSize: 16px
    fontWeight: 800
    lineHeight: 20px
    letterSpacing: 0.02em
rounded:
  none: 0px
  sm: 4px
  md: 8px
  lg: 16px
  xl: 24px
  full: 9999px
spacing:
  xs: 8px
  sm: 16px
  md: 28px
  lg: 56px
  xl: 80px
  gutter: 32px
  section: 80px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: 18px 28px
    height: 52px
  button-primary-hover:
    backgroundColor: "{colors.primary-strong}"
    textColor: "{colors.neutral}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: 18px 28px
    height: 52px
  button-secondary:
    backgroundColor: "{colors.neutral}"
    textColor: "{colors.primary}"
    typography: "{typography.button}"
    rounded: "{rounded.full}"
    padding: 18px 28px
    height: 52px
  button-link:
    backgroundColor: "transparent"
    textColor: "{colors.primary}"
    typography: "{typography.label-md}"
    rounded: "{rounded.none}"
    padding: 0px
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    rounded: "{rounded.lg}"
    padding: 32px
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.on-surface}"
    typography: "{typography.body-md}"
    rounded: "{rounded.md}"
    padding: 14px 16px
    height: 52px
  chip:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.neutral}"
    typography: "{typography.label-sm}"
    rounded: "{rounded.full}"
    padding: 10px 16px
---

# Kreate Bold Play

## Overview
Kreate feels loud, confident, and creator-first: a landing page built to convert independent makers, performers, and digital sellers. The tone is upbeat and friendly rather than corporate, with oversized headlines and a playful violet brand color that gives the interface strong personality. The layout is airy and centered, using lots of white space to keep the page approachable despite the bold typography.

## Colors
- **Primary (#7B42F5):** The signature violet used for the logo, main CTA buttons, underlines, links, and the bottom category strip. It carries the brand’s energetic, modern, creator-focused identity.
- **Primary strong (#5E2BC7):** A deeper violet used as the pressed/edge tone for buttons and the heavier shadow accent, adding a tactile, outlined look.
- **Secondary / On-surface (#13102B):** A very dark navy ink used for body text, strong headlines, and structural emphasis. It creates high contrast without feeling harsh black.
- **Neutral / Surface (#FFFFFF):** The dominant background color that keeps the page bright, minimal, and spacious.
- **Border (#E5E5E5):** A soft neutral line color used for inputs, separators, and low-emphasis outlines.
- **Muted (#B9B6C7):** A subdued lavender-gray useful for placeholder text, secondary metadata, and low-priority affordances.
- **Error (#D64545):** A clear alert color for validation or destructive states, though the shown experience is mostly positive and conversion-oriented.

## Typography
Kreate uses SN Pro as the core voice across headings, labels, buttons, and body copy. The display scale is extremely bold, with heavyweight headlines and tight negative letter-spacing that make the hero message feel punchy and iconic. Body text stays readable and clean at 16–20px with comfortable line heights, while labels and navigation use uppercase or near-uppercase styling with increased letter-spacing for a crisp, promotional feel.

Headline levels should be used for a clear hierarchy: `headline-display` for the main hero, `headline-lg` and `headline-md` for section intros, and `headline-sm` for subheads. `body-lg` and `body-md` handle explanatory copy, while `label-sm`, `label-md`, and `label-lg` support navigation, buttons, and small UI text. The interface often relies on bold weight rather than color alone to establish emphasis.

## Layout
The layout is centered and highly symmetrical, with a narrow hero content column set within a wide, open canvas. Horizontal sections use generous whitespace and a loose vertical rhythm, with the provided spacing scale stepping through 8px, 16px, 28px, 56px, and 80px to create clear separation between navigation, hero content, and supporting calls to action. Section padding should remain large and breathing, while component internals stay compact and efficient.

The structure reads like a fixed-max-width marketing landing page rather than a dense app shell. Cards, forms, and buttons should align to a consistent center column and maintain substantial side padding, with `gutter` and `section` tokens used to keep spacing predictable across breakpoints.

## Elevation & Depth
Depth is achieved through outline, contrast, and shadow rather than soft blur-heavy elevation. Buttons use a strong 2px border and a sharp violet shadow offset downward, producing a playful “sticker” or “popped” effect. Cards, when used, should feel similarly crisp with solid borders and clear edges instead of translucent surfaces.

The overall system is mostly flat and bright, so hierarchy depends on typography scale, color contrast, and that hard-edged shadow language. Use shadows sparingly and keep them directional, not ambient.

## Shapes
The shape language is rounded and friendly, but not pillowy. The most important interactive controls use `rounded.full`, giving buttons a soft capsule feel that matches the energetic brand. Inputs and cards use more restrained radii such as `rounded.md` and `rounded.lg`, balancing approachability with structure.

Overall, the geometry feels smooth and approachable, with rounded corners applied consistently to soften the otherwise bold, high-contrast composition.

## Components
Buttons are the most distinctive component. `button-primary` should be the main conversion CTA: violet fill, white text, bold SN Pro, capsule radius, generous horizontal padding, and a tactile bottom shadow or stronger border edge. `button-primary-hover` should deepen the violet to signal interactivity. `button-secondary` should invert to a white surface with violet text and a neutral outline, preserving the same rounded, substantial shape. `button-link` is reserved for inline actions like “Masuk,” with no container styling and minimal padding.

Cards should use `card` with a white background, dark border, rounded corners, and clear spacing inside. They should feel sturdy and editorial rather than soft or floating.

Inputs should follow `input`: white fill, subtle gray border, medium radius, and comfortable height. Placeholder text should remain muted so the field does not compete with the primary CTA. Focus states should emphasize the border in violet rather than adding heavy chrome.

Chips and category tags should use `chip` styling with violet fill and white text for high-visibility labels. The bottom scrolling category strip suggests an uppercase, compact chip/list style that works best with tight tracking and strong weight.

Navigation items should stay lightweight and text-only, with bold labels and no heavy pill treatments. Use spacing to separate links cleanly rather than relying on separators or complex menus.

## Do's and Don'ts
- Do keep the page spacious and centered, with a single dominant conversion path.
- Do use SN Pro consistently for all text to preserve the brand’s playful but polished voice.
- Do reserve the brightest violet for primary actions, links, and brand highlights.
- Do emphasize hierarchy through size and weight first, then color.
- Do use rounded full buttons and crisp outlines to maintain the “bold sticker” feel.
- Don't introduce soft gradients, glassmorphism, or heavy blurred shadows.
- Don't use dark backgrounds as the default; this system is built around white space and contrast.
- Don't make buttons thin or rectangular; the capsule shape is part of the identity.