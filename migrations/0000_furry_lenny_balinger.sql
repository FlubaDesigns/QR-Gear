CREATE TABLE "admin_settings" (
	"id" varchar PRIMARY KEY DEFAULT 'default' NOT NULL,
	"global_markup_percent" numeric(5, 2) DEFAULT '25',
	"global_markup_fixed" numeric(10, 2) DEFAULT '0',
	"global_qr_production_cost" numeric(10, 2) DEFAULT '2',
	"additional_placement_cost" numeric(10, 2) DEFAULT '4',
	"text_above_upcharge" numeric(10, 2) DEFAULT '2',
	"text_below_upcharge" numeric(10, 2) DEFAULT '2',
	"image_hosting_upcharge" numeric(10, 2) DEFAULT '5',
	"dynamic_qr_upcharge" numeric(10, 2) DEFAULT '25',
	"show_prices_before_customization" boolean DEFAULT false,
	"default_fulfillment_provider" text DEFAULT 'printify',
	"default_mockup_provider" text DEFAULT 'printful',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "browsing_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"viewed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bundle_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bundle_id" varchar NOT NULL,
	"master_product_id" varchar,
	"product_id" integer,
	"display_order" integer DEFAULT 0,
	"quantity" integer DEFAULT 1,
	"is_required" boolean DEFAULT false,
	"item_discount_percent" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "canonical_placements" (
	"id" varchar PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"preview_x" numeric(5, 3) DEFAULT '0.5',
	"preview_y" numeric(5, 3) DEFAULT '0.4',
	"preview_scale" numeric(5, 3) DEFAULT '0.3',
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cart_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"design_id" varchar,
	"product_id" varchar NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"customization" jsonb NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "channel_configs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"channel_type" text NOT NULL,
	"display_name" text NOT NULL,
	"is_enabled" boolean DEFAULT false,
	"api_key_secret_name" text,
	"api_secret_secret_name" text,
	"shop_id" text,
	"rate_limit" integer DEFAULT 60,
	"rate_limit_window" integer DEFAULT 60,
	"webhook_secret" text,
	"webhook_url" text,
	"last_health_check" timestamp,
	"settings" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channel_configs_channel_type_unique" UNIQUE("channel_type")
);
--> statement-breakpoint
CREATE TABLE "channel_publish_states" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"master_product_id" varchar NOT NULL,
	"channel_type" text NOT NULL,
	"external_product_id" text,
	"external_listing_id" text,
	"external_variant_ids" jsonb,
	"status" text DEFAULT 'unpublished',
	"last_published_at" timestamp,
	"last_synced_at" timestamp,
	"last_error" text,
	"published_design_version_id" varchar,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "channel_publish_states_master_product_id_channel_type_unique" UNIQUE("master_product_id","channel_type")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"discount_type" text NOT NULL,
	"discount_value" numeric(10, 2) NOT NULL,
	"currency" text DEFAULT 'usd',
	"min_order_amount" numeric(10, 2),
	"max_redemptions" integer,
	"redemption_count" integer DEFAULT 0,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"stripe_coupon_id" text,
	"stripe_promotion_code_id" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "coupons_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "custom_designs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"project_name" text NOT NULL,
	"product_id" integer NOT NULL,
	"product_name" text NOT NULL,
	"product_image" text,
	"placements" text[] NOT NULL,
	"placement_configs" jsonb,
	"placement_images" jsonb,
	"background_image_url" text,
	"background_asset_id" varchar,
	"top_text" jsonb,
	"bottom_text" jsonb,
	"text_upcharge" numeric(10, 2) DEFAULT '2.00',
	"landing_overlay" jsonb,
	"template_variant" text DEFAULT 'url',
	"external_url" text,
	"dynamic_content_set_id" varchar,
	"store_type" text,
	"store_name" text,
	"segment" text,
	"is_featured" boolean DEFAULT false,
	"is_seasonal_promo" boolean DEFAULT false,
	"qr_code_url" text,
	"printify_composite_url" text,
	"saved_to_library" boolean DEFAULT false,
	"saved_to_store" boolean DEFAULT false,
	"template_name" text,
	"template_category" text,
	"template_subcategory" text,
	"owner_user_id" varchar,
	"campaign_name" text,
	"blueprint_id" integer,
	"print_provider_id" integer,
	"printify_product_id" text,
	"print_ready_art_url" text,
	"selected_colors" text[],
	"default_color" text,
	"mockups_by_color" jsonb,
	"graphics_config" jsonb,
	"selected_variant_ids" jsonb,
	"publish_status" text DEFAULT 'draft',
	"publish_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "custom_gifts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"slug" text NOT NULL,
	"background_source" text NOT NULL,
	"background_id" varchar,
	"uploaded_image_id" varchar,
	"composite_image_url" text,
	"overlay_config" jsonb,
	"text_above_qr" text,
	"text_below_qr" text,
	"qr_text_content" text,
	"hosting_tier_id" varchar,
	"disclaimer_accepted" boolean DEFAULT false,
	"disclaimer_accepted_at" timestamp,
	"pricing_snapshot" jsonb,
	"views" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "custom_gifts_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "dynamic_content_sets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"schedule_type" text DEFAULT 'daily' NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"loop_behavior" text DEFAULT 'stop',
	"total_slots" integer DEFAULT 0,
	"user_id" varchar,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dynamic_content_slots" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_set_id" varchar NOT NULL,
	"slot_number" integer NOT NULL,
	"title" text,
	"description" text,
	"image_url" text,
	"video_url" text,
	"link_url" text,
	"link_text" text,
	"text_color" text DEFAULT '#ffffff',
	"overlay_position" text DEFAULT 'bottom',
	"font_family" text DEFAULT 'Inter',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dynamic_page_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_id" varchar NOT NULL,
	"hosted_image_id" varchar NOT NULL,
	"title" text,
	"is_active" boolean DEFAULT false,
	"activated_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dynamic_pages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"active_asset_id" varchar,
	"hosting_tier_id" varchar,
	"views" integer DEFAULT 0,
	"status" text DEFAULT 'active',
	"expires_at" timestamp,
	"renewal_reminder_sent" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dynamic_pages_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "email_logs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" varchar,
	"trigger" text NOT NULL,
	"recipient_email" text NOT NULL,
	"subject" text NOT NULL,
	"status" text NOT NULL,
	"resend_id" text,
	"order_id" varchar,
	"user_id" varchar,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "email_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"trigger" text NOT NULL,
	"name" text NOT NULL,
	"subject" text NOT NULL,
	"html_content" text NOT NULL,
	"text_content" text,
	"is_enabled" boolean DEFAULT true,
	"description" text,
	"variables" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_templates_trigger_unique" UNIQUE("trigger")
);
--> statement-breakpoint
CREATE TABLE "gift_backgrounds" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"thumbnail_url" text NOT NULL,
	"full_image_url" text NOT NULL,
	"storage_url" text NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(32) NOT NULL,
	"gift_package_id" varchar NOT NULL,
	"buyer_user_id" varchar,
	"buyer_email" text,
	"buyer_name" text,
	"personal_message" text,
	"order_id" varchar,
	"stripe_payment_id" text,
	"purchased_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"last_emailed_to" text,
	"last_emailed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "gift_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "gift_packages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"gift_type" text DEFAULT 'product' NOT NULL,
	"master_product_id" varchar,
	"dynamics_tier" text,
	"dynamics_months" integer,
	"price" numeric(10, 2) NOT NULL,
	"allow_color_choice" boolean DEFAULT true,
	"allow_size_choice" boolean DEFAULT true,
	"allow_qr_customization" boolean DEFAULT true,
	"include_personal_message" boolean DEFAULT true,
	"redemption_valid_days" integer DEFAULT 365,
	"display_image" text,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gift_redemptions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gift_code_id" varchar NOT NULL,
	"recipient_user_id" varchar,
	"recipient_email" text,
	"recipient_name" text,
	"selected_color" text,
	"selected_size" text,
	"qr_content" text,
	"qr_style" jsonb,
	"shipping_address" jsonb,
	"dynamics_subscription_id" varchar,
	"dynamics_content_set_id" varchar,
	"fulfillment_order_id" varchar,
	"fulfillment_provider" text,
	"fulfillment_status" text DEFAULT 'pending',
	"tracking_number" text,
	"tracking_url" text,
	"redeemed_at" timestamp DEFAULT now() NOT NULL,
	"fulfilled_at" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "graphic_sets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category_id" varchar,
	"subcategory_id" varchar,
	"background_image_url" text,
	"qr_content_type" text NOT NULL,
	"qr_destination" text,
	"header_text" jsonb,
	"footer_text" jsonb,
	"landing_overlay" jsonb,
	"tags" text[],
	"is_active" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosted_images" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_url" text NOT NULL,
	"public_url" text NOT NULL,
	"title" text,
	"description" text,
	"business_name" text,
	"business_logo" text,
	"views" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosting_reminders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"custom_gift_id" varchar NOT NULL,
	"user_id" varchar,
	"reminder_type" text NOT NULL,
	"scheduled_for" timestamp NOT NULL,
	"sent_at" timestamp,
	"email_address" text,
	"status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hosting_tiers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"duration_days" integer NOT NULL,
	"is_included" boolean DEFAULT false,
	"price_upcharge" numeric(10, 2) DEFAULT '0',
	"video_price_upcharge" numeric(10, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	CONSTRAINT "hosting_tiers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "library_assets" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar,
	"owner_type" text NOT NULL,
	"asset_type" text NOT NULL,
	"media_type" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"mime_type" text NOT NULL,
	"size_bytes" integer NOT NULL,
	"storage_url" text NOT NULL,
	"public_url" text NOT NULL,
	"thumbnail_url" text,
	"duration" integer,
	"library_category_id" varchar,
	"library_subcategory_id" varchar,
	"category" text,
	"season" text,
	"event" text,
	"tags" text[],
	"visible_store_slugs" text[],
	"visible_segments" jsonb,
	"is_active" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"usage_count" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "master_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sku" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"product_type" text NOT NULL,
	"current_design_version_id" varchar,
	"pricing_profile_id" varchar,
	"base_cost" numeric(10, 2),
	"retail_price" numeric(10, 2),
	"status" text DEFAULT 'draft',
	"channels" jsonb,
	"tags" text[],
	"bundle_parent_id" varchar,
	"bundle_discount" numeric(5, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "master_products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "mockup_cache" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar,
	"blueprint_id" integer,
	"print_provider_id" integer,
	"color_name" text NOT NULL,
	"color_hex" text,
	"canonical_placement_id" varchar,
	"artwork_url" text,
	"artwork_variant" text DEFAULT 'black',
	"mockup_url" text NOT NULL,
	"mockup_url_hq" text,
	"lifestyle_mockup_url" text,
	"pod_provider_id" varchar,
	"provider_mockup_id" text,
	"status" text DEFAULT 'active',
	"generated_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "mockup_cache_unique" UNIQUE("blueprint_id","print_provider_id","color_name","canonical_placement_id","artwork_variant")
);
--> statement-breakpoint
CREATE TABLE "mockup_jobs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"color_name" text NOT NULL,
	"qr_size" text DEFAULT 'medium' NOT NULL,
	"placement" text DEFAULT 'front-chest' NOT NULL,
	"job_data" jsonb NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"priority" integer DEFAULT 10,
	"attempts" integer DEFAULT 0,
	"max_attempts" integer DEFAULT 5,
	"priority_updated_at" timestamp,
	"priority_owner" varchar,
	"priority_expires_at" timestamp,
	"result_data" jsonb,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	"next_retry_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"quantity" integer NOT NULL,
	"customization" jsonb NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"printify_item_id" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"status" text NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"stripe_payment_id" text,
	"stripe_session_id" text,
	"stripe_payment_intent_id" text,
	"printify_order_id" text,
	"shipping_address" jsonb,
	"tracking_number" text,
	"carrier" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders_unified" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_channel" text NOT NULL,
	"external_order_id" text,
	"customer_email" text,
	"customer_name" text,
	"shipping_address" jsonb,
	"items" jsonb NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"shipping_total" numeric(10, 2),
	"tax_total" numeric(10, 2),
	"total" numeric(10, 2) NOT NULL,
	"routed_provider" text,
	"provider_order_id" text,
	"status" text DEFAULT 'pending',
	"status_history" jsonb,
	"tracking_number" text,
	"tracking_url" text,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"production_cost" numeric(10, 2),
	"profit" numeric(10, 2),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_store_products" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_store_id" varchar NOT NULL,
	"product_id" varchar NOT NULL,
	"custom_price" numeric(10, 2),
	"custom_name" text,
	"kc_placements" text[],
	"kc_business_slug" text,
	"enabled_sizes" text[],
	"enabled_colors" text[],
	"default_color" text,
	"mockups_by_color" jsonb,
	"sort_order" integer DEFAULT 0,
	"is_enabled" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "partner_stores" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"logo_url" text,
	"website_url" text,
	"business_page_url_pattern" text,
	"api_key" text NOT NULL,
	"allowed_origins" text[],
	"primary_color" text,
	"accent_color" text,
	"commission_percent" numeric(5, 2) DEFAULT '0',
	"available_segments" text[],
	"is_internal" boolean DEFAULT false,
	"annual_member_perk" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "partner_stores_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pod_providers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"logo_url" text,
	"website_url" text,
	"api_base_url" text,
	"supports_white_label" boolean DEFAULT false,
	"supports_rush" boolean DEFAULT false,
	"average_ship_days" integer,
	"is_active" boolean DEFAULT true,
	"health_status" text DEFAULT 'unknown',
	"last_health_check" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_profiles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"markup_type" text DEFAULT 'percentage' NOT NULL,
	"markup_percent" numeric(5, 2),
	"markup_fixed" numeric(10, 2),
	"min_margin_percent" numeric(5, 2) DEFAULT '40',
	"channel_adjustments" jsonb,
	"auto_reprice_enabled" boolean DEFAULT false,
	"auto_reprice_min_margin" numeric(5, 2),
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pricing_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"scope" text NOT NULL,
	"scope_value" text,
	"markup_type" text NOT NULL,
	"markup_value" numeric(10, 2) NOT NULL,
	"qr_production_cost" numeric(10, 2) DEFAULT '0',
	"priority" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printful_products" (
	"id" integer PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"type_name" text NOT NULL,
	"brand" text,
	"model" text,
	"title" text NOT NULL,
	"image" text,
	"variant_count" integer DEFAULT 0,
	"currency" text DEFAULT 'USD',
	"min_price" numeric(10, 2),
	"max_price" numeric(10, 2),
	"printfile_width" integer,
	"printfile_height" integer,
	"printfile_dpi" integer,
	"description" text,
	"avg_fulfillment_time" integer,
	"origin_country" text,
	"is_discontinued" boolean DEFAULT false,
	"available_placements" text[],
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printful_variants" (
	"id" integer PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"name" text NOT NULL,
	"size" text,
	"color" text,
	"color_code" text,
	"color_code2" text,
	"image" text,
	"price" numeric(10, 2) NOT NULL,
	"in_stock" boolean DEFAULT true,
	"availability_status" text,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printify_blueprints" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"brand" text,
	"model" text,
	"images" text[],
	"primary_image_url" text,
	"category" text,
	"last_synced_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printify_catalog_sync" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sync_type" text NOT NULL,
	"status" text NOT NULL,
	"blueprints_count" integer DEFAULT 0,
	"providers_count" integer DEFAULT 0,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "printify_cost_sync" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text NOT NULL,
	"total_providers" integer DEFAULT 0,
	"processed_count" integer DEFAULT 0,
	"success_count" integer DEFAULT 0,
	"failed_count" integer DEFAULT 0,
	"skipped_count" integer DEFAULT 0,
	"last_processed_provider_id" text,
	"error_message" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "printify_print_providers" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"blueprint_id" integer NOT NULL,
	"provider_id" integer NOT NULL,
	"title" text NOT NULL,
	"country" text,
	"is_usa" boolean DEFAULT false,
	"min_cost" integer,
	"max_cost" integer,
	"available_colors" jsonb,
	"available_sizes" text[],
	"placeholder_product_id" text,
	"costs_fetched_at" timestamp,
	"last_synced_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "printify_printful_mapping" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"printify_blueprint_id" integer NOT NULL,
	"printify_print_provider_id" integer,
	"printify_brand" text,
	"printify_model" text,
	"printful_product_id" integer NOT NULL,
	"printful_brand" text,
	"printful_model" text,
	"placement_mapping" jsonb,
	"color_mapping" jsonb,
	"is_active" boolean DEFAULT true,
	"match_confidence" text DEFAULT 'auto',
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "printify_printful_unique" UNIQUE("printify_blueprint_id","printify_print_provider_id")
);
--> statement-breakpoint
CREATE TABLE "product_bundles" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"bundle_type" text DEFAULT 'fixed' NOT NULL,
	"display_image" text,
	"display_order" integer DEFAULT 0,
	"pricing_type" text DEFAULT 'discount_percent' NOT NULL,
	"discount_percent" numeric(5, 2),
	"fixed_price" numeric(10, 2),
	"discount_amount" numeric(10, 2),
	"min_items" integer,
	"max_items" integer,
	"is_active" boolean DEFAULT true,
	"display_locations" text[] DEFAULT ARRAY['cart']::text[],
	"trigger_product_ids" text[],
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories_lookup" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"description" text,
	"taxonomy_type" text NOT NULL,
	"icon" text,
	"parent_id" varchar,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_categories_lookup_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "product_category_assignments" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"category_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_design_versions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"master_product_id" varchar NOT NULL,
	"version_number" integer DEFAULT 1 NOT NULL,
	"header_text" text,
	"header_style" jsonb,
	"footer_text" text,
	"footer_style" jsonb,
	"qr_url" text NOT NULL,
	"rendered_png_url" text,
	"rendered_svg_url" text,
	"qr_code_url" text,
	"placement_images" jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_placement_availability" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"canonical_placement_id" varchar NOT NULL,
	"artwork_black_url" text,
	"artwork_white_url" text,
	"is_primary" boolean DEFAULT false,
	"is_enabled" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_placement_unique" UNIQUE("product_id","canonical_placement_id")
);
--> statement-breakpoint
CREATE TABLE "product_variant_media" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"color" text NOT NULL,
	"color_hex" text,
	"mockup_url" text NOT NULL,
	"overlay_url" text,
	"is_primary" boolean DEFAULT false,
	"media_status" text DEFAULT 'pending',
	"printify_mockup_id" text,
	"last_checked_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "product_variant_media_product_id_color_unique" UNIQUE("product_id","color")
);
--> statement-breakpoint
CREATE TABLE "product_variants" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" varchar NOT NULL,
	"printify_variant_id" integer NOT NULL,
	"title" text NOT NULL,
	"size" text,
	"color" text,
	"color_hex" text,
	"price" numeric(10, 2) NOT NULL,
	"is_enabled" boolean DEFAULT true,
	"is_in_stock" boolean DEFAULT true,
	CONSTRAINT "product_variants_product_id_printify_variant_id_unique" UNIQUE("product_id","printify_variant_id")
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar PRIMARY KEY NOT NULL,
	"printify_id" text,
	"blueprint_id" integer,
	"print_provider_id" integer,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"product_line" text DEFAULT 'all',
	"base_price" numeric(10, 2) NOT NULL,
	"image_url" text,
	"manufacturer" text,
	"made_in_usa" boolean DEFAULT false,
	"default_placement" text DEFAULT 'front-chest',
	"available_placements" text[],
	"available_colors" jsonb,
	"available_sizes" text[],
	"default_color" text,
	"metadata" jsonb,
	"is_enabled" boolean DEFAULT false,
	"markup_percent" numeric(5, 2) DEFAULT '0',
	"markup_fixed" numeric(10, 2) DEFAULT '0',
	"qr_production_cost" numeric(10, 2) DEFAULT '0',
	"customer_price" numeric(10, 2),
	"is_featured" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"mockups_by_color" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_printify_id_unique" UNIQUE("printify_id")
);
--> statement-breakpoint
CREATE TABLE "provider_health_log" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider_type" text NOT NULL,
	"check_time" timestamp DEFAULT now() NOT NULL,
	"is_healthy" boolean DEFAULT true,
	"response_time_ms" integer,
	"error_message" text,
	"error_code" text,
	"uptime_percent_24h" numeric(5, 2),
	"avg_response_time_24h" integer
);
--> statement-breakpoint
CREATE TABLE "provider_placement_mappings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"pod_provider_id" varchar NOT NULL,
	"canonical_placement_id" varchar NOT NULL,
	"provider_placement_key" text NOT NULL,
	"override_x" numeric(5, 3),
	"override_y" numeric(5, 3),
	"override_scale" numeric(5, 3),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "provider_placement_unique" UNIQUE("pod_provider_id","provider_placement_key")
);
--> statement-breakpoint
CREATE TABLE "provider_quotes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"master_product_id" varchar NOT NULL,
	"provider_type" text NOT NULL,
	"production_cost" numeric(10, 2) NOT NULL,
	"shipping_cost" numeric(10, 2),
	"estimated_days" integer,
	"is_available" boolean DEFAULT true,
	"quoted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "qr_designs" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"name" text NOT NULL,
	"qr_type" text NOT NULL,
	"qr_content" text NOT NULL,
	"qr_style" jsonb NOT NULL,
	"product_id" text,
	"placement" text NOT NULL,
	"product_color" text,
	"manufacturer" text,
	"made_in_usa" boolean DEFAULT false,
	"preview_url" text,
	"show_in_gallery" boolean DEFAULT false,
	"gallery_title" text,
	"gallery_description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qr_scan_events" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"master_product_id" varchar,
	"custom_design_id" varchar,
	"qr_url" text,
	"scan_date" timestamp DEFAULT now() NOT NULL,
	"scan_count" integer DEFAULT 1,
	"country" text,
	"region" text,
	"device_type" text,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "qr_templates" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"thumbnail_url" text NOT NULL,
	"full_image_url" text NOT NULL,
	"storage_url" text NOT NULL,
	"qr_placement" jsonb,
	"available_sizes" text[],
	"default_text_above" text,
	"default_text_below" text,
	"text_style" jsonb,
	"price_upcharge" numeric(10, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"sort_order" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "repricing_history" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" varchar,
	"master_product_id" varchar,
	"channel" text,
	"previous_price" numeric(10, 2) NOT NULL,
	"new_price" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"previous_margin" numeric(5, 2),
	"new_margin" numeric(5, 2),
	"applied_at" timestamp DEFAULT now() NOT NULL,
	"was_automatic" boolean DEFAULT true
);
--> statement-breakpoint
CREATE TABLE "repricing_rules" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"conditions" jsonb DEFAULT '{}'::jsonb,
	"action_type" text NOT NULL,
	"action_params" jsonb DEFAULT '{}'::jsonb,
	"applies_to" text DEFAULT 'all',
	"applies_to_ids" text[],
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "template_categories" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"parent_id" varchar,
	"sort_order" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"password_hash" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"social_facebook" varchar,
	"social_instagram" varchar,
	"social_twitter" varchar,
	"social_linkedin" varchar,
	"social_tiktok" varchar,
	"social_youtube" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "browsing_history" ADD CONSTRAINT "browsing_history_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_bundle_id_product_bundles_id_fk" FOREIGN KEY ("bundle_id") REFERENCES "public"."product_bundles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bundle_items" ADD CONSTRAINT "bundle_items_master_product_id_master_products_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "public"."master_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_design_id_qr_designs_id_fk" FOREIGN KEY ("design_id") REFERENCES "public"."qr_designs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cart_items" ADD CONSTRAINT "cart_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "channel_publish_states" ADD CONSTRAINT "channel_publish_states_master_product_id_master_products_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "public"."master_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_designs" ADD CONSTRAINT "custom_designs_background_asset_id_library_assets_id_fk" FOREIGN KEY ("background_asset_id") REFERENCES "public"."library_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_designs" ADD CONSTRAINT "custom_designs_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_gifts" ADD CONSTRAINT "custom_gifts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_gifts" ADD CONSTRAINT "custom_gifts_background_id_gift_backgrounds_id_fk" FOREIGN KEY ("background_id") REFERENCES "public"."gift_backgrounds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_gifts" ADD CONSTRAINT "custom_gifts_uploaded_image_id_hosted_images_id_fk" FOREIGN KEY ("uploaded_image_id") REFERENCES "public"."hosted_images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "custom_gifts" ADD CONSTRAINT "custom_gifts_hosting_tier_id_hosting_tiers_id_fk" FOREIGN KEY ("hosting_tier_id") REFERENCES "public"."hosting_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_content_sets" ADD CONSTRAINT "dynamic_content_sets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_content_slots" ADD CONSTRAINT "dynamic_content_slots_content_set_id_dynamic_content_sets_id_fk" FOREIGN KEY ("content_set_id") REFERENCES "public"."dynamic_content_sets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_page_assets" ADD CONSTRAINT "dynamic_page_assets_page_id_dynamic_pages_id_fk" FOREIGN KEY ("page_id") REFERENCES "public"."dynamic_pages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_page_assets" ADD CONSTRAINT "dynamic_page_assets_hosted_image_id_hosted_images_id_fk" FOREIGN KEY ("hosted_image_id") REFERENCES "public"."hosted_images"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_pages" ADD CONSTRAINT "dynamic_pages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dynamic_pages" ADD CONSTRAINT "dynamic_pages_hosting_tier_id_hosting_tiers_id_fk" FOREIGN KEY ("hosting_tier_id") REFERENCES "public"."hosting_tiers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_template_id_email_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."email_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "email_logs" ADD CONSTRAINT "email_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_codes" ADD CONSTRAINT "gift_codes_gift_package_id_gift_packages_id_fk" FOREIGN KEY ("gift_package_id") REFERENCES "public"."gift_packages"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_codes" ADD CONSTRAINT "gift_codes_buyer_user_id_users_id_fk" FOREIGN KEY ("buyer_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_packages" ADD CONSTRAINT "gift_packages_master_product_id_master_products_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "public"."master_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_redemptions" ADD CONSTRAINT "gift_redemptions_gift_code_id_gift_codes_id_fk" FOREIGN KEY ("gift_code_id") REFERENCES "public"."gift_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_redemptions" ADD CONSTRAINT "gift_redemptions_recipient_user_id_users_id_fk" FOREIGN KEY ("recipient_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_redemptions" ADD CONSTRAINT "gift_redemptions_dynamics_content_set_id_dynamic_content_sets_id_fk" FOREIGN KEY ("dynamics_content_set_id") REFERENCES "public"."dynamic_content_sets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_sets" ADD CONSTRAINT "graphic_sets_category_id_template_categories_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."template_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "graphic_sets" ADD CONSTRAINT "graphic_sets_subcategory_id_template_categories_id_fk" FOREIGN KEY ("subcategory_id") REFERENCES "public"."template_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosted_images" ADD CONSTRAINT "hosted_images_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_reminders" ADD CONSTRAINT "hosting_reminders_custom_gift_id_custom_gifts_id_fk" FOREIGN KEY ("custom_gift_id") REFERENCES "public"."custom_gifts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hosting_reminders" ADD CONSTRAINT "hosting_reminders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_assets" ADD CONSTRAINT "library_assets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_assets" ADD CONSTRAINT "library_assets_library_category_id_template_categories_id_fk" FOREIGN KEY ("library_category_id") REFERENCES "public"."template_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_assets" ADD CONSTRAINT "library_assets_library_subcategory_id_template_categories_id_fk" FOREIGN KEY ("library_subcategory_id") REFERENCES "public"."template_categories"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mockup_cache" ADD CONSTRAINT "mockup_cache_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mockup_cache" ADD CONSTRAINT "mockup_cache_canonical_placement_id_canonical_placements_id_fk" FOREIGN KEY ("canonical_placement_id") REFERENCES "public"."canonical_placements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mockup_cache" ADD CONSTRAINT "mockup_cache_pod_provider_id_pod_providers_id_fk" FOREIGN KEY ("pod_provider_id") REFERENCES "public"."pod_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_store_products" ADD CONSTRAINT "partner_store_products_partner_store_id_partner_stores_id_fk" FOREIGN KEY ("partner_store_id") REFERENCES "public"."partner_stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_store_products" ADD CONSTRAINT "partner_store_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printful_variants" ADD CONSTRAINT "printful_variants_product_id_printful_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."printful_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "printify_print_providers" ADD CONSTRAINT "printify_print_providers_blueprint_id_printify_blueprints_id_fk" FOREIGN KEY ("blueprint_id") REFERENCES "public"."printify_blueprints"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_assignments" ADD CONSTRAINT "product_category_assignments_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_category_assignments" ADD CONSTRAINT "product_category_assignments_category_id_product_categories_lookup_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."product_categories_lookup"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_design_versions" ADD CONSTRAINT "product_design_versions_master_product_id_master_products_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "public"."master_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_placement_availability" ADD CONSTRAINT "product_placement_availability_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_placement_availability" ADD CONSTRAINT "product_placement_availability_canonical_placement_id_canonical_placements_id_fk" FOREIGN KEY ("canonical_placement_id") REFERENCES "public"."canonical_placements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variant_media" ADD CONSTRAINT "product_variant_media_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_placement_mappings" ADD CONSTRAINT "provider_placement_mappings_pod_provider_id_pod_providers_id_fk" FOREIGN KEY ("pod_provider_id") REFERENCES "public"."pod_providers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_placement_mappings" ADD CONSTRAINT "provider_placement_mappings_canonical_placement_id_canonical_placements_id_fk" FOREIGN KEY ("canonical_placement_id") REFERENCES "public"."canonical_placements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "provider_quotes" ADD CONSTRAINT "provider_quotes_master_product_id_master_products_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "public"."master_products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_designs" ADD CONSTRAINT "qr_designs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qr_scan_events" ADD CONSTRAINT "qr_scan_events_master_product_id_master_products_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "public"."master_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repricing_history" ADD CONSTRAINT "repricing_history_rule_id_repricing_rules_id_fk" FOREIGN KEY ("rule_id") REFERENCES "public"."repricing_rules"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "repricing_history" ADD CONSTRAINT "repricing_history_master_product_id_master_products_id_fk" FOREIGN KEY ("master_product_id") REFERENCES "public"."master_products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mockup_jobs_status_idx" ON "mockup_jobs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "mockup_jobs_product_idx" ON "mockup_jobs" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "mockup_jobs_next_retry_idx" ON "mockup_jobs" USING btree ("next_retry_at");--> statement-breakpoint
CREATE INDEX "mockup_jobs_priority_idx" ON "mockup_jobs" USING btree ("priority","priority_updated_at");--> statement-breakpoint
CREATE INDEX "mockup_jobs_lookup_idx" ON "mockup_jobs" USING btree ("product_id","color_name","qr_size","placement");--> statement-breakpoint
CREATE INDEX "printful_variants_product_idx" ON "printful_variants" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "printful_variants_color_idx" ON "printful_variants" USING btree ("color");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");