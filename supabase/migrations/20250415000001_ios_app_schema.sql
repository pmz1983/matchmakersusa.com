-- ═══════════════════════════════════════════════════════════════
-- MATCHMAKERS — iOS App Schema (Firebase → Supabase Migration)
-- Conv 15: Tables, indexes, RLS, storage, PostGIS
-- ═══════════════════════════════════════════════════════════════

-- ─── Extensions ──────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS postgis;

-- ═══════════════════════════════════════════════════════════════
-- 1. USERS (replaces /Users/{id}/SignUp + denormalized fields)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_id UUID UNIQUE REFERENCES auth.users(id) ON DELETE SET NULL,
  firebase_uid TEXT UNIQUE,
  email TEXT UNIQUE NOT NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT GENERATED ALWAYS AS (COALESCE(first_name, '') || ' ' || COALESCE(last_name, '')) STORED,
  membership_type INT DEFAULT 1,         -- 0=Temporary, 1=Free, 2=Paid
  user_type INT DEFAULT 0,               -- 1=admin
  is_admin BOOLEAN DEFAULT FALSE,
  app_version TEXT,
  fcm_token TEXT,
  account_creation_date TIMESTAMPTZ DEFAULT NOW(),
  last_active_date TIMESTAMPTZ DEFAULT NOW(),
  is_interest_in_coaching BOOLEAN DEFAULT FALSE,
  match_request_count INT DEFAULT 0,
  match_request_date DATE,
  objectional BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 2. PROFILES (replaces /Users/{id}/ProfileData)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  gender TEXT,
  interested_in TEXT,
  filter_key TEXT GENERATED ALWAYS AS (COALESCE(gender, '') || '_' || COALESCE(interested_in, '')) STORED,
  birth_date DATE,
  zip_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  location GEOGRAPHY(POINT, 4326),
  city TEXT,
  state TEXT,
  about_me TEXT,
  height TEXT,
  body_type TEXT,
  income TEXT,
  political TEXT,
  religion TEXT,
  race TEXT,
  have_kids TEXT,
  smoke TEXT,
  drink TEXT,
  education TEXT,
  occupation TEXT,
  profile_pic_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-populate location geography from lat/lng
CREATE OR REPLACE FUNCTION update_profile_location()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.location := ST_SetSRID(ST_MakePoint(NEW.longitude, NEW.latitude), 4326)::geography;
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_profile_location
  BEFORE INSERT OR UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_profile_location();

