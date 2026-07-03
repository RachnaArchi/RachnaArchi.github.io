import { defineConfig } from "vite";

// User site (rachnaarchi.github.io): base "/"
// Project site (rachnaarchi.github.io/R-Portfolio/): base "/R-Portfolio/"
export default defineConfig({
    base: "/",
    build: {
        // Avoid collision with public/Assets on case-insensitive filesystems (Windows)
        assetsDir: "bundled",
    },
});
