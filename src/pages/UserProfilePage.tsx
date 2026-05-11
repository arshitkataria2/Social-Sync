import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { userService, postService, friendService } from '@/services/apiService';
import { User, Post } from '@/services/types';
import { Button } from '@/components/ui/button';
import { User as UserIcon, Lock, Globe, Image, Film, Heart, MessageCircle, UserPlus, Clock, Users } from 'lucide-react';
import { toast } from 'sonner';

const UserProfilePage = () => {
  const { userId } = useParams<{ userId: string }>();
  const { user: currentUser } = useAuth();
  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [canViewPosts, setCanViewPosts] = useState(false);
  const [postTab, setPostTab] = useState<'images' | 'videos'>('images');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (userId) loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const u = await userService.getUser(userId);
      setProfile(u);
      // Can view posts if: own profile, public profile, or is friend
      const canView = !u?.isPrivate || u.isFriend || u.id === currentUser?.id;
      setCanViewPosts(canView);
      if (canView) {
        try {
          const p = await postService.getUserPosts(userId);
          setPosts(p);
        } catch { setPosts([]); }
      }
    } catch { }
    setLoading(false);
  };

  const handleSendRequest = async () => {
    if (!currentUser || !profile) return;
    try {
      await friendService.sendRequest(currentUser.id, profile.id);
      toast.success('Friend request sent!');
      loadProfile();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!profile) return <div className="p-8 text-center text-muted-foreground">User not found</div>;

  const imagePosts = posts.filter(p => p.type === 'image');
  const videoPosts = posts.filter(p => p.type === 'video');
  const displayedPosts = postTab === 'images' ? imagePosts : videoPosts;

  return (
    <div className="max-w-3xl mx-auto p-8 animate-slide-up">
      {/* Profile Header */}
      <div className="glass rounded-2xl p-8 shadow-[var(--shadow-card)] mb-6">
        <div className="flex items-start gap-6">
          <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/30">
            {profile.avatar ? <img src={profile.avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-10 h-10 text-muted-foreground" />}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-display font-bold text-foreground">{profile.displayName}</h1>
              {profile.isPrivate ? <Lock className="w-4 h-4 text-warning" /> : <Globe className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-sm text-muted-foreground mb-2">@{profile.username}</p>
            {profile.bio && <p className="text-sm text-foreground/80 mb-3">{profile.bio}</p>}
            <div className="flex gap-6 text-sm">
              <div><span className="font-bold text-foreground">{profile.friendsCount || 0}</span> <span className="text-muted-foreground">Friends</span></div>
              {canViewPosts && <div><span className="font-bold text-foreground">{profile.postsCount || 0}</span> <span className="text-muted-foreground">Posts</span></div>}
            </div>
          </div>
          <div>
            {currentUser?.id !== profile.id && (
              profile.isFriend ? (
                <Button size="sm" variant="outline" disabled><Users className="w-4 h-4 mr-1" /> Friends</Button>
              ) : profile.sentRequestId ? (
                <Button size="sm" variant="outline" disabled><Clock className="w-4 h-4 mr-1" /> Requested</Button>
              ) : (
                <Button size="sm" className="gradient-primary text-primary-foreground" onClick={handleSendRequest}>
                  <UserPlus className="w-4 h-4 mr-1" /> Add Friend
                </Button>
              )
            )}
          </div>
        </div>
      </div>

      {/* Posts Section */}
      {canViewPosts ? (
        <>
          <div className="flex gap-1 mb-4 rounded-lg bg-muted p-1">
            <button
              onClick={() => setPostTab('images')}
              className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${postTab === 'images' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Image className="w-4 h-4" /> Photos ({imagePosts.length})
            </button>
            <button
              onClick={() => setPostTab('videos')}
              className={`flex-1 py-2 text-sm font-medium rounded-md flex items-center justify-center gap-2 transition-all ${postTab === 'videos' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
            >
              <Film className="w-4 h-4" /> Videos ({videoPosts.length})
            </button>
          </div>

          {displayedPosts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>No {postTab} yet</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {displayedPosts.map(post => (
                <div key={post.id} className="relative group aspect-square rounded-lg overflow-hidden bg-muted">
                  {post.type === 'video' ? (
                    <video src={post.mediaUrl} className="w-full h-full object-cover" />
                  ) : (
                    <img src={post.mediaUrl} className="w-full h-full object-cover" />
                  )}
                  <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                    <div className="flex items-center gap-1 text-foreground text-sm"><Heart className="w-4 h-4" /> {post.likesCount}</div>
                    <div className="flex items-center gap-1 text-foreground text-sm"><MessageCircle className="w-4 h-4" /> {post.commentsCount}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="glass rounded-2xl p-12 text-center">
          <Lock className="w-12 h-12 mx-auto mb-4 text-warning/50" />
          <h2 className="text-lg font-display font-semibold mb-2 text-foreground">This Account is Private</h2>
          <p className="text-muted-foreground text-sm">Follow this user to see their posts</p>
        </div>
      )}
    </div>
  );
};

export default UserProfilePage;