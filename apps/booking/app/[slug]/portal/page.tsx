'use client';

import { Button } from '@salon/ui';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  marketingOptOut?: boolean;
  loyalty: {
    points: number;
    tier: string;
  };
  activeSubscriptionsCount: number;
  activeGiftCardsCount: number;
}

interface AppointmentItem {
  _id: string;
  status: string;
  lines: Array<{
    start: string;
    end: string;
  }>;
  depositAmount: { amount: number };
}

export default function ClientPortalPage() {
  const slug = String(useParams().slug ?? '');
  const [salon, setSalon] = useState<{ name: string } | null>(null);

  // Auth State
  const [token, setToken] = useState<string | null>(null);
  const [phone, setPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'portal'>('phone');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Portal State
  const [tab, setTab] = useState<'upcoming' | 'history' | 'loyalty' | 'giftcards' | 'profile'>('upcoming');
  const [profile, setProfile] = useState<CustomerProfile | null>(null);
  const [upcoming, setUpcoming] = useState<AppointmentItem[]>([]);
  const [past, setPast] = useState<AppointmentItem[]>([]);
  const [loyalty, setLoyalty] = useState<{ points: number; tier: string; history: any[] } | null>(null);
  const [giftCards, setGiftCards] = useState<any[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Profile Edit
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editOptOut, setEditOptOut] = useState(false);

  useEffect(() => {
    // 1. Fetch salon details
    fetch(`${API}/public/${slug}`)
      .then((r) => r.json())
      .then((d) => setSalon(d))
      .catch(() => undefined);

    // 2. Check local token
    const stored = localStorage.getItem(`client_token_${slug}`);
    if (stored) {
      setToken(stored);
      setStep('portal');
    }
  }, [slug]);

  useEffect(() => {
    if (token && step === 'portal') {
      loadPortalData();
    }
  }, [token, step]);

  const loadPortalData = async () => {
    if (!token) return;
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // Load Profile
      const pRes = await fetch(`${API}/public/${slug}/portal/profile`, { headers });
      if (pRes.ok) {
        const p = await pRes.json();
        setProfile(p);
        setEditName(p.name || '');
        setEditEmail(p.email || '');
        setEditOptOut(p.marketingOptOut || false);
      } else if (pRes.status === 401) {
        logout();
        return;
      }

      // Load Appointments
      const aRes = await fetch(`${API}/public/${slug}/portal/appointments`, { headers });
      if (aRes.ok) {
        const a = await aRes.json();
        setUpcoming(a.upcoming || []);
        setPast(a.past || []);
      }

      // Load Loyalty
      const lRes = await fetch(`${API}/public/${slug}/portal/loyalty`, { headers });
      if (lRes.ok) setLoyalty(await lRes.json());

      // Load Gift Cards
      const gRes = await fetch(`${API}/public/${slug}/portal/gift-cards`, { headers });
      if (gRes.ok) setGiftCards(await gRes.json());
    } catch {
      // Ignored in offline/mock
    }
  };

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/public/${slug}/portal/auth/request-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');
      setStep('otp');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API}/public/${slug}/portal/auth/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code: otpCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid OTP code');

      setToken(data.token);
      localStorage.setItem(`client_token_${slug}`, data.token);
      setStep('portal');
    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelAppointment = async (apptId: string) => {
    if (!token || !confirm('Are you sure you want to cancel this appointment?')) return;
    setFeedback(null);
    try {
      const res = await fetch(`${API}/public/${slug}/portal/appointments/${apptId}/cancel`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to cancel');
      setFeedback('Appointment cancelled successfully.');
      loadPortalData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    try {
      const res = await fetch(`${API}/public/${slug}/portal/profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          name: editName,
          email: editEmail,
          marketingOptOut: editOptOut,
        }),
      });
      if (res.ok) {
        setFeedback('Profile updated successfully.');
        loadPortalData();
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const logout = () => {
    localStorage.removeItem(`client_token_${slug}`);
    setToken(null);
    setStep('phone');
    setProfile(null);
  };

  const box = 'w-full rounded-medium border border-default-300 bg-default-50 px-3 py-2 text-sm outline-none focus:border-brand';

  return (
    <div className="mx-auto min-h-screen max-w-xl bg-background px-4 py-8 text-foreground">
      {/* Header */}
      <header className="mb-6 flex items-center justify-between border-b border-default-200 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-brand">
            {salon?.name ?? 'Salon Portal'}
          </h1>
          <p className="text-xs text-default-500">Client Self-Service Portal</p>
        </div>
        {token && (
          <Button variant="ghost" size="sm" onPress={logout} className="text-danger">
            Log Out
          </Button>
        )}
      </header>

      {/* --- AUTHENTICATION FLOW --- */}
      {step === 'phone' && (
        <section className="rounded-large border border-default-200 bg-content1 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Sign in to your client account</h2>
          <p className="mb-4 text-xs text-default-500">
            Enter your mobile number to manage your appointments, loyalty points, and subscriptions.
          </p>
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-default-700">Phone Number</label>
              <input
                type="tel"
                required
                placeholder="01712345678"
                className={box}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            {authError && <div className="text-xs text-danger">{authError}</div>}
            <Button type="submit" variant="primary" className="w-full" isDisabled={loading}>
              {loading ? 'Sending...' : 'Send Verification Code'}
            </Button>
          </form>
        </section>
      )}

      {step === 'otp' && (
        <section className="rounded-large border border-default-200 bg-content1 p-6 shadow-sm">
          <h2 className="text-lg font-semibold">Enter Verification Code</h2>
          <p className="mb-4 text-xs text-default-500">
            We sent a 6-digit code to <span className="font-semibold text-foreground">{phone}</span>
          </p>
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-default-700">6-Digit Code</label>
              <input
                type="text"
                required
                maxLength={6}
                placeholder="123456"
                className={`${box} text-center text-lg tracking-widest`}
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
              />
            </div>
            {authError && <div className="text-xs text-danger">{authError}</div>}
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onPress={() => setStep('phone')}>
                Change Number
              </Button>
              <Button type="submit" variant="primary" className="flex-1" isDisabled={loading}>
                {loading ? 'Verifying...' : 'Verify & Sign In'}
              </Button>
            </div>
          </form>
        </section>
      )}

      {/* --- AUTHENTICATED PORTAL DASHBOARD --- */}
      {step === 'portal' && (
        <div className="space-y-6">
          {/* Welcome & Loyalty Summary Card */}
          <div className="rounded-large bg-gradient-to-r from-brand/10 to-brand/5 p-4 border border-brand/20">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-default-500">Welcome back,</p>
                <h2 className="text-lg font-bold">{profile?.name || 'Valued Guest'}</h2>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-full bg-brand/20 px-2.5 py-0.5 text-xs font-semibold text-brand uppercase">
                  {profile?.loyalty?.tier || 'Bronze'} Member
                </span>
                <p className="text-sm font-bold text-foreground mt-0.5">
                  {profile?.loyalty?.points ?? 0} pts
                </p>
              </div>
            </div>
          </div>

          {feedback && (
            <div className="rounded-medium bg-success-50 border border-success-200 p-3 text-xs text-success-700">
              {feedback}
            </div>
          )}

          {/* Navigation Tabs */}
          <div className="flex border-b border-default-200 text-xs font-medium">
            <button
              onClick={() => setTab('upcoming')}
              className={`flex-1 pb-2.5 text-center border-b-2 transition-colors ${
                tab === 'upcoming' ? 'border-brand text-brand font-semibold' : 'border-transparent text-default-500'
              }`}
            >
              Upcoming ({upcoming.length})
            </button>
            <button
              onClick={() => setTab('history')}
              className={`flex-1 pb-2.5 text-center border-b-2 transition-colors ${
                tab === 'history' ? 'border-brand text-brand font-semibold' : 'border-transparent text-default-500'
              }`}
            >
              History
            </button>
            <button
              onClick={() => setTab('loyalty')}
              className={`flex-1 pb-2.5 text-center border-b-2 transition-colors ${
                tab === 'loyalty' ? 'border-brand text-brand font-semibold' : 'border-transparent text-default-500'
              }`}
            >
              Perks
            </button>
            <button
              onClick={() => setTab('profile')}
              className={`flex-1 pb-2.5 text-center border-b-2 transition-colors ${
                tab === 'profile' ? 'border-brand text-brand font-semibold' : 'border-transparent text-default-500'
              }`}
            >
              Profile
            </button>
          </div>

          {/* Tab 1: Upcoming Appointments */}
          {tab === 'upcoming' && (
            <div className="space-y-3">
              {upcoming.length === 0 ? (
                <div className="rounded-large border border-dashed border-default-300 p-8 text-center text-sm text-default-500">
                  You have no upcoming appointments.
                </div>
              ) : (
                upcoming.map((appt) => {
                  const start = appt.lines[0]?.start ? new Date(appt.lines[0].start) : null;
                  const isNearCutoff = start ? start.getTime() - Date.now() < 2 * 60 * 60 * 1000 : false;
                  return (
                    <div
                      key={appt._id}
                      className="rounded-large border border-default-200 bg-content1 p-4 shadow-xs"
                    >
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-sm font-semibold">Salon Service</p>
                          <p className="text-xs text-default-500">
                            {start ? start.toLocaleString([], { dateStyle: 'full', timeStyle: 'short' }) : 'Time pending'}
                          </p>
                          <span className="mt-2 inline-block rounded-full bg-primary-50 px-2 py-0.5 text-tiny font-medium text-primary-700 capitalize">
                            {appt.status}
                          </span>
                        </div>
                        <div>
                          <Button
                            size="sm"
                            variant="danger-soft"
                            isDisabled={isNearCutoff}
                            onPress={() => handleCancelAppointment(appt._id)}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                      {isNearCutoff && (
                        <p className="mt-2 text-tiny text-default-400">
                          * Cannot cancel within 2 hours of appointment time.
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* Tab 2: Appointment History */}
          {tab === 'history' && (
            <div className="space-y-3">
              {past.length === 0 ? (
                <div className="rounded-large border border-dashed border-default-300 p-8 text-center text-sm text-default-500">
                  No past appointments found.
                </div>
              ) : (
                past.map((appt) => (
                  <div key={appt._id} className="rounded-medium border border-default-200 bg-content1 p-3">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-medium">
                        {appt.lines[0]?.start ? new Date(appt.lines[0].start).toLocaleDateString() : '—'}
                      </span>
                      <span className="capitalize text-default-500">{appt.status}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Tab 3: Loyalty & Gift Cards */}
          {tab === 'loyalty' && (
            <div className="space-y-4">
              <div className="rounded-large border border-default-200 bg-content1 p-4">
                <h3 className="text-sm font-bold">Loyalty Rewards</h3>
                <p className="text-2xl font-bold text-brand mt-1">{loyalty?.points ?? 0} Points</p>
                <p className="text-xs text-default-500">Tier: {loyalty?.tier?.toUpperCase() ?? 'BRONZE'}</p>
              </div>

              <div>
                <h3 className="text-xs font-bold uppercase text-default-500 mb-2">My Gift Cards</h3>
                {giftCards.length === 0 ? (
                  <p className="text-xs text-default-400">No active gift cards.</p>
                ) : (
                  giftCards.map((g: any) => (
                    <div key={g._id} className="rounded-medium border border-default-200 p-3 bg-content1 text-xs">
                      <p className="font-bold">{g.code}</p>
                      <p className="text-default-500">Balance: ৳{(g.balance.amount / 100).toFixed(0)}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Tab 4: Profile Settings */}
          {tab === 'profile' && (
            <form onSubmit={handleSaveProfile} className="space-y-4 rounded-large border border-default-200 bg-content1 p-4">
              <div>
                <label className="text-xs font-medium text-default-700">Full Name</label>
                <input
                  type="text"
                  className={box}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-default-700">Email Address</label>
                <input
                  type="email"
                  className={box}
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="optout"
                  checked={editOptOut}
                  onChange={(e) => setEditOptOut(e.target.checked)}
                />
                <label htmlFor="optout" className="text-xs text-default-600">
                  Opt out of promotional SMS and marketing campaigns
                </label>
              </div>
              <Button type="submit" variant="primary" size="sm">
                Save Changes
              </Button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
