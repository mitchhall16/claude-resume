-- Claude Resume D1 Database Schema
-- Run with: wrangler d1 execute claude-resume-db --file=./schema.sql

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User profiles (contact info, summary)
CREATE TABLE IF NOT EXISTS profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  full_name TEXT,
  email TEXT,
  phone TEXT,
  location TEXT,
  linkedin TEXT,
  github TEXT,
  portfolio TEXT,
  summary TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Work experience
CREATE TABLE IF NOT EXISTS experience (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  company TEXT NOT NULL,
  location TEXT,
  start_date TEXT,
  end_date TEXT,
  bullets TEXT, -- JSON array of bullet points
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Education
CREATE TABLE IF NOT EXISTS education (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  degree TEXT NOT NULL,
  school TEXT NOT NULL,
  location TEXT,
  start_year TEXT,
  end_year TEXT,
  gpa TEXT,
  extras TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Certifications
CREATE TABLE IF NOT EXISTS certifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  name TEXT NOT NULL,
  organization TEXT,
  date_obtained TEXT,
  credential_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Skills (normalized)
CREATE TABLE IF NOT EXISTS skills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  skill_type TEXT NOT NULL CHECK(skill_type IN ('technical', 'soft', 'tools', 'interests')),
  skill_name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Saved resumes (generated/tailored resumes)
CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY, -- UUID
  user_id INTEGER NOT NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  job_url TEXT,
  job_description TEXT,
  score INTEGER DEFAULT 0,
  matched_keywords TEXT, -- JSON array
  missing_keywords TEXT, -- JSON array
  tailored_summary TEXT,
  resume_content TEXT,
  recruiter_assessment TEXT,
  status TEXT DEFAULT 'generated' CHECK(status IN ('generated', 'applied', 'interviewing', 'offered', 'rejected', 'withdrawn')),
  notes TEXT,
  status_history TEXT, -- JSON array of {status, date}
  interviews TEXT, -- JSON array of {date, notes}
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  status_updated_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_profiles_user ON profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_experience_user ON experience(user_id);
CREATE INDEX IF NOT EXISTS idx_education_user ON education(user_id);
CREATE INDEX IF NOT EXISTS idx_certifications_user ON certifications(user_id);
CREATE INDEX IF NOT EXISTS idx_skills_user_type ON skills(user_id, skill_type);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id);
CREATE INDEX IF NOT EXISTS idx_resumes_user_status ON resumes(user_id, status);
CREATE INDEX IF NOT EXISTS idx_resumes_created ON resumes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Trigger to update updated_at on profiles
CREATE TRIGGER IF NOT EXISTS update_profiles_timestamp
AFTER UPDATE ON profiles
BEGIN
  UPDATE profiles SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update updated_at on experience
CREATE TRIGGER IF NOT EXISTS update_experience_timestamp
AFTER UPDATE ON experience
BEGIN
  UPDATE experience SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to update updated_at on resumes
CREATE TRIGGER IF NOT EXISTS update_resumes_timestamp
AFTER UPDATE ON resumes
BEGIN
  UPDATE resumes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;
