import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { friendService, userService } from '@/services/apiService';
import { User, FriendRequest } from '@/services/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, UserPlus, Check, X, User as UserIcon, Clock, Lock, Globe, Users, UserMinus, ShieldBan, ShieldOff } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { getSocket } from '@/services/socket';

const FriendsPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<User[]>([]);
  const [requests, setRequests] = useState<(FriendRequest & { fromUser: User })[]>([]);
  const [sentRequests, setSentRequests] = useState<(FriendRequest & { toUser: User })[]>([]);
  const [blockedUsers, setBlockedUsers] = useState<User[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [tab, setTab] = useState<'friends' | 'requests' | 'sent' | 'search' | 'blocked'>('friends');
  const [searching, setSearching] = useState(false);

  const reload = async () => {
    if (!user) return;
    setFriends(await friendService.getFriends(user.id));
    setRequests(await friendService.getPendingRequests(user.id));
    setSentRequests(await friendService.getSentRequests(user.id));
    setBlockedUsers(await friendService.getBlockedUsers(user.id));
  };

  useEffect(() => { reload(); }, [user]);

  // Real-time: listen for friend request events and friend accepted events
  useEffect(() => {
    const socket = getSocket();

    const handleFriendRequest = () => {
      reload();
    };

    const handleFriendAccepted = () => {
      reload();
    };

    socket.on('friend_request', handleFriendRequest);
    socket.on('friend_accepted', handleFriendAccepted);

    return () => {
      socket.off('friend_request', handleFriendRequest);
      socket.off('friend_accepted', handleFriendAccepted);
    };
  }, [user]);

  useEffect(() => {
    if (tab !== 'search' || !searchQuery.trim() || !user) {
      if (!searchQuery.trim()) setSearchResults([]);
      return;
    }
    setSearching(true);
    const timer = setTimeout(async () => {
      try {
        const results = await userService.searchUsers(searchQuery);
        setSearchResults(results.filter(u => u.id !== user.id));
      } catch { }
      setSearching(false);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, tab, user]);

  const handleSendRequest = async (toId: string) => {
    if (!user) return;
    try {
      await friendService.sendRequest(user.id, toId);
      toast.success('Friend request sent!');
      if (searchQuery.trim()) {
        const results = await userService.searchUsers(searchQuery);
        setSearchResults(results.filter(u => u.id !== user.id));
      }
      reload();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleAccept = async (reqId: string) => {
    await friendService.acceptRequest(reqId);
    toast.success('Friend added!');
    reload();
  };

  const handleDecline = async (reqId: string) => {
    await friendService.declineRequest(reqId);
    toast.info('Request declined');
    reload();
  };

  const handleRemoveFriend = async (friendId: string) => {
    if (!user) return;
    await friendService.removeFriend(user.id, friendId);
    toast.info('Friend removed');
    reload();
  };

  const handleBlock = async (blockedId: string) => {
    if (!user) return;
    await friendService.blockUser(user.id, blockedId);
    toast.info('User blocked');
    reload();
  };

  const handleUnblock = async (blockedId: string) => {
    if (!user) return;
    await friendService.unblockUser(user.id, blockedId);
    toast.success('User unblocked');
    reload();
  };

  if (!user) return null;

  const tabs = ['friends', 'requests', 'sent', 'search', 'blocked'] as const;

  return (
    <div className="max-w-2xl mx-auto p-8 animate-slide-up">
      <h1 className="text-2xl font-display font-bold mb-6">Friends</h1>

      <div className="flex gap-1 mb-6 rounded-lg bg-muted p-1 overflow-x-auto">
        {tabs.map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-md capitalize transition-all whitespace-nowrap px-2 ${
              tab === t ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t}{t === 'requests' && requests.length > 0 ? ` (${requests.length})` : ''}{t === 'sent' && sentRequests.length > 0 ? ` (${sentRequests.length})` : ''}{t === 'blocked' && blockedUsers.length > 0 ? ` (${blockedUsers.length})` : ''}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <div className="space-y-3">
          {friends.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <UserIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No friends yet. Search for people to connect!</p>
            </div>
          )}
          {friends.map(f => (
            <div key={f.id} className="glass rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => navigate(`/user/${f.id}`)}>
                {f.avatar ? <img src={f.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 cursor-pointer" onClick={() => navigate(`/user/${f.id}`)}>
                <p className="font-medium text-foreground">{f.displayName}</p>
                <p className="text-xs text-muted-foreground">@{f.username}</p>
              </div>
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${f.status === 'online' ? 'bg-online' : f.status === 'away' ? 'bg-warning' : 'bg-muted-foreground'}`} />
                <Button size="sm" variant="ghost" onClick={() => handleRemoveFriend(f.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" title="Remove friend">
                  <UserMinus className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleBlock(f.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive" title="Block user">
                  <ShieldBan className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'requests' && (
        <div className="space-y-3">
          {requests.length === 0 && <div className="text-center py-12 text-muted-foreground">No pending requests</div>}
          {requests.map(r => (
            <div key={r.id} className="glass rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => navigate(`/user/${r.fromUser.id}`)}>
                {r.fromUser.avatar ? <img src={r.fromUser.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 cursor-pointer" onClick={() => navigate(`/user/${r.fromUser.id}`)}>
                <p className="font-medium text-foreground">{r.fromUser.displayName}</p>
                <p className="text-xs text-muted-foreground">@{r.fromUser.username} wants to be your friend</p>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => handleAccept(r.id)} className="gradient-primary text-primary-foreground h-8 w-8 p-0">
                  <Check className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="ghost" onClick={() => handleDecline(r.id)} className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive">
                  <X className="w-4 h-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'sent' && (
        <div className="space-y-3">
          {sentRequests.length === 0 && <div className="text-center py-12 text-muted-foreground">No sent requests</div>}
          {sentRequests.map(r => (
            <div key={r.id} className="glass rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => navigate(`/user/${r.toUser.id}`)}>
                {r.toUser.avatar ? <img src={r.toUser.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1 cursor-pointer" onClick={() => navigate(`/user/${r.toUser.id}`)}>
                <p className="font-medium text-foreground">{r.toUser.displayName}</p>
                <p className="text-xs text-muted-foreground">@{r.toUser.username}</p>
              </div>
              <div className="flex items-center gap-1 text-warning text-xs">
                <Clock className="w-3.5 h-3.5" /> Pending
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'blocked' && (
        <div className="space-y-3">
          {blockedUsers.length === 0 && <div className="text-center py-12 text-muted-foreground">No blocked users</div>}
          {blockedUsers.map(u => (
            <div key={u.id} className="glass rounded-xl p-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-muted-foreground" />}
              </div>
              <div className="flex-1">
                <p className="font-medium text-foreground">{u.displayName}</p>
                <p className="text-xs text-muted-foreground">@{u.username}</p>
              </div>
              <Button size="sm" variant="outline" onClick={() => handleUnblock(u.id)} className="h-8 px-3 text-xs">
                <ShieldOff className="w-3.5 h-3.5 mr-1" /> Unblock
              </Button>
            </div>
          ))}
        </div>
      )}

      {tab === 'search' && (
        <div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Search by username or name..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="bg-muted border-border/50 pl-10"
              autoFocus
            />
          </div>
          {searching && <p className="text-center text-sm text-muted-foreground py-4">Searching...</p>}
          <div className="space-y-3">
            {searchResults.map(u => (
              <div key={u.id} className="glass rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => navigate(`/user/${u.id}`)}>
                  {u.avatar ? <img src={u.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="flex-1 cursor-pointer" onClick={() => navigate(`/user/${u.id}`)}>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{u.displayName}</p>
                    {u.isPrivate ? <Lock className="w-3 h-3 text-warning" /> : <Globe className="w-3 h-3 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">@{u.username}</p>
                  {u.bio && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{u.bio}</p>}
                  <div className="flex gap-3 mt-1 text-xs text-muted-foreground">
                    <span>{u.friendsCount || 0} friends</span>
                    {!u.isPrivate && <span>{u.postsCount || 0} posts</span>}
                  </div>
                </div>
                {u.isFriend ? (
                  <Button size="sm" variant="outline" disabled className="h-8 px-3 text-xs"><Users className="w-3.5 h-3.5 mr-1" /> Friends</Button>
                ) : u.sentRequestId ? (
                  <Button size="sm" variant="outline" disabled className="h-8 px-3 text-xs"><Clock className="w-3.5 h-3.5 mr-1" /> Sent</Button>
                ) : u.receivedRequestId ? (
                  <Button size="sm" variant="outline" className="h-8 px-3 text-xs" onClick={() => { setTab('requests'); }}>
                    <Check className="w-3.5 h-3.5 mr-1" /> Respond
                  </Button>
                ) : (
                  <Button size="sm" onClick={() => handleSendRequest(u.id)} className="gradient-primary text-primary-foreground h-8 px-3 text-xs">
                    <UserPlus className="w-3.5 h-3.5 mr-1" /> Add
                  </Button>
                )}
              </div>
            ))}
            {!searching && searchQuery.trim() && searchResults.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">No users found</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FriendsPage;