-- ═══════════════════════════════════════════════════════════════
-- 3. PREFERENCES (replaces /Users/{id}/PreferenceData)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  self_rating INT DEFAULT 6,
  preferred_body_type TEXT,
  preferred_income TEXT,
  preferred_political TEXT,
  preferred_religion TEXT,
  preferred_race TEXT,
  preferred_have_kids TEXT,
  preferred_smoke TEXT,
  preferred_drink TEXT,
  preferred_height_min TEXT,
  preferred_height_max TEXT,
  preferred_age_min INT,
  preferred_age_max INT,
  search_radius INT DEFAULT 100000000,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 4. PROFILE IMAGES (replaces /Users/{id}/ProfileImages)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profile_images (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  storage_path TEXT,
  sort_order INT DEFAULT 0,
  is_primary BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 5. USER LEVELS (replaces /Users/{id}/newUserLevel + MyLevelProgress)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_levels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  current_level INT DEFAULT 6,
  level_progress FLOAT DEFAULT 0,
  normalized_level INT DEFAULT 6,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 6. RATINGS (replaces /Users/{id}/UserRating + UserRatingByDate)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rated_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  rater_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  rating_value INT NOT NULL,
  multiplier INT DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rated_user_id, rater_user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 7. CONNECTIONS (replaces /Users/{id}/Request + /Users/{id}/Friends)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  requested_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  status INT NOT NULL DEFAULT 0,         -- 0=Sent, 1=Accepted, 3=Rejected
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(requester_id, requested_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 8. BLOCKS (replaces /Users/{id}/Block)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS blocks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  blocker_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  blocked_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(blocker_id, blocked_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 9. CONVERSATIONS (replaces /Message/{convId} top-level)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  participant_2 UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  subject TEXT,
  subject_lowercase TEXT GENERATED ALWAYS AS (LOWER(subject)) STORED,
  p1_last_read TIMESTAMPTZ,
  p2_last_read TIMESTAMPTZ,
  last_message_time TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Unique constraint: one conversation per user pair (order-independent)
CREATE UNIQUE INDEX idx_conversations_pair
  ON conversations (LEAST(participant_1, participant_2), GREATEST(participant_1, participant_2));

-- ═══════════════════════════════════════════════════════════════
-- 10. MESSAGES (replaces /Message/{convId}/messages/{msgId})
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE NOT NULL,
  sender_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Update conversation last_message_time on new message
CREATE OR REPLACE FUNCTION update_conversation_last_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE conversations SET last_message_time = NEW.created_at WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_conv_last_message
  AFTER INSERT ON messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_last_message();

-- ═══════════════════════════════════════════════════════════════
-- 11. RANKED PHOTOS (replaces /Users/{id}/RankedPhotos)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS ranked_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  image_url TEXT NOT NULL,
  rank_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 12. PHOTO RANKINGS (replaces RankedPhotosByUser/RankedPhotosByMe)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS photo_rankings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  photo_id UUID REFERENCES ranked_photos(id) ON DELETE CASCADE NOT NULL,
  ranker_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(photo_id, ranker_user_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 13. PROFILE VIEWS (replaces ReviewedMyProfileByUser/ReviewedUserProfileByMe)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS profile_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  viewer_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  viewed_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(viewer_id, viewed_id)
);

-- ═══════════════════════════════════════════════════════════════
-- 14. REPORTS (replaces /ReportedUsers/)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  reported_user_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT,
  details JSONB,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 15. SPOTLIGHT SUBSCRIPTIONS (replaces SpotLight fields + ReceiptData)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS spotlight_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  product_id TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  receipt_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════
-- 16. ADMIN SETTINGS (replaces /Admin/Settings/)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS admin_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed default admin settings
INSERT INTO admin_settings (key, value) VALUES
  ('levels', '{
    "MINIMUM_RATING_REQUIRED": 5,
    "LATEST_RATING_CONSIDER": 20,
    "PERCENTAGE_FOR_LEVEL_10": 90,
    "PERCENTAGE_FOR_LEVEL_9": 80,
    "PERCENTAGE_FOR_LEVEL_8": 70,
    "PERCENTAGE_FOR_LEVEL_7": 60,
    "PERCENTAGE_FOR_LEVEL_6": 50,
    "PERCENTAGE_FOR_LEVEL_5": 40,
    "PERCENTAGE_FOR_LEVEL_4": 30,
    "PERCENTAGE_FOR_LEVEL_3": 20,
    "PERCENTAGE_FOR_LEVEL_2": 10,
    "PERCENTAGE_FOR_LEVEL_1": 0,
    "MAXIMUM_MATCH_REQUESTS_PER_DAY": 20,
    "RECENT_ACTIVE_USER_DAYS": 90
  }'::jsonb),
  ('app_version_control', '{
    "MINIMUM_SUPPORT_VERSION": "3.2",
    "LATEST_RELEASED_VERSION": "4.0",
    "MESSAGE_UPDATE": "A new version is available. Please update for the best experience.",
    "MESSAGE_FORCEFULLY_UPDATE": "This version is no longer supported. Please update to continue."
  }'::jsonb),
  ('algorithm', '{
    "last_run_date": null,
    "is_run_algorithm": false
  }'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════
-- 17. USER GROUPS (replaces /UsersGroups/)
-- ═══════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS user_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES app_users(id) ON DELETE CASCADE NOT NULL,
  gender TEXT NOT NULL,
  group_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, group_name)
);


-- ═══════════════════════════════════════════════════════════════
-- INDEXES
-- ═══════════════════════════════════════════════════════════════

-- app_users
CREATE INDEX idx_app_users_email ON app_users(email);
CREATE INDEX idx_app_users_full_name ON app_users(full_name);
CREATE INDEX idx_app_users_membership ON app_users(membership_type);
CREATE INDEX idx_app_users_last_active ON app_users(last_active_date);
CREATE INDEX idx_app_users_firebase_uid ON app_users(firebase_uid);
CREATE INDEX idx_app_users_auth_id ON app_users(auth_id);

-- profiles
CREATE INDEX idx_profiles_filter_key ON profiles(filter_key);
CREATE INDEX idx_profiles_location ON profiles USING GIST(location);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_zip ON profiles(zip_code);

-- preferences
CREATE INDEX idx_preferences_user_id ON preferences(user_id);

-- profile_images
CREATE INDEX idx_profile_images_user ON profile_images(user_id, sort_order);

-- user_levels
CREATE INDEX idx_user_levels_user ON user_levels(user_id);
CREATE INDEX idx_user_levels_level ON user_levels(normalized_level);

-- ratings
CREATE INDEX idx_ratings_rated_user ON ratings(rated_user_id, created_at);
CREATE INDEX idx_ratings_rater ON ratings(rater_user_id);

-- connections
CREATE INDEX idx_connections_requested ON connections(requested_id, status);
CREATE INDEX idx_connections_requester ON connections(requester_id, status);

-- blocks
CREATE INDEX idx_blocks_blocker ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked ON blocks(blocked_id);

-- conversations
CREATE INDEX idx_conversations_p1 ON conversations(participant_1);
CREATE INDEX idx_conversations_p2 ON conversations(participant_2);
CREATE INDEX idx_conversations_last_msg ON conversations(last_message_time DESC);

-- messages
CREATE INDEX idx_messages_conversation ON messages(conversation_id, created_at);
CREATE INDEX idx_messages_sender ON messages(sender_id);

-- ranked_photos
CREATE INDEX idx_ranked_photos_user ON ranked_photos(user_id);

-- photo_rankings
CREATE INDEX idx_photo_rankings_photo ON photo_rankings(photo_id);
CREATE INDEX idx_photo_rankings_ranker ON photo_rankings(ranker_user_id);

-- profile_views
CREATE INDEX idx_profile_views_viewed ON profile_views(viewed_id);
CREATE INDEX idx_profile_views_viewer ON profile_views(viewer_id);

-- reports
CREATE INDEX idx_reports_reported ON reports(reported_user_id, is_resolved);
CREATE INDEX idx_reports_reporter ON reports(reporter_id);

-- spotlight_subscriptions
CREATE INDEX idx_spotlight_user ON spotlight_subscriptions(user_id, expires_at);

-- user_groups
CREATE INDEX idx_user_groups_gender ON user_groups(gender, group_name);
CREATE INDEX idx_user_groups_user ON user_groups(user_id);


-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════

-- Helper: get the app_users.id for the current auth user
CREATE OR REPLACE FUNCTION get_app_user_id()
RETURNS UUID AS $$
  SELECT id FROM app_users WHERE auth_id = auth.uid() LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── app_users ───────────────────────────────────────────────
ALTER TABLE app_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read users"
  ON app_users FOR SELECT USING (true);

CREATE POLICY "Users update own record"
  ON app_users FOR UPDATE USING (auth_id = auth.uid());

CREATE POLICY "Service role full access on app_users"
  ON app_users FOR ALL USING (auth.role() = 'service_role');

-- ─── profiles ────────────────────────────────────────────────
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles"
  ON profiles FOR SELECT USING (true);

CREATE POLICY "Users update own profile"
  ON profiles FOR UPDATE USING (user_id = get_app_user_id());

CREATE POLICY "Users insert own profile"
  ON profiles FOR INSERT WITH CHECK (user_id = get_app_user_id());

CREATE POLICY "Service role full access on profiles"
  ON profiles FOR ALL USING (auth.role() = 'service_role');

-- ─── preferences ─────────────────────────────────────────────
ALTER TABLE preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own preferences"
  ON preferences FOR SELECT USING (user_id = get_app_user_id());

CREATE POLICY "Users update own preferences"
  ON preferences FOR UPDATE USING (user_id = get_app_user_id());

CREATE POLICY "Users insert own preferences"
  ON preferences FOR INSERT WITH CHECK (user_id = get_app_user_id());

CREATE POLICY "Service role full access on preferences"
  ON preferences FOR ALL USING (auth.role() = 'service_role');

-- ─── profile_images ──────────────────────────────────────────
ALTER TABLE profile_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view profile images"
  ON profile_images FOR SELECT USING (true);

CREATE POLICY "Users manage own images"
  ON profile_images FOR ALL USING (user_id = get_app_user_id());

CREATE POLICY "Service role full access on profile_images"
  ON profile_images FOR ALL USING (auth.role() = 'service_role');

-- ─── user_levels ─────────────────────────────────────────────
ALTER TABLE user_levels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read levels"
  ON user_levels FOR SELECT USING (true);

CREATE POLICY "Service role manages levels"
  ON user_levels FOR ALL USING (auth.role() = 'service_role');

-- Users can't directly modify their own level (server-side only)

-- ─── ratings ─────────────────────────────────────────────────
ALTER TABLE ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read ratings they gave or received"
  ON ratings FOR SELECT USING (
    rater_user_id = get_app_user_id() OR rated_user_id = get_app_user_id()
  );

CREATE POLICY "Users can insert ratings"
  ON ratings FOR INSERT WITH CHECK (rater_user_id = get_app_user_id());

CREATE POLICY "Service role full access on ratings"
  ON ratings FOR ALL USING (auth.role() = 'service_role');

-- ─── connections ─────────────────────────────────────────────
ALTER TABLE connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own connections"
  ON connections FOR SELECT USING (
    requester_id = get_app_user_id() OR requested_id = get_app_user_id()
  );

CREATE POLICY "Users create connection requests"
  ON connections FOR INSERT WITH CHECK (requester_id = get_app_user_id());

CREATE POLICY "Users update connections they're part of"
  ON connections FOR UPDATE USING (
    requester_id = get_app_user_id() OR requested_id = get_app_user_id()
  );

CREATE POLICY "Users delete connections they're part of"
  ON connections FOR DELETE USING (
    requester_id = get_app_user_id() OR requested_id = get_app_user_id()
  );

CREATE POLICY "Service role full access on connections"
  ON connections FOR ALL USING (auth.role() = 'service_role');

-- ─── blocks ──────────────────────────────────────────────────
ALTER TABLE blocks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own blocks"
  ON blocks FOR ALL USING (blocker_id = get_app_user_id());

CREATE POLICY "Service role full access on blocks"
  ON blocks FOR ALL USING (auth.role() = 'service_role');

-- ─── conversations ───────────────────────────────────────────
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read conversations"
  ON conversations FOR SELECT USING (
    participant_1 = get_app_user_id() OR participant_2 = get_app_user_id()
  );

CREATE POLICY "Participants can create conversations"
  ON conversations FOR INSERT WITH CHECK (
    participant_1 = get_app_user_id() OR participant_2 = get_app_user_id()
  );

CREATE POLICY "Participants can update conversations"
  ON conversations FOR UPDATE USING (
    participant_1 = get_app_user_id() OR participant_2 = get_app_user_id()
  );

CREATE POLICY "Service role full access on conversations"
  ON conversations FOR ALL USING (auth.role() = 'service_role');

-- ─── messages ────────────────────────────────────────────────
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can read messages"
  ON messages FOR SELECT USING (
    conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_1 = get_app_user_id() OR participant_2 = get_app_user_id()
    )
  );

