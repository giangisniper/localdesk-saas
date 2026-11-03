-- Database-level guarantee against double booking: a staff member cannot have two
-- active (non-cancelled / non-no-show) appointments with overlapping time ranges.
CREATE EXTENSION IF NOT EXISTS btree_gist;
--> statement-breakpoint
ALTER TABLE "appointments"
  ADD CONSTRAINT "appointments_no_overlap"
  EXCLUDE USING gist (
    "staff_id" WITH =,
    tstzrange("starts_at", "ends_at") WITH &&
  ) WHERE ("status" NOT IN ('cancelled', 'no_show'));
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_time_order" CHECK ("ends_at" > "starts_at");
