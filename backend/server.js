const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const http = require('http');
const { Server } = require('socket.io');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('./db');
require('dotenv').config();

const uuidv4 = () => crypto.randomUUID();
const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Serve uploaded files
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

// Multer config for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => cb(null, `${uuidv4()}${path.extname(file.originalname)}`),
});
const upload = multer({ storage, limits: { fileSize: 50 * 1024 * 1024 } });

const JWT_SECRET = process.env.JWT_SECRET || 'socialsync_default_secret_change_me';
const JWT_EXPIRES_IN = '7d';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3001';

// ============ JWT MIDDLEWARE ============
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ message: 'Token required' });
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) return res.status(403).json({ message: 'Invalid or expired token' });
    req.userId = decoded.userId;
    next();
  });
}

// ============ HELPERS ============
function formatUser(row) {
  return {
    id: row.id, email: row.email, username: row.username,
    displayName: row.display_name, avatar: row.avatar || '', bio: row.bio || '',
    status: row.status, isPrivate: !!row.is_private,
    profileSetupComplete: !!row.profile_setup_complete,
    lastSeen: row.last_seen || null,
    createdAt: row.created_at,
  };
}
function formatMessage(row) {
  return { id: row.id, senderId: row.sender_id, content: row.content, timestamp: row.timestamp, type: row.type, readBy: [] };
}
function formatFriendRequest(row) {
  return { id: row.id, fromUserId: row.from_user_id, toUserId: row.to_user_id, status: row.status, createdAt: row.created_at };
}
function formatPost(row) {
  return { id: row.id, userId: row.user_id, caption: row.caption, type: row.type, mediaUrl: row.media_url, createdAt: row.created_at, likesCount: row.likes_count || 0, commentsCount: row.comments_count || 0, isLiked: !!row.is_liked, hideLikes: !!row.hide_likes, commentsDisabled: !!row.comments_disabled, commentReview: !!row.comment_review };
}

function isValidUsername(username) {
  return /^[a-zA-Z0-9_.]{3,30}$/.test(username);
}

// ============ AUTH ============
app.post('/api/auth/signup', async (req, res) => {
  try {
    const { email, password, username } = req.body;
    if (!username || !isValidUsername(username)) {
      return res.status(400).json({ message: 'Username must be 3-30 characters, only letters, numbers, underscore, dot. No spaces or special symbols.' });
    }
    const [existing] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
    if (existing.length) return res.status(400).json({ message: 'Username already taken' });
    const [existingEmail] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existingEmail.length) return res.status(400).json({ message: 'Email already registered' });

    const id = uuidv4();
    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute(
      'INSERT INTO users (id, email, username, password, display_name) VALUES (?, ?, ?, ?, ?)',
      [id, email, username, hashedPassword, username]
    );
    res.json({ message: 'Account created! Please log in.' });
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const [rows] = await db.execute('SELECT * FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(400).json({ message: 'Invalid email or password' });
    const valid = await bcrypt.compare(password, rows[0].password);
    if (!valid) return res.status(400).json({ message: 'Invalid email or password' });
    await db.execute("UPDATE users SET status = 'online', last_seen = NOW() WHERE id = ?", [rows[0].id]);
    const user = formatUser({ ...rows[0], status: 'online', last_seen: new Date() });
    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    res.json({ user, token });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!rows.length) return res.status(404).json({ message: 'User not found' });
  res.json(formatUser(rows[0]));
});

app.get('/api/auth/check-username', async (req, res) => {
  const { username } = req.query;
  if (!username || !isValidUsername(username)) return res.json({ available: false, message: 'Invalid username format' });
  const [rows] = await db.execute('SELECT id FROM users WHERE username = ?', [username]);
  res.json({ available: rows.length === 0 });
});

