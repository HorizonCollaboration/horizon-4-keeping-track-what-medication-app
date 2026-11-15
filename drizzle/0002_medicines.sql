CREATE TABLE "email_alert" (
	"user_id" text PRIMARY KEY NOT NULL,
	"on" boolean DEFAULT false NOT NULL,
	"often" text DEFAULT 'changes' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "list_check" (
	"id" text PRIMARY KEY NOT NULL,
	"checked_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicine" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"strength" text NOT NULL,
	"form" text NOT NULL,
	"maker" text NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"expected_back" date,
	"last_changed_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "medicine_change" (
	"id" text PRIMARY KEY NOT NULL,
	"medicine_id" text NOT NULL,
	"status" text NOT NULL,
	"note" text NOT NULL,
	"changed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tracked_medicine" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"medicine_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "tracked_medicine_user_medicine" UNIQUE("user_id","medicine_id")
);
--> statement-breakpoint
ALTER TABLE "email_alert" ADD CONSTRAINT "email_alert_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "medicine_change" ADD CONSTRAINT "medicine_change_medicine_id_medicine_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_medicine" ADD CONSTRAINT "tracked_medicine_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tracked_medicine" ADD CONSTRAINT "tracked_medicine_medicine_id_medicine_id_fk" FOREIGN KEY ("medicine_id") REFERENCES "public"."medicine"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "medicine_change_medicine_idx" ON "medicine_change" USING btree ("medicine_id","changed_at");