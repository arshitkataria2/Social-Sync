import React, { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { checkUsername, authService } from '@/services/apiService';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Zap, ArrowRight, Users, MessageCircle, CheckCircle, XCircle, Loader2, Eye, EyeOff, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';

const AuthPage = () => {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot' | 'otp' | 'reset'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<'idle' | 'checking' | 'available' | 'taken' | 'invalid'>('idle');
  const [otpValue, setOtpValue] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, signup } = useAuth();
  const navigate = useNavigate();

  const usernameRegex = /^[a-zA-Z0-9_.]{3,30}$/;

  useEffect(() => {
    if (mode !== 'signup' || !username) { setUsernameStatus('idle'); return; }
    if (!usernameRegex.test(username)) { setUsernameStatus('invalid'); return; }
    setUsernameStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await checkUsername(username);
        setUsernameStatus(res.available ? 'available' : 'taken');
      } catch { setUsernameStatus('idle'); }
    }, 500);
    return () => clearTimeout(timer);
  }, [username, mode]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (mode === 'login') {
        await login(email, password);
        navigate('/');
      } else if (mode === 'signup') {
        if (!usernameRegex.test(username)) { setError('Username: 3-30 chars, only letters, numbers, underscore, dot'); setLoading(false); return; }
        if (usernameStatus === 'taken') { setError('Username already taken'); setLoading(false); return; }
        const message = await signup(email, password, username);
        toast.success(message);
        setMode('login');
        setUsername('');
        setPassword('');
      } else if (mode === 'forgot') {
        const res = await authService.forgotPassword(email);
        toast.success(res.message);
        setMode('otp');
      } else if (mode === 'otp') {
        if (otpValue.length !== 6) { setError('Enter 6-digit OTP'); setLoading(false); return; }
        const res = await authService.verifyOtp(email, otpValue);
        setResetToken(res.token);
        setMode('reset');
        toast.success('OTP verified!');
      } else if (mode === 'reset') {
        if (newPassword.length < 6) { setError('Password must be at least 6 characters'); setLoading(false); return; }
        const res = await authService.resetPassword(resetToken, newPassword);
        toast.success(res.message);
        setMode('login');
        setNewPassword('');
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    }
    setLoading(false);
  };

  const getTitle = () => {
    switch (mode) {
      case 'login': return 'Sign In';
      case 'signup': return 'Sign Up';
      case 'forgot': return 'Forgot Password';
      case 'otp': return 'Enter OTP';
      case 'reset': return 'Reset Password';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden">
      <div className="absolute inset-0 opacity-30">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full bg-primary/10 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full bg-accent/10 blur-[120px]" />
      </div>

      <div className="relative z-10 w-full max-w-md mx-4">
        <div className="text-center mb-8 animate-slide-up">
          <div className="inline-flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center glow">
              <Zap className="w-7 h-7 text-primary-foreground" />
            </div>
            <h1 className="text-3xl font-display font-bold text-foreground">
              Social<span className="text-primary">Sync</span>
            </h1>
          </div>
          <p className="text-muted-foreground">Connect. Chat. Create.</p>
        </div>

        {(mode === 'login' || mode === 'signup') && (
          <div className="flex justify-center gap-3 mb-8 animate-slide-up" style={{ animationDelay: '0.1s' }}>
            {[
              { icon: Users, label: 'Friends' },
              { icon: MessageCircle, label: 'Chat' },
              { icon: Zap, label: 'Posts' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full glass text-xs text-muted-foreground">
                <Icon className="w-3.5 h-3.5 text-primary" />
                {label}
              </div>
            ))}
          </div>
        )}

        <div className="glass rounded-2xl p-8 shadow-[var(--shadow-elevated)] animate-slide-up" style={{ animationDelay: '0.2s' }}>
          {(mode === 'login' || mode === 'signup') && (
            <div className="flex mb-6 rounded-lg bg-muted p-1">
              {(['login', 'signup'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setError(''); }}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${
                    mode === m ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {m === 'login' ? 'Sign In' : 'Sign Up'}
                </button>
              ))}
            </div>
          )}

          {(mode === 'forgot' || mode === 'otp' || mode === 'reset') && (
            <div className="flex items-center gap-2 mb-6">
              <button onClick={() => setMode('login')} className="text-muted-foreground hover:text-foreground transition-colors">
                <ArrowLeft className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-semibold text-foreground">{getTitle()}</h2>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div className="relative">
                <Input
                  placeholder="Username (e.g. john_doe)"
                  value={username}
                  onChange={e => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_.]/g, ''))}
                  className="bg-muted border-border/50 focus:border-primary pr-10"
                  maxLength={30}
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {usernameStatus === 'checking' && <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />}
                  {usernameStatus === 'available' && <CheckCircle className="w-4 h-4 text-online" />}
                  {usernameStatus === 'taken' && <XCircle className="w-4 h-4 text-destructive" />}
                  {usernameStatus === 'invalid' && <XCircle className="w-4 h-4 text-warning" />}
                </div>
                {usernameStatus === 'taken' && <p className="text-xs text-destructive mt-1">Username taken</p>}
                {usernameStatus === 'invalid' && username.length > 0 && <p className="text-xs text-warning mt-1">3-30 chars: letters, numbers, _ and . only</p>}
              </div>
            )}

            {(mode === 'login' || mode === 'signup' || mode === 'forgot') && (
              <Input
                type="email"
                placeholder="Email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="bg-muted border-border/50 focus:border-primary"
                required
              />
            )}

            {(mode === 'login' || mode === 'signup') && (
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="bg-muted border-border/50 focus:border-primary pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {mode === 'otp' && (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Enter the 6-digit code sent to <span className="text-foreground font-medium">{email}</span></p>
                <div className="flex justify-center">
                  <InputOTP maxLength={6} value={otpValue} onChange={setOtpValue}>
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
            )}

            {mode === 'reset' && (
              <div className="relative">
                <Input
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="New Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="bg-muted border-border/50 focus:border-primary pr-10"
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            )}

            {error && <p className="text-destructive text-sm">{error}</p>}

            <Button
              type="submit"
              className="w-full gradient-primary text-primary-foreground font-semibold glow"
              disabled={loading || (mode === 'signup' && (usernameStatus === 'taken' || usernameStatus === 'invalid' || usernameStatus === 'checking'))}
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {mode === 'login' ? 'Sign In' : mode === 'signup' ? 'Create Account' : mode === 'forgot' ? 'Send OTP' : mode === 'otp' ? 'Verify OTP' : 'Reset Password'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>

            {mode === 'login' && (
              <button
                type="button"
                onClick={() => { setMode('forgot'); setError(''); }}
                className="w-full text-sm text-primary hover:underline mt-2"
              >
                Forgot Password?
              </button>
            )}

            {mode === 'forgot' && (
              <p className="text-xs text-muted-foreground text-center">
                We'll send a 6-digit OTP to your registered email. (Check server console for now)
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default AuthPage;