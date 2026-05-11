// Core types for Social Sync

export interface User {
  id: string;
  email: string;
  username: string;
  displayName: string;
  avatar: string;
  bio: string;
  status: 'online' | 'offline' | 'away';
  isPrivate: boolean;
  profileSetupComplete: boolean;
  lastSeen?: string;
  createdAt: string;
  friendsCount?: number;
  postsCount?: number;
  isFriend?: boolean;
  sentRequestId?: string | null;
  receivedRequestId?: string | null;
}

export interface FriendRequest {
  id: string;
  fromUserId: string;
  toUserId: string;
  status: 'pending' | 'accepted' | 'declined';
  createdAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  content: string;
  timestamp: string;
  type: 'text' | 'image';
  readBy?: string[];
}

export interface Chat {
  id: string;
  type: 'private' | 'group';
  name?: string;
  avatar?: string;
  participants: string[];
  participantUsers?: Record<string, User>;
  lastMessage?: Message;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  caption: string;
  type: 'image' | 'video';
  mediaUrl: string;
  createdAt: string;
  likesCount: number;
  commentsCount: number;
  isLiked: boolean;
  hideLikes: boolean;
  commentsDisabled: boolean;
  commentReview: boolean;
  user?: {
    displayName: string;
    username: string;
    avatar: string;
  };
}

export interface PostComment {
  id: string;
  postId: string;
  userId: string;
  content: string;
  approved: boolean;
  createdAt: string;
  user: {
    displayName: string;
    username: string;
    avatar: string;
  };
}

export interface AuthService {
  login(email: string, password: string): Promise<User>;
  signup(email: string, password: string, username: string): Promise<{ message: string }>;

  me(): Promise<User>;

  logout(): Promise<void>;
  getCurrentUser(): User | null;

  forgotPassword(email: string): Promise<{ message: string }>;
  verifyOtp(email: string, otp: string): Promise<{ token: string }>;
  resetPassword(token: string, newPassword: string): Promise<{ message: string }>;
}

export interface UserService {
  getUser(id: string): Promise<User | null>;
  updateProfile(id: string, data: Partial<User>): Promise<User>;
  searchUsers(query: string): Promise<User[]>;
}

export interface FriendService {
  sendRequest(fromId: string, toId: string): Promise<FriendRequest>;
  acceptRequest(requestId: string): Promise<void>;
  declineRequest(requestId: string): Promise<void>;
  removeFriend(userId: string, friendId: string): Promise<void>;
  blockUser(userId: string, blockedId: string): Promise<void>;
  unblockUser(userId: string, blockedId: string): Promise<void>;
  getBlockedUsers(userId: string): Promise<User[]>;
  getFriends(userId: string): Promise<User[]>;
  getPendingRequests(userId: string): Promise<(FriendRequest & { fromUser: User })[]>;
  getSentRequests(userId: string): Promise<(FriendRequest & { toUser: User })[]>;
}

export interface ChatService {
  getChats(userId: string): Promise<Chat[]>;
  getMessages(chatId: string): Promise<Message[]>;
  sendMessage(chatId: string, senderId: string, content: string): Promise<Message>;
  createPrivateChat(user1Id: string, user2Id: string): Promise<Chat>;
  createGroupChat(name: string, avatar: string, memberIds: string[]): Promise<Chat>;
  markMessagesRead(chatId: string): Promise<void>;
}

export interface PostService {
  createPost(caption: string, type: 'image' | 'video', mediaUrl: string, settings?: { hideLikes?: boolean; commentsDisabled?: boolean; commentReview?: boolean }): Promise<Post>;
  getFeed(): Promise<Post[]>;
  getUserPosts(userId: string): Promise<Post[]>;
  likePost(postId: string): Promise<{ liked: boolean }>;
  getComments(postId: string): Promise<PostComment[]>;
  getPendingComments(postId: string): Promise<PostComment[]>;
  addComment(postId: string, content: string): Promise<PostComment>;
  deleteComment(postId: string, commentId: string): Promise<void>;
  approveComment(postId: string, commentId: string): Promise<void>;
  updatePostSettings(postId: string, settings: { hideLikes?: boolean; commentsDisabled?: boolean; commentReview?: boolean }): Promise<void>;
  blockCommenter(userId: string): Promise<void>;
  unblockCommenter(userId: string): Promise<void>;
  getBlockedCommenters(): Promise<User[]>;
  deletePost(postId: string): Promise<void>;
  uploadFile(file: File): Promise<{ url: string }>;
}