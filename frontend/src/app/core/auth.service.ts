import { Injectable, computed, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { tap } from 'rxjs';
import { AuthResponse } from './models';
import { apiBase } from './api-base';

// sessionStorage keys — cleared when the browser tab/window is closed.
// The signal is the primary in-memory source; sessionStorage is only used
// to survive a same-tab page refresh.
const TOKEN_KEY = 'origin.token';
const USER_KEY = 'origin.user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  // In-memory session is the source of truth; sessionStorage is a warm-start fallback
  private readonly session = signal<AuthResponse | null>(this.readSession());
  readonly user = computed(() => this.session());
  readonly isLoggedIn = computed(() => {
    const s = this.session();
    if (!s?.token) return false;
    // Proactively reject expired tokens without making a network request
    return !this.isTokenExpired(s.token);
  });

  constructor(private readonly http: HttpClient, private readonly router: Router) {}

  token(): string | null {
    const t = this.session()?.token ?? null;
    if (t && this.isTokenExpired(t)) {
      // Token expired — clear session silently
      this.clearSession();
      return null;
    }
    return t;
  }

  login(email: string, password: string) {
    return this.http.post<AuthResponse>(`${apiBase()}/api/auth/login`, { email, password }).pipe(
      tap((response) => this.store(response))
    );
  }

  register(payload: {
    name: string;
    email: string;
    password: string;
    farmName: string;
    farmLocation: string;
  }) {
    return this.http.post<AuthResponse>(`${apiBase()}/api/auth/register`, payload).pipe(
      tap((response) => this.store(response))
    );
  }

  logout() {
    this.clearSession();
    void this.router.navigate(['/']);
  }

  private store(response: AuthResponse) {
    // sessionStorage: survives page refresh but not tab close / new tab
    sessionStorage.setItem(TOKEN_KEY, response.token);
    sessionStorage.setItem(USER_KEY, JSON.stringify(response));
    this.session.set(response);
  }

  private clearSession() {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.session.set(null);
  }

  private readSession(): AuthResponse | null {
    try {
      const token = sessionStorage.getItem(TOKEN_KEY);
      const raw = sessionStorage.getItem(USER_KEY);
      if (!token || !raw) return null;
      if (this.isTokenExpired(token)) {
        // Don't restore an already-expired token on page refresh
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        return null;
      }
      return { ...JSON.parse(raw), token };
    } catch {
      return null;
    }
  }

  /**
   * Decodes the JWT payload (without verification — verification is done on the server).
   * Returns true if the token's `exp` claim is in the past.
   */
  private isTokenExpired(token: string): boolean {
    try {
      const payloadBase64 = token.split('.')[1];
      if (!payloadBase64) return true;
      const payload = JSON.parse(atob(payloadBase64));
      // `exp` is in seconds; Date.now() is in ms
      return typeof payload.exp === 'number' && payload.exp * 1000 < Date.now();
    } catch {
      return true; // Malformed token — treat as expired
    }
  }
}

