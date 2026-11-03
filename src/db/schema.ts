import { relations, sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  time,
  timestamp,
  uniqueIndex,
  uuid,
  smallint,
} from "drizzle-orm/pg-core";

export const roleEnum = pgEnum("role", ["owner", "admin", "staff"]);
export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);
export const sourceEnum = pgEnum("appointment_source", ["dashboard", "online"]);

export type OpeningHours = Record<string, { open: string; close: string }[]>;
export type NotificationPrefs = {
  newBooking: boolean;
  cancellation: boolean;
  dailyDigest: boolean;
  customerReminders: boolean;
};

const id = () => uuid("id").primaryKey().defaultRandom();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").notNull(),
    /** null for accounts that only sign in with Google/Apple */
    passwordHash: text("password_hash"),
    sessionVersion: integer("session_version").notNull().default(0),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("users_email_idx").on(sql`lower(${t.email})`)],
);

export const oauthProviderEnum = pgEnum("oauth_provider", ["google", "apple"]);

/** Persistent link between a LocalDesk user and an identity at an external provider. */
export const oauthAccounts = pgTable(
  "oauth_accounts",
  {
    id: id(),
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    provider: oauthProviderEnum("provider").notNull(),
    /** the provider's stable subject identifier (`sub`) — never the email */
    providerAccountId: text("provider_account_id").notNull(),
    /** email reported by the provider at link time (informational; Apple may be a private relay) */
    email: text("email"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("oauth_accounts_identity_idx").on(t.provider, t.providerAccountId),
    uniqueIndex("oauth_accounts_user_provider_idx").on(t.userId, t.provider),
  ],
);

export const businesses = pgTable(
  "businesses",
  {
    id: id(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    category: text("category").notNull().default("Other"),
    description: text("description").notNull().default(""),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    address: text("address").notNull().default(""),
    timezone: text("timezone").notNull().default("UTC"),
    currency: text("currency").notNull().default("EUR"),
    slotIntervalMin: smallint("slot_interval_min").notNull().default(15),
    minNoticeHours: smallint("min_notice_hours").notNull().default(2),
    maxAdvanceDays: smallint("max_advance_days").notNull().default(60),
    cancellationHours: smallint("cancellation_hours").notNull().default(24),
    bufferMin: smallint("buffer_min").notNull().default(0),
    onlineBookingEnabled: boolean("online_booking_enabled").notNull().default(true),
    autoConfirm: boolean("auto_confirm").notNull().default(true),
    openingHours: jsonb("opening_hours").$type<OpeningHours>().notNull().default({}),
    notifications: jsonb("notifications")
      .$type<NotificationPrefs>()
      .notNull()
      .default({ newBooking: true, cancellation: true, dailyDigest: false, customerReminders: true }),
    onboardedAt: timestamp("onboarded_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("businesses_slug_idx").on(t.slug)],
);

export const memberships = pgTable(
  "memberships",
  {
    userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    role: roleEnum("role").notNull().default("staff"),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.businessId] })],
);

export const staff = pgTable(
  "staff",
  {
    id: id(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    userId: uuid("user_id").references(() => users.id, { onDelete: "set null" }),
    name: text("name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    title: text("title").notNull().default(""),
    color: text("color").notNull().default("#0d9488"),
    active: boolean("active").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("staff_business_idx").on(t.businessId)],
);

export const staffHours = pgTable(
  "staff_hours",
  {
    id: id(),
    staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
    weekday: smallint("weekday").notNull(), // 0 = Sunday .. 6 = Saturday
    startTime: time("start_time").notNull(),
    endTime: time("end_time").notNull(),
  },
  (t) => [index("staff_hours_staff_idx").on(t.staffId)],
);

export const timeOff = pgTable(
  "time_off",
  {
    id: id(),
    staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    reason: text("reason").notNull().default(""),
  },
  (t) => [index("time_off_staff_idx").on(t.staffId)],
);

export const services = pgTable(
  "services",
  {
    id: id(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    category: text("category").notNull().default(""),
    durationMin: integer("duration_min").notNull(),
    priceCents: integer("price_cents").notNull(),
    color: text("color").notNull().default("#0d9488"),
    active: boolean("active").notNull().default(true),
    bookableOnline: boolean("bookable_online").notNull().default(true),
    createdAt: createdAt(),
  },
  (t) => [index("services_business_idx").on(t.businessId)],
);

export const staffServices = pgTable(
  "staff_services",
  {
    staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "cascade" }),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "cascade" }),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.serviceId] })],
);

export const customers = pgTable(
  "customers",
  {
    id: id(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email").notNull().default(""),
    phone: text("phone").notNull().default(""),
    tags: text("tags").array().notNull().default(sql`'{}'::text[]`),
    marketingOptIn: boolean("marketing_opt_in").notNull().default(false),
    createdAt: createdAt(),
  },
  (t) => [index("customers_business_idx").on(t.businessId, t.name)],
);

export const customerNotes = pgTable(
  "customer_notes",
  {
    id: id(),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    authorId: uuid("author_id").references(() => users.id, { onDelete: "set null" }),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("customer_notes_customer_idx").on(t.customerId)],
);

export const appointments = pgTable(
  "appointments",
  {
    id: id(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
    staffId: uuid("staff_id").notNull().references(() => staff.id, { onDelete: "restrict" }),
    serviceId: uuid("service_id").notNull().references(() => services.id, { onDelete: "restrict" }),
    startsAt: timestamp("starts_at", { withTimezone: true }).notNull(),
    endsAt: timestamp("ends_at", { withTimezone: true }).notNull(),
    status: appointmentStatusEnum("status").notNull().default("scheduled"),
    priceCents: integer("price_cents").notNull(),
    notes: text("notes").notNull().default(""),
    source: sourceEnum("source").notNull().default("dashboard"),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index("appointments_business_start_idx").on(t.businessId, t.startsAt),
    index("appointments_staff_start_idx").on(t.staffId, t.startsAt),
    index("appointments_customer_idx").on(t.customerId),
  ],
);

export const activity = pgTable(
  "activity",
  {
    id: id(),
    businessId: uuid("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    message: text("message").notNull(),
    actor: text("actor").notNull().default("System"),
    createdAt: createdAt(),
  },
  (t) => [index("activity_business_idx").on(t.businessId, t.createdAt)],
);

export const businessesRelations = relations(businesses, ({ many }) => ({
  staff: many(staff),
  services: many(services),
  customers: many(customers),
}));
export const staffRelations = relations(staff, ({ many }) => ({
  hours: many(staffHours),
  services: many(staffServices),
}));
export const staffHoursRelations = relations(staffHours, ({ one }) => ({
  staff: one(staff, { fields: [staffHours.staffId], references: [staff.id] }),
}));
export const staffServicesRelations = relations(staffServices, ({ one }) => ({
  staff: one(staff, { fields: [staffServices.staffId], references: [staff.id] }),
  service: one(services, { fields: [staffServices.serviceId], references: [services.id] }),
}));

export type Role = (typeof roleEnum.enumValues)[number];
export type AppointmentStatus = (typeof appointmentStatusEnum.enumValues)[number];
