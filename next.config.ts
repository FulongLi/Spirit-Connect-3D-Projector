import type { NextConfig } from "next";

const repoName =
  process.env.GITHUB_REPOSITORY?.split("/")[1] || "Spirit-Connect-3D-Projector";
const basePath = process.env.GITHUB_ACTIONS === "true" ? `/${repoName}` : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: basePath,
  images: {
    unoptimized: true,
  },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
