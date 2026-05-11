import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { chatService, userService, friendService, postService } from '@/services/apiService';
import { getSocket } from '@/services/socket';
import { Chat, Message, User } from '@/services/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { MessageCircle, Send, Users, User as UserIcon, Smile, CheckCheck, Check as CheckIcon, Plus, Image as ImageIcon, X } from 'lucide-react';
import { toast } from 'sonner';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

const ChatPage = () => {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMsg, setNewMsg] = useState('');
  const [chatUsers, setChatUsers] = useState<Record<string, User>>({});
  const [friends, setFriends] = useState<User[]>([]);
  const [showNewGroup, setShowNewGroup] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<string[]>([]);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState('');
  const mediaInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const activeChatRef = useRef<Chat | null>(null);

  useEffect(() => { activeChatRef.current = activeChat; }, [activeChat]);

  const loadChats = useCallback(async () => {
    if (!user) return;
    const c = await chatService.getChats(user.id);
    setChats(c);
    setFriends(await friendService.getFriends(user.id));

    const allParticipantIds = new Set<string>();
    c.forEach(chat => chat.participants.forEach(pid => allParticipantIds.add(pid)));
    
    for (const pid of allParticipantIds) {
      if (pid !== user.id && !chatUsers[pid]) {
        userService.getUser(pid).then(u => {
          if (u) setChatUsers(prev => ({ ...prev, [pid]: u }));
        });
      }
    }
  }, [user]);

  useEffect(() => { loadChats(); }, [loadChats]);

  useEffect(() => {
    const socket = getSocket();
    const handleNewMessage = ({ chatId, message }: { chatId: string; message: Message }) => {
      if (activeChatRef.current?.id === chatId) {
        setMessages(prev => [...prev, message]);
        chatService.markMessagesRead(chatId).catch(() => {});
      }
      setChats(prev => prev.map(c => c.id === chatId ? { ...c, lastMessage: message } : c));
    };

    const handleMessageRead = ({ chatId, userId: readerId }: { chatId: string; userId: string }) => {
      if (activeChatRef.current?.id === chatId) {
        setMessages(prev => prev.map(m => ({
          ...m,
          readBy: m.readBy ? (m.readBy.includes(readerId) ? m.readBy : [...m.readBy, readerId]) : [readerId],
        })));
      }
    };

    socket.on('new_message', handleNewMessage);
    socket.on('messages_read', handleMessageRead);
    return () => {
      socket.off('new_message', handleNewMessage);
      socket.off('messages_read', handleMessageRead);
    };
  }, []);

  useEffect(() => {
    if (!activeChat) return;
    chatService.getMessages(activeChat.id).then(setMessages);
    chatService.markMessagesRead(activeChat.id).catch(() => {});
    const socket = getSocket();
    socket.emit('join_chat', activeChat.id);
    activeChat.participants.forEach(async (pid) => {
      if (!chatUsers[pid]) {
        const u = await userService.getUser(pid);
        if (u) setChatUsers(prev => ({ ...prev, [pid]: u }));
      }
    });
  }, [activeChat]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!activeChat || !user) return;

    // Handle media upload
    if (mediaFile) {
      try {
        const { url } = await postService.uploadFile(mediaFile);
        const mediaType = mediaFile.type.startsWith('video') ? 'video' : 'image';
        const msg = await chatService.sendMessage(activeChat.id, user.id, `[${mediaType}]${url}`);
        setMessages(prev => [...prev, msg]);
        setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: msg } : c));
        setMediaFile(null);
        setMediaPreview('');
      } catch {
        toast.error('Failed to send media');
      }
      return;
    }

    if (!newMsg.trim()) return;
    const msg = await chatService.sendMessage(activeChat.id, user.id, newMsg);
    setNewMsg('');
    setMessages(prev => [...prev, msg]);
    setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: msg } : c));
    setShowEmojiPicker(false);
  };

  const startPrivateChat = async (friendId: string) => {
    if (!user) return;
    const chat = await chatService.createPrivateChat(user.id, friendId);
    setShowNewChat(false);
    await loadChats();
    setActiveChat(chat);
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedMembers.length === 0 || !user) return;
    const chat = await chatService.createGroupChat(groupName, '', [user.id, ...selectedMembers]);
    setShowNewGroup(false);
    setGroupName('');
    setSelectedMembers([]);
    await loadChats();
    setActiveChat(chat);
    toast.success('Group created!');
  };

  const handleMediaSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setMediaFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setMediaPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const getChatName = (chat: Chat) => {
    if (chat.type === 'group') return chat.name || 'Group';
    const otherId = chat.participants.find(p => p !== user?.id);
    return chatUsers[otherId || '']?.displayName || chatUsers[otherId || '']?.username || 'Loading...';
  };

  const getChatUsername = (chat: Chat) => {
    if (chat.type === 'group') return `${chat.participants.length} members`;
    const otherId = chat.participants.find(p => p !== user?.id);
    return chatUsers[otherId || '']?.username ? `@${chatUsers[otherId || '']?.username}` : '';
  };

  const getChatAvatar = (chat: Chat) => {
    if (chat.type === 'group') return chat.avatar;
    const otherId = chat.participants.find(p => p !== user?.id);
    return chatUsers[otherId || '']?.avatar || '';
  };

  const getOtherUser = (chat: Chat): User | undefined => {
    if (chat.type !== 'private') return undefined;
    const otherId = chat.participants.find(p => p !== user?.id);
    return chatUsers[otherId || ''];
  };

  const formatLastSeen = (lastSeen?: string) => {
    if (!lastSeen) return 'offline';
    const d = new Date(lastSeen);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return d.toLocaleDateString();
  };

  const onEmojiSelect = (emoji: any) => {
    setNewMsg(prev => prev + emoji.native);
  };

  const renderMessageContent = (content: string) => {
    const imageMatch = content.match(/^\[image\](.+)$/);
    const videoMatch = content.match(/^\[video\](.+)$/);
    if (imageMatch) {
      return <img src={imageMatch[1]} className="max-w-full max-h-60 rounded-lg" alt="" />;
    }
    if (videoMatch) {
      return <video src={videoMatch[1]} controls className="max-w-full max-h-60 rounded-lg" />;
    }
    return <p className="text-sm whitespace-pre-wrap">{content}</p>;
  };

  if (!user) return null;

  return (
    <div className="flex h-screen">
      {/* Chat list */}
      <div className="w-80 border-r border-border bg-card flex flex-col">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-display font-bold">Messages</h2>
            <div className="flex gap-1">
              <Dialog open={showNewChat} onOpenChange={setShowNewChat}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                    <Plus className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader><DialogTitle className="font-display">New Chat</DialogTitle></DialogHeader>
                  <div className="space-y-2 max-h-60 overflow-y-auto">
                    {friends.map(f => (
                      <button key={f.id} onClick={() => startPrivateChat(f.id)} className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-muted transition-colors">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                          {f.avatar ? <img src={f.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-muted-foreground" />}
                        </div>
                        <div className="text-left">
                          <span className="text-sm text-foreground block">{f.displayName}</span>
                          <span className="text-xs text-muted-foreground">@{f.username}</span>
                        </div>
                      </button>
                    ))}
                    {friends.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Add friends first!</p>}
                  </div>
                </DialogContent>
              </Dialog>

              <Dialog open={showNewGroup} onOpenChange={setShowNewGroup}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-muted-foreground hover:text-primary">
                    <Users className="w-4 h-4" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-card border-border">
                  <DialogHeader><DialogTitle className="font-display">New Group</DialogTitle></DialogHeader>
                  <Input placeholder="Group name" value={groupName} onChange={e => setGroupName(e.target.value)} className="bg-muted border-border/50" />
                  <p className="text-sm text-muted-foreground">Select members:</p>
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {friends.map(f => (
                      <label key={f.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted cursor-pointer">
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(f.id)}
                          onChange={e => {
                            if (e.target.checked) setSelectedMembers(prev => [...prev, f.id]);
                            else setSelectedMembers(prev => prev.filter(id => id !== f.id));
                          }}
                          className="accent-primary"
                        />
                        <span className="text-sm text-foreground">{f.displayName}</span>
                      </label>
                    ))}
                  </div>
                  <Button onClick={createGroup} className="w-full gradient-primary text-primary-foreground">Create Group</Button>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {chats.map(chat => {
            const otherUser = getOtherUser(chat);
            const isOnline = otherUser?.status === 'online';
            return (
              <button
                key={chat.id}
                onClick={() => setActiveChat(chat)}
                className={`w-full flex items-center gap-3 p-4 border-b border-border/30 transition-all hover:bg-muted/50 ${
                  activeChat?.id === chat.id ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                }`}
              >
                <div className="relative flex-shrink-0">
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {getChatAvatar(chat) ? (
                      <img src={getChatAvatar(chat)} className="w-full h-full object-cover" />
                    ) : chat.type === 'group' ? (
                      <Users className="w-5 h-5 text-primary" />
                    ) : (
                      <UserIcon className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                  {chat.type === 'private' && isOnline && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-online border-2 border-card" />
                  )}
                </div>
                <div className="flex-1 text-left min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="font-medium text-sm text-foreground truncate">{getChatName(chat)}</p>
                    {chat.lastMessage && (
                      <span className="text-[10px] text-muted-foreground flex-shrink-0 ml-2">
                        {new Date(chat.lastMessage.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{getChatUsername(chat)}</p>
                  {chat.lastMessage && (
                    <p className="text-xs text-muted-foreground truncate mt-0.5">
                      {chat.lastMessage.content.startsWith('[image]') ? '📷 Photo' :
                       chat.lastMessage.content.startsWith('[video]') ? '🎥 Video' :
                       chat.lastMessage.content}
                    </p>
                  )}
                </div>
              </button>
            );
          })}
          {chats.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-sm">
              <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No conversations yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 flex flex-col">
        {activeChat ? (
          <>
            <div className="p-4 border-b border-border glass">
              <div className="flex items-center gap-3">
                <div className="relative">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {getChatAvatar(activeChat) ? (
                      <img src={getChatAvatar(activeChat)} className="w-full h-full object-cover" />
                    ) : activeChat.type === 'group' ? (
                      <Users className="w-4 h-4 text-primary" />
                    ) : (
                      <UserIcon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  {activeChat.type === 'private' && getOtherUser(activeChat)?.status === 'online' && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-online border-2 border-card" />
                  )}
                </div>
                <div>
                  <p className="font-medium text-foreground">{getChatName(activeChat)}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeChat.type === 'group'
                      ? `${activeChat.participants.length} members`
                      : getOtherUser(activeChat)?.status === 'online'
                        ? 'Online'
                        : `Last seen ${formatLastSeen(getOtherUser(activeChat)?.lastSeen)}`
                    }
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.map(msg => {
                const isMe = msg.senderId === user.id;
                const sender = chatUsers[msg.senderId];
                const isRead = msg.readBy && msg.readBy.length > 0;
                return (
                  <div key={msg.id} className={`flex gap-2 ${isMe ? 'justify-end' : 'justify-start'} animate-fade-in`}>
                    {!isMe && (
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1 overflow-hidden">
                        {sender?.avatar ? <img src={sender.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                    )}
                    <div className={`max-w-[70%] ${isMe ? 'gradient-primary text-primary-foreground' : 'bg-secondary text-secondary-foreground'} rounded-2xl px-4 py-2.5`}>
                      {!isMe && activeChat.type === 'group' && (
                        <p className="text-xs font-medium opacity-70 mb-0.5">{sender?.displayName || 'Unknown'}</p>
                      )}
                      {renderMessageContent(msg.content)}
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <p className="text-[10px] opacity-50">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                        {isMe && (
                          isRead
                            ? <CheckCheck className="w-3.5 h-3.5 opacity-80 text-blue-300" />
                            : <CheckIcon className="w-3 h-3 opacity-50" />
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Media preview */}
            {mediaPreview && (
              <div className="px-4 py-2 border-t border-border bg-muted/50">
                <div className="relative inline-block">
                  {mediaFile?.type.startsWith('video') ? (
                    <video src={mediaPreview} className="h-20 rounded-lg" />
                  ) : (
                    <img src={mediaPreview} className="h-20 rounded-lg" />
                  )}
                  <button
                    onClick={() => { setMediaFile(null); setMediaPreview(''); }}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )}

            <div className="p-4 border-t border-border glass">
              <div className="flex gap-2 items-end">
                <input
                  ref={mediaInputRef}
                  type="file"
                  accept="image/*,video/*,.gif"
                  className="hidden"
                  onChange={handleMediaSelect}
                />
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-10 w-10 p-0 text-muted-foreground hover:text-primary flex-shrink-0"
                  onClick={() => mediaInputRef.current?.click()}
                >
                  <ImageIcon className="w-5 h-5" />
                </Button>
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-10 w-10 p-0 text-muted-foreground hover:text-primary flex-shrink-0">
                      <Smile className="w-5 h-5" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-0" side="top" align="start">
                    <Picker data={data} onEmojiSelect={onEmojiSelect} theme="dark" previewPosition="none" skinTonePosition="none" />
                  </PopoverContent>
                </Popover>
                <Input
                  value={newMsg}
                  onChange={e => setNewMsg(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                  placeholder={mediaFile ? 'Send media...' : 'Type a message...'}
                  className="bg-muted border-border/50 flex-1"
                />
                <Button onClick={handleSend} className="gradient-primary text-primary-foreground glow px-4 flex-shrink-0">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 mx-auto mb-4 text-muted-foreground/20" />
              <p className="text-muted-foreground">Select a chat or start a new conversation</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;