// ============ FORGOT PASSWORD / OTP ============
app.post('/api/auth/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const [rows] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (!rows.length) return res.status(400).json({ message: 'No account with that email' });
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const id = uuidv4();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 min
    await db.execute('INSERT INTO password_resets (id, user_id, otp, expires_at) VALUES (?, ?, ?, ?)', [id, rows[0].id, otp, expiresAt]);
    // In production, send email here. For now, log OTP.
    console.log(`[OTP] User ${email}: ${otp}`);
    res.json({ message: `OTP sent to ${email}. Check server console for now.` });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/api/auth/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const [users] = await db.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (!users.length) return res.status(400).json({ message: 'User not found' });
    const [rows] = await db.execute(
      'SELECT * FROM password_resets WHERE user_id = ? AND otp = ? AND used = 0 AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [users[0].id, otp]
    );
    if (!rows.length) return res.status(400).json({ message: 'Invalid or expired OTP' });
    // Mark used
    await db.execute('UPDATE password_resets SET used = 1 WHERE id = ?', [rows[0].id]);
    // Issue a short-lived reset token
    const token = jwt.sign({ userId: users[0].id, purpose: 'reset' }, JWT_SECRET, { expiresIn: '15m' });
    res.json({ token });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.purpose !== 'reset') return res.status(400).json({ message: 'Invalid token' });
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.execute('UPDATE users SET password = ? WHERE id = ?', [hashed, decoded.userId]);
    res.json({ message: 'Password reset successfully! Please log in.' });
  } catch (e) {
    res.status(400).json({ message: 'Invalid or expired reset token' });
  }
});

// ============ USERS ============
app.get('/api/users/search', authenticateToken, async (req, res) => {
  const q = `%${req.query.q}%`;
  const [rows] = await db.execute(
    'SELECT * FROM users WHERE (display_name LIKE ? OR username LIKE ? OR email LIKE ?) AND id != ?',
    [q, q, q, req.userId]
  );
  const results = [];
  for (const row of rows) {
    const u = formatUser(row);
    const [friendCount] = await db.execute('SELECT COUNT(*) as count FROM friends WHERE user_id = ?', [u.id]);
    const [postCount] = await db.execute('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [u.id]);
    const [friendship] = await db.execute('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?', [req.userId, u.id]);
    const [sentReq] = await db.execute("SELECT id, status FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'", [req.userId, u.id]);
    const [recvReq] = await db.execute("SELECT id, status FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'", [u.id, req.userId]);
    results.push({
      ...u,
      friendsCount: friendCount[0].count,
      postsCount: postCount[0].count,
      isFriend: friendship.length > 0,
      sentRequestId: sentReq.length > 0 ? sentReq[0].id : null,
      receivedRequestId: recvReq.length > 0 ? recvReq[0].id : null,
    });
  }
  res.json(results);
});

app.get('/api/users/:id', authenticateToken, async (req, res) => {
  const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [req.params.id]);
  if (!rows[0]) return res.json(null);
  const u = formatUser(rows[0]);
  const [friendCount] = await db.execute('SELECT COUNT(*) as count FROM friends WHERE user_id = ?', [u.id]);
  const [postCount] = await db.execute('SELECT COUNT(*) as count FROM posts WHERE user_id = ?', [u.id]);
  const [friendship] = await db.execute('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?', [req.userId, u.id]);
  res.json({ ...u, friendsCount: friendCount[0].count, postsCount: postCount[0].count, isFriend: friendship.length > 0 });
});

app.put('/api/users/:id', authenticateToken, async (req, res) => {
  const { displayName, bio, avatar, isPrivate, profileSetupComplete } = req.body;
  await db.execute(
    'UPDATE users SET display_name = COALESCE(?, display_name), bio = COALESCE(?, bio), avatar = COALESCE(?, avatar), is_private = COALESCE(?, is_private), profile_setup_complete = COALESCE(?, profile_setup_complete) WHERE id = ?',
    [displayName, bio, avatar, isPrivate !== undefined ? (isPrivate ? 1 : 0) : null, profileSetupComplete !== undefined ? (profileSetupComplete ? 1 : 0) : null, req.params.id]
  );
  const [rows] = await db.execute('SELECT * FROM users WHERE id = ?', [req.params.id]);
  res.json(formatUser(rows[0]));
});

// ============ FILE UPLOAD ============
app.post('/api/upload', authenticateToken, upload.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
  const url = `${BASE_URL}/uploads/${req.file.filename}`;
  res.json({ url, filename: req.file.filename });
});

