import { User, Chat, Message, FriendRequest } from './types';

export const mockUsers: User[] = [
  { id: '1', email: 'you@example.com', username: 'you', displayName: 'You', avatar: '', bio: 'Building cool stuff ✨', status: 'online', isPrivate: false, profileSetupComplete: true, createdAt: '2024-01-01' },
  { id: '2', email: 'alex@example.com', username: 'alex_chen', displayName: 'Alex Chen', avatar: '', bio: 'Full-stack dev | Coffee lover', status: 'online', isPrivate: false, profileSetupComplete: true, createdAt: '2024-01-05' },
  { id: '3', email: 'maya@example.com', username: 'maya_patel', displayName: 'Maya Patel', avatar: '', bio: 'Designer & illustrator 🎨', status: 'away', isPrivate: false, profileSetupComplete: true, createdAt: '2024-01-10' },
  { id: '4', email: 'jordan@example.com', username: 'jordan_kim', displayName: 'Jordan Kim', avatar: '', bio: 'Gaming & Code', status: 'offline', isPrivate: true, profileSetupComplete: true, createdAt: '2024-02-01' },
  { id: '5', email: 'sam@example.com', username: 'sam_rivera', displayName: 'Sam Rivera', avatar: '', bio: 'Music producer 🎵', status: 'online', isPrivate: false, profileSetupComplete: true, createdAt: '2024-02-15' },
  { id: '6', email: 'nova@example.com', username: 'nova_blake', displayName: 'Nova Blake', avatar: '', bio: 'Exploring the cosmos 🚀', status: 'offline', isPrivate: false, profileSetupComplete: true, createdAt: '2024-03-01' },
];

export const mockMessages: Record<string, Message[]> = {
  'chat-1': [
    { id: 'm1', senderId: '2', content: 'Hey! How\'s the project going?', timestamp: '2024-03-01T10:00:00', type: 'text' },
    { id: 'm2', senderId: '1', content: 'Going great! Just finished the UI 🚀', timestamp: '2024-03-01T10:01:00', type: 'text' },
    { id: 'm3', senderId: '2', content: 'Awesome, can\'t wait to see it!', timestamp: '2024-03-01T10:02:00', type: 'text' },
  ],
  'chat-2': [
    { id: 'm4', senderId: '3', content: 'Check out this new design I made', timestamp: '2024-03-01T09:00:00', type: 'text' },
    { id: 'm5', senderId: '1', content: 'That looks incredible Maya!', timestamp: '2024-03-01T09:05:00', type: 'text' },
  ],
  'chat-group-1': [
    { id: 'm6', senderId: '2', content: 'Team meeting at 3pm?', timestamp: '2024-03-01T08:00:00', type: 'text' },
    { id: 'm7', senderId: '3', content: 'Works for me!', timestamp: '2024-03-01T08:01:00', type: 'text' },
    { id: 'm8', senderId: '5', content: 'I\'ll be there 👍', timestamp: '2024-03-01T08:02:00', type: 'text' },
  ],
};

export const mockChats: Chat[] = [
  { id: 'chat-1', type: 'private', participants: ['1', '2'], lastMessage: mockMessages['chat-1'][2], createdAt: '2024-02-01' },
  { id: 'chat-2', type: 'private', participants: ['1', '3'], lastMessage: mockMessages['chat-2'][1], createdAt: '2024-02-10' },
  { id: 'chat-group-1', type: 'group', name: 'Dev Squad', avatar: '', participants: ['1', '2', '3', '5'], lastMessage: mockMessages['chat-group-1'][2], createdAt: '2024-02-20' },
];

export const mockFriendRequests: (FriendRequest & { fromUser: User })[] = [
  { id: 'fr-1', fromUserId: '6', toUserId: '1', status: 'pending', createdAt: '2024-03-01', fromUser: mockUsers[5] },
];