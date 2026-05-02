import { MyProfileResponse } from '../types';

const IDENTITY_STORAGE_KEY = 'telecheck_contributor_identity';

type StoredContributorIdentity = {
  deviceId: string;
  username?: string;
  recoveryKey?: string;
  linksAdded?: number;
  rank?: number | null;
  firstSeen?: string;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
};

function canUseStorage() {
  if (typeof window === 'undefined') return false;

  try {
    return typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

function createDeviceId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function readIdentity(): StoredContributorIdentity | null {
  if (!canUseStorage()) return null;

  try {
    const raw = localStorage.getItem(IDENTITY_STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as Partial<StoredContributorIdentity>;
    if (!parsed.deviceId || typeof parsed.deviceId !== 'string') return null;

    return {
      deviceId: parsed.deviceId,
      username: parsed.username,
      recoveryKey: parsed.recoveryKey,
      linksAdded: parsed.linksAdded,
      rank: parsed.rank,
      firstSeen: parsed.firstSeen,
      lastSeen: parsed.lastSeen,
      createdAt: parsed.createdAt || new Date().toISOString(),
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

function writeIdentity(identity: StoredContributorIdentity) {
  if (!canUseStorage()) return;

  try {
    localStorage.setItem(IDENTITY_STORAGE_KEY, JSON.stringify(identity));
  } catch {
    // Persistence is best-effort; API calls still work without local storage.
  }
}

export function getContributorIdentity() {
  const existing = readIdentity();
  if (existing) return existing;

  const now = new Date().toISOString();
  const identity: StoredContributorIdentity = {
    deviceId: createDeviceId(),
    createdAt: now,
    updatedAt: now,
  };

  writeIdentity(identity);
  return identity;
}

export function getContributorHeaders(contentType?: string): HeadersInit {
  const headers: Record<string, string> = {};

  if (contentType) headers['Content-Type'] = contentType;
  return headers;
}

export function appendContributorIdentity(params: URLSearchParams) {
  const identity = getContributorIdentity();

  params.set('contributor_id', identity.deviceId);
  params.set('device_id', identity.deviceId);

  if (identity.recoveryKey) {
    params.set('recovery_key', identity.recoveryKey);
  }

  if (identity.username) {
    params.set('contributor_username', identity.username);
  }

  return params;
}

export function getContributorPayload() {
  const identity = getContributorIdentity();

  return {
    contributor_id: identity.deviceId,
    device_id: identity.deviceId,
    recovery_key: identity.recoveryKey,
    contributor_username: identity.username,
  };
}

export function rememberContributorProfile(profile: MyProfileResponse): MyProfileResponse {
  if (!profile.username) return profile;

  const identity = getContributorIdentity();
  const profileRecoveryKey = profile.recovery_key;
  const isKnownIdentity =
    !identity.username ||
    identity.username === profile.username ||
    (!!identity.recoveryKey && !!profileRecoveryKey && identity.recoveryKey === profileRecoveryKey);

  if (isKnownIdentity) {
    const updated: StoredContributorIdentity = {
      ...identity,
      username: profile.username,
      recoveryKey: profileRecoveryKey || identity.recoveryKey,
      linksAdded: profile.links_added,
      rank: profile.rank,
      firstSeen: profile.first_seen,
      lastSeen: profile.last_seen,
      updatedAt: new Date().toISOString(),
    };

    writeIdentity(updated);
    return profile;
  }

  return {
    ...profile,
    username: identity.username,
    recovery_key: identity.recoveryKey,
    links_added: identity.linksAdded ?? profile.links_added,
    rank: identity.rank ?? profile.rank,
    first_seen: identity.firstSeen ?? profile.first_seen,
    last_seen: identity.lastSeen ?? profile.last_seen,
  };
}
