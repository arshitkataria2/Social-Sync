import { AuthService, UserService, FriendService, ChatService, PostService, User, FriendRequest, Message, Chat, Post, PostComment } from './types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getToken(): string | null {
  return localStorage.getItem('socialsync_token');
}

function setSession(user: User, token: string) {
  localStorage.setItem('socialsync_user', JSON.stringify(user));
  localStorage.setItem('socialsync_token', token);
}

function clearSession() {
  localStorage.removeItem('socialsync_user');
  localStorage.removeItem('socialsync_token');
}

async function request<T>(path: string, options?: RequestInit & { skipAuthRedirect?: boolean }): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const { skipAuthRedirect, ...fetchOptions } = options || {};

  const res = await fetch(`${API_BASE}${path}`, { headers, ...fetchOptions });

  if ((res.status === 401 || res.status === 403) && !skipAuthRedirect) {
    if (token) {
      clearSession();
      window.location.href = '/auth';
      throw new Error('Session expired');
    }
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || 'API Error');
  }
  return res.json();
}

// ---- Auth ----
export const authService: AuthService = {
  async login(email: string, password: string) {
    const { user, token } = await request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuthRedirect: true,
    });
    setSession(user, token);
    return user;
  },
  async signup(email: string, password: string, username: string) {
    const result = await request<{ message: string }>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password, username }),
      skipAuthRedirect: true,
    });
    return result as any;
  },
async me() {
  const data = localStorage.getItem('socialsync_user');
  if (!data) throw new Error('Not authenticated');
  return JSON.parse(data);
},
  async logout() {
    clearSession();
  },
  getCurrentUser() {
    const data = localStorage.getItem('socialsync_user');
    return data ? JSON.parse(data) : null;
  },
  async forgotPassword(email: string) {
    return request<{ message: string }>('/auth/forgot-password', {
      method: 'POST', body: JSON.stringify({ email }), skipAuthRedirect: true,
    });
  },
  async verifyOtp(email: string, otp: string) {
    return request<{ token: string }>('/auth/verify-otp', {
      method: 'POST', body: JSON.stringify({ email, otp }), skipAuthRedirect: true,
    });
  },
  async resetPassword(token: string, newPassword: string) {
    return request<{ message: string }>('/auth/reset-password', {
      method: 'POST', body: JSON.stringify({ token, newPassword }), skipAuthRedirect: true,
    });
  },
};

export async function checkUsername(username: string): Promise<{ available: boolean; message?: string }> {
  const res = await fetch(`${API_BASE}/auth/check-username?username=${encodeURIComponent(username)}`);
  return res.json();
}

