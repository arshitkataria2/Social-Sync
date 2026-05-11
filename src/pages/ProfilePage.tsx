import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userService, postService, friendService } from '@/services/apiService';
import { Post } from '@/services/types';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Camera, Save, User as UserIcon, Settings, Lock, Globe, Image, Film, Plus, Heart, MessageCircle, Trash2, Upload, X, EyeOff, Check, Users, ZoomIn } from 'lucide-react';
import { toast } from 'sonner';
import PostDetailModal from '@/components/PostDetailModal';
import AvatarEditor from 'react-avatar-editor';

const ProfilePage = () => {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [avatar, setAvatar] = useState(user?.avatar || '');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(user?.isPrivate || false);
  const [hideFriendCount, setHideFriendCount] = useState(false);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendsCount, setFriendsCount] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [postTab, setPostTab] = useState<'images' | 'videos'>('images');
  const [showNewPost, setShowNewPost] = useState(false);
  const [newCaption, setNewCaption] = useState('');
  const [newMediaFile, setNewMediaFile] = useState<File | null>(null);
  const [newMediaPreview, setNewMediaPreview] = useState('');
  const [newMediaType, setNewMediaType] = useState<'image' | 'video'>('image');
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showPostDetail, setShowPostDetail] = useState(false);

  // Avatar crop
  const [showAvatarCrop, setShowAvatarCrop] = useState(false);
  const [avatarCropImage, setAvatarCropImage] = useState<string>('');
  const [avatarScale, setAvatarScale] = useState(1.2);
