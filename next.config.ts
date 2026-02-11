import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Comentar output standalone para Netlify
  // output: "standalone",
  
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  
  // Configuración para Netlify
  // Aumentar timeout para operaciones de IA
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  
  // Manejo de imágenes
  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