// ============ FRIENDS ============
app.post('/api/friends/request', authenticateToken, async (req, res) => {
  try {
    const { fromId, toId } = req.body;
    const [existing] = await db.execute('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?', [fromId, toId]);
    if (existing.length) return res.status(400).json({ message: 'Already friends' });
    const [existingReq] = await db.execute("SELECT id FROM friend_requests WHERE from_user_id = ? AND to_user_id = ? AND status = 'pending'", [fromId, toId]);
    if (existingReq.length) return res.status(400).json({ message: 'Request already sent' });
    const id = uuidv4();
    await db.execute('INSERT INTO friend_requests (id, from_user_id, to_user_id) VALUES (?, ?, ?)', [id, fromId, toId]);
    const [rows] = await db.execute('SELECT * FROM friend_requests WHERE id = ?', [id]);
    io.to(`user_${toId}`).emit('friend_request', formatFriendRequest(rows[0]));
    res.json(formatFriendRequest(rows[0]));
  } catch (e) {
    res.status(400).json({ message: e.message });
  }
});

app.post('/api/friends/request/:id/accept', authenticateToken, async (req, res) => {
  const [rows] = await db.execute('SELECT * FROM friend_requests WHERE id = ?', [req.params.id]);
  if (!rows.length) return res.status(404).json({ message: 'Not found' });
  const r = rows[0];
  await db.execute("UPDATE friend_requests SET status = 'accepted' WHERE id = ?", [r.id]);
  await db.execute('INSERT IGNORE INTO friends (user_id, friend_id) VALUES (?, ?), (?, ?)', [r.from_user_id, r.to_user_id, r.to_user_id, r.from_user_id]);
  io.to(`user_${r.from_user_id}`).emit('friend_accepted', { requestId: r.id });
  res.json({ ok: true });
});

app.post('/api/friends/request/:id/decline', authenticateToken, async (req, res) => {
  await db.execute("UPDATE friend_requests SET status = 'declined' WHERE id = ?", [req.params.id]);
  res.json({ ok: true });
});

// Remove friend
app.post('/api/friends/remove', authenticateToken, async (req, res) => {
  const { userId, friendId } = req.body;
  await db.execute('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', [userId, friendId, friendId, userId]);
  // Also clean up accepted friend requests
  await db.execute("DELETE FROM friend_requests WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)", [userId, friendId, friendId, userId]);
  res.json({ ok: true });
});

// Block user
app.post('/api/friends/block', authenticateToken, async (req, res) => {
  const { userId, blockedId } = req.body;
  // Remove friendship if exists
  await db.execute('DELETE FROM friends WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)', [userId, blockedId, blockedId, userId]);
  // Remove pending requests
  await db.execute("DELETE FROM friend_requests WHERE (from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?)", [userId, blockedId, blockedId, userId]);
  // Insert block
  await db.execute('INSERT IGNORE INTO blocked_users (blocker_id, blocked_id) VALUES (?, ?)', [userId, blockedId]);
  res.json({ ok: true });
});

// Unblock user
app.post('/api/friends/unblock', authenticateToken, async (req, res) => {
  const { userId, blockedId } = req.body;
  await db.execute('DELETE FROM blocked_users WHERE blocker_id = ? AND blocked_id = ?', [userId, blockedId]);
  res.json({ ok: true });
});

// Get blocked users
app.get('/api/friends/:userId/blocked', authenticateToken, async (req, res) => {
  const [rows] = await db.execute('SELECT u.* FROM users u JOIN blocked_users b ON u.id = b.blocked_id WHERE b.blocker_id = ?', [req.params.userId]);
  res.json(rows.map(formatUser));
});

app.get('/api/friends/:userId', authenticateToken, async (req, res) => {
  const [rows] = await db.execute('SELECT u.* FROM users u JOIN friends f ON u.id = f.friend_id WHERE f.user_id = ?', [req.params.userId]);
  res.json(rows.map(formatUser));
});

app.get('/api/friends/:userId/pending', authenticateToken, async (req, res) => {
  const [rows] = await db.execute(
    `SELECT fr.*, u.id as fu_id, u.email as fu_email, u.username as fu_username, u.display_name as fu_name, u.avatar as fu_avatar, u.bio as fu_bio, u.status as fu_status, u.created_at as fu_created
     FROM friend_requests fr JOIN users u ON u.id = fr.from_user_id
     WHERE fr.to_user_id = ? AND fr.status = 'pending'`, [req.params.userId]
  );
  res.json(rows.map(r => ({
    ...formatFriendRequest(r),
    fromUser: { id: r.fu_id, email: r.fu_email, username: r.fu_username, displayName: r.fu_name, avatar: r.fu_avatar, bio: r.fu_bio, status: r.fu_status, createdAt: r.fu_created },
  })));
});

