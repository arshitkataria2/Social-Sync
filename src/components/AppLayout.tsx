import React from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate, useLocation } from 'react-router-dom';
import { Zap, Home, Users, MessageCircle, User, LogOut } from 'lucide-react';
import { friendService } from '@/services/apiService';
import { useState, useEffect } from 'react';
import { getSocket } from '@/services/socket';

const navItems = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/friends', icon: Users, label: 'Friends' },
  { path: '/chat', icon: MessageCircle, label: 'Chat' },
  { path: '/profile', icon: User, label: 'Profile' },
];

const AppLayout = ({ children }: { children: React.ReactNode }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [pendingCount, setPendingCount] = useState(0);
  const [hasNewPost, setHasNewPost] = useState(false);
  const [hasNewMessage, setHasNewMessage] = useState(false);

  useEffect(() => {
    if (user) {
      friendService.getPendingRequests(user.id).then(r => setPendingCount(r.length));
    }
  }, [user, location]);

  // Real-time notification badges
  useEffect(() => {
    const socket = getSocket();

    const handleFriendRequest = () => {
      setPendingCount(prev => prev + 1);
    };

    const handleNewPost = () => {
      if (location.pathname !== '/') {
        setHasNewPost(true);
      }
    };

    const handleNewMessage = () => {
      if (location.pathname !== '/chat') {
        setHasNewMessage(true);
      }
    };

    socket.on('friend_request', handleFriendRequest);
    socket.on('new_post', handleNewPost);
    socket.on('new_message', handleNewMessage);

    return () => {
      socket.off('friend_request', handleFriendRequest);
      socket.off('new_post', handleNewPost);
      socket.off('new_message', handleNewMessage);
    };
  }, [location.pathname]);

  // Clear badges on navigation
  useEffect(() => {
    if (location.pathname === '/') setHasNewPost(false);
    if (location.pathname === '/chat') setHasNewMessage(false);
    if (location.pathname === '/friends') setPendingCount(0);
  }, [location.pathname]);

  const getBadge = (label: string) => {
    if (label === 'Friends' && pendingCount > 0) return pendingCount;
    if (label === 'Home' && hasNewPost) return '•';
    if (label === 'Chat' && hasNewMessage) return '•';
    return null;
  };

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="w-[72px] bg-card border-r border-border flex flex-col items-center py-4 gap-2 fixed h-full z-50">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center mb-4 glow cursor-pointer" onClick={() => navigate('/')}>
          <Zap className="w-5 h-5 text-primary-foreground" />
        </div>

        <div className="flex-1 flex flex-col gap-1">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname === path;
            const badge = getBadge(label);
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`relative w-12 h-12 rounded-xl flex items-center justify-center transition-all group ${
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                }`}
                title={label}
              >
                {active && <div className="absolute left-0 w-1 h-5 rounded-r bg-primary" />}
                <Icon className="w-5 h-5" />
                {badge !== null && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold px-1">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => { logout(); navigate('/auth'); }}
          className="w-12 h-12 rounded-xl flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
          title="Logout"
        >
          <LogOut className="w-5 h-5" />
        </button>
      </aside>

      <main className="flex-1 ml-[72px]">
        {children}
      </main>
    </div>
  );
};

export default AppLayout;