CREATE POLICY "Users can send messages in their conversations"
  ON messages FOR INSERT WITH CHECK (
    sender_id = get_app_user_id()
    AND conversation_id IN (
      SELECT id FROM conversations
      WHERE participant_1 = get_app_user_id() OR participant_2 = get_app_user_id()
    )
  );

CREATE POLICY "Service role full access on messages"
  ON messages FOR ALL USING (auth.role() = 'service_role');

-- ─── ranked_photos ───────────────────────────────────────────
ALTER TABLE ranked_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ranked photos"
  ON ranked_photos FOR SELECT USING (true);

CREATE POLICY "Users manage own ranked photos"
  ON ranked_photos FOR ALL USING (user_id = get_app_user_id());

CREATE POLICY "Service role full access on ranked_photos"
  ON ranked_photos FOR ALL USING (auth.role() = 'service_role');

-- ─── photo_rankings ──────────────────────────────────────────
ALTER TABLE photo_rankings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see rankings on their photos or rankings they gave"
  ON photo_rankings FOR SELECT USING (
    ranker_user_id = get_app_user_id()
    OR photo_id IN (SELECT id FROM ranked_photos WHERE user_id = get_app_user_id())
  );

CREATE POLICY "Users can rank photos"
  ON photo_rankings FOR INSERT WITH CHECK (ranker_user_id = get_app_user_id());

