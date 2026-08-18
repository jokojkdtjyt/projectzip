import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";

export const disputesTable = pgTable("disputes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull(),
  moduleId: text("module_id").notNull(),
  message: text("message").notNull(),
  /** Telegram file_id — null when no image was attached */
  imageUrl: text("image_url"),
  /** 'pending' | 'approved' | 'rejected' */
  status: text("status").notNull().default("pending"),
  /** Message ID of the Telegram dispute notification (for editing buttons later) */
  telegramMessageId: integer("telegram_message_id"),
  /** When the user last sent a reminder */
  lastRemindedAt: timestamp("last_reminded_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});
