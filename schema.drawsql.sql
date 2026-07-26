CREATE TABLE "users"(
    "id" BIGINT NOT NULL,
    "username" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "created_at" TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP NOT NULL
);
ALTER TABLE
    "users" ADD PRIMARY KEY("id");
CREATE TABLE "series"(
    "id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "genre" TEXT NOT NULL,
    "tag" TEXT NOT NULL,
    "author_id" BIGINT NOT NULL,
    "created_at" TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP NOT NULL
);
ALTER TABLE
    "series" ADD PRIMARY KEY("id");
CREATE TABLE "seasons"(
    "id" BIGINT NOT NULL,
    "series_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "created_at" TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP NOT NULL
);
ALTER TABLE
    "seasons" ADD PRIMARY KEY("id");
CREATE TABLE "episodes"(
    "id" BIGINT NOT NULL,
    "series_id" BIGINT NOT NULL,
    "season_id" BIGINT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "prev_episode_summary" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "author_id" BIGINT NOT NULL,
    "co_author_id" BIGINT NULL,
    "forked_from_episode_id" BIGINT NULL,
    "prev_episode_id" BIGINT NULL,
    "decision_point" TEXT NULL,
    "is_canonical" BOOLEAN NOT NULL,
    "verified_by_author" BOOLEAN NOT NULL,
    "audio_url" TEXT NULL,
    "audio_duration_ms" INTEGER NULL,
    "created_at" TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP NOT NULL
);
ALTER TABLE
    "episodes" ADD PRIMARY KEY("id");
CREATE TABLE "playback_events"(
    "id" BIGINT NOT NULL,
    "episode_id" BIGINT NOT NULL,
    "user_id" BIGINT NULL,
    "session_id" UUID NOT NULL,
    "event_type" VARCHAR(20) NOT NULL,
    "position_ms" INTEGER NOT NULL,
    "seek_to_ms" INTEGER NULL,
    "duration_ms" INTEGER NULL,
    "speed" DECIMAL(3, 2) NULL,
    "device" VARCHAR(30) NULL,
    "autoplay" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP NOT NULL
);
ALTER TABLE
    "playback_events" ADD PRIMARY KEY("id");
CREATE TABLE "ratings"(
    "id" BIGINT NOT NULL,
    "episode_id" BIGINT NOT NULL,
    "user_id" BIGINT NOT NULL,
    "score" SMALLINT NOT NULL,
    "created_at" TIMESTAMP NOT NULL
);
ALTER TABLE
    "ratings" ADD PRIMARY KEY("id");
CREATE TABLE "reviews"(
    "id" BIGINT NOT NULL,
    "episode_id" BIGINT NOT NULL,
    "created_by" BIGINT NOT NULL,
    "review_text" TEXT NOT NULL,
    "parent_review_id" BIGINT NULL,
    "created_at" TIMESTAMP NOT NULL,
    "updated_at" TIMESTAMP NOT NULL
);
ALTER TABLE
    "reviews" ADD PRIMARY KEY("id");
CREATE TABLE "characters"(
    "id" BIGINT NOT NULL,
    "series_id" BIGINT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "role" VARCHAR(30) NOT NULL,
    "personality" TEXT NOT NULL,
    "backstory" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "speech_style" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL
);
ALTER TABLE
    "characters" ADD PRIMARY KEY("id");
CREATE TABLE "character_state"(
    "id" BIGINT NOT NULL,
    "character_id" BIGINT NOT NULL,
    "episode_id" BIGINT NULL,
    "memory_snapshot" TEXT NOT NULL,
    "char_summary" TEXT NOT NULL,
    "status" VARCHAR(20) NULL
);
ALTER TABLE
    "character_state" ADD PRIMARY KEY("id");
CREATE TABLE "char_relationship_state"(
    "id" BIGINT NOT NULL,
    "char_id" BIGINT NOT NULL,
    "relation_char_id" BIGINT NOT NULL,
    "episode_id" BIGINT NOT NULL,
    "relationship_summary" TEXT NULL
);
ALTER TABLE
    "char_relationship_state" ADD PRIMARY KEY("id");
CREATE TABLE "plot_thread_state"(
    "id" BIGINT NOT NULL,
    "thread_id" BIGINT NOT NULL,
    "episode_id" BIGINT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "note" TEXT NULL
);
ALTER TABLE
    "plot_thread_state" ADD PRIMARY KEY("id");
CREATE TABLE "char_relationship"(
    "id" BIGINT NOT NULL,
    "char_id" BIGINT NOT NULL,
    "relation_char_id" BIGINT NOT NULL,
    "relationship_summary" TEXT NOT NULL
);
ALTER TABLE
    "char_relationship" ADD PRIMARY KEY("id");
CREATE TABLE "world"(
    "id" BIGINT NOT NULL,
    "series_id" BIGINT NOT NULL,
    "entry_type" VARCHAR(30) NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "description" TEXT NOT NULL
);
ALTER TABLE
    "world" ADD PRIMARY KEY("id");
CREATE TABLE "style_guide"(
    "id" BIGINT NOT NULL,
    "series_id" BIGINT NOT NULL,
    "pov" VARCHAR(30) NOT NULL,
    "tense" VARCHAR(20) NOT NULL,
    "tone" TEXT NOT NULL,
    "pacing" TEXT NOT NULL,
    "content_rating" VARCHAR(10) NOT NULL,
    "narrative_voice" TEXT NOT NULL
);
ALTER TABLE
    "style_guide" ADD PRIMARY KEY("id");
