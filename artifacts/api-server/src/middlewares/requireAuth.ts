import { getAuth } from "@clerk/express";
import { Request, Response, NextFunction } from "express";

export interface AuthedRequest extends Request {
  userId: string;
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const auth = getAuth(req);
  const userId = auth?.userId;
  if (!userId) {
    const authHeader = req.headers.authorization;
    console.log(
      `[requireAuth] 401 — method=${req.method} path=${req.path} | auth-header=${authHeader ? "present" : "MISSING"} | sessionId=${auth?.sessionId ?? "N/A"}`,
    );
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as AuthedRequest).userId = userId;
  next();
}
