import { useEffect, useState, type FormEvent } from "react";
import type { AuthSession, BranchOption, PharmacyEmployee } from "../../shared/types";
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

function generatedAdminPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
  const values = new Uint32Array(18);
  crypto.getRandomValues(values);
  return Array.from(values, (value) => alphabet[value % alphabet.length]).join("");
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
  const [stage, setStage] = useState<"credentials" | "branches" | "admin-setup" | "profiles">("credentials");
  const [branches, setBranches] = useState<BranchOption[]>([]);
  const [ownerSession, setOwnerSession] = useState<AuthSession | null>(null);
  const [teamLoadError, setTeamLoadError] = useState<string | null>(null);
  const [ownerPassword, setOwnerPassword] = useState("");
  const [pharmacyId, setPharmacyId] = useState<string | null>(null);
  const [members, setMembers] = useState<PharmacyEmployee[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState<PharmacyEmployee | null>(null);
  const [employeePassword, setEmployeePassword] = useState("");
  const [adminName, setAdminName] = useState("ADMIN");
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminSetupBusy, setAdminSetupBusy] = useState(false);

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

  async function continueWithSession(nextSession: AuthSession, ownerPasswordValue: string) {
    if (nextSession.membership_role === "owner" && nextSession.branch_id) {
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
      setOwnerSession(nextSession);
      setOwnerPassword(ownerPasswordValue);
      setPassword("");
      setPharmacyId(nextSession.branch_id);
      setMembers(roster);
      const setupKey = `shifa-admin-setup:${nextSession.business_id ?? nextSession.branch_id}`;
      if (!localStorage.getItem(setupKey)) {
        setAdminName(roster.find((member) => member.user_id === nextSession.user_id)?.display_name || "ADMIN");
        setAdminEmail(nextSession.email ? nextSession.email.replace("@", "+admin@") : "");
        setAdminPassword(generatedAdminPassword());
        setStage("admin-setup");
      } else {
        setStage("profiles");
      }
      return;
    }
    setPassword("");
    onSignedIn(nextSession);
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const passwordValue = password;
      const res = await window.api.auth.signIn(email, passwordValue);
      if (!res.session) {
        setBranches(res.branches);
        setStage("branches");
        return;
      }
      await continueWithSession(res.session, passwordValue);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function chooseBranch(branchId: string) {
    setBusy(true);
    setError(null);
    try {
      const passwordValue = password;
      const res = await window.api.auth.selectBranch(branchId);
      if (!res.session) throw new Error("Choose a pharmacy branch to continue.");
      await continueWithSession(res.session, passwordValue);
    } catch (err) {
      setError(friendly(err));
    } finally {
      setBusy(false);
    }
  }

  async function completeAdminSetup() {
    if (!ownerSession || !pharmacyId || !adminName.trim() || !adminEmail.trim() || adminPassword.length < 8) {
      setError("Enter an administrator name, email, and strong password of at least 8 characters.");
      return;
    }
    setAdminSetupBusy(true);
    setError(null);
    try {
      await window.api.team.provisionAdmin({ email: adminEmail.trim(), password: adminPassword, display_name: adminName.trim() });
      localStorage.setItem(`shifa-admin-setup:${ownerSession.business_id ?? pharmacyId}`, "1");
      setStage("profiles");
    } catch (err) {
      setError(friendly(err));
    } finally {
      setAdminSetupBusy(false);
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
      if (!res.session) throw new Error("Choose a pharmacy branch before choosing an employee.");
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
      if (!res.session) throw new Error("Choose a pharmacy branch before choosing an employee.");
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
      setBranches([]);
      setOwnerSession(null);
      setTeamLoadError(null);
      setOwnerPassword("");
      setPharmacyId(null);
      setMembers([]);
      setSelectedEmployee(null);
      setEmployeePassword("");
      setAdminName("ADMIN");
      setAdminEmail("");
      setAdminPassword("");
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
      <form className="login-card" onSubmit={stage === "profiles" ? submitEmployee : stage === "admin-setup" ? (event) => { event.preventDefault(); void completeAdminSetup(); } : submit}>
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
        ) : stage === "admin-setup" ? (
          <>
            <div className="profile-picker-heading">
              <h2>Set up the pharmacy administrator</h2>
              <p>This one-time setup runs inside Shifa Pro. Rename the administrator if needed and keep the generated password somewhere secure.</p>
            </div>
            <label>
              Administrator name
              <input value={adminName} onChange={(event) => setAdminName(event.target.value)} autoFocus required />
            </label>
            <label>
              Administrator email
              <input type="email" value={adminEmail} onChange={(event) => setAdminEmail(event.target.value)} required />
            </label>
            <label>
              Administrator password
              <input type="text" value={adminPassword} onChange={(event) => setAdminPassword(event.target.value)} minLength={8} required />
            </label>
            <p className="hint">The password is shown only in this setup screen. It is not written to logs or displayed in chat.</p>
            {error && <div className="error">{error}</div>}
            <button type="submit" disabled={adminSetupBusy || adminPassword.length < 8}>
              {adminSetupBusy ? <><span className="spinner light" /> Saving…</> : "Save administrator setup"}
            </button>
            <button type="button" className="text-button" onClick={() => setAdminPassword(generatedAdminPassword())} disabled={adminSetupBusy}>
              Generate another password
            </button>
          </>
        ) : stage === "branches" ? (
          <>
            <div className="profile-picker-heading">
              <h2>Choose a branch</h2>
              <p>This account has access to more than one pharmacy branch. Select the branch on this computer.</p>
            </div>
            <div className="profile-picker">
              {branches.map((branch) => (
                <button type="button" className="profile-choice" key={branch.id} onClick={() => void chooseBranch(branch.id)} disabled={busy}>
                  <span className="profile-avatar admin-avatar">{(branch.branch_name || branch.name).trim().slice(0, 1).toUpperCase()}</span>
                  <span className="profile-copy">
                    <strong>{branch.branch_name || branch.name}</strong>
                    <span>{branch.name}{branch.branch_code ? ` · ${branch.branch_code}` : ""}</span>
                  </span>
                  <span className="profile-arrow">›</span>
                </button>
              ))}
            </div>
            {error && <div className="error">{error}</div>}
            <button type="button" className="text-button" onClick={() => void backToCredentials()} disabled={busy}>
              Back to sign in
            </button>
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
