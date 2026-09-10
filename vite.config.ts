// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Mounts the Express UPI gateway (server.js) onto the dev server so the
// vanilla pages in /public can call /api/* while previewing.
const upiGatewayApi = {
  name: "upi-gateway-api",
  apply: "serve" as const,
  async configureServer(server: { middlewares: { use: (fn: unknown) => void } }) {
    process.env["UPI_GATEWAY_EMBEDDED"] = "1";
    const mod: any = await import(/* @vite-ignore */ "./server.js");
    const app = mod.default;
    server.middlewares.use((req: any, res: any, next: any) => {
      if (req.url && req.url.startsWith("/api/")) return app(req, res, next);
      next();
    });
  },
};

export default defineConfig({
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
  vite: {
    plugins: [upiGatewayApi],
  },
});
