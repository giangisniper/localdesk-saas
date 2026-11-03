import { z } from "zod";
import { DATE_RE } from "./time";

export const timeStr = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
export const dateStr = z.string().regex(DATE_RE, "Invalid date");
const uuid = z.string().uuid();
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid color");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email").max(160),
  password: z
    .string()
    .min(10, "Use at least 10 characters")
    .max(72, "Use at most 72 characters")
    .refine((p) => /[a-z]/i.test(p) && /\d/.test(p), "Include letters and numbers"),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  password: z.string().min(1, "Enter your password").max(128),
});

export const openingHoursSchema = z.record(
  z.string().regex(/^[0-6]$/),
  z.array(z.object({ open: timeStr, close: timeStr })).max(3),
).superRefine((v, ctx) => {
  for (const [day, ws] of Object.entries(v))
    for (const w of ws) if (w.open >= w.close) ctx.addIssue({ code: "custom", message: "Closing time must be after opening", path: [day] });
});

export const onboardingSchema = z.object({
  name: z.string().trim().min(2, "Enter your business name").max(80),
  category: z.string().trim().min(2).max(40),
  timezone: z.string().refine((tz) => {
    try { new Intl.DateTimeFormat("en", { timeZone: tz }); return true; } catch { return false; }
  }, "Unknown timezone"),
  currency: z.enum(["EUR", "USD", "GBP", "CHF", "CAD", "AUD"]),
  openingHours: openingHoursSchema,
  firstService: z.object({
    name: z.string().trim().min(2, "Name your first service").max(80),
    durationMin: z.coerce.number().int().min(5).max(480),
    price: z.string().trim().min(1, "Enter a price"),
  }),
  staffName: z.string().trim().min(2, "Enter a name").max(80),
});

export const businessSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Lowercase letters, numbers and dashes").min(3).max(48),
  category: z.string().trim().min(2).max(40),
  description: z.string().trim().max(500),
  email: z.union([z.literal(""), z.string().trim().email()]),
  phone: z.string().trim().max(40),
  address: z.string().trim().max(200),
  timezone: z.string().min(1),
  currency: z.enum(["EUR", "USD", "GBP", "CHF", "CAD", "AUD"]),
});

export const bookingRulesSchema = z.object({
  slotIntervalMin: z.coerce.number().int().refine((n) => [5, 10, 15, 20, 30, 60].includes(n), "Invalid interval"),
  minNoticeHours: z.coerce.number().int().min(0).max(168),
  maxAdvanceDays: z.coerce.number().int().min(1).max(365),
  cancellationHours: z.coerce.number().int().min(0).max(168),
  bufferMin: z.coerce.number().int().min(0).max(120),
  onlineBookingEnabled: z.boolean(),
  autoConfirm: z.boolean(),
});

export const notificationsSchema = z.object({
  newBooking: z.boolean(), cancellation: z.boolean(), dailyDigest: z.boolean(), customerReminders: z.boolean(),
});

export const accountSchema = z.object({
  name: z.string().trim().min(2).max(80),
});
export const passwordChangeSchema = z.object({
  current: z.string().min(1, "Enter your current password"),
  next: registerSchema.shape.password,
});

export const serviceSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Enter a name").max(80),
  description: z.string().trim().max(400).default(""),
  category: z.string().trim().max(40).default(""),
  durationMin: z.coerce.number().int().min(5, "At least 5 minutes").max(480),
  price: z.string().trim().min(1, "Enter a price"),
  color,
  active: z.boolean(),
  bookableOnline: z.boolean(),
  staffIds: z.array(uuid).default([]),
});

export const staffSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Enter a name").max(80),
  email: z.union([z.literal(""), z.string().trim().email("Invalid email")]),
  phone: z.string().trim().max(40).default(""),
  title: z.string().trim().max(60).default(""),
  color,
  active: z.boolean(),
  serviceIds: z.array(uuid).default([]),
  hours: z.array(z.object({ weekday: z.number().int().min(0).max(6), startTime: timeStr, endTime: timeStr }))
    .refine((hs) => hs.every((h) => h.startTime < h.endTime), "Shift end must be after start"),
});

export const timeOffSchema = z.object({
  staffId: uuid,
  startDate: dateStr,
  endDate: dateStr,
  reason: z.string().trim().max(120).default(""),
}).refine((v) => v.endDate >= v.startDate, { message: "End must be on or after start", path: ["endDate"] });

export const customerSchema = z.object({
  id: uuid.optional(),
  name: z.string().trim().min(2, "Enter a name").max(100),
  email: z.union([z.literal(""), z.string().trim().toLowerCase().email("Invalid email")]),
  phone: z.string().trim().max(40).default(""),
  tags: z.array(z.string().trim().min(1).max(24)).max(8).default([]),
  marketingOptIn: z.boolean().default(false),
});

export const appointmentSchema = z.object({
  id: uuid.optional(),
  customerId: uuid,
  serviceId: uuid,
  staffId: uuid,
  date: dateStr,
  time: timeStr,
  status: z.enum(["scheduled", "confirmed", "completed", "cancelled", "no_show"]).default("scheduled"),
  notes: z.string().trim().max(1000).default(""),
  price: z.string().trim().optional(),
});

export const publicBookingSchema = z.object({
  slug: z.string().min(1),
  serviceId: uuid,
  staffId: uuid.or(z.literal("any")),
  date: dateStr,
  time: timeStr,
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email"),
  phone: z.string().trim().max(40).default(""),
  notes: z.string().trim().max(500).default(""),
});
