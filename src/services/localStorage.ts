import { AuthService, UserService, FriendService, ChatService, User, FriendRequest, Message, Chat } from './types';
import { mockUsers, mockChats, mockMessages, mockFriendRequests } from './mockData';

// localStorage-based implementation - swap this for any backend

const KEYS = {
  currentUser: 'socialsync_user',
  users: 'socialsync_users',
  chats: 'socialsync_chats',
  messages: 'socialsync_messages',
  friends: 'socialsync_friends',
  requests: 'socialsync_requests',
};

function init() {
  if (!localStorage.getItem(KEYS.users)) localStorage.setItem(KEYS.users, JSON.stringify(mockUsers));
  if (!localStorage.getItem(KEYS.chats)) localStorage.setItem(KEYS.chats, JSON.stringify(mockChats));
  if (!localStorage.getItem(KEYS.messages)) localStorage.setItem(KEYS.messages, JSON.stringify(mockMessages));
  if (!localStorage.getItem(KEYS.friends)) localStorage.setItem(KEYS.friends, JSON.stringify({ '1': ['2', '3', '5'] }));
  if (!localStorage.getItem(KEYS.requests)) localStorage.setItem(KEYS.requests, JSON.stringify(mockFriendRequests));
}
init();

function getStore<T>(key: string): T { return JSON.parse(localStorage.getItem(key) || '{}'); }
function setStore(key: string, data: unknown) { localStorage.setItem(key, JSON.stringify(data)); }

export const authService: AuthService = {
  async login(email: string, _password: string) {
    const users = getStore<User[]>(KEYS.users) || [];
    const user = (users as User[]).find(u => u.email === email);
    if (!user) throw new Error('User not found');
    user.status = 'online';
    localStorage.setItem(KEYS.currentUser, JSON.stringify(user));
    return user;
  },
  async signup(email: string, _password: string, username: string) {
    const users = getStore<User[]>(KEYS.users) || [];
    const newUser: User = {
      id: crypto.randomUUID(), email, username, displayName: username,
      avatar: '', bio: '', status: 'online', isPrivate: false, profileSetupComplete: false,
      createdAt: new Date().toISOString(),
    };
    (users as User[]).push(newUser);
    setStore(KEYS.users, users);
    return { message: 'Account created! Please log in.' } as any;
  },
  async me() {
  const data = localStorage.getItem(KEYS.currentUser);
  if (!data) throw new Error('Not authenticated');
  return JSON.parse(data);
},
  async logout() { localStorage.removeItem(KEYS.currentUser); },
  getCurrentUser() {
    const data = localStorage.getItem(KEYS.currentUser);
    return data ? JSON.parse(data) : null;
  },
  async forgotPassword(_email: string) { return { message: 'OTP sent (mock)' }; },
  async verifyOtp(_email: string, _otp: string) { return { token: 'mock-token' }; },
  async resetPassword(_token: string, _newPassword: string) { return { message: 'Password reset (mock)' }; },
};

export const userService: UserService = {
  async getUser(id: string) {
    const users = getStore<User[]>(KEYS.users) || [];
    return (users as User[]).find(u => u.id === id) || null;
  },
  async updateProfile(id: string, data: Partial<User>) {
    const users = getStore<User[]>(KEYS.users) || [];
    const idx = (users as User[]).findIndex(u => u.id === id);
    if (idx === -1) throw new Error('User not found');
    (users as User[])[idx] = { ...(users as User[])[idx], ...data };
    setStore(KEYS.users, users);
    if (authService.getCurrentUser()?.id === id) localStorage.setItem(KEYS.currentUser, JSON.stringify((users as User[])[idx]));
    return (users as User[])[idx];
  },
  async searchUsers(query: string) {
    const users = getStore<User[]>(KEYS.users) || [];
    return (users as User[]).filter(u => u.displayName.toLowerCase().includes(query.toLowerCase()) || u.username.toLowerCase().includes(query.toLowerCase()) || u.email.toLowerCase().includes(query.toLowerCase()));
  },
};