CREATE POLICY "Service role full access on photo_rankings"
  ON photo_rankings FOR ALL USING (auth.role() = 'service_role');

-- ─── profile_views ───────────────────────────────────────────
ALTER TABLE profile_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see who viewed them and who they viewed"
  ON profile_views FOR SELECT USING (
    viewer_id = get_app_user_id() OR viewed_id = get_app_user_id()
  );

CREATE POLICY "Users can log profile views"
  ON profile_views FOR INSERT WITH CHECK (viewer_id = get_app_user_id());

CREATE POLICY "Service role full access on profile_views"
  ON profile_views FOR ALL USING (auth.role() = 'service_role');

-- ─── reports ─────────────────────────────────────────────────
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can create reports"
  ON reports FOR INSERT WITH CHECK (reporter_id = get_app_user_id());

CREATE POLICY "Admins can read all reports"
  ON reports FOR SELECT USING (
    EXISTS (SELECT 1 FROM app_users WHERE id = get_app_user_id() AND is_admin = true)
  );

CREATE POLICY "Service role full access on reports"
  ON reports FOR ALL USING (auth.role() = 'service_role');

-- ─── spotlight_subscriptions ─────────────────────────────────
ALTER TABLE spotlight_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own spotlight"
  ON spotlight_subscriptions FOR SELECT USING (user_id = get_app_user_id());