app.get('/api/friends/:userId/sent', authenticateToken, async (req, res) => {
  const [rows] = await db.execute(
    `SELECT fr.*, u.id as tu_id, u.email as tu_email, u.username as tu_username, u.display_name as tu_name, u.avatar as tu_avatar, u.bio as tu_bio, u.status as tu_status, u.created_at as tu_created
     FROM friend_requests fr JOIN users u ON u.id = fr.to_user_id
     WHERE fr.from_user_id = ? AND fr.status = 'pending'`, [req.params.userId]
  );
  res.json(rows.map(r => ({
    ...formatFriendRequest(r),
    toUser: { id: r.tu_id, email: r.tu_email, username: r.tu_username, displayName: r.tu_name, avatar: r.tu_avatar, bio: r.tu_bio, status: r.tu_status, createdAt: r.tu_created },
  })));
});

// ============ POSTS ============
app.post('/api/posts', authenticateToken, async (req, res) => {
  const { caption, type, mediaUrl, hideLikes, commentsDisabled, commentReview } = req.body;
  const id = uuidv4();
  await db.execute(
    'INSERT INTO posts (id, user_id, caption, type, media_url, hide_likes, comments_disabled, comment_review) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, req.userId, caption || '', type, mediaUrl, hideLikes ? 1 : 0, commentsDisabled ? 1 : 0, commentReview ? 1 : 0]
  );
  const [rows] = await db.execute('SELECT * FROM posts WHERE id = ?', [id]);
  const post = formatPost(rows[0]);
  // Get user info for the post
  const [userRows] = await db.execute('SELECT display_name, username, avatar FROM users WHERE id = ?', [req.userId]);
  const postWithUser = { ...post, user: { displayName: userRows[0].display_name, username: userRows[0].username, avatar: userRows[0].avatar } };
  // Notify friends about new post
  const [friendRows] = await db.execute('SELECT friend_id FROM friends WHERE user_id = ?', [req.userId]);
  friendRows.forEach(f => {
    io.to(`user_${f.friend_id}`).emit('new_post', postWithUser);
  });
  res.json(post);
});

app.get('/api/posts/feed', authenticateToken, async (req, res) => {
  const [rows] = await db.execute(
    `SELECT p.*, u.display_name, u.username, u.avatar as user_avatar, u.is_private,
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
      (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id AND approved = 1) as comments_count,
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
     FROM posts p JOIN users u ON p.user_id = u.id
     WHERE p.user_id = ?
       OR (u.is_private = 0)
       OR (u.is_private = 1 AND EXISTS (SELECT 1 FROM friends WHERE user_id = ? AND friend_id = p.user_id))
     ORDER BY p.created_at DESC LIMIT 50`,
    [req.userId, req.userId, req.userId]
  );
  res.json(rows.map(r => ({
    ...formatPost(r),
    user: { displayName: r.display_name, username: r.username, avatar: r.user_avatar },
  })));
});

app.get('/api/posts/user/:userId', authenticateToken, async (req, res) => {
  const targetId = req.params.userId;
  const [userRows] = await db.execute('SELECT is_private FROM users WHERE id = ?', [targetId]);
  if (!userRows.length) return res.json([]);
  if (userRows[0].is_private && targetId !== req.userId) {
    const [friendship] = await db.execute('SELECT 1 FROM friends WHERE user_id = ? AND friend_id = ?', [req.userId, targetId]);
    if (!friendship.length) return res.status(403).json({ message: 'Private profile' });
  }
  const [rows] = await db.execute(
    `SELECT p.*,
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id) as likes_count,
      (SELECT COUNT(*) FROM post_comments WHERE post_id = p.id) as comments_count,
      (SELECT COUNT(*) FROM post_likes WHERE post_id = p.id AND user_id = ?) as is_liked
     FROM posts p WHERE p.user_id = ? ORDER BY p.created_at DESC`,
    [req.userId, targetId]
  );
  res.json(rows.map(formatPost));
});

