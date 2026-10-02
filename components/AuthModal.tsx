'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Lock, LogOut, User as UserIcon, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
} from 'firebase/auth';
import { getFirebaseAuth } from '@/lib/firebase';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
}

/** Google "G" logo as inline SVG — no external dependency needed */
function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}

const springTransition = { type: 'spring' as const, stiffness: 420, damping: 30 };

export default function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { user, getIdToken, signOut, signInWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setError('');
    setShowPassword(false);
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  const friendlyError = (msg: string): string => {
    if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential'))
      return 'Invalid email or password.';
    if (msg.includes('email-already-in-use')) return 'An account with this email already exists.';
    if (msg.includes('weak-password')) return 'Password must be at least 6 characters.';
    if (msg.includes('invalid-email')) return 'Please enter a valid email address.';
    if (msg.includes('too-many-requests')) return 'Too many attempts. Please wait a moment and try again.';
    if (msg.includes('network-request-failed')) return 'Network error. Check your connection and retry.';
    if (msg.includes('popup-closed-by-user')) return 'Sign-in popup was closed. Please try again.';
    return msg;
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);
    try {
      await signInWithGoogle();
      const token = await getIdToken();
      if (!token) throw new Error('Signed in, but unable to create a session. Please try again.');
      toast.success('Signed in with Google!');
      handleClose();
    } catch (err: any) {
      const msg = friendlyError(err.message || 'Google sign-in failed');
      setError(msg);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const auth = getFirebaseAuth();
      if (!auth) {
        setError('Firebase is not configured. Please add NEXT_PUBLIC_FIREBASE_* env vars.');
        setIsLoading(false);
        return;
      }

      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        await createUserWithEmailAndPassword(auth, email, password);
      }

      const token = await getIdToken();
      if (!token) throw new Error('Signed in, but unable to create a session. Please try again.');

      toast.success(mode === 'login' ? 'Signed in successfully!' : 'Account created!');
      handleClose();
    } catch (err: any) {
      setError(friendlyError(err.message || 'Authentication failed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      toast.success('Signed out successfully');
      handleClose();
    } catch {
      toast.error('Failed to sign out');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop — dark overlay only, no blur (blur is on a separate layer below the card) */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={handleClose}
            className="fixed inset-0 z-[60]"
            style={{ background: 'rgba(0,0,0,0.55)' }}
          />

          {/* Blur layer — sits between backdrop and modal, doesn't affect modal card */}
          <motion.div
            key="blur-layer"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[61] backdrop-blur-sm pointer-events-none"
          />

          {/* Modal */}
          <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 12 }}
            transition={springTransition}
            className="fixed inset-0 z-[70] flex items-center justify-center p-4"
            onClick={handleClose}
            role="dialog"
            aria-modal="true"
            aria-labelledby="auth-modal-title"
          >
            <div
              className="w-full max-w-sm bg-white dark:bg-black rounded-2xl border border-gray-200 dark:border-[#333] shadow-2xl overflow-hidden"
              onClick={e => e.stopPropagation()}
            >

              {/* Header */}
              <div className="flex items-center justify-between border-b border-gray-100 dark:border-[#222] px-5 py-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 bg-black dark:bg-white text-white dark:text-black rounded-full flex items-center justify-center shrink-0">
                    <ShieldCheck size={15} strokeWidth={2.5} aria-hidden="true" />
                  </div>
                  <h2
                    id="auth-modal-title"
                    className="text-sm font-semibold text-black dark:text-white"
                  >
                    {user
                      ? 'Account'
                      : mode === 'login'
                      ? 'Sign in to TeleCheck Pro'
                      : 'Create your account'}
                  </h2>
                </div>
                <button
                  onClick={handleClose}
                  data-cuelume-close
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 dark:border-[#333] bg-gray-100/50 dark:bg-[#111]/50 text-gray-500 hover:text-black dark:text-gray-400 dark:hover:text-white transition-colors"
                  aria-label="Close"
                >
                  <X size={16} />
                </button>
              </div>

              {/* Body */}
              <div className="px-5 py-5">
                {user ? (
                  /* ── Logged-in view ── */
                  <div className="space-y-4">
                    <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-[#111] border border-gray-100 dark:border-[#222]">
                      {user.photoURL ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={user.photoURL}
                          alt={user.displayName || 'User avatar'}
                          className="w-9 h-9 rounded-full shrink-0 object-cover"
                          referrerPolicy="no-referrer"
                        />
                      ) : (
                        <div className="w-9 h-9 rounded-full bg-black dark:bg-white flex items-center justify-center shrink-0">
                          <UserIcon size={17} className="text-white dark:text-black" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-black dark:text-white truncate">
                          {user.displayName || user.email || 'User'}
                        </p>
                        {user.displayName && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                            {user.email}
                          </p>
                        )}
                      </div>
                      {user.emailVerified && (
                        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider px-2 py-1 rounded-full bg-gray-100 dark:bg-[#222] text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-[#333]">
                          Verified
                        </span>
                      )}
                    </div>

                    <button
                      onClick={handleSignOut}
                      className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#111] hover:text-black dark:hover:text-white transition-colors"
                    >
                      <LogOut size={15} />
                      Sign out
                    </button>
                  </div>
                ) : (
                  /* ── Auth form ── */
                  <div className="space-y-4">
                    {/* Error banner */}
                    <AnimatePresence>
                      {error && (
                        <motion.div
                          initial={{ opacity: 0, y: -6 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -6 }}
                          transition={{ duration: 0.15 }}
                          className="px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#111] border border-gray-200 dark:border-[#333]"
                        >
                          <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Google sign-in */}
                    <button
                      type="button"
                      onClick={handleGoogleSignIn}
                      disabled={isGoogleLoading || isLoading}
                      className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-[#111] text-sm font-medium text-black dark:text-white hover:bg-gray-50 dark:hover:bg-[#1a1a1a] disabled:opacity-50 transition-colors"
                    >
                      {isGoogleLoading ? (
                        <Loader2 size={16} className="animate-spin text-gray-500" />
                      ) : (
                        <GoogleIcon size={16} />
                      )}
                      Continue with Google
                    </button>

                    {/* Divider */}
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-px bg-gray-100 dark:bg-[#222]" />
                      <span className="text-[11px] text-gray-400 dark:text-gray-600 uppercase tracking-widest font-medium">
                        or
                      </span>
                      <div className="flex-1 h-px bg-gray-100 dark:bg-[#222]" />
                    </div>

                    {/* Email / Password form */}
                    <form onSubmit={handleAuthSubmit} className="space-y-3" noValidate>
                      {/* Email */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="auth-email"
                          className="block text-xs font-medium text-gray-600 dark:text-gray-400"
                        >
                          Email
                        </label>
                        <div className="relative">
                          <Mail
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 pointer-events-none"
                          />
                          <input
                            id="auth-email"
                            type="email"
                            required
                            autoComplete="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                          />
                        </div>
                      </div>

                      {/* Password */}
                      <div className="space-y-1.5">
                        <label
                          htmlFor="auth-password"
                          className="block text-xs font-medium text-gray-600 dark:text-gray-400"
                        >
                          Password
                        </label>
                        <div className="relative">
                          <Lock
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 pointer-events-none"
                          />
                          <input
                            id="auth-password"
                            type={showPassword ? 'text' : 'password'}
                            required
                            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-9 pr-10 py-2.5 rounded-xl border border-gray-200 dark:border-[#333] bg-white dark:bg-black text-sm text-black dark:text-white placeholder:text-gray-400 dark:placeholder:text-gray-600 focus:outline-none focus:border-black dark:focus:border-white transition-colors"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 hover:text-black dark:hover:text-white transition-colors"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}
                          >
                            {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>
                        </div>
                      </div>

                      {/* Submit */}
                      <button
                        type="submit"
                        disabled={isLoading || isGoogleLoading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-black dark:bg-white text-white dark:text-black text-sm font-medium hover:opacity-90 disabled:opacity-50 transition-opacity"
                      >
                        {isLoading ? (
                          <>
                            <Loader2 size={15} className="animate-spin" />
                            {mode === 'login' ? 'Signing in…' : 'Creating account…'}
                          </>
                        ) : mode === 'login' ? (
                          'Sign in'
                        ) : (
                          'Create account'
                        )}
                      </button>
                    </form>

                    {/* Mode toggle */}
                    <p className="text-center text-xs text-gray-500 dark:text-gray-400">
                      {mode === 'login' ? "Don't have an account?" : 'Already have an account?'}{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setMode(mode === 'login' ? 'signup' : 'login');
                          setError('');
                        }}
                        className="font-medium text-black dark:text-white hover:underline underline-offset-2 transition-colors"
                      >
                        {mode === 'login' ? 'Sign up' : 'Sign in'}
                      </button>
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