// ---- Users ----
export const userService: UserService = {
  async getUser(id: string) {
    return request<User | null>(`/users/${id}`);
  },
  async updateProfile(id: string, data: Partial<User>) {
    const user = await request<User>(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (authService.getCurrentUser()?.id === id) {
      const token = getToken();
      if (token) setSession(user, token);
    }
    return user;
  },
  async searchUsers(query: string) {
    return request<User[]>(`/users/search?q=${encodeURIComponent(query)}`);
  },
};

// ---- Friends ----
export const friendService: FriendService = {
  async sendRequest(fromId: string, toId: string) {
    return request<FriendRequest>('/friends/request', {
      method: 'POST',
      body: JSON.stringify({ fromId, toId }),
    });
  },
  async acceptRequest(requestId: string) {
    await request(`/friends/request/${requestId}/accept`, { method: 'POST' });
  },
  async declineRequest(requestId: string) {
    await request(`/friends/request/${requestId}/decline`, { method: 'POST' });
  },
  async removeFriend(userId: string, friendId: string) {
    await request('/friends/remove', { method: 'POST', body: JSON.stringify({ userId, friendId }) });
  },
  async blockUser(userId: string, blockedId: string) {
    await request('/friends/block', { method: 'POST', body: JSON.stringify({ userId, blockedId }) });
  },
  async unblockUser(userId: string, blockedId: string) {
    await request('/friends/unblock', { method: 'POST', body: JSON.stringify({ userId, blockedId }) });
  },
  async getBlockedUsers(userId: string) {
    return request<User[]>(`/friends/${userId}/blocked`);
  },
  async getFriends(userId: string) {
    return request<User[]>(`/friends/${userId}`);
  },
  async getPendingRequests(userId: string) {
    return request<(FriendRequest & { fromUser: User })[]>(`/friends/${userId}/pending`);
  },
  async getSentRequests(userId: string) {
    return request<(FriendRequest & { toUser: User })[]>(`/friends/${userId}/sent`);
  },
};

// ---- Chat ----
export const chatService: ChatService = {
  async getChats(userId: string) {
    return request<Chat[]>(`/chats/${userId}`);
  },
  async getMessages(chatId: string) {
    return request<Message[]>(`/chats/${chatId}/messages`);
  },
  async sendMessage(chatId: string, senderId: string, content: string) {
    return request<Message>(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ senderId, content }),
    });
  },
  async createPrivateChat(user1Id: string, user2Id: string) {
    return request<Chat>('/chats/private', {
      method: 'POST',
      body: JSON.stringify({ user1Id, user2Id }),
    });
  },
  async createGroupChat(name: string, avatar: string, memberIds: string[]) {
    return request<Chat>('/chats/group', {
      method: 'POST',
      body: JSON.stringify({ name, avatar, memberIds }),
    });
  },
  async markMessagesRead(chatId: string) {
    return request<void>(`/chats/${chatId}/read`, { method: 'POST' });
  },
};

// ---- Posts ----
export const postService: PostService = {
  async createPost(caption: string, type: 'image' | 'video', mediaUrl: string, settings?: { hideLikes?: boolean; commentsDisabled?: boolean; commentReview?: boolean }) {
    return request<Post>('/posts', {
      method: 'POST',
      body: JSON.stringify({ caption, type, mediaUrl, ...settings }),
    });
  },
  async getFeed() {
    return request<Post[]>('/posts/feed');
  },
  async getUserPosts(userId: string) {
    return request<Post[]>(`/posts/user/${userId}`);
  },
  async likePost(postId: string) {
    return request<{ liked: boolean }>(`/posts/${postId}/like`, { method: 'POST' });
  },
  async getComments(postId: string) {
    return request<PostComment[]>(`/posts/${postId}/comments`);
  },
  async getPendingComments(postId: string) {
    return request<PostComment[]>(`/posts/${postId}/comments/pending`);
  },
  async addComment(postId: string, content: string) {
    return request<PostComment>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  },
  async deleteComment(postId: string, commentId: string) {
    await request(`/posts/${postId}/comments/${commentId}`, { method: 'DELETE' });
  },
  async approveComment(postId: string, commentId: string) {
    await request(`/posts/${postId}/comments/${commentId}/approve`, { method: 'POST' });
  },
  async updatePostSettings(postId: string, settings: { hideLikes?: boolean; commentsDisabled?: boolean; commentReview?: boolean }) {
    await request(`/posts/${postId}/settings`, {
      method: 'PUT',
      body: JSON.stringify(settings),
    });
  },
  async blockCommenter(userId: string) {
    await request('/posts/block-commenter', { method: 'POST', body: JSON.stringify({ blockedUserId: userId }) });
  },
  async unblockCommenter(userId: string) {
    await request('/posts/unblock-commenter', { method: 'POST', body: JSON.stringify({ blockedUserId: userId }) });
  },
  async getBlockedCommenters() {
    return request<User[]>('/posts/blocked-commenters');
  },
  async deletePost(postId: string) {
    await request(`/posts/${postId}`, { method: 'DELETE' });
  },
  async uploadFile(file: File) {
    const token = getToken();
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/upload`, {
      method: 'POST',
      headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      body: formData,
    });
    if (!res.ok) throw new Error('Upload failed');
    return res.json();
  },
};