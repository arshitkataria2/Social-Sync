import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { friendService, postService } from '@/services/apiService';
import { Post } from '@/services/types';
import { useNavigate } from 'react-router-dom';
import { Users, MessageCircle, ArrowRight, User as UserIcon, Heart, MessageCircle as CommentIcon, Image } from 'lucide-react';
import PostDetailModal from '@/components/PostDetailModal';
import { getSocket } from '@/services/socket';

const HomePage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [friends, setFriends] = useState<any[]>([]);
  const [feed, setFeed] = useState<Post[]>([]);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showPostDetail, setShowPostDetail] = useState(false);
  const [hasFriends, setHasFriends] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const f = await friendService.getFriends(user.id);
      setFriends(f);
      setHasFriends(f.length > 0);
      postService.getFeed().then(setFeed).catch(() => {});
      setLoaded(true);
    };
    load();
  }, [user]);

  // Listen for real-time new post notifications
  useEffect(() => {
    const socket = getSocket();
    const handleNewPost = (post: Post) => {
      setFeed(prev => [post, ...prev]);
    };
    socket.on('new_post', handleNewPost);
    return () => { socket.off('new_post', handleNewPost); };
  }, []);

  if (!user || !loaded) return null;

  const isFirstTime = !user.profileSetupComplete;

  const handleLike = async (postId: string) => {
    try {
      const result = await postService.likePost(postId);
      setFeed(prev => prev.map(p => p.id === postId ? { ...p, isLiked: result.liked, likesCount: result.liked ? p.likesCount + 1 : p.likesCount - 1 } : p));
    } catch { }
  };

  const handlePostUpdate = (updated: Post) => {
    setFeed(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedPost(updated);
  };

  // First time user with no friends
  if (isFirstTime || (!hasFriends && feed.length === 0)) {
    return (
      <div className="p-8 max-w-4xl mx-auto">
        <div className="mb-8 animate-slide-up">
          <h1 className="text-3xl font-display font-bold mb-2">
            Welcome, <span className="text-primary glow-text">{user.displayName}</span>
          </h1>
          <p className="text-muted-foreground">Get started by connecting with people</p>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <button onClick={() => navigate('/friends')} className="glass rounded-2xl p-8 text-left hover:border-primary/50 transition-all group shadow-[var(--shadow-card)]">
            <Users className="w-8 h-8 text-primary mb-4" />
            <p className="font-display font-semibold text-foreground mb-1">Find Friends</p>
            <p className="text-sm text-muted-foreground">Search and connect with people</p>
            <ArrowRight className="w-4 h-4 text-muted-foreground mt-4 group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </button>
          <button onClick={() => navigate('/chat')} className="glass rounded-2xl p-8 text-left hover:border-primary/50 transition-all group shadow-[var(--shadow-card)]">
            <MessageCircle className="w-8 h-8 text-accent mb-4" />
            <p className="font-display font-semibold text-foreground mb-1">Start Messaging</p>
            <p className="text-sm text-muted-foreground">Send messages to friends</p>
            <ArrowRight className="w-4 h-4 text-muted-foreground mt-4 group-hover:text-accent group-hover:translate-x-1 transition-all" />
          </button>
        </div>

        <div className="text-center py-12 text-muted-foreground animate-slide-up" style={{ animationDelay: '0.2s' }}>
          <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No posts available yet. Add friends and encourage them to post!</p>
        </div>
      </div>
    );
  }

  // Returning user
  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6 animate-slide-up">
        <h1 className="text-3xl font-display font-bold mb-1">
          Welcome back, <span className="text-primary glow-text">{user.displayName}</span>
        </h1>
      </div>

      {/* Feed */}
      {feed.length > 0 ? (
        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <div className="space-y-4">
            {feed.map(post => (
              <div key={post.id} className="glass rounded-2xl overflow-hidden shadow-[var(--shadow-card)]">
                <div className="flex items-center gap-3 p-4">
                  <div
                    className="w-9 h-9 rounded-full bg-muted flex items-center justify-center overflow-hidden cursor-pointer"
                    onClick={() => navigate(`/user/${post.userId}`)}
                  >
                    {post.user?.avatar ? <img src={post.user.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-4 h-4 text-muted-foreground" />}
                  </div>
                  <div className="cursor-pointer" onClick={() => navigate(`/user/${post.userId}`)}>
                    <p className="text-sm font-medium text-foreground">{post.user?.displayName}</p>
                    <p className="text-xs text-muted-foreground">@{post.user?.username}</p>
                  </div>
                </div>
                <div className="bg-muted">
                  {post.type === 'video' ? (
                    <video src={post.mediaUrl} controls className="w-full max-h-[500px] object-contain" />
                  ) : (
                    <img src={post.mediaUrl} className="w-full max-h-[500px] object-contain" />
                  )}
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-4 mb-2">
                    <button onClick={() => handleLike(post.id)} className={`flex items-center gap-1 text-sm transition-colors ${post.isLiked ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}>
                      <Heart className={`w-5 h-5 ${post.isLiked ? 'fill-current' : ''}`} />
                      {!post.hideLikes && post.likesCount}
                    </button>
                    <button
                      onClick={() => { setSelectedPost(post); setShowPostDetail(true); }}
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
                      disabled={post.commentsDisabled}
                    >
                      <CommentIcon className="w-5 h-5" /> {post.commentsCount}
                    </button>
                  </div>
                  {post.caption && <p className="text-sm text-foreground"><span className="font-medium">{post.user?.username}</span> {post.caption}</p>}
                  <p className="text-xs text-muted-foreground mt-1">{new Date(post.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="mb-2">No posts in your feed yet.</p>
          <p className="text-sm">Your friends haven't posted anything. Send them a message and encourage them to share!</p>
        </div>
      )}

      <PostDetailModal
        post={selectedPost}
        open={showPostDetail}
        onOpenChange={setShowPostDetail}
        onPostUpdate={handlePostUpdate}
      />
    </div>
  );
};

export default HomePage;