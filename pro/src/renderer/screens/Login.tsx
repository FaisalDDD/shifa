import { useEffect, useState, type FormEvent } from "react";
import type { AuthSession, PharmacyEmployee } from "../../shared/types";
import { makeT, type Lang } from "../i18n";

function friendly(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const m = raw.trim();
  if (/invalid login|invalid authentication|invalid credentials/i.test(m))
    return "Incorrect email or password.";
  if (/weak.?password/i.test(m)) return "That password is too weak.";
  if (/already registered|already exists|user_already/i.test(m))
    return "An account with this email already exists.";
  if (/failed to fetch|fetch failed|networkerror|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|net::ERR/i.test(m))
    return "Can't reach this Supabase server. Check the connection settings below and try again.";
  if (/[{}]/.test(m) || /\bat\s+/i.test(m) || /error_code|status.?code/i.test(m))
    return "Something went wrong. Please try again.";
  if (m.length > 140) return "Something went wrong. Please try again.";
  return m;
}

export function Login({
  onSignedIn,
  lang,
}: {
  onSignedIn: (s: AuthSession) => void;
  lang: Lang;
}) {
  const t = makeT(lang);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showConnection, setShowConnection] = useState(false);
  const [backendUrl, setBackendUrl] = useState("");
  const [anonKey, setAnonKey] = useState("");
  const [connectionSaved, setConnectionSaved] = useState(false);
  const [stage, setStage] = useState<"credentials" | "profiles">("credentials");
  const [ownerSession, setOwnerSession] = useState<AuthSession | null>(null);
  const [teamLoadError, setTeamLoadError] = useState<string | null>(null);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [members, setMembers] = useState<PharmacyEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<PharmacyEmployee | null>(null);
  const [employeePassword, setEmployeePassword] = useState("");

  useEffect(() => {
    window.api.settings.getBackend().then((config) => {
      setBackendUrl(config.url);
      setAnonKey(config.anonKey);
    }).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!error) return;
    const tId = setTimeout(() => setError(null), 5000);
    return () => clearTimeout(tId);
  }, [error]);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await window.api.auth.signIn(email, password);
      if (res.session.membership_role === "owner" && res.pharmacyId) {
        let roster: PharmacyEmployee[] = [];
        try {
          roster = await window.api.team.list();
          setTeamLoadError(null);
        } catch (teamError) {
          const detail = friendly(teamError);
          setTeamLoadError(
            /\b503\b/.test(detail)
              ? "Your account is signed in, but Shifa's pharmacy team service returned HTTP 503. You can continue as Pharmacy admin; employee profiles will appear when the team service is available."
              : `Your account is signed in, but the employee list could not be loaded. ${detail} You can continue as Pharmacy admin.`,
          );
        }
        setOwnerSession(res.session);
        setOwnerPassword(password);
        setPassword("");
        setPharmacyId(res.pharmacyId);
        setMembers(roster);
        setStage("profiles");
        return;
      }
      setPassword("");
      onSignedIn(res.session);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function retryTeamList() {
    if (!ownerSession) return;
    setBusy(true);
    try {
      setMembers(await window.api.team.list());
      setTeamLoadError(null);
    } catch (err) {
      const detail = friendly(err);
      setTeamLoadError(
        /\b503\b/.test(detail)
          ? "Shifa's pharmacy team service is still returning HTTP 503. You can continue as Pharmacy admin."
          : `The employee list could not be loaded. ${detail}`,
      );
    } finally {
      setBusy(false);
    }
  }

  function chooseAdmin() {
    if (!ownerSession) return;
    setOwnerPassword("");
    onSignedIn(ownerSession);
  }

  function validateEmployeeSession(
    session: AuthSession,
    nextPharmacyId: string | null,
    employee: PharmacyEmployee,
  ) {
    if (
      session.user_id !== employee.user_id ||
      session.membership_role !== "staff" ||
      nextPharmacyId !== pharmacyId
    ) {
      throw new Error("This employee account is not linked to the selected test pharmacy.");
    }
  }

  async function selectEmployee(employee: PharmacyEmployee) {
    if (!employee.email) {
      setError("This employee profile does not have a sign-in email yet.");
      return;
    }
    setBusy(true);
    setError(null);
    setSelectedEmployee(employee);
    try {
      const res = await window.api.auth.signIn(employee.email, ownerPassword);
      validateEmployeeSession(res.session, res.pharmacyId, employee);
      setOwnerPassword("");
      setPassword("");
      onSignedIn(res.session);
    } catch (err) {
      const raw = err instanceof Error ? err.message : String(err);
      if (/invalid login|invalid authentication|invalid credentials/i.test(raw)) {
        setEmployeePassword("");
        setError("Enter this employee's password to continue. The demo profiles use the same test password.");
      } else {
        setError(friendly(err));
      }
    } finally {
      setBusy(false);
    }
  }

  async function submitEmployee(e: FormEvent) {
    e.preventDefault();
    if (!selectedEmployee?.email) return;
    setBusy(true);
    setError(null);
    try {
      const res = await window.api.auth.signIn(selectedEmployee.email, employeePassword);
      validateEmployeeSession(res.session, res.pharmacyId, selectedEmployee);
      setOwnerPassword("");
      setPassword("");
      setEmployeePassword("");
      onSignedIn(res.session);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function backToCredentials() {
    setBusy(true);
    setError(null);
    try {
      await window.api.auth.signOut();
      setStage("credentials");
      setPassword("");
      setOwnerSession(null);
      setTeamLoadError(null);
      setOwnerPassword("");
      setPharmacyId(null);
      setMembers([]);
      setSelectedEmployee(null);
      setEmployeePassword("");
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function saveConnection() {
    setError(null);
    setConnectionSaved(false);
    if (!anonKey.trim()) {
      setError("Start local Supabase, then paste its public anon key here. Run `supabase status -o env` from the medfind folder and copy SUPABASE_ANON_KEY; do not use SUPABASE_SERVICE_ROLE_KEY.");
      return;
    }
    try {
      const config = await window.api.settings.setBackend({ url: backendUrl, anonKey });
      setBackendUrl(config.url);
      setConnectionSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the server connection.");
    }
  }

  return (
    <div className="login">
      <form className="login-card" onSubmit={stage === "credentials" ? submit : submitEmployee}>
        <div className="brand">
          <img className="brand-logo" src="./logo.png" alt="Shifa" />
          <div>
            <h1>{t("app.name")}</h1>
            <p>{t("app.tagline")}</p>
          </div>
        </div>

        {stage === "credentials" ? (
          <>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@pharmacy.com"
                autoFocus
                required
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </label>

            {error && <div className="error">{error}</div>}

            <button type="submit" disabled={busy}>
              {busy ? <><span className="spinner light" /> {t("sale.processing")}</> : "Sign in"}
            </button>

            <button type="button" className="text-button" onClick={() => setShowConnection((v) => !v)}>
              {showConnection ? "Hide server connection" : "Server connection"}
            </button>
            {showConnection && (
              <div className="connection-settings">
                <p>Connect this app to the Supabase project that holds your Shifa accounts. A fresh local build uses local Supabase and will not connect to a hosted project automatically.</p>
                <label>
                  Supabase project URL
                  <input type="url" value={backendUrl} onChange={(e) => setBackendUrl(e.target.value)} placeholder="http://127.0.0.1:54321" required />
                </label>
                <label>
                  Public anon / publishable key
                  <input type="password" value={anonKey} onChange={(e) => setAnonKey(e.target.value)} autoComplete="off" required />
                </label>
                <button type="button" className="secondary-button" onClick={() => { setBackendUrl("http://127.0.0.1:54321"); setAnonKey(""); setConnectionSaved(false); setError(null); }}>
                  Use local Supabase
                </button>
                <button type="button" className="secondary-button" onClick={() => void saveConnection()} disabled={!backendUrl.trim() || !anonKey.trim()}>
                  Save connection
                </button>
                {connectionSaved && <p className="connection-saved">Connection saved on this computer.</p>}
                <p className="hint">For local testing, start Docker Desktop, run <code>supabase start</code> in the medfind folder, then copy <code>SUPABASE_ANON_KEY</code> from <code>supabase status -o env</code> into this field. Create the demo logins with <code>npm run db:seed-local-users</code>. Never enter <code>SUPABASE_SERVICE_ROLE_KEY</code> here.</p>
              </div>
            )}

            <p className="hint">
              Uses your Shifa account. Sales work offline and sync when you're back online.
            </p>
          </>
        ) : (
          <>
            <div className="profile-picker-heading">
              <h2>Choose a profile</h2>
              <p>Select who is using this pharmacy workstation.</p>
            </div>
            {teamLoadError && (
              <div className="team-service-warning" role="status">
                <p>{teamLoadError}</p>
                <button type="button" onClick={() => void retryTeamList()} disabled={busy}>Retry employee list</button>
              </div>
            )}
            <div className="profile-picker">
              {ownerSession && (
                <button type="button" className="profile-choice" onClick={chooseAdmin} disabled={busy}>
                  <span className="profile-avatar admin-avatar">A</span>
                  <span className="profile-copy">
                    <strong>Pharmacy admin</strong>
                    <span>{ownerSession.email ?? email}</span>
                  </span>
                  <span className="profile-arrow">›</span>
                </button>
              )}
              {members.filter((member) => member.membership_role === "staff").map((member) => (
                <button
                  type="button"
                  className="profile-choice"
                  key={member.user_id}
                  onClick={() => void selectEmployee(member)}
                  disabled={busy || !member.email}
                >
                  <span className="profile-avatar employee-avatar">{(member.display_name || "E").trim().slice(0, 1).toUpperCase()}</span>
                  <span className="profile-copy">
                    <strong>{member.display_name || "Employee"}</strong>
                    <span>{member.email || "No sign-in email"}</span>
                  </span>
                  <span className="profile-arrow">›</span>
                </button>
              ))}
            </div>
            {selectedEmployee && (
              <div className="employee-password">
                <p>Sign in as <strong>{selectedEmployee.display_name || selectedEmployee.email}</strong></p>
                <label>
                  Employee password
                  <input
                    type="password"
                    value={employeePassword}
                    onChange={(e) => setEmployeePassword(e.target.value)}
                    autoFocus
                    required
                  />
                </label>
                <button type="submit" disabled={busy || !employeePassword}>
                  {busy ? <><span className="spinner light" /> {t("sale.processing")}</> : "Continue as employee"}
                </button>
              </div>
            )}
            {error && <div className="error">{error}</div>}
            <button type="button" className="text-button" onClick={() => void backToCredentials()} disabled={busy}>
              Back to sign in
            </button>
          </>
        )}
      </form>
    </div>
  );
}