app.post('/api/posts/:postId/like', authenticateToken, async (req, res) => {
  const [existing] = await db.execute('SELECT 1 FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.postId, req.userId]);
  if (existing.length) {
    await db.execute('DELETE FROM post_likes WHERE post_id = ? AND user_id = ?', [req.params.postId, req.userId]);
    res.json({ liked: false });
  } else {
    await db.execute('INSERT INTO post_likes (post_id, user_id) VALUES (?, ?)', [req.params.postId, req.userId]);
    res.json({ liked: true });
  }
});

app.get('/api/posts/:postId/comments', authenticateToken, async (req, res) => {
  const [rows] = await db.execute(
    `SELECT c.*, u.display_name, u.username, u.avatar as user_avatar
     FROM post_comments c JOIN users u ON c.user_id = u.id
     WHERE c.post_id = ? AND c.approved = 1 ORDER BY c.created_at ASC`, [req.params.postId]
  );
  res.json(rows.map(r => ({
    id: r.id, postId: r.post_id, userId: r.user_id, content: r.content, approved: !!r.approved, createdAt: r.created_at,
    user: { displayName: r.display_name, username: r.username, avatar: r.user_avatar },
  })));
});

// Get pending comments (for post owner)
app.get('/api/posts/:postId/comments/pending', authenticateToken, async (req, res) => {
  const [post] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [req.params.postId]);
  if (!post.length || post[0].user_id !== req.userId) return res.status(403).json({ message: 'Not authorized' });
  const [rows] = await db.execute(
    `SELECT c.*, u.display_name, u.username, u.avatar as user_avatar
     FROM post_comments c JOIN users u ON c.user_id = u.id
     WHERE c.post_id = ? AND c.approved = 0 ORDER BY c.created_at ASC`, [req.params.postId]
  );
  res.json(rows.map(r => ({
    id: r.id, postId: r.post_id, userId: r.user_id, content: r.content, approved: !!r.approved, createdAt: r.created_at,
    user: { displayName: r.display_name, username: r.username, avatar: r.user_avatar },
  })));
});

app.post('/api/posts/:postId/comments', authenticateToken, async (req, res) => {
  // Check if comments are disabled
  const [postRows] = await db.execute('SELECT * FROM posts WHERE id = ?', [req.params.postId]);
  if (!postRows.length) return res.status(404).json({ message: 'Post not found' });
  const post = postRows[0];
  if (post.comments_disabled) return res.status(403).json({ message: 'Comments are disabled' });

  // Check if user is blocked from commenting
  const [blocked] = await db.execute('SELECT 1 FROM comment_blocked_users WHERE owner_id = ? AND blocked_user_id = ?', [post.user_id, req.userId]);
  if (blocked.length) return res.status(403).json({ message: 'You are not allowed to comment on this post' });

  const id = uuidv4();
  const approved = (post.comment_review && post.user_id !== req.userId) ? 0 : 1;
  await db.execute('INSERT INTO post_comments (id, post_id, user_id, content, approved) VALUES (?, ?, ?, ?, ?)', [id, req.params.postId, req.userId, req.body.content, approved]);
  const [rows] = await db.execute(
    `SELECT c.*, u.display_name, u.username, u.avatar as user_avatar FROM post_comments c JOIN users u ON c.user_id = u.id WHERE c.id = ?`, [id]
  );
  const r = rows[0];
  const commentData = { id: r.id, postId: r.post_id, userId: r.user_id, content: r.content, approved: !!r.approved, createdAt: r.created_at, user: { displayName: r.display_name, username: r.username, avatar: r.user_avatar } };
  // Notify post owner about new comment
  if (post.user_id !== req.userId) {
    io.to(`user_${post.user_id}`).emit('new_comment', { postId: req.params.postId, comment: commentData });
  }
  res.json(commentData);
});

// Delete comment (post owner or comment author)
app.delete('/api/posts/:postId/comments/:commentId', authenticateToken, async (req, res) => {
  const [post] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [req.params.postId]);
  const [comment] = await db.execute('SELECT user_id FROM post_comments WHERE id = ?', [req.params.commentId]);
  if (!post.length || !comment.length) return res.status(404).json({ message: 'Not found' });
  if (post[0].user_id !== req.userId && comment[0].user_id !== req.userId) return res.status(403).json({ message: 'Not authorized' });
  await db.execute('DELETE FROM post_comments WHERE id = ?', [req.params.commentId]);
  res.json({ ok: true });
});

