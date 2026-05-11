-- Social Sync Database Schema
-- Run this in your MySQL database

CREATE DATABASE IF NOT EXISTS socialsync;
USE socialsync;

-- Users table with username, privacy, profile setup tracking
CREATE TABLE users (
  id VARCHAR(36) PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  username VARCHAR(50) UNIQUE NOT NULL,
  password VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  avatar TEXT DEFAULT '',
  bio TEXT DEFAULT '',
  status ENUM('online','offline','away') DEFAULT 'offline',
  is_private TINYINT(1) DEFAULT 0,
  profile_setup_complete TINYINT(1) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Friend requests
CREATE TABLE friend_requests (
  id VARCHAR(36) PRIMARY KEY,
  from_user_id VARCHAR(36) NOT NULL,
  to_user_id VARCHAR(36) NOT NULL,
  status ENUM('pending','accepted','declined') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_request (from_user_id, to_user_id)
);

-- Friends (bidirectional)
CREATE TABLE friends (
  user_id VARCHAR(36) NOT NULL,
  friend_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, friend_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chats
CREATE TABLE chats (
  id VARCHAR(36) PRIMARY KEY,
  type ENUM('private','group') NOT NULL,
  name VARCHAR(100) DEFAULT NULL,
  avatar TEXT DEFAULT '',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Chat participants
CREATE TABLE chat_participants (
  chat_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (chat_id, user_id),
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Messages
CREATE TABLE messages (
  id VARCHAR(36) PRIMARY KEY,
  chat_id VARCHAR(36) NOT NULL,
  sender_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('text','image') DEFAULT 'text',
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE,
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Posts (images and videos)
CREATE TABLE posts (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  caption TEXT DEFAULT '',
  type ENUM('image','video') NOT NULL,
  media_url TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Post likes
CREATE TABLE post_likes (
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (post_id, user_id),
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Post comments
CREATE TABLE post_comments (
  id VARCHAR(36) PRIMARY KEY,
  post_id VARCHAR(36) NOT NULL,
  user_id VARCHAR(36) NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);