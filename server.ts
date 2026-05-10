import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";
import archiver from "archiver";
import fs from "fs";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/admin/export", async (req, res) => {
    // In a real app, you'd verify admin status here via JWT/Supabase
    // For now, we'll allow it but you should protect this route with a secret or token in production
    
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', 'attachment; filename=pustak-source.zip');

    const archive = archiver('zip', {
      zlib: { level: 9 }
    });

    archive.on('error', (err) => {
      res.status(500).send({ error: err.message });
    });

    archive.pipe(res);

    // Add all files except excluded ones
    archive.glob('**/*', {
      cwd: process.cwd(),
      ignore: [
        'node_modules/**',
        'dist/**',
        '.git/**',
        '.env',
        '*.zip',
        '.cache/**',
        '.next/**',
        'package-lock.json'
      ]
    });

    await archive.finalize();
  });

  // Default to production if NODE_ENV is set or if dist exists
  const isProduction = process.env.NODE_ENV === "production" || process.env.RENDER === "true";
  
  if (!isProduction) {
    console.log("Running in DEVELOPMENT mode");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Running in PRODUCTION mode");
    const distPath = path.join(process.cwd(), "dist");
    
    // Serve static files
    app.use(express.static(distPath));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
