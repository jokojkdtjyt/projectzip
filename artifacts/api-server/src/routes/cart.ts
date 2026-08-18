import { Router, type IRouter, type Request, type Response } from "express";
import { and, eq } from "drizzle-orm";
import { db, cartTable, purchasedTable, modulesTable } from "@workspace/db";
import { AddToCartParams, RemoveFromCartParams } from "@workspace/api-zod";
import { requireAuth, AuthedRequest } from "../middlewares/requireAuth";

const router: IRouter = Router();

async function buildCartResponse(userId: string) {
  const cartRows = await db
    .select()
    .from(cartTable)
    .where(eq(cartTable.userId, userId));

  if (cartRows.length === 0) return { items: [], total: 0 };

  const moduleIds = cartRows.map((r) => r.moduleId);
  const allModules = await db.select().from(modulesTable);
  const moduleMap = new Map(allModules.map((m) => [m.id, m]));

  const items = moduleIds
    .map((id) => {
      const mod = moduleMap.get(id);
      if (!mod) return null;
      return {
        moduleId: mod.id,
        title: mod.title,
        price: mod.price,
        price3Month: mod.price3Month ?? null,
        price1Year: mod.price1Year ?? null,
        priceLifetime: mod.priceLifetime ?? null,
        category: mod.category,
        duration: mod.duration,
      };
    })
    .filter(Boolean);

  // Total is 0 here — actual total is computed client-side after tier selection
  return { items, total: 0 };
}

router.get("/cart", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  res.json(await buildCartResponse(userId));
});

router.post("/cart/:moduleId", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const params = AddToCartParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  await db
    .insert(cartTable)
    .values({ userId, moduleId: params.data.moduleId })
    .onConflictDoNothing();

  res.json(await buildCartResponse(userId));
});

router.delete(
  "/cart/:moduleId",
  requireAuth,
  async (req: Request, res: Response): Promise<void> => {
    const userId = (req as AuthedRequest).userId;
    const params = RemoveFromCartParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    await db
      .delete(cartTable)
      .where(
        and(
          eq(cartTable.userId, userId),
          eq(cartTable.moduleId, params.data.moduleId),
        ),
      );

    res.json(await buildCartResponse(userId));
  },
);

router.post("/checkout", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const cartRows = await db
    .select()
    .from(cartTable)
    .where(eq(cartTable.userId, userId));

  const moduleIds = cartRows.map((r) => r.moduleId);
  if (moduleIds.length === 0) {
    res.json({ purchased: [] });
    return;
  }

  await db
    .insert(purchasedTable)
    .values(moduleIds.map((id) => ({ userId, moduleId: id, tier: "lifetime" })))
    .onConflictDoNothing();

  await db.delete(cartTable).where(eq(cartTable.userId, userId));

  res.json({ purchased: moduleIds });
});

// ── GET /purchased ─────────────────────────────────────────────────────────────
// Returns non-expired module IDs for the current user.
router.get("/purchased", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const now = new Date();
  const rows = await db
    .select()
    .from(purchasedTable)
    .where(eq(purchasedTable.userId, userId));

  // Filter out expired timed purchases
  const active = rows.filter(
    (r) => r.expiresAt === null || r.expiresAt === undefined || r.expiresAt > now,
  );
  res.json(active.map((r) => r.moduleId));
});

// ── GET /purchased/details ─────────────────────────────────────────────────────
// Returns all purchased rows (including expired) with tier and expiry info.
router.get("/purchased/details", requireAuth, async (req: Request, res: Response): Promise<void> => {
  const userId = (req as AuthedRequest).userId;
  const now = new Date();
  const rows = await db
    .select()
    .from(purchasedTable)
    .where(eq(purchasedTable.userId, userId));

  res.json(
    rows.map((r) => ({
      moduleId: r.moduleId,
      tier: r.tier,
      expiresAt: r.expiresAt?.toISOString() ?? null,
      isExpired: r.expiresAt !== null && r.expiresAt !== undefined && r.expiresAt <= now,
    })),
  );
});

export default router;
