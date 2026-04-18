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
  const PORT = 3000;

  console.log(`Starting server in ${process.env.NODE_ENV || 'development'} mode`);

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // PayU Hash Generation
  app.post("/api/payu/hash", (req, res) => {
    const { txnid, amount, productinfo, firstname, email } = req.body;
    const key = process.env.PAYU_MERCHANT_KEY || "placeholder_key";
    const salt = process.env.PAYU_MERCHANT_SALT || "placeholder_salt";

    // Hash Formula: sha512(key|txnid|amount|productinfo|firstname|email|udf1|udf2|udf3|udf4|udf5||||||salt)
    const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
    const hash = crypto.createHash("sha512").update(hashString).digest("hex");

    res.json({ hash });
  });

  // PayU Success/Failure Webhooks
  app.post("/api/payu/response", (req, res) => {
    const { status, txnid, amount, productinfo, firstname, email, hash } = req.body;
    const key = process.env.PAYU_MERCHANT_KEY || "placeholder_key";
    const salt = process.env.PAYU_MERCHANT_SALT || "placeholder_salt";

    // Reverse Hash Formula: sha512(salt|status||||||udf5|udf4|udf3|udf2|udf1|email|firstname|productinfo|amount|txnid|key)
    const reverseHashString = `${salt}|${status}|||||||||||${email}|${firstname}|${productinfo}|${amount}|${txnid}|${key}`;
    const generatedHash = crypto.createHash("sha512").update(reverseHashString).digest("hex");

    if (generatedHash === hash) {
      // Payment is verified
      if (status === "success") {
        // Redirect to success page or handle order completion
        res.redirect(`/orders?status=success&txnid=${txnid}`);
      } else {
        res.redirect(`/orders?status=failed&txnid=${txnid}`);
      }
    } else {
      res.status(400).send("Hash Mismatch");
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    console.log(`Serving static files from: ${distPath}`);
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
