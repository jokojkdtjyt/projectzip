import { pgTable, text, timestamp, primaryKey, integer } from "drizzle-orm/pg-core";

export const cartTable = pgTable("cart", {
  userId: text("user_id").notNull(),
  moduleId: text("module_id").notNull(),
}, (t) => [primaryKey({ columns: [t.userId, t.moduleId] })]);

export const purchasedTable = pgTable("purchased", {
  userId: text("user_id").notNull(),
  moduleId: text("module_id").notNull(),
  purchasedAt: timestamp("purchased_at", { withTimezone: true }).notNull().defaultNow(),
  /** '3month' | '1year' | 'lifetime' */
  tier: text("tier").notNull().default("lifetime"),
  /** null = never expires (lifetime). Set to now+90d or now+365d for timed tiers. */
  expiresAt: timestamp("expires_at", { withTimezone: true }),
}, (t) => [primaryKey({ columns: [t.userId, t.moduleId] })]);

export const pendingPurchasesTable = pgTable("pending_purchases", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  moduleId: text("module_id").notNull(),
  imageUrl: text("image_url").notNull(),
  status: text("status").notNull().default("pending"),
  sessionId: text("session_id").notNull(),
  telegramMessageId: integer("telegram_message_id"),
  /** '3month' | '1year' | 'lifetime' — chosen by student at checkout */
  tier: text("tier").notNull().default("lifetime"),
  /** Price in DZD at time of purchase request */
  tierPrice: integer("tier_price"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  lastRemindedAt: timestamp("last_reminded_at", { withTimezone: true }),
});
