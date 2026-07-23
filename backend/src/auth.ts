import type { Request, Response, NextFunction } from "express";
import { config } from "./config.js";

export function requirePassphrase(req: Request, res: Response, next: NextFunction) {
  if (req.header("x-passphrase") !== config.webPassphrase) {
    res.status(401).json({ error: "Invalid passphrase" });
    return;
  }
  next();
}
