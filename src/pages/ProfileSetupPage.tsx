import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/apiService';
import { postService } from '@/services/apiService';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Camera, ArrowRight, User, Lock, Globe } from 'lucide-react';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const ProfileSetupPage = () => {
  const { user, updateUser } = useAuth();
  const navigate = useNavigate();
  const [displayName, setDisplayName] = useState(user?.displayName || user?.username || '');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState('');
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isPrivate, setIsPrivate] = useState(false);
  const [loading, setLoading] = useState(false);

  if (!user) return null;

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onload = (ev) => setAvatar(ev.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      let avatarUrl = avatar;
      // Upload avatar if file selected
      if (avatarFile) {
        try {
          const { url } = await postService.uploadFile(avatarFile);
          avatarUrl = url;
        } catch {
          // If upload fails, use base64 fallback
        }
      }
      const updated = await userService.updateProfile(user.id, {
        displayName: displayName || user.username,
        bio,
        avatar: avatarUrl,
        isPrivate,
        profileSetupComplete: true,
      });
      updateUser(updated);
      toast.success('Profile set up! Welcome to Social Sync!');
      navigate('/');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-lg mx-4 animate-slide-up">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-bold text-foreground mb-2">
            Welcome, <span className="text-primary glow-text">@{user.username}</span>!
          </h1>
          <p className="text-muted-foreground">Set up your profile to get started</p>
        </div>

        <div className="glass rounded-2xl p-8 shadow-[var(--shadow-elevated)]">
          {/* Avatar */}
          <div className="flex flex-col items-center mb-6">
            <div className="relative group">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-primary/30 glow">
                {avatar ? (
                  <img src={avatar} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <User className="w-10 h-10 text-muted-foreground" />
                )}
              </div>
              <label className="absolute inset-0 rounded-full flex items-center justify-center bg-background/60 opacity-0 group-hover:opacity-100 cursor-pointer transition-opacity">
                <Camera className="w-6 h-6 text-primary" />
                <input type="file" accept="image/*" className="hidden" onChange={handleAvatarChange} />
              </label>
            </div>
            <p className="text-xs text-muted-foreground mt-2">Profile picture (optional)</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Display Name</label>
              <Input
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className="bg-muted border-border/50"
                placeholder="How should people call you?"
              />
            </div>

            <div>
              <label className="text-sm text-muted-foreground mb-1 block">Bio</label>
              <Textarea
                value={bio}
                onChange={e => setBio(e.target.value)}
                className="bg-muted border-border/50 min-h-[80px]"
                placeholder="Tell us about yourself..."
                maxLength={300}
              />
              <p className="text-xs text-muted-foreground mt-1 text-right">{bio.length}/300</p>
            </div>

            <div className="flex items-center justify-between p-4 rounded-xl bg-muted/50">
              <div className="flex items-center gap-3">
                {isPrivate ? <Lock className="w-5 h-5 text-warning" /> : <Globe className="w-5 h-5 text-primary" />}
                <div>
                  <p className="text-sm font-medium text-foreground">{isPrivate ? 'Private Profile' : 'Public Profile'}</p>
                  <p className="text-xs text-muted-foreground">
                    {isPrivate ? 'Only friends can see your posts' : 'Everyone can see your posts'}
                  </p>
                </div>
              </div>
              <Switch checked={isPrivate} onCheckedChange={setIsPrivate} />
            </div>

            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full gradient-primary text-primary-foreground font-semibold glow"
            >
              {loading ? 'Setting up...' : 'Complete Setup'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            <button
              onClick={() => {
                userService.updateProfile(user.id, { profileSetupComplete: true }).then(updated => {
                  updateUser(updated);
                  navigate('/');
                });
              }}
              className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfileSetupPage;