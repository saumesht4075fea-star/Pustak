import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import crypto from "crypto";

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

  app.post("/api/ai", async (req, res) => {
    try {
      const { userMessage } = req.body;
      const msg = userMessage.toLowerCase();

      let responseText = "I'm the PUSTAK Assistant. I'm here to help you dominate the intellect! Ask me about buying books, selling, or verification processes.";

      if (msg.includes("hello") || msg.includes("hi") || msg.includes("namaste")) {
        responseText = "Namaste! Welcome to PUSTAK. How can I help you dominate the market today?";
      } else if (msg.includes("where") && msg.includes("book")) {
        responseText = "Your books are in the 'My Orders' section. Once our admin verifies your UPI UTR (usually 5-30 mins), the download link will unlock instantly!";
      } else if (msg.includes("sell") || msg.includes("seller")) {
        responseText = "To sell on PUSTAK, go to your Dashboard and register as a seller. You can upload ebooks, set prices, and even offer affiliate commissions to others!";
      } else if (msg.includes("verify") || msg.includes("utr") || msg.includes("payment")) {
        responseText = "Payment verification is manual. Please ensure you've submitted the correct UTR/Transaction ID. Admin checks these every 15 minutes. If it's been more than an hour, click 'Support' to email us.";
      } else if (msg.includes("affiliate") || msg.includes("earn") || msg.includes("refer")) {
        responseText = "Every seller can enable an affiliate commission. Just copy the referral link from the product page and share it. When someone buys using your link, you get paid instantly to your wallet!";
      } else if (msg.includes("withdraw") || msg.includes("money")) {
        responseText = "Minimum withdrawal is ₹500. Go to your Seller Dashboard to request a payout. We process all payments via UPI within 24 hours.";
      } else if (msg.includes("bug") || msg.includes("error") || msg.includes("broken")) {
        responseText = "Don't worry! Our 'Bug Hunter' system is active 24/7. Any technical issues are automatically reported to our command center.";
      } else if (msg.includes("who") && msg.includes("you")) {
        responseText = "I am the PUSTAK AI, your guide to premium digital assets. My mission is to ensure your intellectual dominance.";
      }

      res.json({ text: responseText });
    } catch (error: any) {
      res.status(500).json({ text: "I'm having a bit of trouble reflecting. Try asking about orders or selling!" });
    }
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
    app.use(express.static(distPath, {
      index: false // Don't serve index.html via static middleware, let the wildcard handle it
    }));
    
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