export const friendService: FriendService = {
  async sendRequest(fromId: string, toId: string) {
    const requests = getStore<(FriendRequest & { fromUser: User })[]>(KEYS.requests) || [];
    const users = getStore<User[]>(KEYS.users) || [];
    const fromUser = (users as User[]).find(u => u.id === fromId)!;
    const req: FriendRequest & { fromUser: User } = { id: crypto.randomUUID(), fromUserId: fromId, toUserId: toId, status: 'pending', createdAt: new Date().toISOString(), fromUser };
    (requests as any[]).push(req);
    setStore(KEYS.requests, requests);
    return req;
  },
  async acceptRequest(requestId: string) {
    const requests = getStore<(FriendRequest & { fromUser: User })[]>(KEYS.requests) || [];
    const friends = getStore<Record<string, string[]>>(KEYS.friends) || {};
    const req = (requests as any[]).find(r => r.id === requestId);
    if (!req) return;
    req.status = 'accepted';
    if (!friends[req.toUserId]) friends[req.toUserId] = [];
    if (!friends[req.fromUserId]) friends[req.fromUserId] = [];
    friends[req.toUserId].push(req.fromUserId);
    friends[req.fromUserId].push(req.toUserId);
    setStore(KEYS.requests, requests);
    setStore(KEYS.friends, friends);
  },
  async declineRequest(requestId: string) {
    const requests = getStore<(FriendRequest & { fromUser: User })[]>(KEYS.requests) || [];
    const req = (requests as any[]).find(r => r.id === requestId);
    if (req) req.status = 'declined';
    setStore(KEYS.requests, requests);
  },
  async removeFriend(_userId: string, _friendId: string) { /* no-op */ },
  async blockUser(_userId: string, _blockedId: string) { /* no-op */ },
  async unblockUser(_userId: string, _blockedId: string) { /* no-op */ },
  async getBlockedUsers(_userId: string) { return []; },
  async getFriends(userId: string) {
    const friends = getStore<Record<string, string[]>>(KEYS.friends) || {};
    const users = getStore<User[]>(KEYS.users) || [];
    const friendIds = friends[userId] || [];
    return (users as User[]).filter(u => friendIds.includes(u.id));
  },
  async getPendingRequests(userId: string) {
    const requests = getStore<(FriendRequest & { fromUser: User })[]>(KEYS.requests) || [];
    return (requests as any[]).filter(r => r.toUserId === userId && r.status === 'pending');
  },
  async getSentRequests(userId: string) {
    const requests = getStore<(FriendRequest & { fromUser: User })[]>(KEYS.requests) || [];
    const users = getStore<User[]>(KEYS.users) || [];
    return (requests as any[]).filter(r => r.fromUserId === userId && r.status === 'pending').map(r => ({
      ...r, toUser: (users as User[]).find(u => u.id === r.toUserId),
    }));
  },
};

export const chatService: ChatService = {
  async getChats(userId: string) {
    const chats = getStore<Chat[]>(KEYS.chats) || [];
    return (chats as Chat[]).filter(c => c.participants.includes(userId));
  },
  async getMessages(chatId: string) {
    const messages = getStore<Record<string, Message[]>>(KEYS.messages) || {};
    return messages[chatId] || [];
  },
  async sendMessage(chatId: string, senderId: string, content: string) {
    const messages = getStore<Record<string, Message[]>>(KEYS.messages) || {};
    const chats = getStore<Chat[]>(KEYS.chats) || [];
    const msg: Message = { id: crypto.randomUUID(), senderId, content, timestamp: new Date().toISOString(), type: 'text' };
    if (!messages[chatId]) messages[chatId] = [];
    messages[chatId].push(msg);
    const chat = (chats as Chat[]).find(c => c.id === chatId);
    if (chat) chat.lastMessage = msg;
    setStore(KEYS.messages, messages);
    setStore(KEYS.chats, chats);
    return msg;
  },
  async createPrivateChat(user1Id: string, user2Id: string) {
    const chats = getStore<Chat[]>(KEYS.chats) || [];
    const existing = (chats as Chat[]).find(c => c.type === 'private' && c.participants.includes(user1Id) && c.participants.includes(user2Id));
    if (existing) return existing;
    const chat: Chat = { id: crypto.randomUUID(), type: 'private', participants: [user1Id, user2Id], createdAt: new Date().toISOString() };
    (chats as Chat[]).push(chat);
    setStore(KEYS.chats, chats);
    return chat;
  },
  async createGroupChat(name: string, avatar: string, memberIds: string[]) {
    const chats = getStore<Chat[]>(KEYS.chats) || [];
    const chat: Chat = { id: crypto.randomUUID(), type: 'group', name, avatar, participants: memberIds, createdAt: new Date().toISOString() };
    (chats as Chat[]).push(chat);
    setStore(KEYS.chats, chats);
    return chat;
  },
  async markMessagesRead(_chatId: string) {
    // No-op for localStorage fallback
  },
};