CREATE TABLE "plot_threads"(
    "id" BIGINT NOT NULL,
    "series_id" BIGINT NOT NULL,
    "thread" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "opened_episode_id" BIGINT NULL,
    "resolved_episode_id" BIGINT NULL
);
ALTER TABLE
    "plot_threads" ADD PRIMARY KEY("id");
ALTER TABLE
    "series" ADD CONSTRAINT "series_author_id_foreign" FOREIGN KEY("author_id") REFERENCES "users"("id");
ALTER TABLE
    "seasons" ADD CONSTRAINT "seasons_series_id_foreign" FOREIGN KEY("series_id") REFERENCES "series"("id");
ALTER TABLE
    "episodes" ADD CONSTRAINT "episodes_series_id_foreign" FOREIGN KEY("series_id") REFERENCES "series"("id");
ALTER TABLE
    "episodes" ADD CONSTRAINT "episodes_season_id_foreign" FOREIGN KEY("season_id") REFERENCES "seasons"("id");
ALTER TABLE
    "episodes" ADD CONSTRAINT "episodes_author_id_foreign" FOREIGN KEY("author_id") REFERENCES "users"("id");
ALTER TABLE
    "episodes" ADD CONSTRAINT "episodes_co_author_id_foreign" FOREIGN KEY("co_author_id") REFERENCES "users"("id");
ALTER TABLE
    "episodes" ADD CONSTRAINT "episodes_forked_from_episode_id_foreign" FOREIGN KEY("forked_from_episode_id") REFERENCES "episodes"("id");
ALTER TABLE
    "episodes" ADD CONSTRAINT "episodes_prev_episode_id_foreign" FOREIGN KEY("prev_episode_id") REFERENCES "episodes"("id");
ALTER TABLE
    "ratings" ADD CONSTRAINT "ratings_episode_id_foreign" FOREIGN KEY("episode_id") REFERENCES "episodes"("id");
ALTER TABLE
    "ratings" ADD CONSTRAINT "ratings_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
ALTER TABLE
    "reviews" ADD CONSTRAINT "reviews_episode_id_foreign" FOREIGN KEY("episode_id") REFERENCES "episodes"("id");
ALTER TABLE
    "reviews" ADD CONSTRAINT "reviews_created_by_foreign" FOREIGN KEY("created_by") REFERENCES "users"("id");
ALTER TABLE
    "reviews" ADD CONSTRAINT "reviews_parent_review_id_foreign" FOREIGN KEY("parent_review_id") REFERENCES "reviews"("id");
ALTER TABLE
    "characters" ADD CONSTRAINT "characters_series_id_foreign" FOREIGN KEY("series_id") REFERENCES "series"("id");
ALTER TABLE
    "character_state" ADD CONSTRAINT "character_state_character_id_foreign" FOREIGN KEY("character_id") REFERENCES "characters"("id");
ALTER TABLE
    "character_state" ADD CONSTRAINT "character_state_episode_id_foreign" FOREIGN KEY("episode_id") REFERENCES "episodes"("id");
ALTER TABLE
    "char_relationship" ADD CONSTRAINT "char_relationship_char_id_foreign" FOREIGN KEY("char_id") REFERENCES "characters"("id");
ALTER TABLE
    "char_relationship" ADD CONSTRAINT "char_relationship_relation_char_id_foreign" FOREIGN KEY("relation_char_id") REFERENCES "characters"("id");
ALTER TABLE
    "char_relationship_state" ADD CONSTRAINT "char_relationship_state_char_id_foreign" FOREIGN KEY("char_id") REFERENCES "characters"("id");
ALTER TABLE
    "char_relationship_state" ADD CONSTRAINT "char_relationship_state_relation_char_id_foreign" FOREIGN KEY("relation_char_id") REFERENCES "characters"("id");
ALTER TABLE
    "char_relationship_state" ADD CONSTRAINT "char_relationship_state_episode_id_foreign" FOREIGN KEY("episode_id") REFERENCES "episodes"("id");
ALTER TABLE
    "world" ADD CONSTRAINT "world_series_id_foreign" FOREIGN KEY("series_id") REFERENCES "series"("id");
ALTER TABLE
    "style_guide" ADD CONSTRAINT "style_guide_series_id_foreign" FOREIGN KEY("series_id") REFERENCES "series"("id");
ALTER TABLE
    "plot_threads" ADD CONSTRAINT "plot_threads_series_id_foreign" FOREIGN KEY("series_id") REFERENCES "series"("id");
ALTER TABLE
    "plot_threads" ADD CONSTRAINT "plot_threads_opened_episode_id_foreign" FOREIGN KEY("opened_episode_id") REFERENCES "episodes"("id");
ALTER TABLE
    "plot_threads" ADD CONSTRAINT "plot_threads_resolved_episode_id_foreign" FOREIGN KEY("resolved_episode_id") REFERENCES "episodes"("id");
ALTER TABLE
    "plot_thread_state" ADD CONSTRAINT "plot_thread_state_thread_id_foreign" FOREIGN KEY("thread_id") REFERENCES "plot_threads"("id");
ALTER TABLE
    "plot_thread_state" ADD CONSTRAINT "plot_thread_state_episode_id_foreign" FOREIGN KEY("episode_id") REFERENCES "episodes"("id");
ALTER TABLE
    "playback_events" ADD CONSTRAINT "playback_events_episode_id_foreign" FOREIGN KEY("episode_id") REFERENCES "episodes"("id");
ALTER TABLE
    "playback_events" ADD CONSTRAINT "playback_events_user_id_foreign" FOREIGN KEY("user_id") REFERENCES "users"("id");