const avatarEditorRef = useRef<any>(null);
  // Post settings
  const [postHideLikes, setPostHideLikes] = useState(false);
  const [postCommentsDisabled, setPostCommentsDisabled] = useState(false);
  const [postCommentReview, setPostCommentReview] = useState(false);

  useEffect(() => {
    if (user) {
      loadPosts();
      friendService.getFriends(user.id).then(f => setFriendsCount(f.length));
    }
  }, [user]);

  const loadPosts = async () => {
    if (!user) return;
    try {
      const p = await postService.getUserPosts(user.id);
      setPosts(p);
    } catch { }
  };

  if (!user) return null;

  const handleSave = async () => {
    try {
      let avatarUrl = avatar;
      if (avatarFile) {
        try {
          const { url } = await postService.uploadFile(avatarFile);
          avatarUrl = url;
        } catch { }
      }
      const updated = await userService.updateProfile(user.id, { displayName, bio, avatar: avatarUrl, isPrivate });
      updateUser(updated);
      setShowSettings(false);
      toast.success('Profile updated!');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setAvatarCropImage(ev.target?.result as string);
        setShowAvatarCrop(true);
        setAvatarScale(1.2);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleAvatarCropSave = () => {
    if (avatarEditorRef.current) {
      const canvas = avatarEditorRef.current.getImageScaledToCanvas();
      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], 'avatar.png', { type: 'image/png' });
          setAvatarFile(file);
          setAvatar(canvas.toDataURL());
          setShowAvatarCrop(false);
        }
      });
    }
  };

  const handleNewMediaFromFiles = (files: FileList | null) => {
    const file = files?.[0];
    if (file) {
      setNewMediaFile(file);
      setNewMediaType(file.type.startsWith('video') ? 'video' : 'image');
      const reader = new FileReader();
      reader.onload = (ev) => setNewMediaPreview(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleNewMediaFromFiles(e.dataTransfer.files);
  };

  const handleCreatePost = async () => {
    if (!newMediaFile) { toast.error('Select an image or video'); return; }
    setUploading(true);
    try {
      const { url } = await postService.uploadFile(newMediaFile);
      await postService.createPost(newCaption, newMediaType, url, {
        hideLikes: postHideLikes,
        commentsDisabled: postCommentsDisabled,
        commentReview: postCommentReview,
      });
      toast.success('Post created!');
      setShowNewPost(false);
      setNewCaption('');
      setNewMediaFile(null);
      setNewMediaPreview('');
      setPostHideLikes(false);
      setPostCommentsDisabled(false);
      setPostCommentReview(false);
      loadPosts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    await postService.deletePost(postId);
    setPosts(prev => prev.filter(p => p.id !== postId));
    toast.success('Post deleted');
  };

  const handlePostClick = (post: Post) => {
    setSelectedPost({ ...post, user: { displayName: user.displayName, username: user.username, avatar: user.avatar } });
    setShowPostDetail(true);
  };

  const handlePostUpdate = (updated: Post) => {
    setPosts(prev => prev.map(p => p.id === updated.id ? updated : p));
    setSelectedPost(updated);
  };

  const imagePosts = posts.filter(p => p.type === 'image');
  const videoPosts = posts.filter(p => p.type === 'video');
  const displayedPosts = postTab === 'images' ? imagePosts : videoPosts;

  return (
    <div className="max-w-3xl mx-auto p-8 animate-slide-up">
      {/* Profile Header */}
      <div className="glass rounded-2xl p-8 shadow-[var(--shadow-card)] mb-6">
        <div className="flex items-start gap-6">
          <div className="relative group">
            <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/30 glow">
              {avatar ? <img src={avatar} alt="Avatar" className="w-full h-full object-cover" /> : <UserIcon className="w-10 h-10 text-muted-foreground" />}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="text-2xl font-display font-bold text-foreground">{user.displayName}</h1>
              {user.isPrivate ? <Lock className="w-4 h-4 text-warning" /> : <Globe className="w-4 h-4 text-primary" />}
            </div>
            <p className="text-sm text-muted-foreground mb-2">@{user.username}</p>
            {user.bio && <p className="text-sm text-foreground/80 mb-3">{user.bio}</p>}
            <div className="flex gap-6 text-sm">
              <div><span className="font-bold text-foreground">{posts.length}</span> <span className="text-muted-foreground">Posts</span></div>
              {!hideFriendCount && (
                <div><span className="font-bold text-foreground">{friendsCount}</span> <span className="text-muted-foreground">Friends</span></div>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Dialog open={showNewPost} onOpenChange={setShowNewPost}>
              <DialogTrigger asChild>
                <Button size="sm" className="gradient-primary text-primary-foreground">
                  <Plus className="w-4 h-4 mr-1" /> New Post
                </Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border max-w-lg">
                <DialogHeader><DialogTitle className="font-display">Create Post</DialogTitle></DialogHeader>
                <div className="space-y-4">
                  {!newMediaPreview ? (
                    <div
                      className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                        dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
                      }`}
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={e => handleNewMediaFromFiles(e.target.files)} />
                      <div className="flex flex-col items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
                          <Upload className="w-7 h-7 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-foreground">Drag & drop your photo or video</p>
                          <p className="text-xs text-muted-foreground mt-1">or click to browse files</p>
                        </div>
                        <div className="flex gap-2 mt-1">
                          <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">JPG</span>
                          <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">PNG</span>
                          <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">MP4</span>
                          <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">MOV</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative rounded-2xl overflow-hidden bg-muted">
                      {newMediaType === 'video' ? (
                        <video src={newMediaPreview} controls className="w-full max-h-64 object-contain" />
                      ) : (
                        <img src={newMediaPreview} className="w-full max-h-64 object-contain" />
                      )}
                      <button onClick={() => { setNewMediaFile(null); setNewMediaPreview(''); }} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center hover:bg-background transition-colors">
                        <X className="w-4 h-4 text-foreground" />
                      </button>
                    </div>
                  )}

                  <Textarea placeholder="Write a caption..." value={newCaption} onChange={e => setNewCaption(e.target.value)} className="bg-muted border-border/50" />

                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Post Settings</p>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-2">
                        <EyeOff className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs">Hide like count</span>
                      </div>
                      <Switch checked={postHideLikes} onCheckedChange={setPostHideLikes} />
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-2">
                        <MessageCircle className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs">Disable comments</span>
                      </div>
                      <Switch checked={postCommentsDisabled} onCheckedChange={setPostCommentsDisabled} />
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/50">
                      <div className="flex items-center gap-2">
                        <Check className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-xs">Review comments first</span>
                      </div>
                      <Switch checked={postCommentReview} onCheckedChange={setPostCommentReview} />
                    </div>
                  </div>

                  <Button onClick={handleCreatePost} disabled={uploading} className="w-full gradient-primary text-primary-foreground">
                    {uploading ? 'Uploading...' : 'Post'}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Button size="sm" variant="outline" onClick={() => setShowSettings(true)}>
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="font-display">Edit Profile</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <div className="relative group">
                <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/30">
                  {avatar ? <img src={avatar} className="w-full h-full object-cover" /> : <UserIcon className="w-8 h-8 text-muted-foreground" />}
                </div>
                <label className="absolute inset-0 rounded-full flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                  <Camera className="w-5 h-5 text-primary" />
                  <input type="file" accept="image/*" className="hidden" onChange={handleAvatarSelect} />
                </label>
              </div>
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Display Name</label>
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="bg-muted border-border/50" />
            </div>
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Bio</label>
              <Textarea value={bio} onChange={e => setBio(e.target.value)} className="bg-muted border-border/50 min-h-[80px]" maxLength={300} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <div className="flex items-center gap-2">
                {isPrivate ? <Lock className="w-4 h-4 text-warning" /> : <Globe className="w-4 h-4 text-primary" />}
                <span className="text-sm">{isPrivate ? 'Private' : 'Public'} Profile</span>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm">Hide friend count</span>
              </div>
              <Switch checked={hideFriendCount} onCheckedChange={setHideFriendCount} />
            </div>
            <Button onClick={handleSave} className="w-full gradient-primary text-primary-foreground">
              <Save className="w-4 h-4 mr-2" /> Save Changes
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Avatar Crop Dialog */}
      <Dialog open={showAvatarCrop} onOpenChange={setShowAvatarCrop}>
        <DialogContent className="bg-card border-border max-w-sm">
          <DialogHeader><DialogTitle className="font-display">Crop Profile Picture</DialogTitle></DialogHeader>
          <div className="flex flex-col items-center gap-4">
            <div className="rounded-xl overflow-hidden border border-border">
              <AvatarEditor
                ref={avatarEditorRef}
                image={avatarCropImage}
                width={200}
                height={200}
                border={30}
                borderRadius={100}
                scale={avatarScale}
                rotate={0}
                color={[0, 0, 0, 0.6]}
              />
            </div>
            <div className="w-full flex items-center gap-3 px-2">
              <ZoomIn className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <Slider
                value={[avatarScale]}
                onValueChange={(v) => setAvatarScale(v[0])}
                min={1}
                max={3}
                step={0.1}
                className="flex-1"
              />
            </div>
            <Button onClick={handleAvatarCropSave} className="w-full gradient-primary text-primary-foreground">
              Apply
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Tabs */}
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

      {/* Posts Grid */}
      {displayedPosts.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Image className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>No {postTab} yet. Create your first post!</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          {displayedPosts.map(post => (
            <div
              key={post.id}
              className="relative group aspect-square rounded-lg overflow-hidden bg-muted cursor-pointer"
              onClick={() => handlePostClick(post)}
            >
              {post.type === 'video' ? (
                <video src={post.mediaUrl} className="w-full h-full object-cover" />
              ) : (
                <img src={post.mediaUrl} className="w-full h-full object-cover" />
              )}
              <div className="absolute inset-0 bg-background/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4">
                <div className="flex items-center gap-1 text-foreground text-sm">
                  <Heart className="w-4 h-4" /> {post.likesCount}
                </div>
                <div className="flex items-center gap-1 text-foreground text-sm">
                  <MessageCircle className="w-4 h-4" /> {post.commentsCount}
                </div>
                <button onClick={(e) => { e.stopPropagation(); handleDeletePost(post.id); }} className="text-destructive hover:text-destructive/80">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              {post.caption && (
                <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-background/80 to-transparent">
                  <p className="text-xs text-foreground truncate">{post.caption}</p>
                </div>
              )}
            </div>
          ))}
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

export default ProfilePage;