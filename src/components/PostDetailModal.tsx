import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { postService } from '@/services/apiService';
import { Post, PostComment } from '@/services/types';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Heart, MessageCircle, Send, Trash2, User, Settings, Check, X, ShieldBan, Eye, EyeOff, Smile } from 'lucide-react';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getSocket } from '@/services/socket';
import data from '@emoji-mart/data';
import Picker from '@emoji-mart/react';

interface PostDetailModalProps {
  post: Post | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPostUpdate?: (post: Post) => void;
}

const PostDetailModal: React.FC<PostDetailModalProps> = ({ post, open, onOpenChange, onPostUpdate }) => {
  const { user } = useAuth();
  const [comments, setComments] = useState<PostComment[]>([]);
  const [pendingComments, setPendingComments] = useState<PostComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [hideLikes, setHideLikes] = useState(false);
  const [commentsDisabled, setCommentsDisabled] = useState(false);
  const [commentReview, setCommentReview] = useState(false);
  const [localPost, setLocalPost] = useState<Post | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const isOwner = user?.id === post?.userId;

  useEffect(() => {
    if (post && open) {
      setLocalPost(post);
      setHideLikes(post.hideLikes);
      setCommentsDisabled(post.commentsDisabled);
      setCommentReview(post.commentReview);
      loadComments();
      if (isOwner && post.commentReview) {
        loadPendingComments();
      }
    }
  }, [post, open]);

  // Real-time comment notifications
  useEffect(() => {
    if (!post || !open) return;
    const socket = getSocket();
    const handleNewComment = ({ postId, comment }: { postId: string; comment: PostComment }) => {
      if (postId === post.id) {
        if (comment.approved) {
          setComments(prev => {
            if (prev.find(c => c.id === comment.id)) return prev;
            return [...prev, comment];
          });
        } else if (isOwner) {
          setPendingComments(prev => {
            if (prev.find(c => c.id === comment.id)) return prev;
            return [...prev, comment];
          });
        }
        if (localPost) {
          const updated = { ...localPost, commentsCount: localPost.commentsCount + 1 };
          setLocalPost(updated);
          onPostUpdate?.(updated);
        }
      }
    };
    socket.on('new_comment', handleNewComment);
    return () => { socket.off('new_comment', handleNewComment); };
  }, [post, open, localPost, isOwner]);

  const loadComments = async () => {
    if (!post) return;
    try {
      const c = await postService.getComments(post.id);
      setComments(c);
    } catch {}
  };

  const loadPendingComments = async () => {
    if (!post) return;
    try {
      const c = await postService.getPendingComments(post.id);
      setPendingComments(c);
    } catch {}
  };

  const handleLike = async () => {
    if (!localPost) return;
    try {
      const result = await postService.likePost(localPost.id);
      const updated = {
        ...localPost,
        isLiked: result.liked,
        likesCount: result.liked ? localPost.likesCount + 1 : localPost.likesCount - 1,
      };
      setLocalPost(updated);
      onPostUpdate?.(updated);
    } catch {}
  };

  const handleComment = async () => {
    if (!newComment.trim() || !post) return;
    setLoading(true);
    try {
      const comment = await postService.addComment(post.id, newComment.trim());
      if (post.commentReview && !isOwner) {
        toast.success('Comment submitted for review');
      } else {
        setComments(prev => [...prev, comment]);
      }
      setNewComment('');
      setShowEmojiPicker(false);
      if (localPost) {
        const updated = { ...localPost, commentsCount: localPost.commentsCount + 1 };
        setLocalPost(updated);
        onPostUpdate?.(updated);
      }
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!post) return;
    try {
      await postService.deleteComment(post.id, commentId);
      setComments(prev => prev.filter(c => c.id !== commentId));
      if (localPost) {
        const updated = { ...localPost, commentsCount: localPost.commentsCount - 1 };
        setLocalPost(updated);
        onPostUpdate?.(updated);
      }
      toast.success('Comment deleted');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleApproveComment = async (commentId: string) => {
    if (!post) return;
    try {
      await postService.approveComment(post.id, commentId);
      const approved = pendingComments.find(c => c.id === commentId);
      if (approved) {
        setPendingComments(prev => prev.filter(c => c.id !== commentId));
        setComments(prev => [...prev, { ...approved, approved: true }]);
      }
      toast.success('Comment approved');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleRejectComment = async (commentId: string) => {
    if (!post) return;
    try {
      await postService.deleteComment(post.id, commentId);
      setPendingComments(prev => prev.filter(c => c.id !== commentId));
      toast.success('Comment rejected');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleBlockCommenter = async (userId: string) => {
    try {
      await postService.blockCommenter(userId);
      toast.success('User blocked from commenting');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleSaveSettings = async () => {
    if (!post) return;
    try {
      await postService.updatePostSettings(post.id, { hideLikes, commentsDisabled, commentReview });
      if (localPost) {
        const updated = { ...localPost, hideLikes, commentsDisabled, commentReview };
        setLocalPost(updated);
        onPostUpdate?.(updated);
      }
      setShowSettings(false);
      toast.success('Post settings updated');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onEmojiSelect = (emoji: any) => {
    setNewComment(prev => prev + emoji.native);
  };

  if (!localPost) return null;

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-[900px] p-0 flex flex-col sm:flex-row bg-card border-border [&>button]:z-[60] [&>button]:bg-background/80 [&>button]:rounded-full [&>button]:w-8 [&>button]:h-8 [&>button]:flex [&>button]:items-center [&>button]:justify-center [&>button]:top-3 [&>button]:right-3">
          {/* Media side */}
          <div className="sm:flex-1 bg-muted flex items-center justify-center min-h-[300px] sm:min-h-0 relative">
            {localPost.type === 'video' ? (
              <video src={localPost.mediaUrl} controls className="w-full h-full max-h-[50vh] sm:max-h-full object-contain" />
            ) : (
              <img src={localPost.mediaUrl} alt="" className="w-full h-full max-h-[50vh] sm:max-h-full object-contain" />
            )}
          </div>

          {/* Comments side */}
          <div className="sm:w-[360px] flex flex-col border-l border-border">
            <SheetHeader className="p-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center overflow-hidden">
                    {localPost.user?.avatar ? (
                      <img src={localPost.user.avatar} className="w-full h-full object-cover" />
                    ) : (
                      <User className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <div>
                    <SheetTitle className="text-sm">{localPost.user?.displayName}</SheetTitle>
                    <p className="text-xs text-muted-foreground">@{localPost.user?.username}</p>
                  </div>
                </div>
                {isOwner && (
                  <Button size="icon" variant="ghost" onClick={() => setShowSettings(true)}>
                    <Settings className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </SheetHeader>

            {/* Caption */}
            {localPost.caption && (
              <div className="px-4 py-3 border-b border-border">
                <p className="text-sm">
                  <span className="font-medium">{localPost.user?.username}</span>{' '}
                  {localPost.caption}
                </p>
              </div>
            )}

            {/* Pending comments for owner */}
            {isOwner && pendingComments.length > 0 && (
              <div className="px-4 py-2 bg-warning/10 border-b border-border">
                <p className="text-xs font-medium text-warning mb-2">Pending review ({pendingComments.length})</p>
                {pendingComments.map(c => (
                  <div key={c.id} className="flex items-start gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                      {c.user.avatar ? <img src={c.user.avatar} className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-muted-foreground" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs"><span className="font-medium">{c.user.username}</span> {c.content}</p>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <button onClick={() => handleApproveComment(c.id)} className="text-success hover:text-success/80"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => handleRejectComment(c.id)} className="text-destructive hover:text-destructive/80"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Comments */}
            <ScrollArea className="flex-1 px-4 py-3">
              {comments.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No comments yet</p>
              ) : (
                <div className="space-y-3">
                  {comments.map(c => (
                    <div key={c.id} className="flex items-start gap-2 group">
                      <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center overflow-hidden flex-shrink-0">
                        {c.user.avatar ? <img src={c.user.avatar} className="w-full h-full object-cover" /> : <User className="w-3 h-3 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm">
                          <span className="font-medium">{c.user.username}</span>{' '}
                          {c.content}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {new Date(c.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      {(isOwner || c.userId === user?.id) && (
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <button onClick={() => handleDeleteComment(c.id)} className="text-destructive hover:text-destructive/80">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {isOwner && c.userId !== user?.id && (
                            <button onClick={() => handleBlockCommenter(c.userId)} className="text-warning hover:text-warning/80" title="Block from commenting">
                              <ShieldBan className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            {/* Actions + Like */}
            <div className="px-4 py-3 border-t border-border">
              <div className="flex items-center gap-4 mb-3">
                <button onClick={handleLike} className={`flex items-center gap-1 text-sm transition-colors ${localPost.isLiked ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'}`}>
                  <Heart className={`w-5 h-5 ${localPost.isLiked ? 'fill-current' : ''}`} />
                </button>
                <MessageCircle className="w-5 h-5 text-muted-foreground" />
              </div>
              {(!localPost.hideLikes || isOwner) && (
                <p className="text-sm font-medium mb-1">
                  {localPost.likesCount} {localPost.likesCount === 1 ? 'like' : 'likes'}
                  {localPost.hideLikes && isOwner && <span className="text-xs text-muted-foreground ml-1">(hidden from others)</span>}
                </p>
              )}
              <p className="text-xs text-muted-foreground">{new Date(localPost.createdAt).toLocaleDateString()}</p>
            </div>

            {/* Comment input with emoji */}
            {!commentsDisabled && (
              <div className="px-4 py-3 border-t border-border flex gap-2 items-end">
                <Popover open={showEmojiPicker} onOpenChange={setShowEmojiPicker}>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-9 w-9 p-0 text-muted-foreground hover:text-primary flex-shrink-0">
                      <Smile className="w-4 h-4" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 border-0" side="top" align="start">
                    <Picker data={data} onEmojiSelect={onEmojiSelect} theme="dark" previewPosition="none" skinTonePosition="none" />
                  </PopoverContent>
                </Popover>
                <Input
                  value={newComment}
                  onChange={e => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="bg-muted border-border/50 text-sm"
                  onKeyDown={e => e.key === 'Enter' && handleComment()}
                />
                <Button size="icon" variant="ghost" onClick={handleComment} disabled={loading || !newComment.trim()}>
                  <Send className="w-4 h-4 text-primary" />
                </Button>
              </div>
            )}
            {commentsDisabled && (
              <div className="px-4 py-3 border-t border-border text-center">
                <p className="text-xs text-muted-foreground">Comments are disabled on this post</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>

      {/* Post Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle className="font-display">Post Settings</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <div className="flex items-center gap-2">
                {hideLikes ? <EyeOff className="w-4 h-4 text-warning" /> : <Eye className="w-4 h-4 text-primary" />}
                <div>
                  <span className="text-sm">Hide like count</span>
                  <p className="text-xs text-muted-foreground">Only you can see likes</p>
                </div>
              </div>
              <Switch checked={hideLikes} onCheckedChange={setHideLikes} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <div className="flex items-center gap-2">
                <MessageCircle className={`w-4 h-4 ${commentsDisabled ? 'text-destructive' : 'text-primary'}`} />
                <div>
                  <span className="text-sm">Disable comments</span>
                  <p className="text-xs text-muted-foreground">No one can comment</p>
                </div>
              </div>
              <Switch checked={commentsDisabled} onCheckedChange={setCommentsDisabled} />
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
              <div className="flex items-center gap-2">
                <Check className={`w-4 h-4 ${commentReview ? 'text-warning' : 'text-primary'}`} />
                <div>
                  <span className="text-sm">Review comments</span>
                  <p className="text-xs text-muted-foreground">Approve before visible</p>
                </div>
              </div>
              <Switch checked={commentReview} onCheckedChange={setCommentReview} />
            </div>
            <Button onClick={handleSaveSettings} className="w-full gradient-primary text-primary-foreground">
              Save Settings
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PostDetailModal;