// Approve comment
app.post('/api/posts/:postId/comments/:commentId/approve', authenticateToken, async (req, res) => {
  const [post] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [req.params.postId]);
  if (!post.length || post[0].user_id !== req.userId) return res.status(403).json({ message: 'Not authorized' });
  await db.execute('UPDATE post_comments SET approved = 1 WHERE id = ?', [req.params.commentId]);
  res.json({ ok: true });
});

// Update post settings
app.put('/api/posts/:postId/settings', authenticateToken, async (req, res) => {
  const { hideLikes, commentsDisabled, commentReview } = req.body;
  const [post] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [req.params.postId]);
  if (!post.length || post[0].user_id !== req.userId) return res.status(403).json({ message: 'Not authorized' });
  await db.execute(
    'UPDATE posts SET hide_likes = ?, comments_disabled = ?, comment_review = ? WHERE id = ?',
    [hideLikes ? 1 : 0, commentsDisabled ? 1 : 0, commentReview ? 1 : 0, req.params.postId]
  );
  res.json({ ok: true });
});

// Block commenter
app.post('/api/posts/block-commenter', authenticateToken, async (req, res) => {
  const { blockedUserId } = req.body;
  await db.execute('INSERT IGNORE INTO comment_blocked_users (owner_id, blocked_user_id) VALUES (?, ?)', [req.userId, blockedUserId]);
  res.json({ ok: true });
});

// Unblock commenter
app.post('/api/posts/unblock-commenter', authenticateToken, async (req, res) => {
  const { blockedUserId } = req.body;
  await db.execute('DELETE FROM comment_blocked_users WHERE owner_id = ? AND blocked_user_id = ?', [req.userId, blockedUserId]);
  res.json({ ok: true });
});

// Get blocked commenters
app.get('/api/posts/blocked-commenters', authenticateToken, async (req, res) => {
  const [rows] = await db.execute('SELECT u.* FROM users u JOIN comment_blocked_users cb ON u.id = cb.blocked_user_id WHERE cb.owner_id = ?', [req.userId]);
  res.json(rows.map(formatUser));
});

app.delete('/api/posts/:postId', authenticateToken, async (req, res) => {
  await db.execute('DELETE FROM posts WHERE id = ? AND user_id = ?', [req.params.postId, req.userId]);
  res.json({ ok: true });
});

// ============ CHATS ============
app.get('/api/chats/:userId', authenticateToken, async (req, res) => {
  const [rows] = await db.execute(
    'SELECT c.* FROM chats c JOIN chat_participants cp ON c.id = cp.chat_id WHERE cp.user_id = ?', [req.params.userId]
  );
  const chats = [];
  for (const chat of rows) {
    const [parts] = await db.execute('SELECT user_id FROM chat_participants WHERE chat_id = ?', [chat.id]);
    const [msgs] = await db.execute('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp DESC LIMIT 1', [chat.id]);
    chats.push({
      id: chat.id, type: chat.type, name: chat.name, avatar: chat.avatar,
      participants: parts.map(p => p.user_id),
      lastMessage: msgs[0] ? formatMessage(msgs[0]) : undefined,
      createdAt: chat.created_at,
    });
  }
  res.json(chats);
});

app.get('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
  const [rows] = await db.execute('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [req.params.chatId]);
  // Get read receipts for each message
  const messages = [];
  for (const row of rows) {
    const msg = formatMessage(row);
    const [reads] = await db.execute('SELECT user_id FROM message_reads WHERE message_id = ?', [row.id]);
    msg.readBy = reads.map(r => r.user_id);
    messages.push(msg);
  }
  res.json(messages);
});

app.post('/api/chats/:chatId/messages', authenticateToken, async (req, res) => {
  const { senderId, content } = req.body;
  const id = uuidv4();
  await db.execute('INSERT INTO messages (id, chat_id, sender_id, content) VALUES (?, ?, ?, ?)', [id, req.params.chatId, senderId, content]);
  const [rows] = await db.execute('SELECT * FROM messages WHERE id = ?', [id]);
  const msg = formatMessage(rows[0]);
  // Broadcast to chat participants via socket
  const [parts] = await db.execute('SELECT user_id FROM chat_participants WHERE chat_id = ?', [req.params.chatId]);
  parts.forEach(p => {
    if (p.user_id !== senderId) {
      io.to(`user_${p.user_id}`).emit('new_message', { chatId: req.params.chatId, message: msg });
    }
  });
  res.json(msg);
});

