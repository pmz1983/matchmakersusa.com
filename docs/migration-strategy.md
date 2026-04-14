# MatchMakers Platform Migration Strategy
# Firebase to Supabase Unified Platform Transformation

**Document Version:** 1.0
**Date:** April 14, 2026
**Classification:** Confidential -- Internal Use Only
**Prepared for:** MatchMakers USA Leadership
**Prepared by:** Platform Engineering

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Migration Architecture](#2-migration-architecture)
3. [Migration Approach](#3-migration-approach)
4. [Authentication Migration](#4-authentication-migration)
5. [Media Migration](#5-media-migration)
6. [iOS App Rewrite Plan](#6-ios-app-rewrite-plan)
7. [Data Cleaning & Profile Quality System](#7-data-cleaning--profile-quality-system)
8. [Unified Platform Architecture](#8-unified-platform-architecture)
9. [Unified Entitlements System](#9-unified-entitlements-system)
10. [Push Notifications Migration](#10-push-notifications-migration)
11. [Performance & Scale Design](#11-performance--scale-design)
12. [QA & Zero-Regression Plan](#12-qa--zero-regression-plan)
13. [Implementation Roadmap](#13-implementation-roadmap)
14. [Value Creation Impact](#14-value-creation-impact)
15. [Risk Register](#15-risk-register)
16. [Phase Two Audit Framework](#16-phase-two-audit-framework)

---

# 1. Executive Summary

## 1.1 Transformation Overview

MatchMakers operates a live dating platform serving 30,000-70,000 user records across an iOS application and a marketing/commerce website. The platform currently runs on a split architecture: the iOS app uses Firebase (Realtime Database, Auth, Storage, FCM, Crashlytics) while the website uses Supabase (Edge Functions, PostgreSQL) with Stripe for commerce.

This document defines the complete migration strategy to consolidate all platform infrastructure onto Supabase, creating a single unified backend that serves the iOS app, the existing website, and a future Android application.

## 1.2 Risk Assessment

**Overall Risk Level: MEDIUM**

The migration carries moderate risk due to the following factors:

| Factor | Risk Level | Rationale |
|--------|-----------|-----------|
| Data volume | LOW | 30K-70K records is small; full export/import fits in a single maintenance window |
| Schema complexity | MEDIUM | 7 years of schema drift in Firebase RTDB requires careful normalization |
| User disruption | LOW | Under 50 active paid subscribers; email/password-only auth simplifies migration |
| Feature parity | MEDIUM | 173 public functions in FirebaseManager.swift must each have a Supabase equivalent |
| Real-time messaging | MEDIUM | Must maintain zero-downtime messaging UX; Supabase Realtime is architecturally different from Firebase RTDB |
| Revenue continuity | HIGH | StoreKit subscriptions and Stripe purchases must have zero gaps |

## 1.3 Timeline Estimate

| Phase | Duration | Description |
|-------|----------|-------------|
| Phase 0: Preparation | 2 weeks | Schema design, backup, migration scripts, test environment |
| Phase 1: Data Export & Transformation | 1 week | Extract, clean, transform, load into staging |
| Phase 2: Cutover | 2-4 hours | Maintenance window for production switch |
| Phase 3: Validation & Monitoring | 2 weeks | Active monitoring, bug fixes, user support |
| Phase 4: Decommission Firebase | 4+ weeks | Gradual wind-down after confirming stability |

**Total estimated timeline: 7-9 weeks**

## 1.4 Expected Outcomes

1. **Single unified backend** serving iOS, web, and future Android from one Supabase project
2. **Elimination of dual infrastructure costs** (Firebase Blaze plan + Supabase Pro plan reduced to Supabase only)
3. **Unified entitlements** enabling cross-platform purchase access (buy on web, use on iOS and vice versa)
4. **Relational data model** replacing denormalized Firebase JSON, enabling complex queries for matching, analytics, and moderation
5. **Android-ready architecture** with no Firebase dependencies in the shared backend
6. **Data quality improvement** through automated profile scoring and fake account cleanup
7. **Row Level Security** providing database-level access control that Firebase RTDB rules cannot match

---

# 2. Migration Architecture

## 2.1 Complete Supabase Schema Design

The following schema converts the denormalized Firebase Realtime Database JSON structure into a properly normalized PostgreSQL relational schema. Each table includes columns, types, constraints, and rationale.

### 2.1.1 Core User Tables

```sql
-- ============================================================
-- EXTENSIONS
-- ============================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";  -- For fuzzy text search on profiles

-- ============================================================
-- TABLE: profiles
-- Source: Firebase RTDB /Users/{uid}
-- This is the central user profile table. Firebase stores all
-- user data as a single denormalized JSON object per user.
-- We normalize this into profiles (core), profile_attributes
-- (structured metadata), and profile_preferences (search criteria).
-- ============================================================
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_uid TEXT UNIQUE,                    -- Preserved for migration mapping and Firebase read-only fallback
    supabase_auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
    
    -- Identity fields
    email TEXT NOT NULL UNIQUE,
    display_name TEXT NOT NULL DEFAULT '',
    first_name TEXT DEFAULT '',
    last_name TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    
    -- Profile content
    bio TEXT DEFAULT '',
    about_me TEXT DEFAULT '',
    
    -- Location
    city TEXT DEFAULT '',
    state TEXT DEFAULT '',
    zip_code TEXT DEFAULT '',
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    
    -- Demographics
    age INTEGER CHECK (age >= 18 AND age <= 120),
    date_of_birth DATE,
    gender TEXT CHECK (gender IN ('male', 'female', 'non-binary', 'other')),
    height_inches INTEGER,
    ethnicity TEXT DEFAULT '',
    religion TEXT DEFAULT '',
    politics TEXT DEFAULT '',
    education TEXT DEFAULT '',
    occupation TEXT DEFAULT '',
    income_range TEXT DEFAULT '',
    
    -- Platform-specific fields
    intent TEXT CHECK (intent IN (
        'long_term', 'marriage', 'fall_in_love', 'short_term',
        'casual', 'physical', 'virtual', 'friends', 'not_sure'
    )),
    
    -- Level system
    level INTEGER DEFAULT 6 CHECK (level >= 1 AND level <= 10),
    level_rating_count INTEGER DEFAULT 0,
    level_percentile DOUBLE PRECISION DEFAULT 0.0,
    level_last_calculated_at TIMESTAMPTZ,
    
    -- Photo ranking
    photo_ranking_count INTEGER DEFAULT 0,
    top_ranked_photo_id UUID,                    -- FK set after photos table creation
    
    -- Account status
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'inactive', 'suspended', 'banned',
        'archived', 'pending_review', 'deactivated'
    )),
    is_verified BOOLEAN DEFAULT FALSE,
    is_premium BOOLEAN DEFAULT FALSE,
    is_spotlight_active BOOLEAN DEFAULT FALSE,
    spotlight_expires_at TIMESTAMPTZ,
    
    -- Profile quality (see Section 7)
    quality_score NUMERIC(3,1) DEFAULT 5.0 CHECK (quality_score >= 0 AND quality_score <= 10),
    completeness_pct INTEGER DEFAULT 0 CHECK (completeness_pct >= 0 AND completeness_pct <= 100),
    
    -- Migration metadata
    migrated_from_firebase BOOLEAN DEFAULT FALSE,
    firebase_raw_json JSONB,                     -- Original Firebase data preserved for debugging
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    last_active_at TIMESTAMPTZ,
    last_login_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ                       -- Soft delete
);

-- ============================================================
-- TABLE: profile_photos
-- Source: Firebase RTDB /Users/{uid}/photos and Firebase Storage
-- Firebase stores photo URLs as an array or map on the user object.
-- We normalize into a separate table with ordering and ranking data.
-- ============================================================
CREATE TABLE profile_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Storage references
    storage_path TEXT NOT NULL,                   -- Supabase Storage path: profile-photos/{profile_id}/{filename}
    public_url TEXT NOT NULL,                     -- Full CDN URL
    firebase_url TEXT,                            -- Original Firebase Storage URL (for fallback/migration)
    
    -- Photo metadata
    display_order INTEGER NOT NULL DEFAULT 0,     -- User-set order
    community_rank INTEGER,                       -- Community-voted rank (1 = best)
    rank_vote_count INTEGER DEFAULT 0,
    is_top_ranked BOOLEAN DEFAULT FALSE,          -- Badge: "Top Ranked Photo"
    is_primary BOOLEAN DEFAULT FALSE,             -- Currently displayed as main photo
    
    -- Moderation
    moderation_status TEXT DEFAULT 'approved' CHECK (moderation_status IN (
        'pending', 'approved', 'rejected', 'flagged'
    )),
    
    -- Image metadata
    width INTEGER,
    height INTEGER,
    file_size_bytes BIGINT,
    mime_type TEXT DEFAULT 'image/jpeg',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add the FK for top_ranked_photo_id now that photos table exists
ALTER TABLE profiles 
    ADD CONSTRAINT fk_top_ranked_photo 
    FOREIGN KEY (top_ranked_photo_id) REFERENCES profile_photos(id) ON DELETE SET NULL;

-- ============================================================
-- TABLE: profile_preferences
-- Source: Firebase RTDB /Users/{uid}/preferences or /Users/{uid}/searchCriteria
-- Firebase stores these as nested JSON on the user object.
-- We extract into a separate table for clean querying.
-- ============================================================
CREATE TABLE profile_preferences (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Age preferences
    preferred_age_min INTEGER DEFAULT 18,
    preferred_age_max INTEGER DEFAULT 99,
    
    -- Location preferences
    preferred_distance_miles INTEGER DEFAULT 50,
    preferred_city TEXT,
    preferred_state TEXT,
    
    -- Demographic preferences (stored as arrays for multi-select)
    preferred_genders TEXT[] DEFAULT '{}',
    preferred_ethnicities TEXT[] DEFAULT '{}',
    preferred_religions TEXT[] DEFAULT '{}',
    preferred_education_levels TEXT[] DEFAULT '{}',
    preferred_income_ranges TEXT[] DEFAULT '{}',
    
    -- Intent compatibility
    preferred_intents TEXT[] DEFAULT '{}',
    
    -- Level preferences
    preferred_min_level INTEGER DEFAULT 6,
    
    -- Lifestyle
    preferred_has_children TEXT DEFAULT 'no_preference' CHECK (preferred_has_children IN (
        'no_preference', 'yes', 'no', 'open_to_it'
    )),
    preferred_wants_children TEXT DEFAULT 'no_preference' CHECK (preferred_wants_children IN (
        'no_preference', 'yes', 'no', 'open_to_it'
    )),
    preferred_smoking TEXT DEFAULT 'no_preference',
    preferred_drinking TEXT DEFAULT 'no_preference',
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: user_groups
-- Source: Firebase RTDB /UsersGroups/{uid}
-- Firebase stores group membership as a map of group_id -> true.
-- We normalize into a proper junction table.
-- ============================================================
CREATE TABLE groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL UNIQUE,
    description TEXT DEFAULT '',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE user_groups (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    group_id UUID NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(profile_id, group_id)
);

### 2.1.2 Messaging Tables

```sql
-- ============================================================
-- TABLE: conversations
-- Source: Derived from Firebase RTDB /Message/{conversationId}
-- Firebase stores messages in a flat list under a conversation
-- key that is typically a concatenation of two user IDs.
-- We create a proper conversations table with participants.
-- ============================================================
CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    firebase_conversation_id TEXT UNIQUE,         -- e.g., "uid1_uid2" for migration mapping
    
    -- Conversation metadata
    conversation_type TEXT DEFAULT 'direct' CHECK (conversation_type IN ('direct', 'group')),
    is_active BOOLEAN DEFAULT TRUE,
    
    -- Denormalized for performance (avoids JOIN on every inbox query)
    last_message_text TEXT,
    last_message_at TIMESTAMPTZ,
    last_message_sender_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: conversation_participants
-- Links profiles to conversations. For direct messages, exactly
-- 2 participants. Supports group conversations for future use.
-- ============================================================
CREATE TABLE conversation_participants (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Per-participant state
    unread_count INTEGER DEFAULT 0,
    is_muted BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    last_read_at TIMESTAMPTZ,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(conversation_id, profile_id)
);

-- ============================================================
-- TABLE: messages
-- Source: Firebase RTDB /Message/{conversationId}/{messageId}
-- Firebase stores each message as a JSON object with sender,
-- text, timestamp, and optionally media references.
-- ============================================================
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    firebase_message_id TEXT,                     -- Original Firebase push key
    
    -- Content
    message_type TEXT DEFAULT 'text' CHECK (message_type IN (
        'text', 'image', 'system', 'connection_request', 'spotlight_notification'
    )),
    body TEXT NOT NULL DEFAULT '',
    media_url TEXT,
    
    -- Delivery state
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMPTZ,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',                  -- Extensible: link previews, reactions, etc.
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.1.3 Connection & Rating Tables

```sql
-- ============================================================
-- TABLE: connections
-- Source: Derived from Firebase RTDB /Users/{uid}/connections or
-- /Users/{uid}/matches and /Users/{uid}/requests
-- Firebase typically stores connections as a nested map on the user.
-- We normalize into a proper junction table with status tracking.
-- ============================================================
CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    requester_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Connection status
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending',          -- M button pressed, waiting for reciprocation
        'mutual',           -- Both pressed M, conversation unlocked
        'declined',         -- Recipient declined
        'expired',          -- Request expired without response
        'unmatched'         -- One party unmatched after mutual connection
    )),
    
    -- Metadata
    requester_rated_at TIMESTAMPTZ,              -- When the M button was pressed
    recipient_responded_at TIMESTAMPTZ,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Prevent duplicate connections in either direction
    CONSTRAINT unique_connection_pair CHECK (requester_id < recipient_id),
    UNIQUE(requester_id, recipient_id)
);

-- ============================================================
-- TABLE: ratings
-- Source: Firebase RTDB /Users/{uid}/ratings or derived from
-- the Discovery level selector interactions (6/7/8/9/M)
-- Each time a user rates another in Discovery, we record it.
-- The Level system uses the most recent 100 ratings per user.
-- ============================================================
CREATE TABLE ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rater_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    rated_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- The rating value (6, 7, 8, 9, or 10 for M)
    rating_value INTEGER NOT NULL CHECK (rating_value >= 1 AND rating_value <= 10),
    is_m_button BOOLEAN DEFAULT FALSE,           -- TRUE when rating_value = 10 (M)
    
    -- Context
    source TEXT DEFAULT 'discovery' CHECK (source IN ('discovery', 'profile_view', 'photo_rank')),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- One rating per rater/rated pair per source
    UNIQUE(rater_id, rated_id, source)
);

-- ============================================================
-- TABLE: photo_rankings
-- Source: Firebase RTDB /Users/{uid}/photoRankings
-- Community votes on photo order. Separate from Level ratings.
-- ============================================================
CREATE TABLE photo_rankings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    voter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    photo_id UUID NOT NULL REFERENCES profile_photos(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,   -- Denormalized for query performance
    
    rank_position INTEGER NOT NULL CHECK (rank_position >= 1),
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(voter_id, photo_id)
);
```

### 2.1.4 Moderation & Reporting Tables

```sql
-- ============================================================
-- TABLE: reports
-- Source: Firebase RTDB /ReportedUsers/
-- Firebase stores reported users as a flat list.
-- We create a proper report tracking system.
-- ============================================================
CREATE TABLE reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    reported_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- Report details
    reason TEXT NOT NULL CHECK (reason IN (
        'fake_profile', 'inappropriate_photos', 'harassment',
        'spam', 'underage', 'offensive_content', 'scam',
        'catfishing', 'other'
    )),
    description TEXT DEFAULT '',
    evidence_urls TEXT[] DEFAULT '{}',
    
    -- Resolution
    status TEXT DEFAULT 'pending' CHECK (status IN (
        'pending', 'reviewing', 'resolved_action_taken',
        'resolved_no_action', 'dismissed'
    )),
    resolved_by TEXT,                             -- Admin user or system
    resolution_notes TEXT DEFAULT '',
    resolved_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: blocks
-- Source: Firebase RTDB /Users/{uid}/blockedUsers
-- ============================================================
CREATE TABLE blocks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    blocker_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(blocker_id, blocked_id)
);
```

### 2.1.5 Subscription & Entitlement Tables

```sql
-- ============================================================
-- TABLE: entitlements
-- NEW: Unified entitlements system (see Section 9 for full design)
-- Combines App Store subscriptions and Stripe purchases into
-- a single source of truth for access control.
-- ============================================================
CREATE TABLE entitlements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    -- What was purchased
    product_id TEXT NOT NULL,                     -- e.g., 'MatchMaker_1_month', 'playbook', 'dating_coach', 'spotlight_1_day'
    product_type TEXT NOT NULL CHECK (product_type IN (
        'subscription',       -- Recurring (App Store or Stripe)
        'one_time',           -- Playbook, Dating Coach
        'consumable'          -- Spotlight
    )),
    
    -- Where it was purchased
    source TEXT NOT NULL CHECK (source IN (
        'app_store',          -- StoreKit IAP
        'stripe',             -- Web Stripe checkout
        'admin_grant',        -- Manual grant by admin
        'promo'               -- Promotional access
    )),
    
    -- Source-specific identifiers
    app_store_transaction_id TEXT,
    app_store_original_transaction_id TEXT,       -- For subscription families
    stripe_session_id TEXT,
    stripe_payment_intent TEXT,
    stripe_subscription_id TEXT,
    
    -- Financial
    amount_cents INTEGER,
    currency TEXT DEFAULT 'USD',
    
    -- Access window
    status TEXT DEFAULT 'active' CHECK (status IN (
        'active', 'expired', 'refunded', 'cancelled',
        'grace_period', 'billing_retry', 'revoked', 'paused'
    )),
    starts_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ,                      -- NULL = lifetime access (e.g., Playbook)
    cancelled_at TIMESTAMPTZ,
    refunded_at TIMESTAMPTZ,
    
    -- Access code (for web products -- Playbook, Dating Coach)
    access_code TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',                  -- App Store receipt data, Stripe metadata, etc.
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: purchases (EXISTING -- already in production Supabase)
-- This table already exists and is used by handle-stripe-webhook.
-- We will keep it as-is and add a migration to populate entitlements
-- from existing purchase records. Eventually, new Stripe purchases
-- will write to BOTH purchases and entitlements.
-- ============================================================
-- purchases table schema (already deployed):
-- id, email, product, stripe_session_id, stripe_payment_intent,
-- amount_cents, access_code, status, created_at, updated_at

-- ============================================================
-- TABLE: checkout_intents (EXISTING -- already in production Supabase)
-- Used by check-eligibility Edge Function for lead capture.
-- No changes needed.
-- ============================================================
-- checkout_intents table schema (already deployed):
-- id, email, product, created_at
```

### 2.1.6 Admin & Configuration Tables

```sql
-- ============================================================
-- TABLE: admin_settings
-- Source: Firebase RTDB /Admin/Settings/
-- Firebase stores global app configuration as a JSON object.
-- We store as key-value pairs for flexibility.
-- ============================================================
CREATE TABLE admin_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key TEXT NOT NULL UNIQUE,
    value JSONB NOT NULL,
    description TEXT DEFAULT '',
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: in_app_content
-- Source: Firebase RTDB /InApp/
-- Dynamic content served to the app (announcements, feature flags, etc.)
-- ============================================================
CREATE TABLE in_app_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    content_type TEXT NOT NULL CHECK (content_type IN (
        'announcement', 'feature_flag', 'promotion',
        'maintenance_notice', 'version_gate'
    )),
    key TEXT NOT NULL UNIQUE,
    title TEXT DEFAULT '',
    body TEXT DEFAULT '',
    payload JSONB DEFAULT '{}',
    
    -- Targeting
    target_platforms TEXT[] DEFAULT '{ios,android,web}',
    target_min_app_version TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    
    starts_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: push_tokens
-- Source: Firebase RTDB /Users/{uid}/fcmToken or similar
-- Stores device push notification tokens for APNs/FCM delivery.
-- ============================================================
CREATE TABLE push_tokens (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    token TEXT NOT NULL,
    platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
    token_type TEXT DEFAULT 'apns' CHECK (token_type IN ('apns', 'fcm', 'web_push')),
    
    is_active BOOLEAN DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(token)
);

-- ============================================================
-- TABLE: notifications
-- Tracks sent notifications for history/debugging.
-- ============================================================
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    recipient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
    
    notification_type TEXT NOT NULL CHECK (notification_type IN (
        'new_message', 'new_connection', 'connection_request',
        'level_update', 'spotlight_started', 'spotlight_ended',
        'subscription_expiring', 'system_announcement',
        'photo_ranking_update', 'profile_view'
    )),
    
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    payload JSONB DEFAULT '{}',
    
    -- Delivery status
    delivered BOOLEAN DEFAULT FALSE,
    delivered_at TIMESTAMPTZ,
    read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: activity_log
-- Tracks user actions for analytics, quality scoring, and
-- abuse detection. Firebase had no equivalent -- this is new.
-- ============================================================
CREATE TABLE activity_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    
    action TEXT NOT NULL,                         -- 'login', 'rate', 'message_sent', 'profile_view', 'photo_upload', etc.
    target_type TEXT,                             -- 'profile', 'message', 'photo', etc.
    target_id UUID,
    
    metadata JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- TABLE: email_lookup
-- Source: Firebase RTDB /UsersEmail/
-- Firebase stores a reverse lookup of email -> uid.
-- In PostgreSQL this is simply an index on profiles.email.
-- We do NOT need a separate table; the UNIQUE index on
-- profiles.email serves the same purpose. This entry is
-- included to document the mapping decision.
-- ============================================================
-- NO TABLE NEEDED: profiles.email has a UNIQUE constraint.
-- Query: SELECT id, firebase_uid FROM profiles WHERE email = $1;
```

### 2.1.7 Indexes

```sql
-- ============================================================
-- INDEXES
-- ============================================================

-- Profiles: Discovery queries filter by gender, age, location, intent, level, status
CREATE INDEX idx_profiles_discovery ON profiles (
    gender, status, level, intent
) WHERE status = 'active' AND deleted_at IS NULL;

CREATE INDEX idx_profiles_location ON profiles USING gist (
    ll_to_earth(latitude, longitude)
) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;
-- Note: Requires earthdistance extension. Alternative:
CREATE INDEX idx_profiles_lat_lng ON profiles (latitude, longitude) 
    WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX idx_profiles_age ON profiles (age) WHERE status = 'active';
CREATE INDEX idx_profiles_email ON profiles (email);
CREATE INDEX idx_profiles_firebase_uid ON profiles (firebase_uid) WHERE firebase_uid IS NOT NULL;
CREATE INDEX idx_profiles_supabase_auth_id ON profiles (supabase_auth_id) WHERE supabase_auth_id IS NOT NULL;
CREATE INDEX idx_profiles_last_active ON profiles (last_active_at DESC) WHERE status = 'active';
CREATE INDEX idx_profiles_quality_score ON profiles (quality_score DESC) WHERE status = 'active';
CREATE INDEX idx_profiles_status ON profiles (status);
CREATE INDEX idx_profiles_level ON profiles (level) WHERE status = 'active';

-- Photos
CREATE INDEX idx_photos_profile_id ON profile_photos (profile_id, display_order);
CREATE INDEX idx_photos_primary ON profile_photos (profile_id) WHERE is_primary = TRUE;

-- Messages: Critical for inbox and conversation loading
CREATE INDEX idx_messages_conversation ON messages (conversation_id, created_at DESC);
CREATE INDEX idx_messages_sender ON messages (sender_id, created_at DESC);
CREATE INDEX idx_messages_unread ON messages (conversation_id, is_read) WHERE is_read = FALSE;

-- Conversations
CREATE INDEX idx_conversations_last_message ON conversations (last_message_at DESC) WHERE is_active = TRUE;

-- Conversation Participants: Must be fast for "get my conversations"
CREATE INDEX idx_conv_participants_profile ON conversation_participants (profile_id, conversation_id);
CREATE INDEX idx_conv_participants_conversation ON conversation_participants (conversation_id, profile_id);

-- Connections
CREATE INDEX idx_connections_requester ON connections (requester_id, status);
CREATE INDEX idx_connections_recipient ON connections (recipient_id, status);
CREATE INDEX idx_connections_status ON connections (status, created_at DESC);
CREATE INDEX idx_connections_mutual ON connections (status) WHERE status = 'mutual';

-- Ratings: Level calculation needs recent 100 per rated user
CREATE INDEX idx_ratings_rated ON ratings (rated_id, created_at DESC);
CREATE INDEX idx_ratings_rater ON ratings (rater_id, created_at DESC);

-- Entitlements: Access checks must be fast
CREATE INDEX idx_entitlements_profile ON entitlements (profile_id, status);
CREATE INDEX idx_entitlements_active ON entitlements (profile_id, product_id, status) 
    WHERE status IN ('active', 'grace_period');
CREATE INDEX idx_entitlements_app_store ON entitlements (app_store_original_transaction_id) 
    WHERE app_store_original_transaction_id IS NOT NULL;
CREATE INDEX idx_entitlements_stripe ON entitlements (stripe_session_id) 
    WHERE stripe_session_id IS NOT NULL;

-- Reports
CREATE INDEX idx_reports_reported ON reports (reported_id, status);
CREATE INDEX idx_reports_pending ON reports (status, created_at) WHERE status = 'pending';

-- Push tokens
CREATE INDEX idx_push_tokens_profile ON push_tokens (profile_id) WHERE is_active = TRUE;

-- Notifications
CREATE INDEX idx_notifications_recipient ON notifications (recipient_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON notifications (recipient_id) WHERE read = FALSE;

-- Activity log: Partitioned by month for performance at scale
CREATE INDEX idx_activity_profile ON activity_log (profile_id, created_at DESC);
CREATE INDEX idx_activity_action ON activity_log (action, created_at DESC);

-- Photo rankings
CREATE INDEX idx_photo_rankings_photo ON photo_rankings (photo_id);
CREATE INDEX idx_photo_rankings_profile ON photo_rankings (profile_id);

-- Blocks
CREATE INDEX idx_blocks_blocker ON blocks (blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks (blocked_id);
CREATE INDEX idx_blocks_pair ON blocks (blocker_id, blocked_id);

-- User groups
CREATE INDEX idx_user_groups_profile ON user_groups (profile_id);
CREATE INDEX idx_user_groups_group ON user_groups (group_id);
```

## 2.2 Firebase to Supabase Data Mapping

Complete mapping of every Firebase RTDB node to its corresponding Supabase table(s):

| Firebase RTDB Path | Supabase Table(s) | Transformation Notes |
|--------------------|--------------------|---------------------|
| `/Users/{uid}` (root fields) | `profiles` | Flatten nested JSON. Map `uid` to `firebase_uid`. Extract demographics, location, bio fields. |
| `/Users/{uid}/photos` | `profile_photos` | Each photo entry becomes a row. Download from Firebase Storage, re-upload to Supabase Storage, update URLs. |
| `/Users/{uid}/preferences` | `profile_preferences` | Extract nested preference object into typed columns. |
| `/Users/{uid}/connections` | `connections` | Denormalized map of `{otherUid: {status, timestamp}}` becomes rows in connections table. Deduplicate reciprocal entries. |
| `/Users/{uid}/blockedUsers` | `blocks` | Map of `{otherUid: true}` becomes rows. |
| `/Users/{uid}/fcmToken` | `push_tokens` | Single token string becomes a row with platform metadata. |
| `/Users/{uid}/ratings` | `ratings` | Nested rating data extracted into individual rating rows. |
| `/Users/{uid}/photoRankings` | `photo_rankings` | Community ranking votes extracted into rows. |
| `/Message/{conversationId}` | `conversations`, `conversation_participants`, `messages` | The conversation ID (typically `uid1_uid2`) is parsed to create conversation + 2 participants. Each child message becomes a `messages` row. |
| `/ReportedUsers/{reportId}` | `reports` | Each report entry mapped to a report row with structured reason codes. |
| `/UsersEmail/{email}` | *No table needed* | This reverse lookup is replaced by the UNIQUE index on `profiles.email`. |
| `/UsersGroups/{uid}` | `user_groups` | Map of `{groupId: true}` for each user becomes junction table rows. Distinct group IDs populate the `groups` table. |
| `/Admin/Settings/` | `admin_settings` | Each key-value pair becomes a row. Complex nested values stored as JSONB. |
| `/InApp/` | `in_app_content` | Dynamic app content mapped to typed rows with targeting fields. |

## 2.3 Normalization Decisions

The following summarizes what gets split from the denormalized Firebase JSON into proper relational tables and why:

| Firebase Structure | Normalization Decision | Rationale |
|-------------------|----------------------|-----------|
| User object with 50+ fields | Split into `profiles` (core), `profile_preferences` (search), `profile_photos` (media) | Separating concerns enables targeted queries. Discovery does not need preferences; profile view does not need every demographic. |
| Messages as flat list under conversation key | Split into `conversations`, `conversation_participants`, `messages` | Enables efficient inbox queries, unread counts, and conversation-level metadata without scanning all messages. |
| Connections stored on each user (duplicated) | Single `connections` table with requester/recipient | Eliminates data duplication. Firebase required writing to both users; PostgreSQL uses a single row with a CHECK constraint ensuring consistent ordering. |
| Ratings stored per user | Separate `ratings` table | Enables aggregate queries, percentile calculations, and rolling-window Level computation in SQL rather than client-side. |
| Email-to-UID lookup table | Replaced by UNIQUE index on `profiles.email` | PostgreSQL indexes serve the same purpose natively. No separate table needed. |
| Group membership on user object | Junction table `user_groups` | Standard many-to-many normalization. Enables group-level queries without scanning all users. |
| FCM token as string on user | Separate `push_tokens` table | Supports multiple devices per user and multiple token types (APNs, FCM, web push). |

---

# 3. Migration Approach

## 3.1 Recommended Strategy: Phased Migration with Maintenance Window Cutover

The recommended approach is a **phased migration** with a single **2-4 hour maintenance window** for the production cutover. This strategy minimizes risk by validating each phase independently before proceeding to the next.

**Why not a gradual/rolling migration?**
- The iOS app is a single binary; it either talks to Firebase or Supabase, not both simultaneously for the same data
- With under 50 paid subscribers, the impact of a short maintenance window is minimal
- A clean cutover eliminates the complexity of dual-write synchronization
- Firebase can remain read-only as a safety net without needing real-time sync

## 3.2 Phase 0: Preparation (2 weeks)

### Week 1: Infrastructure & Schema

**Step 0.1: Create Supabase staging environment**
```bash
# Create a separate Supabase project for staging
# Use the Supabase dashboard or CLI
supabase projects create matchmakers-staging --region us-east-1
```

**Step 0.2: Deploy database schema to staging**
- Execute all SQL from Section 2.1 against the staging database
- Verify all tables, constraints, indexes, and extensions are created correctly
- Run `\dt` and `\di` in psql to confirm

**Step 0.3: Deploy Row Level Security policies to staging**
- Apply all RLS policies from Section 8.5
- Test with service role key (bypasses RLS) and anon key (enforces RLS)

**Step 0.4: Deploy Edge Functions to staging**
- Update existing Edge Functions (coach-proxy, check-eligibility, handle-stripe-webhook)
- Deploy new Edge Functions (verify-app-store-receipt, send-push-notification, calculate-levels)
- Test each function independently

**Step 0.5: Create Firebase export scripts**
```javascript
// firebase-export.js
// Node.js script to export all Firebase RTDB data to JSON files
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize with service account
admin.initializeApp({
    credential: admin.credential.cert('./matchmakers-live-service-account.json'),
    databaseURL: 'https://matchmakers-live-default-rtdb.firebaseio.com'
});

const db = admin.database();
const OUTPUT_DIR = './firebase-export';

async function exportNode(nodePath, filename) {
    console.log(`Exporting ${nodePath}...`);
    const snapshot = await db.ref(nodePath).once('value');
    const data = snapshot.val();
    
    if (!data) {
        console.log(`  ${nodePath} is empty, skipping`);
        return null;
    }
    
    const filepath = path.join(OUTPUT_DIR, filename);
    fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
    
    const count = typeof data === 'object' ? Object.keys(data).length : 1;
    console.log(`  Exported ${count} records to ${filename}`);
    return data;
}

async function main() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    
    // Export each top-level node
    await exportNode('Users', 'users.json');
    await exportNode('Message', 'messages.json');
    await exportNode('ReportedUsers', 'reported_users.json');
    await exportNode('UsersEmail', 'users_email.json');
    await exportNode('UsersGroups', 'users_groups.json');
    await exportNode('Admin/Settings', 'admin_settings.json');
    await exportNode('InApp', 'in_app.json');
    
    console.log('\nExport complete. Files written to:', OUTPUT_DIR);
    process.exit(0);
}

main().catch(err => {
    console.error('Export failed:', err);
    process.exit(1);
});
```

**Step 0.6: Export Firebase Auth users**
```bash
# Use Firebase CLI to export auth users
firebase auth:export firebase-export/auth_users.json --format=json --project matchmakers-live
```

This exports user records including:
- UID
- Email
- Password hash (bcrypt)
- Password salt
- Creation timestamp
- Last sign-in timestamp
- Disabled status

**Step 0.7: Full Firebase RTDB backup**
```bash
# Create a manual backup via Firebase console or REST API
curl -o firebase-export/full_backup.json \
  "https://matchmakers-live-default-rtdb.firebaseio.com/.json?auth=YOUR_DATABASE_SECRET"
```

### Week 2: Transformation Scripts & Testing

**Step 0.8: Build data transformation pipeline**

```javascript
// transform-users.js
// Transforms Firebase user JSON into Supabase-compatible INSERT statements
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const users = JSON.parse(fs.readFileSync('./firebase-export/users.json', 'utf8'));
const output = [];
const photoOutput = [];
const preferenceOutput = [];

// Map of firebase_uid -> new UUID for foreign key resolution
const uidMap = {};

for (const [firebaseUid, userData] of Object.entries(users)) {
    const profileId = uuidv4();
    uidMap[firebaseUid] = profileId;
    
    // Handle schema drift: field names may vary across 7 years of data
    const email = (
        userData.email || 
        userData.Email || 
        userData.emailAddress || 
        ''
    ).toLowerCase().trim();
    
    if (!email || !email.includes('@')) {
        console.warn(`Skipping user ${firebaseUid}: no valid email`);
        continue;
    }
    
    const displayName = userData.displayName || userData.name || userData.Name || '';
    const firstName = userData.firstName || userData.first_name || displayName.split(' ')[0] || '';
    const lastName = userData.lastName || userData.last_name || displayName.split(' ').slice(1).join(' ') || '';
    
    // Normalize intent values (Firebase may have inconsistent casing/naming)
    let intent = (userData.intent || userData.Intent || userData.lookingFor || 'not_sure').toLowerCase();
    const intentMap = {
        'long term': 'long_term',
        'longterm': 'long_term',
        'long-term': 'long_term',
        'marriage': 'marriage',
        'fall in love': 'fall_in_love',
        'fallinlove': 'fall_in_love',
        'short term': 'short_term',
        'shortterm': 'short_term',
        'short-term': 'short_term',
        'casual': 'casual',
        'physical': 'physical',
        'virtual': 'virtual',
        'friends': 'friends',
        'not sure': 'not_sure',
        'notsure': 'not_sure',
        'unsure': 'not_sure',
    };
    intent = intentMap[intent] || 'not_sure';
    
    // Normalize gender
    let gender = (userData.gender || userData.Gender || '').toLowerCase();
    const genderMap = {
        'm': 'male', 'male': 'male', 'man': 'male',
        'f': 'female', 'female': 'female', 'woman': 'female',
        'nb': 'non-binary', 'non-binary': 'non-binary', 'nonbinary': 'non-binary',
    };
    gender = genderMap[gender] || 'other';
    
    const profile = {
        id: profileId,
        firebase_uid: firebaseUid,
        email: email,
        display_name: displayName,
        first_name: firstName,
        last_name: lastName,
        phone: userData.phone || userData.phoneNumber || '',
        bio: userData.bio || userData.Bio || userData.about || '',
        about_me: userData.aboutMe || userData.about_me || userData.description || '',
        city: userData.city || userData.City || '',
        state: userData.state || userData.State || '',
        zip_code: userData.zipCode || userData.zip || userData.postalCode || '',
        latitude: parseFloat(userData.latitude || userData.lat) || null,
        longitude: parseFloat(userData.longitude || userData.lng || userData.lon) || null,
        age: parseInt(userData.age || userData.Age) || null,
        date_of_birth: userData.dateOfBirth || userData.dob || userData.birthday || null,
        gender: gender,
        height_inches: parseInt(userData.height || userData.heightInches) || null,
        ethnicity: userData.ethnicity || userData.race || '',
        religion: userData.religion || userData.Religion || '',
        politics: userData.politics || userData.politicalViews || '',
        education: userData.education || userData.Education || '',
        occupation: userData.occupation || userData.job || userData.work || '',
        income_range: userData.incomeRange || userData.income || '',
        intent: intent,
        level: parseInt(userData.level || userData.Level) || 6,
        level_rating_count: parseInt(userData.ratingCount || userData.levelRatingCount) || 0,
        status: userData.isBanned ? 'banned' : (userData.isActive === false ? 'inactive' : 'active'),
        is_verified: userData.isVerified || false,
        is_premium: userData.isPremium || userData.isSubscribed || false,
        migrated_from_firebase: true,
        firebase_raw_json: JSON.stringify(userData),
        created_at: userData.createdAt ? new Date(userData.createdAt).toISOString() : new Date().toISOString(),
        last_active_at: userData.lastActive ? new Date(userData.lastActive).toISOString() : null,
        last_login_at: userData.lastLogin ? new Date(userData.lastLogin).toISOString() : null,
    };
    
    output.push(profile);
    
    // Extract photos
    const photos = userData.photos || userData.Photos || userData.profilePhotos || [];
    const photoArray = Array.isArray(photos) ? photos : Object.values(photos);
    
    photoArray.forEach((photo, index) => {
        const photoUrl = typeof photo === 'string' ? photo : (photo.url || photo.imageUrl || photo.downloadUrl || '');
        if (!photoUrl) return;
        
        photoOutput.push({
            id: uuidv4(),
            profile_id: profileId,
            firebase_url: photoUrl,
            storage_path: `profile-photos/${profileId}/${index}.jpg`,
            public_url: '', // Will be set after media migration
            display_order: index,
            is_primary: index === 0,
            community_rank: typeof photo === 'object' ? (photo.rank || null) : null,
            rank_vote_count: typeof photo === 'object' ? (photo.rankCount || 0) : 0,
            created_at: new Date().toISOString(),
        });
    });
    
    // Extract preferences
    const prefs = userData.preferences || userData.searchCriteria || userData.filters || {};
    if (Object.keys(prefs).length > 0) {
        preferenceOutput.push({
            id: uuidv4(),
            profile_id: profileId,
            preferred_age_min: parseInt(prefs.ageMin || prefs.minAge) || 18,
            preferred_age_max: parseInt(prefs.ageMax || prefs.maxAge) || 99,
            preferred_distance_miles: parseInt(prefs.distance || prefs.maxDistance) || 50,
            preferred_genders: Array.isArray(prefs.genders) ? prefs.genders : 
                (prefs.gender ? [prefs.gender] : []),
        });
    }
}

// Write UID mapping for use by other transformation scripts
fs.writeFileSync('./firebase-export/uid_map.json', JSON.stringify(uidMap, null, 2));
fs.writeFileSync('./firebase-export/transformed_profiles.json', JSON.stringify(output, null, 2));
fs.writeFileSync('./firebase-export/transformed_photos.json', JSON.stringify(photoOutput, null, 2));
fs.writeFileSync('./firebase-export/transformed_preferences.json', JSON.stringify(preferenceOutput, null, 2));

console.log(`Transformed ${output.length} profiles`);
console.log(`Transformed ${photoOutput.length} photos`);
console.log(`Transformed ${preferenceOutput.length} preference sets`);
```

```javascript
// transform-messages.js
// Transforms Firebase message data into Supabase-compatible format
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const messages = JSON.parse(fs.readFileSync('./firebase-export/messages.json', 'utf8'));
const uidMap = JSON.parse(fs.readFileSync('./firebase-export/uid_map.json', 'utf8'));

const conversationOutput = [];
const participantOutput = [];
const messageOutput = [];

for (const [conversationId, messageData] of Object.entries(messages)) {
    // Parse participant UIDs from conversation ID
    // Firebase typically uses "uid1_uid2" format, but may vary
    const parts = conversationId.split('_');
    let participantUids = [];
    
    if (parts.length === 2 && uidMap[parts[0]] && uidMap[parts[1]]) {
        participantUids = parts;
    } else {
        // Try to extract from message senders
        const senders = new Set();
        if (typeof messageData === 'object') {
            for (const msg of Object.values(messageData)) {
                if (msg.sender || msg.senderId || msg.from) {
                    senders.add(msg.sender || msg.senderId || msg.from);
                }
            }
        }
        participantUids = Array.from(senders).filter(uid => uidMap[uid]);
    }
    
    if (participantUids.length < 2) {
        console.warn(`Skipping conversation ${conversationId}: cannot determine participants`);
        continue;
    }
    
    const convId = uuidv4();
    
    // Process messages
    const msgEntries = typeof messageData === 'object' ? Object.entries(messageData) : [];
    let lastMsgText = '';
    let lastMsgAt = null;
    let lastMsgSenderId = null;
    
    for (const [msgId, msg] of msgEntries) {
        if (!msg || typeof msg !== 'object') continue;
        
        const senderFirebaseUid = msg.sender || msg.senderId || msg.from;
        const senderProfileId = uidMap[senderFirebaseUid];
        if (!senderProfileId) continue;
        
        const text = msg.text || msg.message || msg.body || msg.content || '';
        const timestamp = msg.timestamp || msg.createdAt || msg.time;
        const createdAt = timestamp ? new Date(
            typeof timestamp === 'number' ? timestamp : Date.parse(timestamp)
        ).toISOString() : new Date().toISOString();
        
        messageOutput.push({
            id: uuidv4(),
            conversation_id: convId,
            sender_id: senderProfileId,
            firebase_message_id: msgId,
            message_type: msg.imageUrl || msg.mediaUrl ? 'image' : 'text',
            body: text,
            media_url: msg.imageUrl || msg.mediaUrl || null,
            is_read: msg.isRead || msg.read || false,
            created_at: createdAt,
        });
        
        // Track last message for conversation denormalization
        const msgDate = new Date(createdAt);
        if (!lastMsgAt || msgDate > new Date(lastMsgAt)) {
            lastMsgText = text.substring(0, 200);
            lastMsgAt = createdAt;
            lastMsgSenderId = senderProfileId;
        }
    }
    
    conversationOutput.push({
        id: convId,
        firebase_conversation_id: conversationId,
        conversation_type: 'direct',
        is_active: true,
        last_message_text: lastMsgText,
        last_message_at: lastMsgAt,
        last_message_sender_id: lastMsgSenderId,
        created_at: lastMsgAt || new Date().toISOString(),
    });
    
    // Create participant entries
    for (const uid of participantUids.slice(0, 2)) {
        const profileId = uidMap[uid];
        if (!profileId) continue;
        
        participantOutput.push({
            id: uuidv4(),
            conversation_id: convId,
            profile_id: profileId,
            unread_count: 0,
            joined_at: lastMsgAt || new Date().toISOString(),
        });
    }
}

fs.writeFileSync('./firebase-export/transformed_conversations.json', JSON.stringify(conversationOutput, null, 2));
fs.writeFileSync('./firebase-export/transformed_participants.json', JSON.stringify(participantOutput, null, 2));
fs.writeFileSync('./firebase-export/transformed_messages.json', JSON.stringify(messageOutput, null, 2));

console.log(`Transformed ${conversationOutput.length} conversations`);
console.log(`Transformed ${participantOutput.length} participant entries`);
console.log(`Transformed ${messageOutput.length} messages`);
```

**Step 0.9: Dry-run import to staging**
- Load all transformed data into the staging Supabase project
- Run validation queries (Section 12.2)
- Fix any transformation bugs
- Repeat until clean

**Step 0.10: Build and test iOS app against staging**
- Update the app to use SupabaseManager (Section 6) pointing to staging
- Verify all features work: profiles, messaging, connections, ratings, push, subscriptions, spotlight
- Fix any issues found during testing

## 3.3 Phase 1: Data Export & Transformation (1 week)

This phase executes the tested scripts against the live Firebase data, producing the final data set for import.

**Step 1.1: Final Firebase data export**
- Run `firebase-export.js` against production
- Run `firebase auth:export` against production
- Store exports in a versioned, encrypted backup location

**Step 1.2: Run transformation pipeline**
- Execute all `transform-*.js` scripts
- Generate SQL insert files or use the Supabase client library for bulk inserts

**Step 1.3: Export Firebase Storage media**
```bash
# Download all profile images from Firebase Storage
# Using gsutil (Firebase Storage is backed by Google Cloud Storage)
gsutil -m cp -r gs://matchmakers-live.appspot.com/profile_images ./firebase-export/media/

# Or use the Firebase Storage REST API if gsutil is not configured
# This script downloads each photo URL from the transformed data
node download-firebase-media.js
```

**Step 1.4: Upload media to Supabase Storage**
```javascript
// upload-media.js
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const photos = JSON.parse(fs.readFileSync('./firebase-export/transformed_photos.json', 'utf8'));
const MEDIA_DIR = './firebase-export/media';

async function uploadAll() {
    let uploaded = 0;
    let failed = 0;
    
    for (const photo of photos) {
        // Determine local file path from Firebase URL
        const localPath = resolveLocalPath(photo.firebase_url, MEDIA_DIR);
        if (!localPath || !fs.existsSync(localPath)) {
            console.warn(`File not found for ${photo.firebase_url}`);
            failed++;
            continue;
        }
        
        const fileBuffer = fs.readFileSync(localPath);
        const { data, error } = await supabase.storage
            .from('profile-photos')
            .upload(photo.storage_path, fileBuffer, {
                contentType: photo.mime_type || 'image/jpeg',
                upsert: true,
            });
        
        if (error) {
            console.error(`Upload failed for ${photo.storage_path}:`, error.message);
            failed++;
            continue;
        }
        
        // Get public URL
        const { data: urlData } = supabase.storage
            .from('profile-photos')
            .getPublicUrl(photo.storage_path);
        
        photo.public_url = urlData.publicUrl;
        uploaded++;
        
        if (uploaded % 100 === 0) {
            console.log(`Uploaded ${uploaded} photos...`);
        }
    }
    
    // Write updated photo data with public URLs
    fs.writeFileSync(
        './firebase-export/transformed_photos_with_urls.json',
        JSON.stringify(photos, null, 2)
    );
    
    console.log(`Upload complete: ${uploaded} succeeded, ${failed} failed`);
}

function resolveLocalPath(firebaseUrl, mediaDir) {
    // Extract the file path from the Firebase Storage URL
    // Firebase URLs look like:
    // https://firebasestorage.googleapis.com/v0/b/matchmakers-live.appspot.com/o/profile_images%2F{uid}%2F{filename}
    try {
        const url = new URL(firebaseUrl);
        const encodedPath = url.pathname.split('/o/')[1];
        if (!encodedPath) return null;
        const decodedPath = decodeURIComponent(encodedPath.split('?')[0]);
        return path.join(mediaDir, decodedPath);
    } catch {
        return null;
    }
}

uploadAll().catch(console.error);
```

**Step 1.5: Validate transformed data**
- Count records: Firebase user count must match Supabase profile count (minus intentionally skipped records)
- Spot-check 50 random profiles: compare Firebase JSON to Supabase row
- Verify all conversations have exactly 2 participants
- Verify all messages reference valid conversations and senders
- Verify all photos have valid public_urls

**Step 1.6: Load data into production Supabase (pre-cutover)**
- Import profiles, photos, preferences, conversations, messages, connections, ratings, reports, groups, settings, in-app content
- Do NOT yet switch the iOS app to point to Supabase
- This data will be slightly stale by cutover time; a delta sync will handle it

## 3.4 Phase 2: Cutover (2-4 hours maintenance window)

### Pre-Cutover Checklist (T-24 hours)
- [ ] All data loaded into production Supabase
- [ ] iOS app update with SupabaseManager submitted to App Store (or available via TestFlight)
- [ ] All Edge Functions deployed and tested in production
- [ ] RLS policies verified
- [ ] Rollback plan documented and tested
- [ ] Support team briefed
- [ ] Maintenance page ready for website
- [ ] Push notification sent to users 24 hours before: "MatchMakers is upgrading tonight from [time] to [time]. You may be logged out -- just sign back in."

### Cutover Steps

**T-0: Begin maintenance window**

```
Step 2.1: Enable maintenance mode
- Deploy maintenance page to matchmakersusa.com
- Set Firebase RTDB rules to read-only:
  {
    "rules": {
      ".read": true,
      ".write": false
    }
  }
- This prevents any new writes to Firebase during migration

Step 2.2: Delta data sync (15-30 minutes)
- Export Firebase data again (delta since Phase 1 export)
- Run transformation on delta records only
- Upsert delta records into Supabase
- Focus on: new messages, new users, updated profiles, new connections

Step 2.3: Import Firebase Auth users into Supabase Auth (30-60 minutes)
- Execute the auth migration script (Section 4)
- Verify user count matches
- Test login with 5 known test accounts

Step 2.4: Verify data integrity (15-30 minutes)
- Run validation queries (Section 12.2)
- Compare record counts between Firebase and Supabase
- Spot-check critical data: active subscribers, recent messages

Step 2.5: Switch DNS / API endpoints (5 minutes)
- No DNS change needed if iOS app is using Supabase URL directly
- Update website API calls from Firebase to Supabase (already done for web)
- Ensure Edge Functions are handling traffic

Step 2.6: Deploy iOS app update (0 minutes -- pre-submitted)
- Enable the new app version in App Store Connect
- Users will get the update on next app launch
- Force-update mechanism via in_app_content table:
  INSERT INTO in_app_content (content_type, key, title, body, payload)
  VALUES ('version_gate', 'force_update', 'Update Required',
    'A new version of MatchMakers is available. Please update to continue.',
    '{"min_version": "X.Y.Z", "store_url": "https://apps.apple.com/app/matchmakers/idXXXXXXXXX"}');

Step 2.7: Smoke test all critical paths (30-45 minutes)
- Test user login (existing account)
- Test profile view and edit
- Test Discovery (browsing profiles, rating)
- Test M button (connection request)
- Test messaging (send and receive)
- Test push notifications
- Test subscription status check
- Test Spotlight purchase
- Test Playbook/Dating Coach access verification

Step 2.8: Disable maintenance mode
- Remove maintenance page from website
- Firebase remains read-only (safety net)
- Monitor error logs actively
```

**T+2-4h: Maintenance window ends**

## 3.5 Phase 3: Validation & Monitoring (2 weeks)

**Step 3.1: Active monitoring (Days 1-3)**
- Monitor Supabase dashboard: query performance, error rates, connection count
- Monitor Edge Function logs for errors
- Monitor iOS app crash reports (Crashlytics continues to work independently of data migration)
- Check user support tickets for migration-related issues
- Run daily data integrity checks

**Step 3.2: Issue triage (Days 1-7)**
- P0 (data loss, auth failure, messaging broken): Fix immediately, consider rollback
- P1 (feature degraded but usable): Fix within 24 hours
- P2 (cosmetic, non-blocking): Queue for next release

**Step 3.3: Firebase read-only fallback usage (Days 1-14)**
- If any data discrepancy is found, cross-reference with Firebase read-only data
- If critical data was missed, run a targeted delta import
- Document any discrepancies for post-mortem

**Step 3.4: Performance baseline (Days 7-14)**
- Establish baseline metrics for query response times
- Identify any slow queries and optimize
- Verify real-time messaging latency meets expectations

## 3.6 Phase 4: Decommission Firebase (4+ weeks after cutover)

**Step 4.1: Monitor Firebase read traffic**
- After 2 weeks with no Firebase reads from production code, proceed
- If any client is still reading Firebase, investigate (old app version?)

**Step 4.2: Downgrade Firebase plan**
- Switch from Blaze to Spark (free) plan
- This eliminates ongoing Firebase costs
- Keep the project active for emergency data access

**Step 4.3: Archive Firebase data**
- Create final full export of Firebase RTDB and Storage
- Store in long-term archive (Google Cloud Storage, Coldline tier)

**Step 4.4: Remove Firebase SDKs from iOS app (future release)**
- Remove FirebaseManager.swift entirely
- Remove Firebase pod dependencies
- Remove GoogleService-Info.plist
- This reduces app binary size and eliminates Firebase SDK network calls

**Step 4.5: Delete Firebase project (optional, 6+ months post-migration)**
- Only after confirming zero dependencies remain
- Final archive backup before deletion

---

# 4. Authentication Migration

## 4.1 Firebase Auth to Supabase Auth

Firebase Auth stores user credentials including bcrypt-hashed passwords. Supabase Auth (GoTrue) supports importing users with pre-existing bcrypt hashes, making password migration seamless.

**Key fact:** Users will NOT need to reset their passwords. Supabase can verify bcrypt hashes from Firebase directly.

## 4.2 Auth User Import Process

```javascript
// import-auth-users.js
// Imports Firebase Auth users into Supabase Auth with password hashes preserved
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Firebase auth export format
const authExport = JSON.parse(fs.readFileSync('./firebase-export/auth_users.json', 'utf8'));
const users = authExport.users || authExport;

// UID map from profile transformation
const uidMap = JSON.parse(fs.readFileSync('./firebase-export/uid_map.json', 'utf8'));

async function importAuthUsers() {
    let imported = 0;
    let skipped = 0;
    let failed = 0;
    const authIdMap = {}; // firebase_uid -> supabase_auth_id

    for (const user of users) {
        const email = (user.email || '').toLowerCase().trim();
        if (!email) {
            skipped++;
            continue;
        }

        // Firebase exports password hash info in these fields:
        // user.passwordHash (base64-encoded bcrypt hash)
        // user.salt (base64-encoded salt, already embedded in bcrypt hash)
        
        try {
            // Use Supabase Admin API to create user with existing password hash
            // The GoTrue admin API supports importing bcrypt hashes directly
            const response = await fetch(
                `${process.env.SUPABASE_URL}/auth/v1/admin/users`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                        'Content-Type': 'application/json',
                        'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                    },
                    body: JSON.stringify({
                        email: email,
                        email_confirm: true,  // Mark email as confirmed (they were already using the account)
                        password_hash: user.passwordHash,  // bcrypt hash from Firebase
                        // GoTrue expects the hash in the format: $2a$10$... (standard bcrypt)
                        // Firebase stores it as base64; decode if needed
                        user_metadata: {
                            firebase_uid: user.localId,
                            display_name: user.displayName || '',
                            migrated_from_firebase: true,
                        },
                        app_metadata: {
                            provider: 'email',
                            providers: ['email'],
                        },
                    }),
                }
            );

            if (!response.ok) {
                const error = await response.json();
                // Handle duplicate email (user may already exist in Supabase from web signups)
                if (error.msg && error.msg.includes('already been registered')) {
                    // Look up existing Supabase user
                    const lookupResponse = await fetch(
                        `${process.env.SUPABASE_URL}/auth/v1/admin/users?filter=email:${encodeURIComponent(email)}`,
                        {
                            headers: {
                                'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                                'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                            },
                        }
                    );
                    const lookupData = await lookupResponse.json();
                    if (lookupData.users && lookupData.users.length > 0) {
                        authIdMap[user.localId] = lookupData.users[0].id;
                        // Update the existing user's metadata to include Firebase UID
                        await fetch(
                            `${process.env.SUPABASE_URL}/auth/v1/admin/users/${lookupData.users[0].id}`,
                            {
                                method: 'PUT',
                                headers: {
                                    'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
                                    'Content-Type': 'application/json',
                                    'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
                                },
                                body: JSON.stringify({
                                    user_metadata: {
                                        ...lookupData.users[0].user_metadata,
                                        firebase_uid: user.localId,
                                        migrated_from_firebase: true,
                                    },
                                }),
                            }
                        );
                        imported++;
                        continue;
                    }
                }
                console.error(`Failed to import ${email}:`, error);
                failed++;
                continue;
            }

            const data = await response.json();
            authIdMap[user.localId] = data.id;
            imported++;

            if (imported % 100 === 0) {
                console.log(`Imported ${imported} auth users...`);
            }
        } catch (err) {
            console.error(`Error importing ${email}:`, err.message);
            failed++;
        }
    }

    // Write auth ID mapping
    fs.writeFileSync('./firebase-export/auth_id_map.json', JSON.stringify(authIdMap, null, 2));
    
    // Update profiles table with supabase_auth_id
    for (const [firebaseUid, supabaseAuthId] of Object.entries(authIdMap)) {
        const profileId = uidMap[firebaseUid];
        if (!profileId) continue;
        
        const { error } = await supabase
            .from('profiles')
            .update({ supabase_auth_id: supabaseAuthId })
            .eq('id', profileId);
        
        if (error) {
            console.error(`Failed to link auth for profile ${profileId}:`, error);
        }
    }

    console.log(`\nAuth import complete: ${imported} imported, ${skipped} skipped, ${failed} failed`);
}

importAuthUsers().catch(console.error);
```

## 4.3 Password Hash Format Handling

Firebase Auth uses scrypt (not bcrypt) for password hashing by default. The hash parameters are included in the Firebase Auth export:

```json
{
  "hash_config": {
    "algorithm": "SCRYPT",
    "base64_signer_key": "...",
    "base64_salt_separator": "...",
    "rounds": 8,
    "mem_cost": 14
  }
}
```

**Supabase GoTrue supports the following hash import strategies:**

1. **Direct hash import (recommended):** Supabase GoTrue supports importing Firebase scrypt hashes. The admin API accepts the hash, salt, and hash parameters. When the user logs in, GoTrue verifies against the imported hash, then re-hashes with bcrypt for future logins.

2. **Force password reset (fallback):** If hash import is not viable, trigger a password reset email for all users on first login attempt. This is less ideal because it creates friction.

**Implementation for Firebase scrypt:**

```javascript
// The Firebase auth export includes per-user:
// user.passwordHash: base64 encoded scrypt hash
// user.salt: base64 encoded salt

// Supabase GoTrue admin API body for Firebase scrypt import:
const body = {
    email: email,
    email_confirm: true,
    password_hash: `firebase-scrypt:hash=${user.passwordHash}:salt=${user.salt}`,
    // GoTrue recognizes the firebase-scrypt prefix and uses the project's
    // hash_config to verify. The hash_config must be set in GoTrue config:
    // GOTRUE_PASSWORD_HASH_CONFIG='{"firebase":{"signer_key":"...","salt_separator":"...","rounds":8,"mem_cost":14}}'
};
```

**Required Supabase configuration:**

Set the following environment variable in the Supabase project settings (Auth > Configuration > Advanced):

```
GOTRUE_PASSWORD_HASH_CONFIG={"firebase":{"signer_key":"BASE64_SIGNER_KEY","salt_separator":"BASE64_SALT_SEPARATOR","rounds":8,"mem_cost":14}}
```

The signer_key and salt_separator values come from the Firebase Auth export's `hash_config` section.

## 4.4 Session Continuity Plan

**Scenario:** User has the old (Firebase) version of the app, opens it, and gets the update prompt. They update to the new (Supabase) version. What happens?

**Flow:**

1. Old app version stores Firebase Auth tokens in iOS Keychain
2. New app version ships with SupabaseManager that uses Supabase Auth
3. On first launch of the new version:
   a. Check for stored Firebase Auth token in Keychain
   b. If found, extract the email from the token (JWT decode)
   c. Attempt automatic Supabase sign-in using the stored email + password from Keychain (if saved via iOS AutoFill)
   d. If AutoFill password is not available, show a "Welcome back" login screen pre-filled with the email
   e. On successful login, clear the Firebase Auth token from Keychain
   f. Store the Supabase session token

**Swift pseudocode for session migration:**

```swift
// SessionMigrationManager.swift
import Foundation
import Supabase

class SessionMigrationManager {
    
    private let supabase: SupabaseClient
    
    init(supabase: SupabaseClient) {
        self.supabase = supabase
    }
    
    /// Check if user has a legacy Firebase session and attempt migration
    func attemptSessionMigration() async -> Bool {
        // Check for Firebase auth token in Keychain
        guard let firebaseToken = KeychainHelper.read(key: "firebase_auth_token") else {
            return false // No legacy session
        }
        
        // Decode the Firebase JWT to extract email
        guard let email = decodeFirebaseJWT(firebaseToken)?.email else {
            // Token is unreadable; clear it and require fresh login
            KeychainHelper.delete(key: "firebase_auth_token")
            return false
        }
        
        // Check if iOS Keychain has a saved password (via AutoFill)
        if let savedPassword = KeychainHelper.readPassword(forEmail: email) {
            do {
                // Attempt Supabase sign-in with saved credentials
                try await supabase.auth.signIn(
                    email: email,
                    password: savedPassword
                )
                // Success: clean up Firebase token
                KeychainHelper.delete(key: "firebase_auth_token")
                return true
            } catch {
                // Password may have been different; fall through to manual login
            }
        }
        
        // Store the email for pre-filling the login screen
        UserDefaults.standard.set(email, forKey: "migration_prefill_email")
        KeychainHelper.delete(key: "firebase_auth_token")
        return false
    }
    
    private func decodeFirebaseJWT(_ token: String) -> (email: String, uid: String)? {
        let parts = token.split(separator: ".")
        guard parts.count >= 2 else { return nil }
        
        var base64 = String(parts[1])
        // Pad base64 string
        while base64.count % 4 != 0 { base64 += "=" }
        
        guard let data = Data(base64Encoded: base64),
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let email = json["email"] as? String else {
            return nil
        }
        
        let uid = json["user_id"] as? String ?? json["sub"] as? String ?? ""
        return (email: email, uid: uid)
    }
}
```

## 4.5 Token Handling

| Aspect | Firebase (Before) | Supabase (After) |
|--------|-------------------|-------------------|
| Token format | Firebase custom JWT | Supabase JWT (standard) |
| Token lifetime | 1 hour (auto-refresh) | 1 hour (configurable, auto-refresh) |
| Refresh mechanism | Firebase SDK automatic | Supabase Swift SDK automatic |
| Storage location | Firebase SDK internal + Keychain | Supabase SDK internal + Keychain |
| Token on API calls | Firebase Auth header | Supabase `apikey` header + `Authorization: Bearer <jwt>` |

The Supabase Swift SDK handles token refresh automatically. No custom token management code is needed in the iOS app.

---

# 5. Media Migration

## 5.1 Firebase Storage to Supabase Storage

Firebase Storage is backed by Google Cloud Storage. All profile images need to be downloaded and re-uploaded to Supabase Storage.

**Estimated volume:** 30,000-70,000 users x 1-6 photos each = 30,000-420,000 images. At an average of 500KB per image, total storage is approximately 15-210 GB.

## 5.2 Bucket Structure Design

```sql
-- Supabase Storage bucket configuration
-- Execute via Supabase dashboard or SQL

-- Profile photos bucket (public read, authenticated write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-photos',
    'profile-photos',
    true,                           -- Public read for CDN delivery
    10485760,                       -- 10MB max per image
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/heic']
);

-- Chat media bucket (authenticated read and write)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'chat-media',
    'chat-media',
    false,                          -- Private; requires auth
    20971520,                       -- 20MB max
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4']
);

-- Verification documents bucket (private, admin-only read)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'verification-docs',
    'verification-docs',
    false,
    10485760,
    ARRAY['image/jpeg', 'image/png', 'application/pdf']
);
```

**Storage path convention:**
```
profile-photos/{profile_id}/{order}_{timestamp}.{ext}
  Example: profile-photos/a1b2c3d4-e5f6-7890-abcd-ef1234567890/0_1713100800.jpg

chat-media/{conversation_id}/{message_id}.{ext}
  Example: chat-media/conv-uuid/msg-uuid.jpg

verification-docs/{profile_id}/{doc_type}_{timestamp}.{ext}
  Example: verification-docs/profile-uuid/selfie_1713100800.jpg
```

**Storage RLS policies:**
```sql
-- Profile photos: anyone can read, only the profile owner can upload/delete
CREATE POLICY "Public read access for profile photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'profile-photos');

CREATE POLICY "Users can upload their own profile photos"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'profile-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their own profile photos"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'profile-photos'
    AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Chat media: only conversation participants can read
CREATE POLICY "Conversation participants can read chat media"
ON storage.objects FOR SELECT
USING (
    bucket_id = 'chat-media'
    AND EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.profile_id = (
            SELECT id FROM profiles WHERE supabase_auth_id = auth.uid()
        )
        AND cp.conversation_id::text = (storage.foldername(name))[1]
    )
);
```

## 5.3 URL Rewriting Strategy

After migration, all profile_photos rows will have both `firebase_url` (old) and `public_url` (new). The iOS app and website must use the new URLs.

**Approach: Database-level URL resolution**

The `profile_photos.public_url` column is the canonical URL. The `firebase_url` column is retained only for debugging.

**For any client code that may have cached old Firebase URLs (e.g., in local storage, NSCache):**

```sql
-- Edge Function or database function to resolve URLs
CREATE OR REPLACE FUNCTION resolve_photo_url(input_url TEXT)
RETURNS TEXT AS $$
BEGIN
    -- If it is already a Supabase URL, return as-is
    IF input_url LIKE '%supabase%' THEN
        RETURN input_url;
    END IF;
    
    -- Look up the new URL from the old Firebase URL
    RETURN COALESCE(
        (SELECT public_url FROM profile_photos WHERE firebase_url = input_url LIMIT 1),
        input_url  -- Fallback to original if not found
    );
END;
$$ LANGUAGE plpgsql STABLE;
```

**For the transition period (first 30 days post-migration):**

Deploy a simple redirect Edge Function that catches requests for Firebase Storage URLs and 301-redirects to the Supabase Storage URL:

```typescript
// supabase/functions/redirect-media/index.ts
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.serve(async (req: Request) => {
    const url = new URL(req.url);
    const firebaseUrl = url.searchParams.get("url");
    
    if (!firebaseUrl) {
        return new Response("Missing url parameter", { status: 400 });
    }
    
    const { data } = await supabase
        .from("profile_photos")
        .select("public_url")
        .eq("firebase_url", firebaseUrl)
        .limit(1)
        .single();
    
    if (data?.public_url) {
        return Response.redirect(data.public_url, 301);
    }
    
    // Fallback: try to load from Firebase directly (safety net)
    return Response.redirect(firebaseUrl, 302);
});
```

## 5.4 CDN Considerations

Supabase Storage uses a CDN (backed by Cloudflare in most regions) for public buckets. The `profile-photos` bucket is set to `public = true`, which automatically enables CDN caching.

**CDN configuration recommendations:**

| Setting | Value | Rationale |
|---------|-------|-----------|
| Cache-Control | `public, max-age=86400, s-maxage=604800` | Profile photos change rarely; 1-day browser cache, 7-day CDN cache |
| Image Transformation | Enable (Pro plan) | Serve resized thumbnails for Discovery grid vs. full-size for profile view |
| Thumbnail sizes | 150x150 (grid), 400x400 (preview), original (full view) | Reduces bandwidth for Discovery browsing |

**Supabase Image Transformation (Pro plan feature):**

```
# Original image
https://PROJECT.supabase.co/storage/v1/object/public/profile-photos/uuid/0.jpg

# 150x150 thumbnail
https://PROJECT.supabase.co/storage/v1/render/image/public/profile-photos/uuid/0.jpg?width=150&height=150&resize=cover

# 400x400 preview
https://PROJECT.supabase.co/storage/v1/render/image/public/profile-photos/uuid/0.jpg?width=400&height=400&resize=cover
```

---

# 6. iOS App Rewrite Plan

## 6.1 SupabaseManager Architecture

The existing `FirebaseManager.swift` is a 3,852-line monolith with 173 public functions. The replacement architecture splits this into focused modules.

### Module Breakdown

| Module | File | Responsibility | Approx. LOC |
|--------|------|---------------|-------------|
| Core Client | `SupabaseManager.swift` | Singleton, client initialization, shared utilities | 200 |
| Auth | `AuthManager.swift` | Sign in, sign up, sign out, session management, password reset | 300 |
| Profile | `ProfileManager.swift` | CRUD operations on profiles, photos, preferences | 500 |
| Discovery | `DiscoveryManager.swift` | Browse profiles, rate, M button, level system | 400 |
| Messaging | `MessagingManager.swift` | Conversations, messages, real-time subscriptions | 500 |
| Connections | `ConnectionManager.swift` | Connection requests, mutual matches, blocks | 300 |
| Entitlements | `EntitlementManager.swift` | Subscription verification, purchase tracking, access control | 400 |
| Notifications | `NotificationManager.swift` | Push token registration, notification handling | 250 |
| Media | `MediaManager.swift` | Photo upload, download, caching, URL management | 300 |
| Admin | `AdminManager.swift` | Settings, in-app content, feature flags | 150 |
| Analytics | `AnalyticsManager.swift` | Activity logging, event tracking | 150 |
| **Total** | | | **~3,450** |

## 6.2 Supabase Swift SDK Integration

**Package dependency (Swift Package Manager):**

```swift
// Package.swift or Xcode > File > Add Package Dependencies
// URL: https://github.com/supabase/supabase-swift
// Version: 2.0.0+ (latest stable)
```

**Core client initialization:**

```swift
// SupabaseManager.swift
import Foundation
import Supabase

final class SupabaseManager {
    
    static let shared = SupabaseManager()
    
    let client: SupabaseClient
    
    private init() {
        client = SupabaseClient(
            supabaseURL: URL(string: "https://peamviowxkyaglyjpagc.supabase.co")!,
            supabaseKey: "YOUR_ANON_KEY"  // Public anon key (safe to ship in app binary)
        )
    }
    
    // Convenience accessors
    var auth: AuthClient { client.auth }
    var db: PostgrestClient { client.database }
    var storage: SupabaseStorageClient { client.storage }
    var realtime: RealtimeClient { client.realtime }
    var functions: FunctionsClient { client.functions }
    
    // Current user's profile (cached after login)
    @Published var currentProfile: Profile?
    
    /// Get the current authenticated user's profile ID
    var currentProfileId: UUID? {
        currentProfile?.id
    }
}
```

## 6.3 Real-Time Subscriptions (Replacing Firebase Observers)

Firebase Realtime Database uses `.observe()` listeners that fire on every change. Supabase uses PostgreSQL's LISTEN/NOTIFY via the Realtime server, exposed through Supabase Channels.

**Firebase pattern (before):**
```swift
// FirebaseManager.swift (old)
func observeMessages(conversationId: String, completion: @escaping ([Message]) -> Void) {
    Database.database().reference()
        .child("Message")
        .child(conversationId)
        .observe(.childAdded) { snapshot in
            // Parse and deliver new message
        }
}
```

**Supabase pattern (after):**
```swift
// MessagingManager.swift (new)
import Supabase
import Realtime

class MessagingManager {
    
    private let supabase = SupabaseManager.shared.client
    private var messageChannel: RealtimeChannelV2?
    
    /// Subscribe to new messages in a conversation
    func observeMessages(conversationId: UUID, onNewMessage: @escaping (Message) -> Void) async {
        // Unsubscribe from previous conversation if any
        await messageChannel?.unsubscribe()
        
        messageChannel = supabase.realtime.channel("messages:\(conversationId)")
        
        let changes = messageChannel!.postgresChange(
            InsertAction.self,
            schema: "public",
            table: "messages",
            filter: .eq("conversation_id", value: conversationId.uuidString)
        )
        
        await messageChannel!.subscribe()
        
        // Listen for new messages
        Task {
            for await change in changes {
                if let message = try? change.decodeRecord(as: Message.self, decoder: JSONDecoder()) {
                    await MainActor.run {
                        onNewMessage(message)
                    }
                }
            }
        }
    }
    
    /// Fetch message history for a conversation (paginated)
    func fetchMessages(
        conversationId: UUID,
        before: Date? = nil,
        limit: Int = 50
    ) async throws -> [Message] {
        var query = supabase.database
            .from("messages")
            .select()
            .eq("conversation_id", value: conversationId)
            .order("created_at", ascending: false)
            .limit(limit)
        
        if let before = before {
            query = query.lt("created_at", value: ISO8601DateFormatter().string(from: before))
        }
        
        let messages: [Message] = try await query.execute().value
        return messages.reversed() // Oldest first for display
    }
    
    /// Send a message
    func sendMessage(
        conversationId: UUID,
        body: String,
        messageType: String = "text",
        mediaUrl: String? = nil
    ) async throws -> Message {
        guard let senderId = SupabaseManager.shared.currentProfileId else {
            throw AppError.notAuthenticated
        }
        
        let newMessage = NewMessage(
            conversationId: conversationId,
            senderId: senderId,
            messageType: messageType,
            body: body,
            mediaUrl: mediaUrl
        )
        
        let message: Message = try await supabase.database
            .from("messages")
            .insert(newMessage)
            .select()
            .single()
            .execute()
            .value
        
        // Update conversation's last_message denormalized fields
        try await supabase.database
            .from("conversations")
            .update([
                "last_message_text": body.prefix(200),
                "last_message_at": ISO8601DateFormatter().string(from: Date()),
                "last_message_sender_id": senderId.uuidString,
            ] as [String: String])
            .eq("id", value: conversationId)
            .execute()
        
        return message
    }
    
    /// Get all conversations for the current user (inbox)
    func fetchInbox() async throws -> [ConversationWithParticipant] {
        guard let profileId = SupabaseManager.shared.currentProfileId else {
            throw AppError.notAuthenticated
        }
        
        // Query conversations where user is a participant, ordered by last message
        let conversations: [ConversationWithParticipant] = try await supabase.database
            .from("conversation_participants")
            .select("""
                conversation_id,
                unread_count,
                conversations!inner (
                    id,
                    last_message_text,
                    last_message_at,
                    last_message_sender_id,
                    conversation_participants!inner (
                        profile_id,
                        profiles!inner (
                            id,
                            display_name,
                            profile_photos!inner (
                                public_url
                            )
                        )
                    )
                )
            """)
            .eq("profile_id", value: profileId)
            .order("conversations.last_message_at", ascending: false)
            .execute()
            .value
        
        return conversations
    }
    
    /// Mark messages as read
    func markAsRead(conversationId: UUID) async throws {
        guard let profileId = SupabaseManager.shared.currentProfileId else { return }
        
        // Update unread count for this participant
        try await supabase.database
            .from("conversation_participants")
            .update(["unread_count": 0, "last_read_at": ISO8601DateFormatter().string(from: Date())])
            .eq("conversation_id", value: conversationId)
            .eq("profile_id", value: profileId)
            .execute()
        
        // Mark individual messages as read
        try await supabase.database
            .from("messages")
            .update(["is_read": true, "read_at": ISO8601DateFormatter().string(from: Date())])
            .eq("conversation_id", value: conversationId)
            .neq("sender_id", value: profileId)
            .eq("is_read", value: false)
            .execute()
    }
    
    func cleanup() async {
        await messageChannel?.unsubscribe()
    }
}
```

## 6.4 Key Function Mapping (Top 20 Critical Firebase Functions to Supabase Equivalents)

| # | Firebase Function | Supabase Equivalent | Module |
|---|------------------|---------------------|--------|
| 1 | `signIn(email:password:)` | `supabase.auth.signIn(email:password:)` | AuthManager |
| 2 | `signUp(email:password:)` | `supabase.auth.signUp(email:password:)` | AuthManager |
| 3 | `signOut()` | `supabase.auth.signOut()` | AuthManager |
| 4 | `fetchCurrentUserProfile()` | `supabase.database.from("profiles").select().eq("supabase_auth_id", auth.uid)` | ProfileManager |
| 5 | `updateProfile(fields:)` | `supabase.database.from("profiles").update(fields).eq("id", profileId)` | ProfileManager |
| 6 | `uploadPhoto(image:)` | `supabase.storage.from("profile-photos").upload(path, data)` | MediaManager |
| 7 | `fetchDiscoveryProfiles(filters:)` | `supabase.database.from("profiles").select().eq(filters).limit(20)` | DiscoveryManager |
| 8 | `rateProfile(uid:level:)` | `supabase.database.from("ratings").upsert(rating)` | DiscoveryManager |
| 9 | `pressM(uid:)` | `supabase.database.from("connections").insert(connection)` + `supabase.database.from("ratings").upsert(rating_10)` | ConnectionManager |
| 10 | `fetchRequests()` | `supabase.database.from("connections").select().eq("recipient_id", profileId).eq("status", "pending")` | ConnectionManager |
| 11 | `acceptRequest(connectionId:)` | `supabase.database.from("connections").update({"status": "mutual"}).eq("id", connectionId)` + create conversation | ConnectionManager |
| 12 | `sendMessage(conversationId:text:)` | `supabase.database.from("messages").insert(message)` | MessagingManager |
| 13 | `observeMessages(conversationId:)` | `supabase.realtime.channel().postgresChange(InsertAction.self, table: "messages")` | MessagingManager |
| 14 | `fetchConversations()` | `supabase.database.from("conversation_participants").select("*, conversations(*)")` | MessagingManager |
| 15 | `blockUser(uid:)` | `supabase.database.from("blocks").insert(block)` | ConnectionManager |
| 16 | `reportUser(uid:reason:)` | `supabase.database.from("reports").insert(report)` | ConnectionManager |
| 17 | `checkSubscriptionStatus()` | `supabase.database.from("entitlements").select().eq("profile_id", profileId).eq("status", "active")` | EntitlementManager |
| 18 | `registerPushToken(token:)` | `supabase.database.from("push_tokens").upsert(token)` | NotificationManager |
| 19 | `activateSpotlight()` | `supabase.database.from("entitlements").insert(spotlight_entitlement)` + `supabase.database.from("profiles").update({"is_spotlight_active": true})` | EntitlementManager |
| 20 | `fetchAdminSettings()` | `supabase.database.from("admin_settings").select()` | AdminManager |

## 6.5 Detailed Module: AuthManager.swift

```swift
// AuthManager.swift
import Foundation
import Supabase

class AuthManager: ObservableObject {
    
    private let supabase = SupabaseManager.shared.client
    @Published var isAuthenticated = false
    @Published var currentUser: User?
    
    init() {
        // Listen for auth state changes
        Task {
            for await (event, session) in supabase.auth.authStateChanges {
                await MainActor.run {
                    switch event {
                    case .signedIn:
                        self.isAuthenticated = true
                        self.currentUser = session?.user
                    case .signedOut:
                        self.isAuthenticated = false
                        self.currentUser = nil
                        SupabaseManager.shared.currentProfile = nil
                    default:
                        break
                    }
                }
            }
        }
    }
    
    func signIn(email: String, password: String) async throws {
        let session = try await supabase.auth.signIn(
            email: email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines),
            password: password
        )
        
        // Fetch the user's profile
        let profile: Profile = try await supabase.database
            .from("profiles")
            .select()
            .eq("supabase_auth_id", value: session.user.id)
            .single()
            .execute()
            .value
        
        await MainActor.run {
            SupabaseManager.shared.currentProfile = profile
        }
        
        // Update last login timestamp
        try? await supabase.database
            .from("profiles")
            .update(["last_login_at": ISO8601DateFormatter().string(from: Date())])
            .eq("id", value: profile.id)
            .execute()
    }
    
    func signUp(email: String, password: String, displayName: String) async throws {
        let authResponse = try await supabase.auth.signUp(
            email: email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines),
            password: password
        )
        
        guard let userId = authResponse.user?.id else {
            throw AppError.signUpFailed
        }
        
        // Create profile record
        let newProfile = NewProfile(
            supabaseAuthId: userId,
            email: email.lowercased().trimmingCharacters(in: .whitespacesAndNewlines),
            displayName: displayName,
            status: "active"
        )
        
        let profile: Profile = try await supabase.database
            .from("profiles")
            .insert(newProfile)
            .select()
            .single()
            .execute()
            .value
        
        await MainActor.run {
            SupabaseManager.shared.currentProfile = profile
        }
    }
    
    func signOut() async throws {
        try await supabase.auth.signOut()
    }
    
    func resetPassword(email: String) async throws {
        try await supabase.auth.resetPasswordForEmail(email)
    }
    
    func updatePassword(newPassword: String) async throws {
        try await supabase.auth.update(user: UserAttributes(password: newPassword))
    }
    
    /// Check if there is an existing session on app launch
    func restoreSession() async -> Bool {
        do {
            let session = try await supabase.auth.session
            let profile: Profile = try await supabase.database
                .from("profiles")
                .select()
                .eq("supabase_auth_id", value: session.user.id)
                .single()
                .execute()
                .value
            
            await MainActor.run {
                self.isAuthenticated = true
                self.currentUser = session.user
                SupabaseManager.shared.currentProfile = profile
            }
            return true
        } catch {
            return false
        }
    }
}
```

## 6.6 Detailed Module: DiscoveryManager.swift

```swift
// DiscoveryManager.swift
import Foundation
import Supabase

class DiscoveryManager {
    
    private let supabase = SupabaseManager.shared.client
    
    /// Fetch discovery profiles based on user preferences and filters
    /// Excludes: blocked users, already-rated users, self, inactive users
    func fetchDiscoveryProfiles(
        preferences: ProfilePreferences?,
        offset: Int = 0,
        limit: Int = 20
    ) async throws -> [DiscoveryProfile] {
        guard let currentProfileId = SupabaseManager.shared.currentProfileId else {
            throw AppError.notAuthenticated
        }
        
        // Use an RPC function for complex discovery logic
        // This avoids building the complex query client-side
        let params: [String: AnyJSON] = [
            "p_profile_id": .string(currentProfileId.uuidString),
            "p_min_age": .number(Double(preferences?.preferredAgeMin ?? 18)),
            "p_max_age": .number(Double(preferences?.preferredAgeMax ?? 99)),
            "p_gender_filter": .array((preferences?.preferredGenders ?? []).map { .string($0) }),
            "p_max_distance_miles": .number(Double(preferences?.preferredDistanceMiles ?? 50)),
            "p_limit": .number(Double(limit)),
            "p_offset": .number(Double(offset)),
        ]
        
        let profiles: [DiscoveryProfile] = try await supabase.database
            .rpc("get_discovery_profiles", params: params)
            .execute()
            .value
        
        return profiles
    }
    
    /// Rate a profile (levels 6-9) from Discovery
    func rateProfile(ratedProfileId: UUID, ratingValue: Int) async throws {
        guard let raterId = SupabaseManager.shared.currentProfileId else {
            throw AppError.notAuthenticated
        }
        guard (6...9).contains(ratingValue) else {
            throw AppError.invalidRating
        }
        
        try await supabase.database
            .from("ratings")
            .upsert([
                "rater_id": raterId.uuidString,
                "rated_id": ratedProfileId.uuidString,
                "rating_value": String(ratingValue),
                "is_m_button": "false",
                "source": "discovery",
            ] as [String: String])
            .execute()
        
        // Log activity
        try? await supabase.database
            .from("activity_log")
            .insert([
                "profile_id": raterId.uuidString,
                "action": "rate",
                "target_type": "profile",
                "target_id": ratedProfileId.uuidString,
                "metadata": "{\"rating_value\": \(ratingValue)}",
            ] as [String: String])
            .execute()
    }
    
    /// Press the M button -- highest rating + connection request
    func pressM(targetProfileId: UUID) async throws {
        guard let currentProfileId = SupabaseManager.shared.currentProfileId else {
            throw AppError.notAuthenticated
        }
        
        // 1. Record the rating (value 10 = M)
        try await supabase.database
            .from("ratings")
            .upsert([
                "rater_id": currentProfileId.uuidString,
                "rated_id": targetProfileId.uuidString,
                "rating_value": "10",
                "is_m_button": "true",
                "source": "discovery",
            ] as [String: String])
            .execute()
        
        // 2. Check if there is already a connection request from the other user
        let existingConnections: [Connection] = try await supabase.database
            .from("connections")
            .select()
            .or("and(requester_id.eq.\(targetProfileId),recipient_id.eq.\(currentProfileId)),and(requester_id.eq.\(currentProfileId),recipient_id.eq.\(targetProfileId))")
            .execute()
            .value
        
        if let existing = existingConnections.first {
            if existing.status == "pending" && existing.requesterId == targetProfileId {
                // Mutual match -- update to mutual and create conversation
                try await supabase.database
                    .from("connections")
                    .update([
                        "status": "mutual",
                        "recipient_responded_at": ISO8601DateFormatter().string(from: Date()),
                    ] as [String: String])
                    .eq("id", value: existing.id)
                    .execute()
                
                // Create conversation for the mutual match
                try await createConversation(
                    profileId1: currentProfileId,
                    profileId2: targetProfileId,
                    connectionId: existing.id
                )
                
                // Send push notification for mutual match
                try await sendMatchNotification(
                    toProfileId: targetProfileId,
                    fromProfileId: currentProfileId
                )
            }
            // If already mutual or other status, do nothing
        } else {
            // No existing connection -- create a new request
            // Ensure consistent ordering for the CHECK constraint
            let (reqId, recId) = currentProfileId < targetProfileId
                ? (currentProfileId, targetProfileId)
                : (targetProfileId, currentProfileId)
            let isRequester = currentProfileId < targetProfileId
            
            try await supabase.database
                .from("connections")
                .insert([
                    "requester_id": reqId.uuidString,
                    "recipient_id": recId.uuidString,
                    "status": "pending",
                    "requester_rated_at": ISO8601DateFormatter().string(from: Date()),
                ] as [String: String])
                .execute()
            
            // Send push notification for new request
            let targetId = isRequester ? recId : reqId
            try await sendRequestNotification(
                toProfileId: targetId,
                fromProfileId: currentProfileId
            )
        }
    }
    
    private func createConversation(
        profileId1: UUID,
        profileId2: UUID,
        connectionId: UUID
    ) async throws {
        // Insert conversation
        let conversation: Conversation = try await supabase.database
            .from("conversations")
            .insert([
                "conversation_type": "direct",
                "is_active": "true",
            ] as [String: String])
            .select()
            .single()
            .execute()
            .value
        
        // Insert both participants
        try await supabase.database
            .from("conversation_participants")
            .insert([
                ["conversation_id": conversation.id.uuidString, "profile_id": profileId1.uuidString],
                ["conversation_id": conversation.id.uuidString, "profile_id": profileId2.uuidString],
            ])
            .execute()
        
        // Link conversation to connection
        try await supabase.database
            .from("connections")
            .update(["conversation_id": conversation.id.uuidString])
            .eq("id", value: connectionId)
            .execute()
    }
    
    private func sendMatchNotification(toProfileId: UUID, fromProfileId: UUID) async throws {
        try await supabase.functions.invoke(
            "send-push-notification",
            options: .init(body: [
                "recipient_id": toProfileId.uuidString,
                "sender_id": fromProfileId.uuidString,
                "type": "new_connection",
                "title": "New Match!",
                "body": "You have a new mutual connection. Start a conversation!",
            ] as [String: String])
        )
    }
    
    private func sendRequestNotification(toProfileId: UUID, fromProfileId: UUID) async throws {
        try await supabase.functions.invoke(
            "send-push-notification",
            options: .init(body: [
                "recipient_id": toProfileId.uuidString,
                "sender_id": fromProfileId.uuidString,
                "type": "connection_request",
                "title": "New Request",
                "body": "Someone selected you! Check your Requests tab.",
            ] as [String: String])
        )
    }
}
```

## 6.7 Discovery RPC Function (Server-Side)

```sql
-- Database function for Discovery profile fetching
-- This runs server-side and handles the complex filtering logic
CREATE OR REPLACE FUNCTION get_discovery_profiles(
    p_profile_id UUID,
    p_min_age INTEGER DEFAULT 18,
    p_max_age INTEGER DEFAULT 99,
    p_gender_filter TEXT[] DEFAULT '{}',
    p_max_distance_miles INTEGER DEFAULT 50,
    p_limit INTEGER DEFAULT 20,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    display_name TEXT,
    age INTEGER,
    city TEXT,
    state TEXT,
    bio TEXT,
    intent TEXT,
    level INTEGER,
    quality_score NUMERIC,
    is_spotlight_active BOOLEAN,
    primary_photo_url TEXT,
    distance_miles DOUBLE PRECISION
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_lat DOUBLE PRECISION;
    v_lng DOUBLE PRECISION;
BEGIN
    -- Get the current user's location
    SELECT p.latitude, p.longitude INTO v_lat, v_lng
    FROM profiles p WHERE p.id = p_profile_id;
    
    RETURN QUERY
    SELECT 
        p.id,
        p.display_name,
        p.age,
        p.city,
        p.state,
        LEFT(p.bio, 200) AS bio,
        p.intent,
        p.level,
        p.quality_score,
        p.is_spotlight_active,
        (
            SELECT pp.public_url 
            FROM profile_photos pp 
            WHERE pp.profile_id = p.id AND pp.is_primary = TRUE 
            LIMIT 1
        ) AS primary_photo_url,
        CASE 
            WHEN v_lat IS NOT NULL AND v_lng IS NOT NULL 
                 AND p.latitude IS NOT NULL AND p.longitude IS NOT NULL 
            THEN (
                3959.0 * acos(
                    cos(radians(v_lat)) * cos(radians(p.latitude)) *
                    cos(radians(p.longitude) - radians(v_lng)) +
                    sin(radians(v_lat)) * sin(radians(p.latitude))
                )
            )
            ELSE NULL
        END AS distance_miles
    FROM profiles p
    WHERE p.id != p_profile_id
        AND p.status = 'active'
        AND p.deleted_at IS NULL
        -- Age filter
        AND (p.age IS NULL OR (p.age >= p_min_age AND p.age <= p_max_age))
        -- Gender filter (empty array = no filter)
        AND (array_length(p_gender_filter, 1) IS NULL OR p.gender = ANY(p_gender_filter))
        -- Exclude blocked users (in either direction)
        AND NOT EXISTS (
            SELECT 1 FROM blocks b 
            WHERE (b.blocker_id = p_profile_id AND b.blocked_id = p.id)
               OR (b.blocker_id = p.id AND b.blocked_id = p_profile_id)
        )
        -- Exclude already-rated users
        AND NOT EXISTS (
            SELECT 1 FROM ratings r 
            WHERE r.rater_id = p_profile_id AND r.rated_id = p.id AND r.source = 'discovery'
        )
    ORDER BY
        -- Spotlight profiles first
        p.is_spotlight_active DESC,
        -- Then by quality score and level
        p.quality_score DESC,
        p.level DESC,
        -- Then by last active
        p.last_active_at DESC NULLS LAST
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;
```

---

# 7. Data Cleaning & Profile Quality System

## 7.1 Fake Profile Detection Signals

After 7 years of data accumulation, the database likely contains a significant portion (10-30%) of fake, abandoned, or low-quality profiles. The following signals identify them:

| Signal | Weight | Detection Logic |
|--------|--------|----------------|
| No profile photo | 3.0 | `NOT EXISTS (SELECT 1 FROM profile_photos WHERE profile_id = p.id)` |
| Empty bio | 1.5 | `bio IS NULL OR bio = '' OR LENGTH(bio) < 10` |
| No activity in 12+ months | 2.0 | `last_active_at < NOW() - INTERVAL '12 months' OR last_active_at IS NULL` |
| No activity in 6+ months | 1.0 | `last_active_at < NOW() - INTERVAL '6 months'` |
| Zero ratings given | 1.5 | `NOT EXISTS (SELECT 1 FROM ratings WHERE rater_id = p.id)` |
| Zero ratings received | 1.0 | `NOT EXISTS (SELECT 1 FROM ratings WHERE rated_id = p.id)` |
| Zero messages sent | 2.0 | `NOT EXISTS (SELECT 1 FROM messages WHERE sender_id = p.id)` |
| No connections | 1.0 | `NOT EXISTS (SELECT 1 FROM connections WHERE requester_id = p.id OR recipient_id = p.id)` |
| Suspicious email pattern | 1.5 | Email contains random strings, disposable domain, etc. |
| Profile created but never completed | 2.0 | `completeness_pct < 30` |
| Multiple reports received | 2.5 | `(SELECT COUNT(*) FROM reports WHERE reported_id = p.id) >= 3` |
| Missing core demographics | 1.0 | `age IS NULL AND gender IS NULL AND city = ''` |

## 7.2 Quality Scoring System (1-10 Scale)

```sql
-- Database function to calculate profile quality score
CREATE OR REPLACE FUNCTION calculate_quality_score(p_profile_id UUID)
RETURNS NUMERIC(3,1)
LANGUAGE plpgsql
AS $$
DECLARE
    v_score NUMERIC(3,1) := 5.0;  -- Start at neutral
    v_profile RECORD;
    v_photo_count INTEGER;
    v_rating_given_count INTEGER;
    v_rating_received_count INTEGER;
    v_message_count INTEGER;
    v_connection_count INTEGER;
    v_report_count INTEGER;
    v_completeness INTEGER;
BEGIN
    -- Fetch profile
    SELECT * INTO v_profile FROM profiles WHERE id = p_profile_id;
    IF NOT FOUND THEN RETURN 0.0; END IF;
    
    -- Count related data
    SELECT COUNT(*) INTO v_photo_count FROM profile_photos WHERE profile_id = p_profile_id;
    SELECT COUNT(*) INTO v_rating_given_count FROM ratings WHERE rater_id = p_profile_id;
    SELECT COUNT(*) INTO v_rating_received_count FROM ratings WHERE rated_id = p_profile_id;
    SELECT COUNT(*) INTO v_message_count FROM messages WHERE sender_id = p_profile_id;
    SELECT COUNT(*) INTO v_connection_count FROM connections 
        WHERE (requester_id = p_profile_id OR recipient_id = p_profile_id) AND status = 'mutual';
    SELECT COUNT(*) INTO v_report_count FROM reports WHERE reported_id = p_profile_id;
    
    -- Calculate completeness percentage
    v_completeness := 0;
    IF v_profile.display_name != '' THEN v_completeness := v_completeness + 10; END IF;
    IF v_profile.bio != '' AND LENGTH(v_profile.bio) > 20 THEN v_completeness := v_completeness + 15; END IF;
    IF v_profile.age IS NOT NULL THEN v_completeness := v_completeness + 10; END IF;
    IF v_profile.gender IS NOT NULL THEN v_completeness := v_completeness + 10; END IF;
    IF v_profile.city != '' THEN v_completeness := v_completeness + 10; END IF;
    IF v_profile.intent IS NOT NULL THEN v_completeness := v_completeness + 15; END IF;
    IF v_photo_count >= 1 THEN v_completeness := v_completeness + 15; END IF;
    IF v_photo_count >= 3 THEN v_completeness := v_completeness + 15; END IF;
    
    -- Update completeness on profile
    UPDATE profiles SET completeness_pct = v_completeness WHERE id = p_profile_id;
    
    -- SCORING ALGORITHM
    
    -- Photos (up to +2.0)
    v_score := v_score + LEAST(v_photo_count * 0.5, 2.0);
    IF v_photo_count = 0 THEN v_score := v_score - 2.0; END IF;
    
    -- Bio quality (up to +1.0)
    IF v_profile.bio IS NOT NULL AND LENGTH(v_profile.bio) > 100 THEN
        v_score := v_score + 1.0;
    ELSIF v_profile.bio IS NOT NULL AND LENGTH(v_profile.bio) > 20 THEN
        v_score := v_score + 0.5;
    ELSIF v_profile.bio IS NULL OR v_profile.bio = '' THEN
        v_score := v_score - 1.0;
    END IF;
    
    -- Activity recency (up to +1.5 / down to -2.0)
    IF v_profile.last_active_at > NOW() - INTERVAL '7 days' THEN
        v_score := v_score + 1.5;
    ELSIF v_profile.last_active_at > NOW() - INTERVAL '30 days' THEN
        v_score := v_score + 1.0;
    ELSIF v_profile.last_active_at > NOW() - INTERVAL '90 days' THEN
        v_score := v_score + 0.0;
    ELSIF v_profile.last_active_at > NOW() - INTERVAL '365 days' THEN
        v_score := v_score - 1.0;
    ELSE
        v_score := v_score - 2.0;
    END IF;
    
    -- Engagement: ratings given (+0.5 for active raters)
    IF v_rating_given_count >= 20 THEN
        v_score := v_score + 0.5;
    END IF;
    
    -- Engagement: messages sent (+0.5)
    IF v_message_count >= 5 THEN
        v_score := v_score + 0.5;
    END IF;
    
    -- Connections: mutual matches (+0.5)
    IF v_connection_count >= 3 THEN
        v_score := v_score + 0.5;
    END IF;
    
    -- Reports penalty (-1.0 per report, up to -3.0)
    v_score := v_score - LEAST(v_report_count * 1.0, 3.0);
    
    -- Completeness bonus (up to +1.0)
    v_score := v_score + (v_completeness::numeric / 100.0);
    
    -- Clamp to 0-10 range
    v_score := GREATEST(0.0, LEAST(10.0, v_score));
    
    -- Update profile
    UPDATE profiles SET quality_score = v_score WHERE id = p_profile_id;
    
    RETURN v_score;
END;
$$;

-- Batch quality score calculation (run nightly)
CREATE OR REPLACE FUNCTION calculate_all_quality_scores()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    v_count INTEGER := 0;
    v_profile_id UUID;
BEGIN
    FOR v_profile_id IN 
        SELECT id FROM profiles WHERE status = 'active' AND deleted_at IS NULL
    LOOP
        PERFORM calculate_quality_score(v_profile_id);
        v_count := v_count + 1;
    END LOOP;
    RETURN v_count;
END;
$$;
```

## 7.3 Automated Cleanup Rules

| Condition | Action | Reversible? |
|-----------|--------|-------------|
| Quality score < 2.0 AND no activity in 12+ months | Auto-archive (set status = 'archived') | Yes: user can reactivate by logging in |
| Quality score < 1.0 AND no photo AND no messages ever | Auto-archive | Yes |
| 3+ confirmed reports (resolved_action_taken) | Set status = 'suspended' | Admin review required to restore |
| Email bounces on notification send | Flag for review (status = 'pending_review') | Admin review |
| Quality score 2.0-4.0 | Remain active but deprioritized in Discovery | Automatic: improves when score improves |

**Cleanup SQL (run post-migration):**

```sql
-- Archive clearly abandoned profiles
UPDATE profiles
SET status = 'archived',
    updated_at = NOW()
WHERE quality_score < 2.0
    AND (last_active_at < NOW() - INTERVAL '12 months' OR last_active_at IS NULL)
    AND status = 'active';

-- Archive profiles with zero engagement and no photo
UPDATE profiles
SET status = 'archived',
    updated_at = NOW()
WHERE status = 'active'
    AND NOT EXISTS (SELECT 1 FROM profile_photos WHERE profile_id = profiles.id)
    AND NOT EXISTS (SELECT 1 FROM messages WHERE sender_id = profiles.id)
    AND NOT EXISTS (SELECT 1 FROM ratings WHERE rater_id = profiles.id)
    AND (last_active_at < NOW() - INTERVAL '6 months' OR last_active_at IS NULL);
```

## 7.4 Profile Improvement Prompts

When a user with a low quality score logs in, the app should show contextual prompts:

```swift
// ProfileImprovementManager.swift
struct ProfileImprovement {
    let type: String
    let message: String
    let priority: Int // 1 = highest
}

func getImprovementSuggestions(for profile: Profile) -> [ProfileImprovement] {
    var suggestions: [ProfileImprovement] = []
    
    if profile.photoCount == 0 {
        suggestions.append(ProfileImprovement(
            type: "photo",
            message: "Add your first photo to get discovered. Profiles with photos get 10x more connections.",
            priority: 1
        ))
    } else if profile.photoCount < 3 {
        suggestions.append(ProfileImprovement(
            type: "photo",
            message: "Add more photos. Members with 3+ photos receive significantly more M-button presses.",
            priority: 3
        ))
    }
    
    if profile.bio.isEmpty || profile.bio.count < 20 {
        suggestions.append(ProfileImprovement(
            type: "bio",
            message: "Write something about yourself. Even 2-3 sentences makes a meaningful difference.",
            priority: 2
        ))
    }
    
    if profile.intent == nil || profile.intent == "not_sure" {
        suggestions.append(ProfileImprovement(
            type: "intent",
            message: "Set your Intent. Members who declare their Intent connect with more compatible matches.",
            priority: 2
        ))
    }
    
    if profile.city.isEmpty {
        suggestions.append(ProfileImprovement(
            type: "location",
            message: "Add your city so people near you can find you.",
            priority: 3
        ))
    }
    
    return suggestions.sorted { $0.priority < $1.priority }
}
```

---

# 8. Unified Platform Architecture

## 8.1 Single Source of Truth Design

Post-migration, Supabase is the single source of truth for all data. Every client (iOS, web, future Android) reads and writes to the same PostgreSQL database through the same API.

```
                    +------------------+
                    |   Supabase       |
                    |   PostgreSQL     |
                    |   (Single DB)    |
                    +--------+---------+
                             |
              +--------------+--------------+
              |              |              |
     +--------v---+  +------v------+  +----v--------+
     | iOS App    |  | Website     |  | Android     |
     | (Swift)    |  | (JS/TS)    |  | (Kotlin)    |
     |            |  |             |  | (Future)    |
     | Supabase   |  | Supabase    |  | Supabase    |
     | Swift SDK  |  | JS SDK      |  | Kotlin SDK  |
     +------------+  +-------------+  +-------------+
```

## 8.2 How Each Platform Accesses Data

| Platform | SDK | Auth Method | Real-Time | Storage |
|----------|-----|-------------|-----------|---------|
| iOS | supabase-swift 2.x | Email/password via Supabase Auth | Supabase Realtime (WebSocket) | Supabase Storage |
| Website | supabase-js 2.x | Supabase Auth (anon for public pages, authed for user pages) | Supabase Realtime | Supabase Storage |
| Android (future) | supabase-kt 3.x | Email/password + Google Sign-In | Supabase Realtime | Supabase Storage |

## 8.3 API Layer

Supabase provides three API access patterns:

1. **PostgREST (Auto-generated REST):** Direct table access via `supabase.database.from("table")`. Used for standard CRUD operations. Secured by RLS.

2. **Edge Functions:** Custom TypeScript/Deno functions for complex business logic. Used for:
   - Stripe webhook handling (existing)
   - App Store receipt verification (new)
   - Push notification dispatch (new)
   - AI Dating Coach proxy (existing)
   - Complex multi-table transactions
   - Third-party API integrations

3. **Database Functions (RPC):** PostgreSQL functions called via `supabase.database.rpc("function_name")`. Used for:
   - Discovery profile fetching (complex filters + exclusions)
   - Level calculation (rolling window aggregation)
   - Quality score computation
   - Batch operations

**Recommendation:** Use PostgREST for simple CRUD, RPC for complex queries, and Edge Functions for anything requiring external API calls or multi-step business logic.

## 8.4 Real-Time Architecture

Supabase Realtime uses PostgreSQL's LISTEN/NOTIFY mechanism, extended with a Realtime server that manages WebSocket connections to clients.

**Real-time use cases in MatchMakers:**

| Use Case | Channel Type | Filter | Payload |
|----------|-------------|--------|---------|
| New messages in conversation | Postgres Changes (INSERT on `messages`) | `conversation_id = X` | Full message row |
| Message read receipts | Postgres Changes (UPDATE on `messages`) | `conversation_id = X AND is_read = true` | Message ID + read_at |
| New connection request | Postgres Changes (INSERT on `connections`) | `recipient_id = current_user` | Connection row |
| Mutual match notification | Postgres Changes (UPDATE on `connections`) | `(requester_id = me OR recipient_id = me) AND status = 'mutual'` | Connection row |
| Presence (online/offline) | Presence | Channel per user or per conversation | User ID + status |
| Typing indicators | Broadcast | Channel per conversation | User ID + typing state |

**Realtime configuration (Supabase dashboard):**

Enable Realtime on these tables:
- `messages` (INSERT, UPDATE)
- `connections` (INSERT, UPDATE)
- `conversation_participants` (UPDATE -- for unread counts)
- `profiles` (UPDATE -- for spotlight status changes)
- `notifications` (INSERT)

```sql
-- Enable Realtime replication for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE connections;
ALTER PUBLICATION supabase_realtime ADD TABLE conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
```

**Presence implementation (online/offline status):**

```swift
// PresenceManager.swift
class PresenceManager {
    private let supabase = SupabaseManager.shared.client
    private var presenceChannel: RealtimeChannelV2?
    
    func trackPresence() async {
        guard let profileId = SupabaseManager.shared.currentProfileId else { return }
        
        presenceChannel = supabase.realtime.channel("presence:global")
        
        await presenceChannel?.subscribe()
        
        // Track this user as online
        await presenceChannel?.track([
            "profile_id": .string(profileId.uuidString),
            "online_at": .string(ISO8601DateFormatter().string(from: Date())),
        ])
    }
    
    func stopTracking() async {
        await presenceChannel?.untrack()
        await presenceChannel?.unsubscribe()
    }
}
```

## 8.5 Row Level Security Policies

RLS policies are the primary access control mechanism. Every table must have RLS enabled with explicit policies.

```sql
-- ============================================================
-- ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE push_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE in_app_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE photo_rankings ENABLE ROW LEVEL SECURITY;

-- ── Helper function: get current user's profile ID ──
CREATE OR REPLACE FUNCTION current_profile_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
    SELECT id FROM profiles WHERE supabase_auth_id = auth.uid() LIMIT 1;
$$;

-- ── PROFILES ──
-- Anyone authenticated can read active profiles (Discovery)
CREATE POLICY "Authenticated users can view active profiles"
ON profiles FOR SELECT
TO authenticated
USING (status = 'active' AND deleted_at IS NULL);

-- Users can read their own profile regardless of status
CREATE POLICY "Users can view their own profile"
ON profiles FOR SELECT
TO authenticated
USING (supabase_auth_id = auth.uid());

-- Users can update only their own profile
CREATE POLICY "Users can update their own profile"
ON profiles FOR UPDATE
TO authenticated
USING (supabase_auth_id = auth.uid())
WITH CHECK (supabase_auth_id = auth.uid());

-- Profile creation happens via service role during signup
-- No direct INSERT policy for users

-- ── PROFILE PHOTOS ──
CREATE POLICY "Anyone authenticated can view profile photos"
ON profile_photos FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = profile_photos.profile_id 
        AND (profiles.status = 'active' OR profiles.supabase_auth_id = auth.uid())
    )
);

CREATE POLICY "Users can manage their own photos"
ON profile_photos FOR ALL
TO authenticated
USING (profile_id = current_profile_id())
WITH CHECK (profile_id = current_profile_id());

-- ── PROFILE PREFERENCES ──
CREATE POLICY "Users can view their own preferences"
ON profile_preferences FOR SELECT
TO authenticated
USING (profile_id = current_profile_id());

CREATE POLICY "Users can manage their own preferences"
ON profile_preferences FOR ALL
TO authenticated
USING (profile_id = current_profile_id())
WITH CHECK (profile_id = current_profile_id());

-- ── CONVERSATIONS ──
CREATE POLICY "Users can view their conversations"
ON conversations FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = conversations.id
        AND cp.profile_id = current_profile_id()
    )
);

-- ── CONVERSATION PARTICIPANTS ──
CREATE POLICY "Users can view participants of their conversations"
ON conversation_participants FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = conversation_participants.conversation_id
        AND cp.profile_id = current_profile_id()
    )
);

CREATE POLICY "Users can update their own participant record"
ON conversation_participants FOR UPDATE
TO authenticated
USING (profile_id = current_profile_id())
WITH CHECK (profile_id = current_profile_id());

-- ── MESSAGES ──
CREATE POLICY "Users can view messages in their conversations"
ON messages FOR SELECT
TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
        AND cp.profile_id = current_profile_id()
    )
);

CREATE POLICY "Users can send messages in their conversations"
ON messages FOR INSERT
TO authenticated
WITH CHECK (
    sender_id = current_profile_id()
    AND EXISTS (
        SELECT 1 FROM conversation_participants cp
        WHERE cp.conversation_id = messages.conversation_id
        AND cp.profile_id = current_profile_id()
    )
);

-- ── CONNECTIONS ──
CREATE POLICY "Users can view their connections"
ON connections FOR SELECT
TO authenticated
USING (
    requester_id = current_profile_id() OR recipient_id = current_profile_id()
);

CREATE POLICY "Users can create connection requests"
ON connections FOR INSERT
TO authenticated
WITH CHECK (
    requester_id = current_profile_id() OR recipient_id = current_profile_id()
);

CREATE POLICY "Users can update connections they are part of"
ON connections FOR UPDATE
TO authenticated
USING (
    requester_id = current_profile_id() OR recipient_id = current_profile_id()
);

-- ── RATINGS ──
CREATE POLICY "Users can insert their own ratings"
ON ratings FOR INSERT
TO authenticated
WITH CHECK (rater_id = current_profile_id());

CREATE POLICY "Users can view their own given ratings"
ON ratings FOR SELECT
TO authenticated
USING (rater_id = current_profile_id());

-- ── REPORTS ──
CREATE POLICY "Users can create reports"
ON reports FOR INSERT
TO authenticated
WITH CHECK (reporter_id = current_profile_id());

CREATE POLICY "Users can view their own submitted reports"
ON reports FOR SELECT
TO authenticated
USING (reporter_id = current_profile_id());

-- ── BLOCKS ──
CREATE POLICY "Users can manage their blocks"
ON blocks FOR ALL
TO authenticated
USING (blocker_id = current_profile_id())
WITH CHECK (blocker_id = current_profile_id());

-- ── ENTITLEMENTS ──
CREATE POLICY "Users can view their own entitlements"
ON entitlements FOR SELECT
TO authenticated
USING (profile_id = current_profile_id());

-- ── PUSH TOKENS ──
CREATE POLICY "Users can manage their own push tokens"
ON push_tokens FOR ALL
TO authenticated
USING (profile_id = current_profile_id())
WITH CHECK (profile_id = current_profile_id());

-- ── NOTIFICATIONS ──
CREATE POLICY "Users can view their own notifications"
ON notifications FOR SELECT
TO authenticated
USING (recipient_id = current_profile_id());

CREATE POLICY "Users can update their own notifications (mark read)"
ON notifications FOR UPDATE
TO authenticated
USING (recipient_id = current_profile_id())
WITH CHECK (recipient_id = current_profile_id());

-- ── ACTIVITY LOG ──
CREATE POLICY "Users can insert their own activity"
ON activity_log FOR INSERT
TO authenticated
WITH CHECK (profile_id = current_profile_id());

-- No SELECT policy for users; activity_log is admin-only for reading

-- ── ADMIN SETTINGS ──
CREATE POLICY "Anyone authenticated can read admin settings"
ON admin_settings FOR SELECT
TO authenticated
USING (true);

-- Only service role can write admin settings (no user policy)

-- ── IN-APP CONTENT ──
CREATE POLICY "Anyone authenticated can read active in-app content"
ON in_app_content FOR SELECT
TO authenticated
USING (is_active = true AND (expires_at IS NULL OR expires_at > NOW()));

-- ── PHOTO RANKINGS ──
CREATE POLICY "Users can submit rankings"
ON photo_rankings FOR INSERT
TO authenticated
WITH CHECK (voter_id = current_profile_id());

CREATE POLICY "Users can view rankings for their own photos"
ON photo_rankings FOR SELECT
TO authenticated
USING (profile_id = current_profile_id());
```

---

# 9. Unified Entitlements System

## 9.1 Entitlements Table Design

The `entitlements` table (defined in Section 2.1.5) is the single source of truth for what every user has purchased, regardless of source (App Store or Stripe).

**Product catalog:**

| Product ID | Product Type | Source(s) | Price | Duration |
|-----------|-------------|-----------|-------|----------|
| `MatchMaker_1_month` | subscription | app_store | $29.99/mo | Monthly recurring |
| `Master_MatchMaker_1_week` | subscription | app_store | $9.99/wk | Weekly recurring |
| `MatchMaker_Spotlight_1_day` | consumable | app_store | $7.99 | 24 hours |
| `playbook` | one_time | stripe | $500 | Lifetime |
| `dating_coach` | one_time | stripe | $500 | 30 days |

## 9.2 App Store Subscription Verification via Edge Function

```typescript
// supabase/functions/verify-app-store-receipt/index.ts
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APP_STORE_SHARED_SECRET = Deno.env.get("APP_STORE_SHARED_SECRET")!;

// Apple's StoreKit 2 Server API endpoints
const APPLE_PRODUCTION_URL = "https://api.storekit.itunes.apple.com";
const APPLE_SANDBOX_URL = "https://api.storekit-sandbox.itunes.apple.com";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

Deno.serve(async (req: Request) => {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }

    // Verify the JWT to get the user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), { status: 401 });
    }

    const body = await req.json();
    const { transaction_id, product_id, original_transaction_id } = body;

    if (!transaction_id || !product_id) {
        return new Response(JSON.stringify({ error: "Missing transaction data" }), { status: 400 });
    }

    // Get the user's profile
    const { data: profile } = await supabase
        .from("profiles")
        .select("id")
        .eq("supabase_auth_id", user.id)
        .single();

    if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404 });
    }

    // Determine product type and duration
    let productType: string;
    let expiresAt: string | null = null;

    switch (product_id) {
        case "MatchMaker_1_month":
            productType = "subscription";
            expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
            break;
        case "Master_MatchMaker_1_week":
            productType = "subscription";
            expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
            break;
        case "MatchMaker_Spotlight_1_day":
            productType = "consumable";
            expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
            break;
        default:
            return new Response(JSON.stringify({ error: "Unknown product" }), { status: 400 });
    }

    // Upsert the entitlement (idempotent on transaction_id)
    const { data: entitlement, error: dbError } = await supabase
        .from("entitlements")
        .upsert(
            {
                profile_id: profile.id,
                product_id: product_id,
                product_type: productType,
                source: "app_store",
                app_store_transaction_id: transaction_id,
                app_store_original_transaction_id: original_transaction_id || transaction_id,
                status: "active",
                starts_at: new Date().toISOString(),
                expires_at: expiresAt,
            },
            { onConflict: "app_store_transaction_id" }
        )
        .select()
        .single();

    if (dbError) {
        console.error("Entitlement upsert error:", dbError);
        return new Response(JSON.stringify({ error: "Database error" }), { status: 500 });
    }

    // If this is a Spotlight, also update the profile
    if (product_id === "MatchMaker_Spotlight_1_day") {
        await supabase
            .from("profiles")
            .update({
                is_spotlight_active: true,
                spotlight_expires_at: expiresAt,
            })
            .eq("id", profile.id);
    }

    // If this is a subscription, update is_premium on profile
    if (productType === "subscription") {
        await supabase
            .from("profiles")
            .update({ is_premium: true })
            .eq("id", profile.id);
    }

    return new Response(JSON.stringify({
        success: true,
        entitlement_id: entitlement.id,
        expires_at: expiresAt,
    }), { status: 200 });
});
```

## 9.3 Stripe Purchase Tracking (Existing)

The `handle-stripe-webhook` Edge Function already records purchases to the `purchases` table. To integrate with the unified entitlements system, add entitlement creation to the webhook handler:

```typescript
// Add to handle-stripe-webhook/index.ts after the existing purchase upsert:

// Also create an entitlement record for unified access control
const entitlementData: Record<string, any> = {
    profile_id: null,  // Will be set if we can find the profile
    product_id: product,
    product_type: "one_time",
    source: "stripe",
    stripe_session_id: sessionId,
    stripe_payment_intent: paymentIntent,
    amount_cents: amountTotal,
    access_code: accessCode,
    status: "completed",
    starts_at: new Date().toISOString(),
    expires_at: product === "dating_coach"
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : null,  // Playbook = lifetime (null = no expiry)
};

// Try to find the profile by email
const { data: profile } = await supabase
    .from("profiles")
    .select("id")
    .eq("email", email)
    .limit(1)
    .single();

if (profile) {
    entitlementData.profile_id = profile.id;
}

await supabase.from("entitlements").upsert(
    entitlementData,
    { onConflict: "stripe_session_id" }
);
```

## 9.4 Cross-Platform Access

**Scenario: User buys Playbook on web, wants Dating Coach access on iOS app**

1. User purchases Playbook at matchmakersusa.com via Stripe checkout
2. `handle-stripe-webhook` creates a row in `entitlements` with `source = 'stripe'`, `product_id = 'playbook'`, linked by email
3. User downloads iOS app and creates an account with the same email
4. iOS app calls `EntitlementManager.checkAccess(product: "playbook")`
5. Query: `SELECT * FROM entitlements WHERE profile_id = $1 AND product_id = 'playbook' AND status = 'active'`
6. Access granted

**Scenario: User buys subscription on iOS, accesses Dating Coach on web**

1. User purchases `MatchMaker_1_month` via StoreKit
2. `verify-app-store-receipt` Edge Function creates a row in `entitlements` with `source = 'app_store'`
3. User logs into matchmakersusa.com with the same email
4. Website calls `check-eligibility` Edge Function
5. Edge Function checks `entitlements` table for any active subscription
6. Access granted

**EntitlementManager.swift (iOS):**

```swift
// EntitlementManager.swift
import Foundation
import Supabase
import StoreKit

class EntitlementManager {
    
    private let supabase = SupabaseManager.shared.client
    
    /// Check if the current user has access to a specific product
    func hasAccess(to productId: String) async throws -> Bool {
        guard let profileId = SupabaseManager.shared.currentProfileId else {
            return false
        }
        
        let entitlements: [Entitlement] = try await supabase.database
            .from("entitlements")
            .select()
            .eq("profile_id", value: profileId)
            .eq("product_id", value: productId)
            .in("status", values: ["active", "grace_period"])
            .execute()
            .value
        
        // Check if any active entitlement exists
        for entitlement in entitlements {
            if let expiresAt = entitlement.expiresAt {
                if expiresAt > Date() {
                    return true
                }
            } else {
                // No expiry = lifetime access
                return true
            }
        }
        
        return false
    }
    
    /// Check if user has any active subscription (for premium features)
    func hasActiveSubscription() async throws -> Bool {
        guard let profileId = SupabaseManager.shared.currentProfileId else {
            return false
        }
        
        let subscriptions: [Entitlement] = try await supabase.database
            .from("entitlements")
            .select()
            .eq("profile_id", value: profileId)
            .eq("product_type", value: "subscription")
            .in("status", values: ["active", "grace_period"])
            .gt("expires_at", value: ISO8601DateFormatter().string(from: Date()))
            .limit(1)
            .execute()
            .value
        
        return !subscriptions.isEmpty
    }
    
    /// Verify a StoreKit 2 transaction and sync to Supabase
    func verifyAndSync(transaction: StoreKit.Transaction) async throws {
        let response = try await supabase.functions.invoke(
            "verify-app-store-receipt",
            options: .init(body: [
                "transaction_id": transaction.id.description,
                "product_id": transaction.productID,
                "original_transaction_id": transaction.originalID.description,
            ] as [String: String])
        )
        
        // The Edge Function handles the entitlement creation
        // Finish the transaction after server confirms
        await transaction.finish()
    }
    
    /// Listen for StoreKit transaction updates
    func observeTransactions() async {
        for await result in StoreKit.Transaction.updates {
            guard case .verified(let transaction) = result else { continue }
            
            do {
                try await verifyAndSync(transaction: transaction)
            } catch {
                print("Failed to sync transaction: \(error)")
            }
        }
    }
    
    /// Restore purchases (re-sync all App Store transactions)
    func restorePurchases() async throws {
        for await result in StoreKit.Transaction.currentEntitlements {
            guard case .verified(let transaction) = result else { continue }
            try await verifyAndSync(transaction: transaction)
        }
    }
    
    /// Get all active entitlements for the current user
    func getAllEntitlements() async throws -> [Entitlement] {
        guard let profileId = SupabaseManager.shared.currentProfileId else {
            return []
        }
        
        let entitlements: [Entitlement] = try await supabase.database
            .from("entitlements")
            .select()
            .eq("profile_id", value: profileId)
            .in("status", values: ["active", "grace_period"])
            .order("created_at", ascending: false)
            .execute()
            .value
        
        return entitlements
    }
}
```

## 9.5 Subscription Lifecycle States

```
                              +----> [grace_period] ----> [expired]
                              |           |
[new purchase] --> [active] --+           +----> [active] (if payment recovered)
                     |        |
                     |        +----> [cancelled] ----> [expired] (at period end)
                     |
                     +----> [refunded]
                     |
                     +----> [revoked] (App Store revocation)
```

**Cron job for entitlement lifecycle management:**

```sql
-- Run every hour via Supabase pg_cron
-- Expire entitlements past their expiry date
UPDATE entitlements
SET status = 'expired', updated_at = NOW()
WHERE status IN ('active', 'grace_period')
    AND expires_at IS NOT NULL
    AND expires_at < NOW();

-- Expire Spotlight and update profile
UPDATE profiles
SET is_spotlight_active = false,
    spotlight_expires_at = NULL,
    updated_at = NOW()
WHERE is_spotlight_active = true
    AND spotlight_expires_at IS NOT NULL
    AND spotlight_expires_at < NOW();

-- Mark premium = false for users with no active subscriptions
UPDATE profiles
SET is_premium = false, updated_at = NOW()
WHERE is_premium = true
    AND NOT EXISTS (
        SELECT 1 FROM entitlements
        WHERE entitlements.profile_id = profiles.id
            AND entitlements.product_type = 'subscription'
            AND entitlements.status IN ('active', 'grace_period')
            AND (entitlements.expires_at IS NULL OR entitlements.expires_at > NOW())
    );
```

---

# 10. Push Notifications Migration

## 10.1 Recommendation: Supabase Edge Function + APNs Direct

**Recommended approach:** Replace FCM with direct APNs (Apple Push Notification service) calls from Supabase Edge Functions.

**Trade-offs:**

| Approach | Pros | Cons |
|----------|------|------|
| **APNs direct (Recommended)** | No Firebase dependency; full control; lower latency; works for iOS-only right now | Must implement APNs protocol; need APNs auth key management |
| Keep FCM for delivery | Familiar; multi-platform ready; proven reliability | Maintains Firebase dependency; adds complexity for Android when it launches on Supabase |
| Use a push service (OneSignal, Knock) | Easy multi-platform; rich features; analytics | Third-party dependency; cost; data leaves your system |

**Recommendation rationale:** Since Android will be built on Supabase (not Firebase), keeping FCM only for push delivery adds unnecessary complexity. APNs direct is straightforward for iOS. When Android launches, add FCM delivery for Android only, triggered from the same Edge Function.

## 10.2 APNs Push Notification Edge Function

```typescript
// supabase/functions/send-push-notification/index.ts
import "@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID")!;
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID")!;
const APNS_PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY")!;  // .p8 key contents
const APNS_BUNDLE_ID = "com.matchmakersusa.app";  // Replace with actual bundle ID

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// APNs JWT token (cached for 50 minutes; Apple allows up to 60)
let cachedToken: { jwt: string; expiresAt: number } | null = null;

async function getAPNsToken(): Promise<string> {
    const now = Math.floor(Date.now() / 1000);
    
    if (cachedToken && cachedToken.expiresAt > now) {
        return cachedToken.jwt;
    }

    // Create JWT for APNs authentication
    const header = btoa(JSON.stringify({ alg: "ES256", kid: APNS_KEY_ID }));
    const payload = btoa(JSON.stringify({ iss: APNS_TEAM_ID, iat: now }));
    
    const signingInput = `${header}.${payload}`;
    
    // Import the private key
    const pemContent = APNS_PRIVATE_KEY
        .replace("-----BEGIN PRIVATE KEY-----", "")
        .replace("-----END PRIVATE KEY-----", "")
        .replace(/\s/g, "");
    const keyData = Uint8Array.from(atob(pemContent), c => c.charCodeAt(0));
    
    const key = await crypto.subtle.importKey(
        "pkcs8",
        keyData,
        { name: "ECDSA", namedCurve: "P-256" },
        false,
        ["sign"]
    );
    
    const signature = await crypto.subtle.sign(
        { name: "ECDSA", hash: "SHA-256" },
        key,
        new TextEncoder().encode(signingInput)
    );
    
    // Convert DER signature to JWT format
    const sig = btoa(String.fromCharCode(...new Uint8Array(signature)));
    const jwt = `${header}.${payload}.${sig}`;
    
    cachedToken = { jwt, expiresAt: now + 3000 }; // Cache for 50 minutes
    return jwt;
}

async function sendAPNs(
    deviceToken: string,
    title: string,
    body: string,
    payload: Record<string, unknown>,
    isProduction: boolean = true
): Promise<boolean> {
    const host = isProduction
        ? "api.push.apple.com"
        : "api.sandbox.push.apple.com";
    
    const token = await getAPNsToken();
    
    const apnsPayload = {
        aps: {
            alert: { title, body },
            sound: "default",
            badge: 1,
            "mutable-content": 1,
        },
        ...payload,
    };
    
    const response = await fetch(
        `https://${host}/3/device/${deviceToken}`,
        {
            method: "POST",
            headers: {
                "authorization": `bearer ${token}`,
                "apns-topic": APNS_BUNDLE_ID,
                "apns-push-type": "alert",
                "apns-priority": "10",
                "apns-expiration": "0",
                "content-type": "application/json",
            },
            body: JSON.stringify(apnsPayload),
        }
    );
    
    if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        console.error(`APNs error for token ${deviceToken.substring(0, 8)}...:`, response.status, error);
        
        // If token is invalid, deactivate it
        if (response.status === 410 || (error as any).reason === "Unregistered") {
            await supabase
                .from("push_tokens")
                .update({ is_active: false })
                .eq("token", deviceToken);
        }
        
        return false;
    }
    
    return true;
}

Deno.serve(async (req: Request) => {
    if (req.method !== "POST") {
        return new Response(JSON.stringify({ error: "Method not allowed" }), { status: 405 });
    }

    const body = await req.json();
    const { recipient_id, sender_id, type, title, body: notifBody, payload = {} } = body;

    if (!recipient_id || !title || !notifBody) {
        return new Response(JSON.stringify({ error: "Missing required fields" }), { status: 400 });
    }

    // Get active push tokens for the recipient
    const { data: tokens } = await supabase
        .from("push_tokens")
        .select("token, platform, token_type")
        .eq("profile_id", recipient_id)
        .eq("is_active", true);

    if (!tokens || tokens.length === 0) {
        console.log(`No active push tokens for profile ${recipient_id}`);
        return new Response(JSON.stringify({ sent: 0 }), { status: 200 });
    }

    // Send to all active tokens
    let sent = 0;
    for (const tokenRecord of tokens) {
        if (tokenRecord.token_type === "apns" || tokenRecord.platform === "ios") {
            const success = await sendAPNs(
                tokenRecord.token,
                title,
                notifBody,
                { type, sender_id, ...payload }
            );
            if (success) sent++;
        }
        // Future: add FCM delivery for Android tokens here
    }

    // Record the notification
    await supabase.from("notifications").insert({
        recipient_id,
        sender_id: sender_id || null,
        notification_type: type,
        title,
        body: notifBody,
        payload,
        delivered: sent > 0,
        delivered_at: sent > 0 ? new Date().toISOString() : null,
    });

    return new Response(JSON.stringify({ sent }), { status: 200 });
});
```

## 10.3 Database Triggers for Automatic Push Notifications

```sql
-- Trigger: Send push notification when a new message is inserted
CREATE OR REPLACE FUNCTION notify_new_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_recipient_id UUID;
    v_sender_name TEXT;
BEGIN
    -- Get the other participant in the conversation
    SELECT cp.profile_id INTO v_recipient_id
    FROM conversation_participants cp
    WHERE cp.conversation_id = NEW.conversation_id
        AND cp.profile_id != NEW.sender_id
    LIMIT 1;
    
    IF v_recipient_id IS NULL THEN RETURN NEW; END IF;
    
    -- Get sender's display name
    SELECT display_name INTO v_sender_name
    FROM profiles WHERE id = NEW.sender_id;
    
    -- Call the push notification Edge Function via pg_net
    PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/send-push-notification',
        headers := jsonb_build_object(
            'Authorization', 'Bearer ' || current_setting('app.service_role_key'),
            'Content-Type', 'application/json'
        ),
        body := jsonb_build_object(
            'recipient_id', v_recipient_id,
            'sender_id', NEW.sender_id,
            'type', 'new_message',
            'title', COALESCE(v_sender_name, 'New Message'),
            'body', LEFT(NEW.body, 100),
            'payload', jsonb_build_object(
                'conversation_id', NEW.conversation_id
            )
        )
    );
    
    -- Increment unread count for the recipient
    UPDATE conversation_participants
    SET unread_count = unread_count + 1
    WHERE conversation_id = NEW.conversation_id
        AND profile_id = v_recipient_id;
    
    RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_notify_new_message
AFTER INSERT ON messages
FOR EACH ROW
EXECUTE FUNCTION notify_new_message();
```

---

# 11. Performance & Scale Design

## 11.1 Database Indexing Strategy

All indexes are defined in Section 2.1.7. The key indexing principles:

1. **Discovery queries** are the most common read operation. The composite index on `(gender, status, level, intent)` covers the primary filter columns.
2. **Inbox queries** need fast conversation lookup by participant. The index on `conversation_participants(profile_id, conversation_id)` enables this.
3. **Message loading** uses `messages(conversation_id, created_at DESC)` for paginated conversation history.
4. **Entitlement checks** use `entitlements(profile_id, product_id, status)` for fast access verification.

## 11.2 Caching Approach

| Data | Cache Location | TTL | Invalidation |
|------|---------------|-----|-------------- |
| Current user profile | iOS: In-memory (SupabaseManager.currentProfile) | Session lifetime | On profile update |
| Discovery profiles | iOS: In-memory array | 5 minutes or on filter change | On new filter/refresh |
| Conversation list | iOS: In-memory + Realtime updates | Realtime (always fresh) | Realtime subscription |
| Admin settings | iOS: UserDefaults | 1 hour | On app foreground |
| Photo URLs | iOS: URLCache (NSURLSession default) | HTTP Cache-Control header (24 hours) | On photo change |
| Entitlement status | iOS: In-memory | 15 minutes | On purchase/restore |

**Server-side caching (future optimization):**

If query volume grows beyond what direct PostgreSQL handles, add a materialized view for Discovery:

```sql
-- Materialized view for Discovery (refreshed every 5 minutes)
CREATE MATERIALIZED VIEW discovery_profiles AS
SELECT 
    p.id, p.display_name, p.age, p.city, p.state, p.gender,
    p.intent, p.level, p.quality_score, p.is_spotlight_active,
    p.latitude, p.longitude, p.last_active_at,
    (
        SELECT pp.public_url FROM profile_photos pp 
        WHERE pp.profile_id = p.id AND pp.is_primary = TRUE LIMIT 1
    ) as primary_photo_url
FROM profiles p
WHERE p.status = 'active' AND p.deleted_at IS NULL AND p.quality_score >= 3.0
ORDER BY p.is_spotlight_active DESC, p.quality_score DESC, p.last_active_at DESC;

CREATE UNIQUE INDEX ON discovery_profiles (id);

-- Refresh periodically
-- (pg_cron job: every 5 minutes)
SELECT cron.schedule('refresh-discovery', '*/5 * * * *', 'REFRESH MATERIALIZED VIEW CONCURRENTLY discovery_profiles');
```

## 11.3 Connection Pooling

Supabase Pro plan includes Supavisor connection pooling. Configuration:

| Setting | Value | Rationale |
|---------|-------|-----------|
| Pool mode | Transaction | Recommended for serverless; connections are returned to pool after each transaction |
| Default pool size | 15 | Sufficient for current load (under 50 concurrent users) |
| Max client connections | 200 | Allows for growth |
| Statement timeout | 30s | Prevents runaway queries |

**Connection string usage:**

```
# Direct connection (for migrations, admin)
postgresql://postgres:[password]@db.[project].supabase.co:5432/postgres

# Pooled connection (for application queries)
postgresql://postgres.[project]:[password]@aws-0-us-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true
```

## 11.4 Query Optimization for Discovery/Matching

**Problem:** Discovery must exclude blocked users, already-rated users, and apply multiple filters. Naive implementation scans the entire profiles table for each exclusion check.

**Solution:** The `get_discovery_profiles` RPC function (Section 6.7) uses `NOT EXISTS` subqueries with indexed lookups, which PostgreSQL optimizes into anti-joins. For the current data volume (30K-70K profiles), this performs well without additional optimization.

**At scale (100K+ profiles):** Add a pre-computed "eligible for discovery" table that is refreshed periodically, eliminating the need for real-time exclusion checks:

```sql
-- Pre-computed Discovery candidates per user
-- Refresh every 15 minutes or on block/rate events
CREATE TABLE discovery_candidates (
    profile_id UUID NOT NULL REFERENCES profiles(id),
    candidate_id UUID NOT NULL REFERENCES profiles(id),
    relevance_score NUMERIC DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (profile_id, candidate_id)
);
```

## 11.5 Real-Time Messaging Performance at Scale

**Current scale:** Under 50 active paid subscribers means very low real-time connection count (likely under 200 concurrent WebSocket connections).

**Supabase Realtime limits by plan:**

| Plan | Concurrent connections | Messages/second |
|------|----------------------|-----------------|
| Free | 200 | 100 |
| Pro | 500 | 500 |
| Team | 5,000 | 5,000 |
| Enterprise | Custom | Custom |

**Recommendation:** Start on Pro plan. If concurrent connections exceed 400, upgrade to Team.

**Optimization for high-volume messaging:**

1. **Channel granularity:** Subscribe to individual conversation channels, not a global messages channel. This prevents clients from receiving irrelevant messages.

2. **Payload filtering:** Use Realtime filters to only receive messages for the current conversation:
```swift
channel.postgresChange(
    InsertAction.self,
    table: "messages",
    filter: .eq("conversation_id", value: currentConversationId)
)
```

3. **Backpressure:** If a conversation has rapid-fire messages, batch UI updates using debouncing (250ms) rather than rendering each message immediately.

---

# 12. QA & Zero-Regression Plan

## 12.1 Pre-Migration Test Checklist

Execute these tests against the staging environment before any production changes:

| # | Test | Steps | Expected Result | Status |
|---|------|-------|-----------------|--------|
| 1 | User sign-in | Enter email + password for a migrated user | Successful login; profile loads | [ ] |
| 2 | User sign-up | Create new account | Account created; profile row exists | [ ] |
| 3 | Profile view | Navigate to own profile | All fields display correctly; photos load | [ ] |
| 4 | Profile edit | Change bio, city, photo order | Changes persist after refresh | [ ] |
| 5 | Photo upload | Upload a new photo | Photo appears in profile; stored in Supabase Storage | [ ] |
| 6 | Discovery browsing | Open Discovery tab | Profiles load; photos display; filters work | [ ] |
| 7 | Rate a profile (6-9) | Select a level for a profile | Rating saved; next profile loads | [ ] |
| 8 | Press M button | Press M on a profile | Connection request created; appears in recipient's Requests | [ ] |
| 9 | Mutual match | Both users press M on each other | Conversation created; both see each other in Messages | [ ] |
| 10 | Send message | Type and send a text message | Message appears in conversation; real-time delivery to other participant | [ ] |
| 11 | Receive message (real-time) | Other user sends a message | Message appears without manual refresh | [ ] |
| 12 | Push notification (new message) | Send a message to a user with the app backgrounded | Push notification received on device | [ ] |
| 13 | Push notification (new request) | Press M on someone | They receive a push notification | [ ] |
| 14 | Block user | Block a user from their profile | Blocked user disappears from Discovery; messages hidden | [ ] |
| 15 | Report user | Report a profile | Report record created; confirmation shown | [ ] |
| 16 | Subscription check | User with active sub accesses premium feature | Access granted | [ ] |
| 17 | Subscription expired | User with expired sub accesses premium feature | Access denied; upgrade prompt shown | [ ] |
| 18 | Spotlight purchase | Buy Spotlight via StoreKit | Spotlight activates; profile appears at top of Discovery | [ ] |
| 19 | Playbook access (web purchase) | User who bought Playbook on web checks access on iOS | Access granted | [ ] |
| 20 | Dating Coach access | User with active Dating Coach opens coach | AI coach responds correctly | [ ] |
| 21 | Level display | View a profile with Level 8 | Level 8 badge displays correctly | [ ] |
| 22 | Photo ranking | Community ranks photos | Rank order updates correctly | [ ] |
| 23 | Password reset | Request password reset email | Email received; password successfully changed | [ ] |
| 24 | Session persistence | Kill and reopen app | User remains logged in | [ ] |
| 25 | Offline handling | Attempt actions with no network | Appropriate error messages; no crashes | [ ] |

## 12.2 Post-Migration Validation Checklist

Run these queries immediately after cutover to validate data integrity:

```sql
-- 1. Total profile count matches Firebase
SELECT COUNT(*) AS supabase_profiles FROM profiles;
-- Compare with Firebase user count

-- 2. No duplicate emails
SELECT email, COUNT(*) FROM profiles GROUP BY email HAVING COUNT(*) > 1;
-- Expected: 0 rows

-- 3. All profiles have valid auth links
SELECT COUNT(*) AS profiles_without_auth
FROM profiles 
WHERE supabase_auth_id IS NULL AND status = 'active';
-- Expected: 0 (all active profiles should be linked)

-- 4. Message count matches
SELECT COUNT(*) AS supabase_messages FROM messages;
-- Compare with Firebase message count

-- 5. All conversations have exactly 2 participants (for direct messages)
SELECT c.id, COUNT(cp.id) AS participant_count
FROM conversations c
JOIN conversation_participants cp ON cp.conversation_id = c.id
WHERE c.conversation_type = 'direct'
GROUP BY c.id
HAVING COUNT(cp.id) != 2;
-- Expected: 0 rows

-- 6. No orphaned messages (messages without valid conversations)
SELECT COUNT(*) FROM messages m
LEFT JOIN conversations c ON c.id = m.conversation_id
WHERE c.id IS NULL;
-- Expected: 0

-- 7. No orphaned messages (messages without valid senders)
SELECT COUNT(*) FROM messages m
LEFT JOIN profiles p ON p.id = m.sender_id
WHERE p.id IS NULL;
-- Expected: 0

-- 8. Connection integrity (no self-connections)
SELECT * FROM connections WHERE requester_id = recipient_id;
-- Expected: 0 rows

-- 9. All photos have valid URLs
SELECT COUNT(*) FROM profile_photos WHERE public_url IS NULL OR public_url = '';
-- Expected: 0

-- 10. Entitlements populated from existing purchases
SELECT COUNT(*) FROM entitlements;
SELECT COUNT(*) FROM purchases WHERE status = 'completed';
-- Entitlement count should be >= purchase count

-- 11. Admin settings migrated
SELECT COUNT(*) FROM admin_settings;
-- Should match Firebase /Admin/Settings/ key count

-- 12. Active subscriptions preserved
SELECT COUNT(*) FROM entitlements 
WHERE product_type = 'subscription' AND status = 'active';
-- Compare with known active subscriber count
```

## 12.3 Edge Cases

| Edge Case | Risk | Mitigation |
|-----------|------|------------|
| Partial user profiles (missing required fields) | Some Firebase users may lack email or display_name | Transformation script assigns defaults; flagged for review |
| Corrupted Firebase JSON (malformed data) | 7 years of schema drift | Try/catch in transformation; log and skip corrupted records |
| Orphaned messages (conversation deleted but messages remain) | Firebase allows partial deletions | Transformation validates conversation existence before importing messages |
| Duplicate connections (stored on both users in Firebase) | Firebase denormalization | Deduplicate during transformation; use UNIQUE constraint |
| Users with email but no password | Possible if Firebase allowed social login at some point | Create Supabase auth user with random password; force password reset on first login |
| Extremely old timestamps (pre-2020) | JavaScript `Date(0)` or null timestamps | Normalize to NULL if timestamp is before 2017 (platform launch) |
| Large profile photos (> 10MB) | Firebase had no file size limit | Resize/compress during media migration; set 10MB limit in Supabase Storage |
| HTML/script injection in user bios | No input sanitization in Firebase | Sanitize all text fields during transformation; add input validation in RLS |
| Users who are both blocker and blocked by same person | Possible in Firebase | Preserved as-is; both block records imported |
| Messages with Firebase Storage media URLs | Images referenced by Firebase URL | URL rewriting (Section 5.3) handles this; fallback redirect for cached URLs |

## 12.4 Automated Smoke Tests

```typescript
// tests/smoke-test.ts
// Run after migration to verify critical paths
// Execute with: deno test --allow-net --allow-env tests/smoke-test.ts

import { createClient } from "@supabase/supabase-js";
import { assertEquals, assertExists } from "https://deno.land/std/assert/mod.ts";

const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

Deno.test("Profiles table is populated", async () => {
    const { count } = await supabase.from("profiles").select("*", { count: "exact", head: true });
    assertExists(count);
    console.log(`Profile count: ${count}`);
    // Adjust threshold based on known Firebase user count
    assertEquals(count! > 10000, true, "Expected at least 10,000 profiles");
});

Deno.test("No duplicate emails in profiles", async () => {
    const { data } = await supabase.rpc("check_duplicate_emails");
    assertEquals(data?.length ?? 0, 0, "Found duplicate emails");
});

Deno.test("Messages table is populated", async () => {
    const { count } = await supabase.from("messages").select("*", { count: "exact", head: true });
    assertExists(count);
    console.log(`Message count: ${count}`);
    assertEquals(count! > 0, true, "Expected messages to be migrated");
});

Deno.test("Conversations have correct participant count", async () => {
    const { data } = await supabase.rpc("check_conversation_participants");
    assertEquals(data?.length ?? 0, 0, "Found conversations with wrong participant count");
});

Deno.test("Auth users exist for active profiles", async () => {
    const { data: profiles } = await supabase
        .from("profiles")
        .select("id, email, supabase_auth_id")
        .eq("status", "active")
        .is("supabase_auth_id", null)
        .limit(5);
    
    assertEquals(
        profiles?.length ?? 0,
        0,
        `Found ${profiles?.length} active profiles without auth links: ${JSON.stringify(profiles)}`
    );
});

Deno.test("Profile photos have valid URLs", async () => {
    const { data } = await supabase
        .from("profile_photos")
        .select("id, public_url")
        .or("public_url.is.null,public_url.eq.")
        .limit(5);
    
    assertEquals(data?.length ?? 0, 0, "Found photos without valid URLs");
});

Deno.test("Admin settings migrated", async () => {
    const { count } = await supabase.from("admin_settings").select("*", { count: "exact", head: true });
    assertExists(count);
    assertEquals(count! > 0, true, "Expected admin settings to be migrated");
});

Deno.test("Edge Function: check-eligibility responds", async () => {
    const response = await supabase.functions.invoke("check-eligibility", {
        body: { email: "test@example.com", action: "check-eligibility", product: "dating_coach" },
    });
    assertExists(response.data);
});

Deno.test("Real-time connection works", async () => {
    const channel = supabase.realtime.channel("smoke-test");
    let connected = false;
    
    channel.subscribe((status) => {
        if (status === "SUBSCRIBED") connected = true;
    });
    
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 3000));
    assertEquals(connected, true, "Real-time connection failed");
    
    await channel.unsubscribe();
});
```

## 12.5 Manual Verification Steps

After automated tests pass, manually verify these with a real device:

1. Install the new app version on a physical iPhone
2. Log in with a known test account (migrated from Firebase)
3. Verify profile photos load correctly (not broken/missing)
4. Browse Discovery and verify profiles appear with correct data
5. Send a message to another test account; confirm real-time delivery
6. Background the app; send a message from another device; confirm push notification
7. Verify subscription status matches what was in Firebase
8. Try the Dating Coach (if the test account has access)
9. Check that the Level system displays correctly
10. Verify the Requests tab shows pending connection requests

---

# 13. Implementation Roadmap

## 13.1 Week-by-Week Breakdown

### Week 1: Schema & Infrastructure

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| Mon | Deploy schema to staging Supabase | Engineering | All tables, indexes, RLS policies created |
| Tue | Deploy Edge Functions to staging | Engineering | verify-app-store-receipt, send-push-notification deployed |
| Wed | Build Firebase export scripts | Engineering | firebase-export.js, auth export validated |
| Thu | Build data transformation scripts | Engineering | transform-users.js, transform-messages.js tested |
| Fri | Dry-run export/transform against Firebase production (read-only) | Engineering | Exported data validated; transformation produces clean output |

### Week 2: iOS App & Integration Testing

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| Mon | Build SupabaseManager.swift core + AuthManager | Engineering | Auth flow working against staging |
| Tue | Build ProfileManager + MediaManager | Engineering | Profile CRUD + photo upload working |
| Wed | Build DiscoveryManager + ConnectionManager | Engineering | Discovery browsing, rating, M button working |
| Thu | Build MessagingManager + real-time | Engineering | Messaging with real-time delivery working |
| Fri | Build EntitlementManager + NotificationManager | Engineering | StoreKit + push notifications working |

### Week 3: Data Migration & App Testing

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| Mon | Full data import to staging (profiles, messages, connections) | Engineering | All data loaded; validation queries pass |
| Tue | Media migration (Firebase Storage to Supabase Storage) | Engineering | All photos accessible via new URLs |
| Wed | Auth user import to staging | Engineering | All users can log in to staging |
| Thu | Full app testing against staging with real data | QA | Test checklist (Section 12.1) executed |
| Fri | Bug fixes from testing | Engineering | All P0/P1 issues resolved |

### Week 4: Pre-Cutover & Cutover

| Day | Task | Owner | Deliverable |
|-----|------|-------|-------------|
| Mon | Final bug fixes; prepare iOS app submission | Engineering | App ready for App Store review |
| Tue | Submit iOS app to App Store review | Engineering | App in review |
| Wed | Pre-load production Supabase with data (not yet live) | Engineering | Production DB populated |
| Thu | **CUTOVER DAY** (2-4 hour maintenance window, evening) | Engineering | Production live on Supabase |
| Fri | Post-cutover monitoring; handle support tickets | Engineering + Support | System stable; critical issues resolved |

### Weeks 5-6: Stabilization

| Week | Focus | Activities |
|------|-------|-----------|
| Week 5 | Monitoring & bug fixes | Daily validation queries; fix any data discrepancies; handle user-reported issues |
| Week 6 | Performance optimization | Identify slow queries; optimize indexes; establish baseline metrics |

### Weeks 7-9: Decommission & Cleanup

| Week | Focus | Activities |
|------|-------|-----------|
| Week 7 | Run quality scoring; archive low-quality profiles | Execute data cleanup (Section 7) |
| Week 8 | Downgrade Firebase plan; final data archive | Confirm zero Firebase reads from production |
| Week 9 | Remove Firebase SDKs from iOS app (next release) | Clean up codebase |

## 13.2 Dependencies Between Phases

```
Schema Design ─────────────> Data Transformation ──> Data Import to Staging
                                                          |
Auth Migration Design ──────> Auth Import Script ─────────|──> Auth Import to Staging
                                                          |
iOS App: Auth Module ──────────────────────────> Full App Testing Against Staging
iOS App: Profile Module ───────────────────────>      |
iOS App: Messaging Module ─────────────────────>      |
iOS App: Discovery Module ─────────────────────>      |
iOS App: Entitlement Module ───────────────────>      |
                                                      |
Media Download from Firebase ──> Media Upload ────────|
                                                      v
                                               App Store Submission
                                                      |
                                                      v
                                          Pre-load Production Data
                                                      |
                                                      v
                                              CUTOVER (Phase 2)
                                                      |
                                                      v
                                              Post-Cutover Monitoring
```

## 13.3 Risk Register with Mitigations

See Section 15 for the complete risk register.

## 13.4 Go/No-Go Criteria for Each Phase

**Phase 0 to Phase 1 (Start data export):**
- [ ] All tables created in staging with no errors
- [ ] All RLS policies applied and tested
- [ ] Export scripts tested against a Firebase subset
- [ ] At least one successful dry-run import to staging

**Phase 1 to Phase 2 (Start cutover):**
- [ ] All data imported to production Supabase (pre-cutover load)
- [ ] iOS app approved by App Store OR available via TestFlight
- [ ] All Edge Functions deployed to production
- [ ] All 25 items on pre-migration test checklist pass
- [ ] Auth import tested and validated
- [ ] Media migration complete (all photos accessible)
- [ ] Rollback plan documented and tested

**Phase 2 to Phase 3 (End maintenance window):**
- [ ] All 7 smoke test items pass (Section 12.7)
- [ ] Manual device testing confirms messaging works
- [ ] Push notifications delivering
- [ ] No P0 issues identified
- [ ] Firebase set to read-only

**Phase 3 to Phase 4 (Begin decommission):**
- [ ] 14 consecutive days with no Firebase reads from production code
- [ ] No open P0 or P1 migration-related bugs
- [ ] User support ticket volume returned to pre-migration baseline

---

# 14. Value Creation Impact

## 14.1 Company Valuation Increase

The migration from Firebase to a unified Supabase architecture directly impacts MatchMakers' valuation through multiple vectors:

**Technical Due Diligence Improvement:**
- A unified, well-documented architecture on PostgreSQL (industry standard) is significantly more attractive to acquirers and investors than a legacy Firebase setup
- Relational database with proper schema enables complex analytics queries that Firebase RTDB cannot support
- Row Level Security and proper access controls demonstrate security maturity
- Infrastructure costs become predictable and lower, improving unit economics

**Platform scalability story:**
- "Single backend serving iOS, web, and Android" is a stronger narrative than "Firebase for iOS, Supabase for web, with plans to figure out Android"
- The unified entitlements system demonstrates cross-platform monetization capability

## 14.2 Improved Retention Through Data Quality

**Current problem:** 10-30% of profiles are fake or abandoned, degrading the experience for active users who encounter empty or unresponsive profiles in Discovery.

**Post-migration impact:**
- The quality scoring system (Section 7) deprioritizes low-quality profiles in Discovery
- Automated archiving removes clearly abandoned profiles from the active pool
- Profile improvement prompts help borderline users become higher-quality participants
- Net effect: Active users see more real, engaged profiles, increasing match rates and reducing churn

**Estimated impact:** A 20% reduction in "dead profile" encounters in Discovery could improve week-1 retention by 5-10%, based on industry benchmarks for dating apps where early positive experiences are the primary retention driver.

## 14.3 Match Quality Improvements

The relational database enables match quality improvements that were impossible on Firebase RTDB:

1. **Intent compatibility scoring:** SQL-based matching can weight intent compatibility (e.g., Long-Term + Fall in Love = 0.9 compatibility) in Discovery ranking
2. **Activity-weighted Discovery:** Profiles with recent activity appear first, ensuring users connect with people who are actually available
3. **Geographic precision:** PostGIS-compatible location queries replace Firebase's limited geohash approach
4. **Cross-platform matching:** A user who signed up on web but is active on iOS now appears in both pools

## 14.4 Monetization Uplift from Unified Entitlements

**Current friction:** A user who buys the Playbook on the website cannot seamlessly access it from the iOS app without a separate verification step. This disconnect costs conversions.

**Post-migration flow:**
- Buy Playbook on web -> access via iOS app automatically (same email lookup)
- Buy subscription on iOS -> access Dating Coach on web automatically
- This removes purchase barriers and increases the addressable market for each product

**Estimated impact:** 10-20% increase in cross-platform purchase conversions based on the elimination of access friction.

## 14.5 Competitive Differentiation vs. Match Group

| Capability | Match Group (Tinder/Hinge/Match) | MatchMakers (Post-Migration) |
|-----------|--------------------------------|------------------------------|
| Intent declaration | Not available | Core feature with compatibility scoring |
| Community-driven quality (Levels) | Algorithms decide who you see | Community rates each other transparently |
| AI coaching integrated | Limited/none | Embedded Dating Coach powered by proprietary methodology |
| Cross-platform entitlements | Siloed per brand | Unified across iOS, web, Android |
| Profile quality scoring | Internal/opaque | Transparent with improvement guidance |
| Open architecture | Proprietary, closed | PostgreSQL-based, extensible |

The unified Supabase architecture enables MatchMakers to iterate on features faster than Match Group properties, which are constrained by legacy infrastructure and organizational complexity. A well-architected startup with 30K-70K users can ship features in days that take Match Group months.

---

# 15. Risk Register

## Top 10 Risks

| # | Risk | Probability | Impact | Overall | Mitigation |
|---|------|------------|--------|---------|------------|
| R1 | **Data loss during migration** -- records missing or corrupted after cutover | Low | Critical | High | Triple-backup strategy: (1) Firebase export JSON, (2) pre-cutover Supabase snapshot, (3) Firebase remains read-only for cross-reference. Validation queries run immediately post-cutover. Rollback plan restores Firebase write access within 15 minutes. |
| R2 | **Auth migration failure** -- users cannot log in after cutover | Medium | Critical | High | Test auth import against staging with 100% of users. Fallback: "Forgot Password" flow available immediately. Pre-cutover email sent to all users with password reset link as safety net. |
| R3 | **Real-time messaging broken** -- messages not delivering in real-time | Medium | High | High | Extensive testing of Supabase Realtime against staging. Fallback: polling-based message fetch (every 5 seconds) as degraded mode. Real-time is an enhancement; polling ensures no messages are lost. |
| R4 | **App Store review rejection** -- iOS app update rejected, delaying cutover | Medium | High | High | Submit app for review 7+ days before planned cutover. Use TestFlight as backup distribution. Cutover date can flex (no hard deadline). |
| R5 | **StoreKit subscription sync failure** -- active subscribers lose premium access | Low | Critical | High | Verify all active subscribers before cutover. Manual entitlement grants as immediate fix for any subscriber who reports access loss. Under 50 subscribers means manual verification is feasible. |
| R6 | **Firebase Storage media inaccessible** -- profile photos fail to load | Medium | Medium | Medium | Upload all media to Supabase Storage before cutover. Firebase Storage URLs remain accessible (Firebase is not deleted). URL redirect Edge Function handles stale cached URLs. |
| R7 | **Performance degradation under load** -- slow queries or timeouts | Low | Medium | Medium | Current load is minimal (under 50 concurrent users). Indexes designed for all critical queries. Supabase Pro plan handles this volume easily. Monitor query performance dashboard daily for first 2 weeks. |
| R8 | **Schema drift in Firebase data** -- unexpected field names or data types | High | Low | Medium | Transformation scripts handle known variants (7+ naming conventions per field). Unknown fields preserved in `firebase_raw_json` JSONB column. Manual review of transformation errors before cutover. |
| R9 | **Edge Function cold starts** -- push notifications or receipt verification delayed | Low | Low | Low | Supabase Edge Functions have sub-second cold starts. Not a blocking issue for any MatchMakers use case. Pre-warm functions by calling them once before cutover. |
| R10 | **User confusion post-update** -- support tickets from users who don't understand the update | Medium | Low | Low | Pre-migration push notification and email explaining the update. In-app banner on first launch of new version. Support team briefed with FAQ document. |

## Risk Response Plan

**If R1 (data loss) occurs:**
1. Immediately compare Supabase data with Firebase read-only data
2. Run targeted delta import for missing records
3. If widespread: execute rollback plan (restore Firebase write access, roll back iOS app via TestFlight)

**If R2 (auth failure) occurs:**
1. Check GoTrue logs for specific error patterns
2. If password hash format issue: trigger bulk password reset emails
3. If systematic: extend maintenance window and debug auth import

**If R5 (subscription sync) occurs:**
1. Query `entitlements` table for the subscriber's email
2. If missing: manually insert entitlement with admin_grant source
3. Contact subscriber directly to confirm access restored

---

# 16. Phase Two Audit Framework

## 16.1 Post-Migration Optimization Opportunities

After the migration is stable (Week 7+), conduct a systematic audit of the following areas:

### Database Optimization Audit

| Area | Audit Action | Potential Improvement |
|------|-------------|----------------------|
| Slow queries | Review `pg_stat_statements` for queries > 100ms | Add missing indexes, rewrite inefficient queries |
| Table bloat | Check `pg_stat_user_tables` for dead tuples | Configure autovacuum settings |
| Index usage | Review `pg_stat_user_indexes` for unused indexes | Drop unused indexes to save storage and write overhead |
| Connection usage | Monitor connection pool utilization | Adjust pool size if over/under-provisioned |
| Storage size | Review `pg_database_size` and per-table sizes | Implement table partitioning for activity_log if > 1GB |

### Query Performance Baseline

```sql
-- Install pg_stat_statements extension (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;

-- Top 10 slowest queries by total time
SELECT 
    query,
    calls,
    total_exec_time / 1000 AS total_seconds,
    mean_exec_time AS avg_ms,
    rows
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 10;

-- Top 10 most called queries
SELECT 
    query,
    calls,
    mean_exec_time AS avg_ms,
    rows
FROM pg_stat_statements
ORDER BY calls DESC
LIMIT 10;
```

## 16.2 UX/UI Improvements Enabled by New Architecture

The unified Supabase backend enables several UX improvements that were impossible or impractical on Firebase:

| Improvement | Enabled By | Priority |
|------------|-----------|----------|
| **Cross-platform purchase access indicator** | Unified entitlements table | High -- reduces support tickets |
| **"Last active" status on profiles** | `last_active_at` timestamp, updated on every app session | Medium -- improves Discovery quality |
| **Read receipts in messaging** | `read_at` column on messages + Realtime | Medium -- standard messaging feature |
| **Typing indicators** | Supabase Realtime Broadcast channels | Low -- nice to have |
| **Online/offline presence** | Supabase Realtime Presence | Medium -- shows who is actively using the app |
| **Profile completion progress bar** | `completeness_pct` column with real-time calculation | High -- drives profile quality |
| **"People who selected you" count in Requests** | Query connections table | Low -- engagement metric |
| **Message search** | Full-text search on messages table (PostgreSQL `tsvector`) | Low -- useful for power users |
| **Advanced Discovery filters** | Relational queries with multiple JOINs | Medium -- filter by multiple criteria simultaneously |
| **Notification center** | `notifications` table with unread tracking | Medium -- replaces fragmented push-only model |

## 16.3 Performance Benchmarking

Establish these benchmarks within 2 weeks post-migration and measure monthly:

| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Discovery page load (cold) | < 500ms | iOS Instruments / Supabase dashboard |
| Discovery page load (warm) | < 200ms | iOS Instruments |
| Message send-to-receive latency | < 1s | Timestamp comparison between send and Realtime delivery |
| Profile photo load time | < 300ms | iOS network logs |
| Auth sign-in time | < 1s | Supabase Auth logs |
| Inbox load time | < 400ms | Query execution time |
| Push notification delivery | < 5s from trigger to device | APNs delivery receipts |
| API error rate | < 0.1% | Supabase dashboard |
| Real-time connection stability | > 99.5% uptime | WebSocket connection monitoring |

## 16.4 Conversion Optimization

Post-migration, the unified data model enables conversion tracking and optimization:

**Funnel: Free User to Paid Subscriber**
```sql
-- Analyze conversion funnel
WITH funnel AS (
    SELECT 
        p.id,
        p.created_at AS signup_date,
        (SELECT MIN(r.created_at) FROM ratings r WHERE r.rater_id = p.id) AS first_rate_date,
        (SELECT MIN(c.created_at) FROM connections c WHERE c.requester_id = p.id AND c.status = 'mutual') AS first_match_date,
        (SELECT MIN(m.created_at) FROM messages m WHERE m.sender_id = p.id) AS first_message_date,
        (SELECT MIN(e.created_at) FROM entitlements e WHERE e.profile_id = p.id AND e.product_type = 'subscription') AS subscription_date
    FROM profiles p
    WHERE p.created_at > NOW() - INTERVAL '90 days'
)
SELECT 
    COUNT(*) AS total_signups,
    COUNT(first_rate_date) AS rated_someone,
    COUNT(first_match_date) AS got_a_match,
    COUNT(first_message_date) AS sent_message,
    COUNT(subscription_date) AS subscribed,
    ROUND(100.0 * COUNT(first_rate_date) / NULLIF(COUNT(*), 0), 1) AS rate_pct,
    ROUND(100.0 * COUNT(first_match_date) / NULLIF(COUNT(*), 0), 1) AS match_pct,
    ROUND(100.0 * COUNT(first_message_date) / NULLIF(COUNT(*), 0), 1) AS message_pct,
    ROUND(100.0 * COUNT(subscription_date) / NULLIF(COUNT(*), 0), 1) AS subscription_pct
FROM funnel;
```

**Funnel: App User to Web Product Purchase**
```sql
-- Users who engage on the app and then buy on the web
SELECT 
    e.product_id,
    COUNT(*) AS purchases,
    AVG(EXTRACT(DAY FROM e.created_at - p.created_at)) AS avg_days_from_signup
FROM entitlements e
JOIN profiles p ON p.id = e.profile_id
WHERE e.source = 'stripe'
    AND e.status = 'active'
GROUP BY e.product_id;
```

These analytics queries are only possible with the relational schema and would have required complex client-side aggregation on Firebase.

---

# Appendix A: Data Model Diagram (Text-Based)

```
profiles (1) ─────── (N) profile_photos
    |
    ├── (1) ─── (1) profile_preferences
    |
    ├── (N) ─── conversation_participants ─── (N) conversations
    |                                              |
    |                                         (N) messages
    |
    ├── (N as requester) ─── connections ─── (N as recipient)
    |
    ├── (N as rater) ────── ratings ────── (N as rated)
    |
    ├── (N as reporter) ─── reports ────── (N as reported)
    |
    ├── (N as blocker) ──── blocks ─────── (N as blocked)
    |
    ├── (N) ─── entitlements
    |
    ├── (N) ─── push_tokens
    |
    ├── (N) ─── notifications
    |
    ├── (N) ─── activity_log
    |
    └── (N) ─── user_groups ─── (N) groups
```

---

# Appendix B: Environment Variables Required

## Supabase Project Settings

| Variable | Description | Where Set |
|----------|-------------|-----------|
| `SUPABASE_URL` | Project URL (https://peamviowxkyaglyjpagc.supabase.co) | Edge Function env |
| `SUPABASE_ANON_KEY` | Public anon key (shipped in app binary) | iOS app, website |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (server-side only, never in client) | Edge Function env |

## Edge Function Secrets

| Variable | Description | Where Set |
|----------|-------------|-----------|
| `STRIPE_SECRET_KEY` | Stripe API key | Edge Function env |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret | Edge Function env |
| `ANTHROPIC_API_KEY` | Claude API key for Dating Coach | Edge Function env |
| `APNS_KEY_ID` | Apple Push Notification key ID | Edge Function env |
| `APNS_TEAM_ID` | Apple Developer Team ID | Edge Function env |
| `APNS_PRIVATE_KEY` | APNs .p8 private key contents | Edge Function env |
| `APP_STORE_SHARED_SECRET` | App Store Connect shared secret | Edge Function env |

## Auth Configuration

| Variable | Description | Where Set |
|----------|-------------|-----------|
| `GOTRUE_PASSWORD_HASH_CONFIG` | Firebase scrypt hash parameters for auth import | Supabase Auth config |

---

# Appendix C: Rollback Plan

If critical issues are discovered during or after cutover that cannot be resolved within the maintenance window:

**Rollback Steps (Execute in order, estimated 15 minutes):**

1. **Restore Firebase RTDB write access:**
```json
{
    "rules": {
        ".read": true,
        ".write": "auth != null"
    }
}
```

2. **Revert iOS app:** If the new app version was released, use App Store Connect to pull it. Users on TestFlight can be reverted. Users who already installed from the App Store will need an expedited update with the Firebase-based code.

3. **Preserve Supabase data:** Do NOT delete any data in Supabase. It may be needed for a second cutover attempt.

4. **Communicate to users:** Push notification: "We encountered an issue during our upgrade. The app is back online. We apologize for the inconvenience."

5. **Post-mortem:** Document what went wrong, fix the issue, and schedule a new cutover attempt.

**Rollback decision criteria:**
- Invoke rollback if: More than 10% of test logins fail post-cutover
- Invoke rollback if: Messaging is completely non-functional
- Invoke rollback if: Data integrity queries show > 1% record loss
- Do NOT rollback for: Minor UI bugs, slow performance (can be fixed post-cutover), individual user issues

---

# Appendix D: Cost Comparison

| Service | Firebase (Current) | Supabase (Post-Migration) |
|---------|-------------------|--------------------------|
| Database | Realtime Database (Blaze plan): $5/GB stored + $1/GB downloaded | PostgreSQL (Pro plan included): 8GB storage, 500MB RAM |
| Auth | Free (up to limits) | Included in Pro plan |
| Storage | $0.026/GB stored + $0.12/GB downloaded | 100GB included in Pro plan |
| Functions | Cloud Functions: $0.40/million invocations | Edge Functions: 2M invocations included |
| Push | FCM: Free | APNs direct: Free (Apple does not charge) |
| Monitoring | Crashlytics: Free | Keep Crashlytics (independent of backend) |
| **Monthly estimate** | **~$25-50/mo** (low traffic) | **$25/mo** (Pro plan, all-inclusive) |

At current scale, costs are comparable. At higher scale, Supabase Pro plan provides significantly more headroom before cost increases.

---

# Appendix E: pg_cron Jobs Post-Migration

```sql
-- Enable pg_cron extension
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 1. Expire entitlements (every hour)
SELECT cron.schedule(
    'expire-entitlements',
    '0 * * * *',
    $$
    UPDATE entitlements
    SET status = 'expired', updated_at = NOW()
    WHERE status IN ('active', 'grace_period')
        AND expires_at IS NOT NULL
        AND expires_at < NOW();
    
    UPDATE profiles
    SET is_spotlight_active = false, spotlight_expires_at = NULL, updated_at = NOW()
    WHERE is_spotlight_active = true
        AND spotlight_expires_at IS NOT NULL
        AND spotlight_expires_at < NOW();
    
    UPDATE profiles
    SET is_premium = false, updated_at = NOW()
    WHERE is_premium = true
        AND NOT EXISTS (
            SELECT 1 FROM entitlements
            WHERE entitlements.profile_id = profiles.id
                AND entitlements.product_type = 'subscription'
                AND entitlements.status IN ('active', 'grace_period')
                AND (entitlements.expires_at IS NULL OR entitlements.expires_at > NOW())
        );
    $$
);

-- 2. Calculate quality scores (daily at 3 AM)
SELECT cron.schedule(
    'calculate-quality-scores',
    '0 3 * * *',
    $$SELECT calculate_all_quality_scores();$$
);

-- 3. Calculate Levels (daily at 4 AM)
SELECT cron.schedule(
    'calculate-levels',
    '0 4 * * *',
    $$
    WITH level_data AS (
        SELECT 
            rated_id,
            AVG(rating_value) AS avg_rating,
            COUNT(*) AS rating_count,
            PERCENT_RANK() OVER (ORDER BY AVG(rating_value)) AS percentile
        FROM (
            SELECT rated_id, rating_value
            FROM ratings
            WHERE source = 'discovery'
            ORDER BY created_at DESC
            -- Use window function to get latest 100 per user
        ) recent
        GROUP BY rated_id
        HAVING COUNT(*) >= 15
    )
    UPDATE profiles p
    SET 
        level = CASE 
            WHEN ld.rating_count < 15 THEN 6
            WHEN ld.percentile < 0.4 THEN 7
            WHEN ld.percentile < 0.7 THEN 8
            WHEN ld.percentile < 0.9 THEN 9
            ELSE 10
        END,
        level_rating_count = ld.rating_count,
        level_percentile = ld.percentile,
        level_last_calculated_at = NOW()
    FROM level_data ld
    WHERE p.id = ld.rated_id;
    $$
);

-- 4. Clean up old activity logs (weekly, keep 90 days)
SELECT cron.schedule(
    'cleanup-activity-log',
    '0 2 * * 0',
    $$DELETE FROM activity_log WHERE created_at < NOW() - INTERVAL '90 days';$$
);

-- 5. Refresh Discovery materialized view (every 5 minutes, enable when needed)
-- SELECT cron.schedule(
--     'refresh-discovery',
--     '*/5 * * * *',
--     $$REFRESH MATERIALIZED VIEW CONCURRENTLY discovery_profiles;$$
-- );

-- 6. Deactivate stale push tokens (weekly)
SELECT cron.schedule(
    'deactivate-stale-tokens',
    '0 5 * * 0',
    $$
    UPDATE push_tokens
    SET is_active = false
    WHERE is_active = true
        AND last_used_at < NOW() - INTERVAL '90 days';
    $$
);
```

---

*End of document. This strategy is designed to be executed immediately. Each section contains actionable specifics with code, SQL, and configuration that can be implemented without ambiguity. The migration approach prioritizes data integrity and user experience continuity while achieving the long-term goal of a unified, scalable platform architecture.*
