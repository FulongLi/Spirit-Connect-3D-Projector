# Spirit Connect

Spirit Connect is a WebGPU holographic particle interface for visualizing digitized consciousness in immersive 3D environments.

The current experience includes:

- A breathing volumetric particle sphere as the default initial form
- Morph transitions between the sphere, BD-1, and BB-8 particle models
- A full-screen hologram stage with rings, scan-grid ambience, bloom, and mouse-reactive particle motion
- Spirit Connect / 灵接科技 branding
- Static export support for GitHub Pages

## Local Development

Install dependencies:

```bash
npm install
```

Run the local dev server:

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

If port 3000 is already in use, run another port:

```bash
npm run dev -- -p 3003
```

## Build

Create a production static export:

```bash
npm run build
```

The static site is generated in:

```text
out/
```

## GitHub Pages Deployment

This repository includes a GitHub Actions workflow at:

```text
.github/workflows/deploy-pages.yml
```

To publish the site:

1. Push the repository to GitHub.
2. Open the repository on GitHub.
3. Go to `Settings -> Pages`.
4. Set `Source` to `GitHub Actions`.
5. Push to `main` or run the workflow manually.

Public site:

[https://fulongli.github.io/Spirit-Connect-3D-Projector/](https://fulongli.github.io/Spirit-Connect-3D-Projector/)

If the public link opens this README instead of the 3D interface, GitHub Pages is
still serving the repository branch directly. In `Settings -> Pages`, set
`Source` to `GitHub Actions`, then rerun the deploy workflow.

## Project Structure

```text
src/app/                         Next.js app entry
src/components/hologramParticles/ WebGPU particle renderer and model switching
src/components/overlay/           Header, footer, controls, and model selector
src/components/shared/            Fonts, theme, and asset path helpers
public/glb/                       Local GLB model assets
public/assets/                    Local visual textures
```

## Notes

The deployment config automatically applies the GitHub Pages base path during GitHub Actions builds, so model and texture assets load correctly from the project URL.
