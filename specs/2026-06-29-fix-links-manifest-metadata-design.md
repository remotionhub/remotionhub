# Design Doc: Fix Public Links and Manifest Metadata

This document outlines the design and proposed changes for correcting broken public GitHub links in the Header/Footer and updating the `manifest.json` metadata from the TanStack starter placeholders to RemotionHub branding.

## Goal
- Update outdated/broken GitHub repository links pointing to `https://github.com/tangwz/remotionhub` to the official repository: `https://github.com/remotionhub/remotionhub`.
- Replace the TanStack starter app metadata in `public/manifest.json` with RemotionHub branding, including matching theme colors and SEO-consistent description.

## Proposed Changes

### Header & Footer Links
- **[Header.tsx](file:///Users/tangwz/.gemini/antigravity/worktrees/remotionhub/fix-links-manifest-metadata/src/components/Header.tsx)**
  - Modify the GitHub anchor tag `href` attribute (line 53) to `https://github.com/remotionhub/remotionhub`.
- **[Footer.tsx](file:///Users/tangwz/.gemini/antigravity/worktrees/remotionhub/fix-links-manifest-metadata/src/components/Footer.tsx)**
  - Modify the GitHub anchor tag `href` attribute (line 20) to `https://github.com/remotionhub/remotionhub`.

### Web App Manifest
- **[manifest.json](file:///Users/tangwz/.gemini/antigravity/worktrees/remotionhub/fix-links-manifest-metadata/public/manifest.json)**
  - Update `short_name` to `"RemotionHub"`.
  - Update `name` to `"RemotionHub"`.
  - Add `description` with value `"Browse Remotion and HyperFrames components with versioned source artifacts."` (matching the meta description in `__root.tsx`).
  - Set `theme_color` to `"#0f172a"` to match the dark mode background color of the application.
  - Set `background_color` to `"#0f172a"` to ensure a smooth loading transition without bright flashes in dark mode.

## Verification Plan

### Manual Verification
1. Run the local development server: `npm run dev`.
2. Inspect the Header and Footer in the browser to ensure the GitHub icon and footer link point to `https://github.com/remotionhub/remotionhub`.
3. Open DevTools, navigate to the **Application** tab, select **Manifest**, and verify:
   - App Name: `RemotionHub`
   - Short Name: `RemotionHub`
   - Description: `Browse Remotion and HyperFrames components with versioned source artifacts.`
   - Theme Color: `#0f172a`
   - Background Color: `#0f172a`
4. Run the static CI checks if applicable to ensure no formatting/linting issues are introduced:
   - `npm run build` or relevant lint commands.
