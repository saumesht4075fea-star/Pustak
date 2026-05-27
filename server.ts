import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";
import archiver from "archiver";
import fs from "fs";
import Mux from "@mux/mux-node";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Lazy init Mux
let muxClient: any = null;
function getMux() {
  if (!muxClient) {
    const tokenId = process.env.MUX_TOKEN_ID;
    const tokenSecret = process.env.MUX_TOKEN_SECRET;
    if (!tokenId || !tokenSecret) {
      throw new Error("MUX_TOKEN_ID and MUX_TOKEN_SECRET environment variables are required");
    }
    muxClient = new Mux({
      tokenId,
      tokenSecret,
    });
  }
  return muxClient;
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  app.use(express.json({ limit: "10mb" }));
  app.use(express.urlencoded({ limit: "10mb", extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Mux API Routes
  app.post("/api/mux/upload", async (req, res) => {
    try {
      const mux = getMux();
      const upload = await mux.video.uploads.create({
        new_asset_settings: {
          playback_policy: ["public"],
          encoding_tier: "baseline",
        },
        cors_origin: "*",
      });
      res.json(upload);
    } catch (error: any) {
      console.error("Mux Upload Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/mux/upload/:uploadId", async (req, res) => {
    try {
      const { uploadId } = req.params;
      const mux = getMux();
      const upload = await mux.video.uploads.retrieve(uploadId);
      res.json(upload);
    } catch (error: any) {
      console.error("Mux Upload Fetch Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/mux/asset/:assetId", async (req, res) => {
    try {
      const { assetId } = req.params;
      const mux = getMux();
      const asset = await mux.video.assets.retrieve(assetId);
      res.json(asset);
    } catch (error: any) {
      console.error("Mux Asset Fetch Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/mux/asset/:assetId", async (req, res) => {
    try {
      const { assetId } = req.params;
      const mux = getMux();
      await mux.video.assets.delete(assetId);
      res.json({ success: true });
    } catch (error: any) {
      console.error("Mux Asset Delete Error:", error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/admin/save-favicons", async (req, res) => {
    try {
      const { favicon16, favicon32, favicon180, favicon192, favicon512 } = req.body;
      const publicDir = path.join(process.cwd(), "public");

      const saveBase64 = (base64Str: string, fileName: string) => {
        if (!base64Str) return;
        const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
        if (!matches || matches.length !== 3) return;
        const buffer = Buffer.from(matches[2], 'base64');
        fs.writeFileSync(path.join(publicDir, fileName), buffer);
        console.log(`Saved favicon to ${fileName} successfully.`);
      };

      saveBase64(favicon32, "favicon.ico");
      saveBase64(favicon32, "favicon.png");
      saveBase64(favicon16, "favicon-16x16.png");
      saveBase64(favicon32, "favicon-32x32.png");
      saveBase64(favicon180, "apple-touch-icon.png");
      saveBase64(favicon180, "apple-touch-icon-precomposed.png");
      saveBase64(favicon192, "icon-192.png");
      saveBase64(favicon512, "icon-512.png");

      res.json({ success: true, message: "Favicons written successfully to public/ directory" });
    } catch (error: any) {
      console.error("Save Favicon Error:", error);
      res.status(500).json({ error: error.message });
    }
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