CREATE POLICY "Service role manages spotlight"
  ON spotlight_subscriptions FOR ALL USING (auth.role() = 'service_role');

-- ─── admin_settings ──────────────────────────────────────────
ALTER TABLE admin_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admin settings"
  ON admin_settings FOR SELECT USING (true);

CREATE POLICY "Service role manages admin settings"
  ON admin_settings FOR ALL USING (auth.role() = 'service_role');

-- ─── user_groups ─────────────────────────────────────────────
ALTER TABLE user_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read user groups"
  ON user_groups FOR SELECT USING (true);

CREATE POLICY "Service role manages user groups"
  ON user_groups FOR ALL USING (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════
-- MATCHING ALGORITHM (RPC Function)
-- Replaces client-side getMatchingProfilesNew() in FirebaseManager
-- ═══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION get_matching_profiles(
  p_user_id UUID,
  p_filter_key TEXT,
  p_latitude DOUBLE PRECISION,
  p_longitude DOUBLE PRECISION,
  p_radius_miles INT DEFAULT 100000000,
  p_limit INT DEFAULT 200,
  p_offset INT DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  membership_type INT,
  gender TEXT,
  interested_in TEXT,
  birth_date DATE,
  zip_code TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  city TEXT,
  state TEXT,
  about_me TEXT,
  height TEXT,
  body_type TEXT,
  income TEXT,
  religion TEXT,
  race TEXT,
  profile_pic_url TEXT,
  current_level INT,
  normalized_level INT,
  distance_miles DOUBLE PRECISION,
  group_name TEXT,
  last_active_date TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    au.id AS user_id,
    au.first_name,
    au.last_name,
    au.full_name,
    au.membership_type,
    p.gender,
    p.interested_in,
    p.birth_date,
    p.zip_code,
    p.latitude,
    p.longitude,
    p.city,
    p.state,
    p.about_me,
    p.height,
    p.body_type,
    p.income,
    p.religion,
    p.race,
    p.profile_pic_url,
    COALESCE(ul.current_level, 6),
    COALESCE(ul.normalized_level, 6),
    CASE
      WHEN p.location IS NOT NULL AND p_latitude IS NOT NULL AND p_longitude IS NOT NULL
      THEN ST_Distance(
        p.location,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography
      ) / 1609.34  -- meters to miles
      ELSE NULL
    END AS distance_miles,
    ug.group_name,
    au.last_active_date
  FROM app_users au
  JOIN profiles p ON p.user_id = au.id
  LEFT JOIN user_levels ul ON ul.user_id = au.id
  LEFT JOIN user_groups ug ON ug.user_id = au.id
  WHERE
    -- Not the requesting user
    au.id != p_user_id
    -- Gender/interest match
    AND p.filter_key = p_filter_key
    -- Not blocked (either direction)
    AND NOT EXISTS (
      SELECT 1 FROM blocks b
      WHERE (b.blocker_id = p_user_id AND b.blocked_id = au.id)
         OR (b.blocker_id = au.id AND b.blocked_id = p_user_id)
    )
    -- Not already connected or requested
    AND NOT EXISTS (
      SELECT 1 FROM connections c
      WHERE (c.requester_id = p_user_id AND c.requested_id = au.id)
         OR (c.requester_id = au.id AND c.requested_id = p_user_id)
    )
    -- Has zip code (profile completeness check)
    AND p.zip_code IS NOT NULL AND p.zip_code != ''
    -- Not flagged
    AND au.objectional = false
    -- Distance filter (only if coordinates available)
    AND (
      p_radius_miles >= 100000000  -- NoLimit
      OR p.location IS NULL
      OR p_latitude IS NULL
      OR ST_DWithin(
        p.location,
        ST_SetSRID(ST_MakePoint(p_longitude, p_latitude), 4326)::geography,
        p_radius_miles * 1609.34  -- miles to meters
      )
    )
  ORDER BY
    -- SpotLight first, then Paid, then Unpaid, then Inactive
    CASE ug.group_name
      WHEN 'SpotLightUsers' THEN 0
      WHEN 'PaidUsers' THEN 1
      WHEN 'UnPaidUsers' THEN 2
      WHEN 'InActivePaidUsers' THEN 3
      WHEN 'InActiveUnPaidUsers' THEN 4
      ELSE 5
    END,
    -- Random within each group
    RANDOM()
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════════════
-- UNREAD COUNTS (RPC Functions)
-- ═══════════════════════════════════════════════════════════════

-- Unread message count for a user
CREATE OR REPLACE FUNCTION get_unread_message_count(p_user_id UUID)
RETURNS INT AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN c.participant_1 = p_user_id THEN
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.created_at > COALESCE(c.p1_last_read, '1970-01-01'))
      WHEN c.participant_2 = p_user_id THEN
        (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.created_at > COALESCE(c.p2_last_read, '1970-01-01'))
      ELSE 0
    END
  ), 0)::INT
  FROM conversations c
  WHERE c.participant_1 = p_user_id OR c.participant_2 = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Unread connection request count
CREATE OR REPLACE FUNCTION get_unread_request_count(p_user_id UUID)
RETURNS INT AS $$
  SELECT COUNT(*)::INT FROM connections
  WHERE requested_id = p_user_id AND status = 0 AND is_read = false;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ═══════════════════════════════════════════════════════════════
-- STORAGE BUCKET
-- ═══════════════════════════════════════════════════════════════

-- Create profile-images bucket (private, signed URLs for access)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-images',
  'profile-images',
  false,
  5242880,  -- 5MB max
  ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Storage policies: users can upload to their own folder
CREATE POLICY "Users upload own images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users read own images"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users delete own images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'profile-images'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- Service role can access all images (for migration + admin)
CREATE POLICY "Service role full storage access"
  ON storage.objects FOR ALL
  USING (auth.role() = 'service_role');


-- ═══════════════════════════════════════════════════════════════
-- ENABLE REALTIME on tables that need live updates
-- ═══════════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE messages;
ALTER PUBLICATION supabase_realtime ADD TABLE connections;
ALTER PUBLICATION supabase_realtime ADD TABLE conversations;
