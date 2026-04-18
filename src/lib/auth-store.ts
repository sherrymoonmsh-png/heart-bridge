import { hasSupabaseConfig, supabase } from "@/lib/supabase";
import { syncAuthUserRecords } from "@/lib/user-service";

const AUTH_KEY = "mind_bridge_user_phone";
const AUTH_USER_ID_KEY = "mind_bridge_user_id";
const AUTH_MODE_KEY = "mind_bridge_auth_mode";
type AuthMode = "user" | "guest";

function setAuthMode(mode: AuthMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_MODE_KEY, mode);
}

function getAuthMode(): AuthMode | "" {
  if (typeof window === "undefined") return "";
  const mode = window.localStorage.getItem(AUTH_MODE_KEY);
  if (mode === "user" || mode === "guest") return mode;
  return "";
}

export function setAuthedPhone(phone: string, userId?: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(AUTH_KEY, phone);
  if (userId) {
    window.localStorage.setItem(AUTH_USER_ID_KEY, userId);
  }
  setAuthMode("user");
}

export function setGuestAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_KEY);
  window.localStorage.removeItem(AUTH_USER_ID_KEY);
  setAuthMode("guest");
}

export function getAuthedPhone() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_KEY) ?? "";
}

export function getAuthedUserId() {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(AUTH_USER_ID_KEY) ?? "";
}

export function isAuthed() {
  return getAuthMode() === "user" && Boolean(getAuthedPhone());
}

export function isGuest() {
  return getAuthMode() === "guest";
}

export function hasSession() {
  return isAuthed() || isGuest();
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_KEY);
  window.localStorage.removeItem(AUTH_USER_ID_KEY);
  window.localStorage.removeItem(AUTH_MODE_KEY);
}

export async function hydrateSessionFromSupabase() {
  if (typeof window === "undefined") return false;
  if (isGuest()) return true;
  if (!hasSupabaseConfig || !supabase) return false;

  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session?.user) {
    if (isAuthed()) clearAuth();
    return false;
  }
  const user = data.session.user;
  const identity = user.email || user.phone || `user_${user.id.slice(0, 8)}`;
  setAuthedPhone(identity, user.id);
  await syncAuthUserRecords(identity);
  return true;
}

export async function signOutAndClearSession() {
  if (hasSupabaseConfig && supabase) {
    await supabase.auth.signOut();
  }
  clearAuth();
}