// Mark messages as read
app.post('/api/chats/:chatId/read', authenticateToken, async (req, res) => {
  const chatId = req.params.chatId;
  const userId = req.userId;
  // Get all unread messages in this chat not sent by this user
  const [unread] = await db.execute(
    `SELECT m.id FROM messages m
     WHERE m.chat_id = ? AND m.sender_id != ?
     AND m.id NOT IN (SELECT message_id FROM message_reads WHERE user_id = ?)`,
    [chatId, userId, userId]
  );
  for (const msg of unread) {
    await db.execute('INSERT IGNORE INTO message_reads (message_id, user_id) VALUES (?, ?)', [msg.id, userId]);
  }
  // Notify sender(s) that messages were read
  const [parts] = await db.execute('SELECT user_id FROM chat_participants WHERE chat_id = ?', [chatId]);
  parts.forEach(p => {
    if (p.user_id !== userId) {
      io.to(`user_${p.user_id}`).emit('messages_read', { chatId, userId });
    }
  });
  res.json({ ok: true });
});

app.post('/api/chats/private', authenticateToken, async (req, res) => {
  const { user1Id, user2Id } = req.body;
  const [existing] = await db.execute(
    `SELECT c.id FROM chats c
     JOIN chat_participants cp1 ON c.id = cp1.chat_id AND cp1.user_id = ?
     JOIN chat_participants cp2 ON c.id = cp2.chat_id AND cp2.user_id = ?
     WHERE c.type = 'private'`, [user1Id, user2Id]
  );
  if (existing.length) {
    const [chat] = await db.execute('SELECT * FROM chats WHERE id = ?', [existing[0].id]);
    const [parts] = await db.execute('SELECT user_id FROM chat_participants WHERE chat_id = ?', [existing[0].id]);
    return res.json({ ...chat[0], participants: parts.map(p => p.user_id), createdAt: chat[0].created_at });
  }
  const id = uuidv4();
  await db.execute("INSERT INTO chats (id, type) VALUES (?, 'private')", [id]);
  await db.execute('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?), (?, ?)', [id, user1Id, id, user2Id]);
  res.json({ id, type: 'private', participants: [user1Id, user2Id], createdAt: new Date().toISOString() });
});

app.post('/api/chats/group', authenticateToken, async (req, res) => {
  const { name, avatar, memberIds } = req.body;
  const id = uuidv4();
  await db.execute("INSERT INTO chats (id, type, name, avatar) VALUES (?, 'group', ?, ?)", [id, name, avatar]);
  for (const uid of memberIds) {
    await db.execute('INSERT INTO chat_participants (chat_id, user_id) VALUES (?, ?)', [id, uid]);
  }
  res.json({ id, type: 'group', name, avatar, participants: memberIds, createdAt: new Date().toISOString() });
});

// ============ SOCKET.IO ============
const onlineUsers = new Map();

io.on('connection', (socket) => {
  socket.on('register', (userId) => {
    onlineUsers.set(userId, socket.id);
    socket.join(`user_${userId}`);
    db.execute("UPDATE users SET status = 'online', last_seen = NOW() WHERE id = ?", [userId]);
    io.emit('user_status', { userId, status: 'online' });
  });

  socket.on('typing', ({ chatId, userId }) => {
    socket.to(`chat_${chatId}`).emit('user_typing', { chatId, userId });
  });

  socket.on('join_chat', (chatId) => {
    socket.join(`chat_${chatId}`);
  });

  socket.on('disconnect', () => {
    for (const [userId, sid] of onlineUsers.entries()) {
      if (sid === socket.id) {
        onlineUsers.delete(userId);
        db.execute("UPDATE users SET status = 'offline', last_seen = NOW() WHERE id = ?", [userId]);
        io.emit('user_status', { userId, status: 'offline' });
        break;
      }
    }
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => console.log(`Server running on port ${PORT} with Socket.IO`));