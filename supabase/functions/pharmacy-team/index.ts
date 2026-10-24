import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});
const validTime = (value: unknown): value is string =>
  typeof value === "string" && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d)?$/.test(value);
const validDate = (value: unknown): value is string => {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const dateOffset = (value: string, days: number) => {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const timeMinutes = (value: string) => {
  const [hour, minute] = value.slice(0, 5).split(":").map(Number);
  return hour * 60 + minute;
};
const interval = (date: string, start: string, end: string) => {
  const base = Date.parse(`${date}T00:00:00Z`) / 60000;
  const startAt = base + timeMinutes(start);
  let endAt = base + timeMinutes(end);
  if (endAt <= startAt) endAt += 1440;
  return { startAt, endAt };
};
const rangesOverlap = (a: { startAt: number; endAt: number }, b: { startAt: number; endAt: number }) =>
  a.startAt < b.endAt && a.endAt > b.startAt;

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return reply(405, { error: "Method not allowed." });
  const authorization = request.headers.get("Authorization");
  if (!authorization?.startsWith("Bearer ")) return reply(401, { error: "Sign in is required." });

  const url = Deno.env.get("SUPABASE_URL");
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !anonKey || !serviceKey) return reply(500, { error: "Team service is not configured." });

  const caller = createClient(url, anonKey, {
    global: { headers: { Authorization: authorization } }, auth: { persistSession: false },
  });
  const { data: { user }, error: authError } = await caller.auth.getUser();
  if (authError || !user) return reply(401, { error: "Your session is invalid or expired." });
  let body: Record<string, unknown>;
  try { body = await request.json(); } catch { return reply(400, { error: "Invalid request body." }); }

  const pharmacyId = typeof body.pharmacy_id === "string" ? body.pharmacy_id : "";
  const action = typeof body.action === "string" ? body.action : "";
  if (!pharmacyId) return reply(400, { error: "Choose a pharmacy." });
  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  const { data: membership, error: memberError } = await admin.from("pharmacy_members")
    .select("membership_role").eq("pharmacy_id", pharmacyId).eq("user_id", user.id).maybeSingle();
  if (memberError) return reply(500, { error: "Could not verify pharmacy access." });
  if (!membership) return reply(403, { error: "You are not a member of this pharmacy." });
  const isOwner = membership.membership_role === "owner";
  const memberActions = new Set([
    "check_access", "my_shifts", "my_leaves", "create_leave", "list_notifications", "mark_notification_read",
    "clock_event", "list_attendance", "request_time_correction", "get_workforce_settings", "respond_leave", "withdraw_leave",
    "list_swap_targets", "list_swap_requests", "create_swap_request",
  ]);
  if (!isOwner && !memberActions.has(action)) {
    return reply(403, { error: "Only the pharmacy owner can manage this team." });
  }

  const audit = async (event: {
    action: string; entity_type: string; entity_id?: string | null; metadata?: Record<string, unknown>;
  }) => {
    const { error } = await admin.from("pharmacy_hr_audit_events").insert({
      pharmacy_id: pharmacyId, actor_user_id: user.id, action: event.action,
      entity_type: event.entity_type, entity_id: event.entity_id ?? null, metadata: event.metadata ?? {},
    });
    if (error) throw new Error("The update was saved, but its audit record could not be written.");
  };
  const notify = async (input: {
    recipient_user_id: string; event_type: string; title: string; body: string;
    entity_type?: string; entity_id?: string | null;
  }) => {
    const { error } = await admin.from("pharmacy_hr_notifications").insert({
      pharmacy_id: pharmacyId, ...input, entity_id: input.entity_id ?? null,
    });
    if (error) throw new Error("The update was saved, but its in-app notification could not be queued.");
  };
  const notifyOwners = async (input: { event_type: string; title: string; body: string; entity_type?: string; entity_id?: string }) => {
    const { data, error } = await admin.from("pharmacy_members").select("user_id")
      .eq("pharmacy_id", pharmacyId).eq("membership_role", "owner");
    if (error) throw new Error("Could not load pharmacy approvers.");
    for (const owner of data ?? []) await notify({ ...input, recipient_user_id: owner.user_id });
  };

  if (action === "check_access") {
    const { data, error } = await admin.from("pharmacy_staff_settings")
      .select("employment_status").eq("pharmacy_id", pharmacyId).eq("employee_user_id", user.id).maybeSingle();
    if (error) return reply(500, { error: "Could not verify your employee status." });
    return reply(200, { employment_status: data?.employment_status ?? "active" });
  }

  if (action === "list_team") {
    const { data, error } = await admin.from("pharmacy_members")
      .select("user_id,membership_role,created_at,profiles(display_name,email)")
      .eq("pharmacy_id", pharmacyId).order("created_at");
    if (error) return reply(500, { error: "Could not load pharmacy team." });
    const members = data ?? [];
    const { data: settings, error: settingsError } = await admin.from("pharmacy_staff_settings")
      .select("employee_user_id,employee_code,display_name,job_title,display_color,avatar_data_url,weekly_target_hours,working_days,shift_start,shift_end,employment_status,department,location,manager_user_id,contract_type,start_date,end_date")
      .eq("pharmacy_id", pharmacyId);
    if (settingsError) return reply(500, { error: "Could not load staff profiles. Apply the workforce management migration first." });
    const settingsByUser = new Map((settings ?? []).map((row) => [row.employee_user_id, row]));
    return reply(200, { members: members.map((member) => ({
      ...member, ...(settingsByUser.get(member.user_id) ?? {}),
      display_name: settingsByUser.get(member.user_id)?.display_name ?? member.profiles?.display_name ?? null,
    })) });
  }

  if (action === "provision_initial_admin") {
    const email = typeof body.admin_email === "string" ? body.admin_email.trim().toLowerCase() : "";
    const password = typeof body.admin_password === "string" ? body.admin_password : "";
    const displayName = typeof body.display_name === "string" ? body.display_name.trim().slice(0, 100) : "ADMIN";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "Enter a valid administrator email." });
    if (password.length < 8 || password.length > 128) return reply(400, { error: "Administrator password must be 8 to 128 characters." });
    const { data: branch, error: branchError } = await admin.from("pharmacies").select("business_id").eq("id", pharmacyId).maybeSingle();
    if (branchError || !branch?.business_id) return reply(500, { error: "Could not identify the pharmacy business." });
    const { data: existingAdmin, error: existingError } = await admin.from("pharmacy_business_members")
      .select("user_id").eq("business_id", branch.business_id).eq("membership_role", "admin").limit(1);
    if (existingError) return reply(500, { error: "Could not check administrator setup." });
    if (existingAdmin?.length) return reply(409, { error: "This pharmacy business already has an administrator account." });
    const { data: createdAdmin, error: createError } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: displayName, account_type: "pharmacy_admin", business_id: branch.business_id } });
    if (createError || !createdAdmin.user) return reply(400, { error: createError?.message ?? "Could not create the administrator account." });
    const adminUserId = createdAdmin.user.id;
    const { error: profileError } = await admin.from("profiles").update({ display_name: displayName, email, role: "pharmacy_staff" }).eq("id", adminUserId);
    if (profileError) return reply(500, { error: "Administrator account was created, but its profile could not be initialized." });
    const { error: businessMemberError } = await admin.from("pharmacy_business_members").insert({ business_id: branch.business_id, user_id: adminUserId, membership_role: "admin" });
    if (businessMemberError) return reply(500, { error: "Administrator account was created, but business access could not be initialized." });
    const { data: branches, error: branchesError } = await admin.from("pharmacies").select("id").eq("business_id", branch.business_id);
    if (branchesError) return reply(500, { error: "Administrator account was created, but branch access could not be initialized." });
    if ((branches ?? []).length) {
      const { error: branchMembershipError } = await admin.from("pharmacy_members").upsert(
        (branches ?? []).map((item) => ({ pharmacy_id: item.id, user_id: adminUserId, membership_role: "owner" })),
        { onConflict: "pharmacy_id,user_id" },
      );
      if (branchMembershipError) return reply(500, { error: "Administrator account was created, but branch access could not be initialized." });
    }
    await audit({ action: "administrator.provisioned", entity_type: "business_admin", entity_id: adminUserId, metadata: { business_id: branch.business_id, email } });
    return reply(200, { provisioned: true, user_id: adminUserId, email, display_name: displayName });
  }

  if (action === "invite") {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(400, { error: "Enter a valid employee email." });
    const webUrl = Deno.env.get("SHIFA_WEB_URL")?.replace(/\/$/, "");
    if (!webUrl) return reply(500, { error: "Set the SHIFA_WEB_URL function secret before sending employee invitations." });
    const redirectTo = `${webUrl}/auth/callback?next=%2Fauth%2Faccept-invite`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo, data: { account_type: "pharmacy_employee", pharmacy_id: pharmacyId },
    });
    if (error || !data.user) return reply(400, { error: error?.message ?? "Could not invite employee." });
    const { error: insertError } = await admin.from("pharmacy_members").upsert({
      pharmacy_id: pharmacyId, user_id: data.user.id, membership_role: "staff",
    }, { onConflict: "pharmacy_id,user_id" });
    if (insertError) return reply(500, { error: "Invite sent, but team membership could not be created." });
    await audit({ action: "employee.invited", entity_type: "employee", entity_id: data.user.id, metadata: { email } });
    await notify({ recipient_user_id: user.id, event_type: "employee.invited", title: "Invitation sent", body: `An invitation was sent to ${email}.`, entity_type: "employee", entity_id: data.user.id });
    return reply(200, { invited: true, user_id: data.user.id, email });
  }

  if (action === "remove") {
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    if (!userId || userId === user.id) return reply(400, { error: "Choose an employee, not the owner." });
    const today = new Date().toISOString().slice(0, 10);
    const { data: futureShifts, error: shiftError } = await admin.from("pharmacy_shifts")
      .select("id").eq("pharmacy_id", pharmacyId).eq("employee_user_id", userId)
      .gte("shift_date", today).in("status", ["draft", "published"]);
    if (shiftError) return reply(500, { error: "Could not check the employee's future shifts." });
    if (futureShifts?.length) return reply(409, { error: `Reassign or cancel ${futureShifts.length} future shift(s) before deactivating this employee.` });
    const { error } = await admin.from("pharmacy_staff_settings").update({ employment_status: "deactivated", end_date: today })
      .eq("pharmacy_id", pharmacyId).eq("employee_user_id", userId);
    if (error) return reply(400, { error: "Could not deactivate this employee." });
    await audit({ action: "employee.deactivated", entity_type: "employee", entity_id: userId });
    await notify({ recipient_user_id: userId, event_type: "employee.deactivated", title: "Pharmacy access changed", body: "Your pharmacy employment record has been deactivated. Contact the pharmacy administrator if this is unexpected.", entity_type: "employee", entity_id: userId });
    return reply(200, { removed: true, deactivated: true });
  }

  if (["list_shifts", "my_shifts"].includes(action)) {
    const month = typeof body.month === "string" ? body.month : "";
    let query = admin.from("pharmacy_shifts")
      .select("id,employee_user_id,shift_date,start_time,end_time,notes,status,location,role_label,break_minutes,timezone,published_at,profiles!pharmacy_shifts_employee_user_id_fkey(display_name,email)")
      .eq("pharmacy_id", pharmacyId).order("shift_date").order("start_time");
    if (month) {
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return reply(400, { error: "Invalid month." });
      const nextMonth = dateOffset(`${month}-01`, 32).slice(0, 7) + "-01";
      query = query.gte("shift_date", `${month}-01`).lt("shift_date", nextMonth);
    }
    if (action === "my_shifts") query = query.eq("employee_user_id", user.id).eq("status", "published");
    if (action === "list_shifts" && typeof body.status === "string" && body.status !== "all") query = query.eq("status", body.status);
    const { data, error } = await query;
    if (error) return reply(500, { error: "Could not load shifts." });
    return reply(200, { shifts: data ?? [] });
  }

  if (action === "save_shift") {
    const shift = body.shift as Record<string, unknown> | undefined;
    const id = typeof shift?.id === "string" ? shift.id : "";
    const employeeId = typeof shift?.employee_user_id === "string" ? shift.employee_user_id : "";
    const date = shift?.shift_date;
    const start = shift?.start_time;
    const end = shift?.end_time;
    const breakMinutes = Number(shift?.break_minutes ?? 0);
    if (!employeeId || !validDate(date) || !validTime(start) || !validTime(end)
      || String(start).slice(0, 5) === String(end).slice(0, 5)
      || !Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 600) {
      return reply(400, { error: "Choose an employee, date, and valid start, end, and break times." });
    }
    const { data: employee, error: employeeError } = await admin.from("pharmacy_members").select("membership_role")
      .eq("pharmacy_id", pharmacyId).eq("user_id", employeeId).maybeSingle();
    if (employeeError || !employee || employee.membership_role !== "staff") return reply(400, { error: "Choose an active pharmacy employee." });
    const { data: employeeSettings, error: settingsError } = await admin.from("pharmacy_staff_settings")
      .select("employment_status").eq("pharmacy_id", pharmacyId).eq("employee_user_id", employeeId).maybeSingle();
    if (settingsError || employeeSettings?.employment_status !== "active") return reply(409, { error: "Only active employees can be scheduled." });
    const newRange = interval(date, start, end);
    const { data: nearby, error: nearbyError } = await admin.from("pharmacy_shifts")
      .select("id,shift_date,start_time,end_time").eq("pharmacy_id", pharmacyId)
      .eq("employee_user_id", employeeId).in("status", ["draft", "published"])
      .gte("shift_date", dateOffset(date, -1)).lte("shift_date", dateOffset(date, 1));
    if (nearbyError) return reply(500, { error: "Could not check schedule conflicts." });
    if ((nearby ?? []).some((other) => other.id !== id && rangesOverlap(newRange, interval(other.shift_date, other.start_time, other.end_time)))) {
      return reply(409, { error: "This employee already has an overlapping shift, including an overnight shift." });
    }
    const affectedThrough = newRange.endAt > Date.parse(`${dateOffset(date, 1)}T00:00:00Z`) / 60000 ? dateOffset(date, 1) : date;
    const { data: leave, error: leaveError } = await admin.from("pharmacy_leave_requests").select("id")
      .eq("pharmacy_id", pharmacyId).eq("employee_user_id", employeeId).eq("status", "approved")
      .lte("start_date", affectedThrough).gte("end_date", date);
    if (leaveError) return reply(500, { error: "Could not check approved leave." });
    if (leave?.length) return reply(409, { error: "This shift overlaps the employee's approved leave." });

    const fields = {
      pharmacy_id: pharmacyId, employee_user_id: employeeId, shift_date: date,
      start_time: String(start).slice(0, 5), end_time: String(end).slice(0, 5),
      notes: typeof shift.notes === "string" ? shift.notes.trim().slice(0, 300) || null : null,
      location: typeof shift.location === "string" ? shift.location.trim().slice(0, 100) || null : null,
      role_label: typeof shift.role_label === "string" ? shift.role_label.trim().slice(0, 80) || null : null,
      break_minutes: breakMinutes,
      timezone: typeof shift.timezone === "string" ? shift.timezone.slice(0, 80) : "Africa/Khartoum",
      status: "draft",
      published_at: null,
      published_by: null,
    };
    let saved;
    let error;
    if (id) {
      ({ data: saved, error } = await admin.from("pharmacy_shifts").update(fields).eq("pharmacy_id", pharmacyId).eq("id", id)
        .select("id,employee_user_id,shift_date,start_time,end_time,notes,status,location,role_label,break_minutes,timezone").maybeSingle());
      if (!error && !saved) return reply(404, { error: "This shift no longer exists." });
    } else {
      ({ data: saved, error } = await admin.from("pharmacy_shifts").insert({ ...fields, created_by: user.id })
        .select("id,employee_user_id,shift_date,start_time,end_time,notes,status,location,role_label,break_minutes,timezone").single());
    }
    if (error) return reply(400, { error: error.code === "23505" ? "A shift already exists for this employee at that time." : error.message });
    await audit({ action: id ? "shift.edited" : "shift.created", entity_type: "shift", entity_id: saved.id, metadata: { employee_user_id: employeeId, status: "draft" } });
    return reply(200, { shift: saved });
  }

  if (action === "delete_shift") {
    const shiftId = typeof body.shift_id === "string" ? body.shift_id : "";
    if (!shiftId) return reply(400, { error: "Choose a shift to cancel." });
    const { data: shift, error: getError } = await admin.from("pharmacy_shifts")
      .select("id,employee_user_id,shift_date,status").eq("pharmacy_id", pharmacyId).eq("id", shiftId).maybeSingle();
    if (getError || !shift) return reply(404, { error: "This shift no longer exists." });
    const { error } = await admin.from("pharmacy_shifts").update({ status: "cancelled" })
      .eq("pharmacy_id", pharmacyId).eq("id", shiftId);
    if (error) return reply(400, { error: error.message });
    await audit({ action: "shift.cancelled", entity_type: "shift", entity_id: shiftId });
    if (shift.status === "published") await notify({ recipient_user_id: shift.employee_user_id, event_type: "shift.cancelled", title: "Shift cancelled", body: `Your shift on ${shift.shift_date} was cancelled by the pharmacy administrator.`, entity_type: "shift", entity_id: shiftId });
    return reply(200, { deleted: true, cancelled: true });
  }

  if (action === "set_schedule_state") {
    const startDate = body.start_date;
    const endDate = body.end_date;
    const nextState = body.state;
    if (!validDate(startDate) || !validDate(endDate) || endDate < startDate || !["published", "draft"].includes(String(nextState))) {
      return reply(400, { error: "Choose a valid date range and schedule state." });
    }
    const fromStatus = nextState === "published" ? "draft" : "published";
    const { data: targets, error: targetError } = await admin.from("pharmacy_shifts")
      .select("id,employee_user_id,shift_date,start_time,end_time").eq("pharmacy_id", pharmacyId)
      .eq("status", fromStatus).gte("shift_date", startDate).lte("shift_date", endDate);
    if (targetError) return reply(500, { error: "Could not load the schedule to update." });
    if (!targets?.length) return reply(200, { updated: 0, state: nextState });
    if (nextState === "published") {
      for (const shift of targets) {
        const finishDate = timeMinutes(shift.end_time) <= timeMinutes(shift.start_time) ? dateOffset(shift.shift_date, 1) : shift.shift_date;
        const { data: conflict, error } = await admin.from("pharmacy_leave_requests").select("id")
          .eq("pharmacy_id", pharmacyId).eq("employee_user_id", shift.employee_user_id).eq("status", "approved")
          .lte("start_date", finishDate).gte("end_date", shift.shift_date).limit(1);
        if (error) return reply(500, { error: "Could not verify approved leave before publishing." });
        if (conflict?.length) return reply(409, { error: `Resolve the approved-leave conflict on ${shift.shift_date} before publishing the schedule.` });
      }
    }
    const changes = nextState === "published"
      ? { status: "published", published_at: new Date().toISOString(), published_by: user.id }
      : { status: "draft", published_at: null, published_by: null };
    const ids = targets.map((shift) => shift.id);
    const { error } = await admin.from("pharmacy_shifts").update(changes).eq("pharmacy_id", pharmacyId).in("id", ids);
    if (error) return reply(500, { error: "Could not update the schedule." });
    const byEmployee = new Map<string, typeof targets>();
    for (const shift of targets) byEmployee.set(shift.employee_user_id, [...(byEmployee.get(shift.employee_user_id) ?? []), shift]);
    for (const [employeeId, employeeShifts] of byEmployee) {
      const title = nextState === "published" ? "Schedule published" : "Schedule changed";
      const bodyText = nextState === "published"
        ? `${employeeShifts.length} shift(s) are now confirmed for ${startDate} to ${endDate}.`
        : `${employeeShifts.length} shift(s) from ${startDate} to ${endDate} were returned to draft.`;
      await notify({ recipient_user_id: employeeId, event_type: nextState === "published" ? "schedule.published" : "schedule.unpublished", title, body: bodyText, entity_type: "schedule" });
    }
    await audit({ action: nextState === "published" ? "schedule.published" : "schedule.unpublished", entity_type: "schedule", metadata: { start_date: startDate, end_date: endDate, shift_count: targets.length } });
    return reply(200, { updated: targets.length, state: nextState });
  }

  if (action === "save_staff_settings") {
    const userId = typeof body.user_id === "string" ? body.user_id : "";
    const settings = body.staff_settings as Record<string, unknown> | undefined;
    if (!userId || !settings) return reply(400, { error: "Choose an employee and provide their settings." });
    const { data: employee, error: employeeError } = await admin.from("pharmacy_members").select("membership_role")
      .eq("pharmacy_id", pharmacyId).eq("user_id", userId).maybeSingle();
    if (employeeError || !employee) return reply(400, { error: "That employee is not part of this pharmacy." });
    const days = Array.isArray(settings.working_days)
      ? [...new Set(settings.working_days.filter((day): day is number => typeof day === "number" && Number.isInteger(day) && day >= 1 && day <= 7))]
      : [];
    const color = typeof settings.display_color === "string" ? settings.display_color : "";
    const avatar = settings.avatar_data_url === null ? null : settings.avatar_data_url;
    const weeklyHours = Number(settings.weekly_target_hours);
    const displayName = typeof settings.display_name === "string" ? settings.display_name.trim() : "";
    const jobTitle = typeof settings.job_title === "string" ? settings.job_title.trim() : "";
    const employmentStatus = typeof settings.employment_status === "string" ? settings.employment_status : "active";
    const department = typeof settings.department === "string" ? settings.department.trim() : "";
    const location = typeof settings.location === "string" ? settings.location.trim() : "";
    const contractType = typeof settings.contract_type === "string" ? settings.contract_type.trim() : "";
    const startDate = settings.start_date === null || settings.start_date === "" ? null : settings.start_date;
    const endDate = settings.end_date === null || settings.end_date === "" ? null : settings.end_date;
    if (displayName.length > 100 || jobTitle.length > 60 || !/^#[0-9a-fA-F]{6}$/.test(color)
      || !Number.isFinite(weeklyHours) || weeklyHours < 0 || weeklyHours > 80 || days.length === 0
      || !validTime(settings.shift_start) || !validTime(settings.shift_end)
      || String(settings.shift_start).slice(0, 5) >= String(settings.shift_end).slice(0, 5)
      || !["active", "on_leave", "suspended", "deactivated"].includes(employmentStatus)
      || department.length > 80 || location.length > 100 || contractType.length > 60
      || (startDate !== null && !validDate(startDate)) || (endDate !== null && !validDate(endDate))
      || (startDate && endDate && endDate < startDate)
      || (employee.membership_role === "owner" && employmentStatus !== "active")) {
      return reply(400, { error: "Check the employee name, role, status, department, location, working days, hours, and dates." });
    }
    if (settings.manager_user_id) {
      const { data: manager } = await admin.from("pharmacy_members").select("user_id")
        .eq("pharmacy_id", pharmacyId).eq("user_id", settings.manager_user_id).maybeSingle();
      if (!manager) return reply(400, { error: "Choose a manager from this pharmacy." });
    }
    if (avatar !== null && (typeof avatar !== "string"
      || !/^data:image\/(png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(avatar) || avatar.length > 400000)) {
      return reply(400, { error: "Employee photo must be a small PNG, JPEG, or WebP image." });
    }
    if (employmentStatus !== "active") {
      const today = new Date().toISOString().slice(0, 10);
      const { data: future, error } = await admin.from("pharmacy_shifts").select("id")
        .eq("pharmacy_id", pharmacyId).eq("employee_user_id", userId).gte("shift_date", today).in("status", ["draft", "published"]);
      if (error) return reply(500, { error: "Could not check the employee's future shifts." });
      if (future?.length) return reply(409, { error: `Cancel or reassign ${future.length} future shift(s) before changing this employee's status.` });
    }
    const { data, error } = await admin.from("pharmacy_staff_settings").upsert({
      pharmacy_id: pharmacyId, employee_user_id: userId,
      display_name: displayName || null, job_title: jobTitle || "Pharmacy staff",
      display_color: color, avatar_data_url: avatar, weekly_target_hours: weeklyHours,
      working_days: days, shift_start: settings.shift_start, shift_end: settings.shift_end,
      employment_status: employmentStatus, department: department || null, location: location || null,
      manager_user_id: typeof settings.manager_user_id === "string" && settings.manager_user_id ? settings.manager_user_id : null,
      contract_type: contractType || null, start_date: startDate, end_date: endDate,
    }, { onConflict: "pharmacy_id,employee_user_id" })
      .select("employee_user_id,employee_code,display_name,job_title,display_color,avatar_data_url,weekly_target_hours,working_days,shift_start,shift_end,employment_status,department,location,manager_user_id,contract_type,start_date,end_date")
      .single();
    if (error) return reply(400, { error: error.message });
    await audit({ action: "employee.profile_updated", entity_type: "employee", entity_id: userId, metadata: { employment_status: employmentStatus, department: department || null, location: location || null } });
    return reply(200, { settings: data });
  }

  if (["list_leaves", "my_leaves"].includes(action)) {
    let query = admin.from("pharmacy_leave_requests")
      .select("id,employee_user_id,leave_type,start_date,end_date,reason,status,review_reason,reviewed_at,created_at,profiles!pharmacy_leave_requests_employee_user_id_fkey(display_name,email)")
      .eq("pharmacy_id", pharmacyId).order("start_date", { ascending: false }).order("created_at", { ascending: false });
    if (action === "my_leaves") query = query.eq("employee_user_id", user.id);
    const { data, error } = await query;
    if (error) return reply(500, { error: "Could not load leave requests. Apply the workforce management migration first." });
    return reply(200, { leaves: data ?? [] });
  }

  if (action === "create_leave") {
    const leave = body.leave as Record<string, unknown> | undefined;
    if (!leave || !["sick", "annual", "personal", "unpaid", "family"].includes(String(leave.leave_type))
      || !validDate(leave.start_date) || !validDate(leave.end_date) || leave.end_date < leave.start_date) {
      return reply(400, { error: "Choose a leave type and valid start and end dates." });
    }
    const employeeUserId = isOwner && typeof leave.employee_user_id === "string" ? leave.employee_user_id : user.id;
    if (!isOwner && leave.employee_user_id && leave.employee_user_id !== user.id) return reply(403, { error: "Employees can only request leave for themselves." });
    const { data: employee, error: employeeError } = await admin.from("pharmacy_members").select("membership_role")
      .eq("pharmacy_id", pharmacyId).eq("user_id", employeeUserId).maybeSingle();
    if (employeeError || !employee || employee.membership_role !== "staff") return reply(400, { error: "Choose an active pharmacy employee." });
    const reason = typeof leave.reason === "string" ? leave.reason.trim().slice(0, 500) : null;
    const { data, error } = await admin.from("pharmacy_leave_requests").insert({
      pharmacy_id: pharmacyId, employee_user_id: employeeUserId, leave_type: leave.leave_type,
      start_date: leave.start_date, end_date: leave.end_date, reason: reason || null,
    }).select("id,employee_user_id,leave_type,start_date,end_date,reason,status,review_reason,reviewed_at,created_at").single();
    if (error) return reply(400, { error: error.message });
    const { data: profile } = await admin.from("profiles").select("display_name,email").eq("id", employeeUserId).maybeSingle();
    const employeeName = profile?.display_name || profile?.email || "An employee";
    await notifyOwners({ event_type: "leave.submitted", title: "Leave request received", body: `${employeeName} requested ${leave.leave_type} leave from ${leave.start_date} to ${leave.end_date}.`, entity_type: "leave", entity_id: data.id });
    if (!isOwner) await notify({ recipient_user_id: employeeUserId, event_type: "leave.submitted", title: "Request submitted", body: "Your leave request is waiting for review.", entity_type: "leave", entity_id: data.id });
    await audit({ action: "leave.submitted", entity_type: "leave", entity_id: data.id, metadata: { leave_type: leave.leave_type, start_date: leave.start_date, end_date: leave.end_date } });
    return reply(200, { leave: data });
  }

  if (action === "respond_leave") {
    const leaveId = typeof body.leave_id === "string" ? body.leave_id : "";
    const responseText = typeof body.response === "string" ? body.response.trim().slice(0, 500) : "";
    if (!leaveId || !responseText) return reply(400, { error: "Add a response before resubmitting this request." });
    const { data: leave, error: loadError } = await admin.from("pharmacy_leave_requests")
      .select("id,employee_user_id,reason,status,start_date,end_date").eq("pharmacy_id", pharmacyId).eq("id", leaveId).maybeSingle();
    if (loadError || !leave || leave.employee_user_id !== user.id || leave.status !== "needs_information") return reply(409, { error: "This request is not waiting for information from you." });
    const reason = [leave.reason, `Employee response: ${responseText}`].filter(Boolean).join("\n\n").slice(0, 500);
    const { data, error } = await admin.from("pharmacy_leave_requests").update({ status: "pending", reason, review_reason: null, reviewed_by: null, reviewed_at: null, updated_at: new Date().toISOString() })
      .eq("pharmacy_id", pharmacyId).eq("id", leaveId).eq("status", "needs_information").select("id").maybeSingle();
    if (error || !data) return reply(409, { error: "This request changed while you were responding. Refresh and try again." });
    await notifyOwners({ event_type: "leave.resubmitted", title: "Employee responded", body: "An employee added information to a leave request.", entity_type: "leave", entity_id: leave.id });
    await audit({ action: "leave.resubmitted", entity_type: "leave", entity_id: leave.id });
    return reply(200, { submitted: true });
  }

  if (action === "withdraw_leave") {
    const leaveId = typeof body.leave_id === "string" ? body.leave_id : "";
    const { data: leave, error: loadError } = await admin.from("pharmacy_leave_requests")
      .select("id,employee_user_id,status").eq("pharmacy_id", pharmacyId).eq("id", leaveId).maybeSingle();
    if (loadError || !leave || (!isOwner && leave.employee_user_id !== user.id)) return reply(404, { error: "This request could not be found." });
    if (!["pending", "needs_information"].includes(leave.status)) return reply(409, { error: "Only an open request can be withdrawn." });
    const nextState = isOwner ? "cancelled" : "withdrawn";
    const { error } = await admin.from("pharmacy_leave_requests").update({ status: nextState, updated_at: new Date().toISOString() })
      .eq("pharmacy_id", pharmacyId).eq("id", leaveId).in("status", ["pending", "needs_information"]);
    if (error) return reply(400, { error: "Could not close this request." });
    const recipient = isOwner ? leave.employee_user_id : (await admin.from("pharmacy_members").select("user_id").eq("pharmacy_id", pharmacyId).eq("membership_role", "owner")).data?.[0]?.user_id;
    if (recipient) await notify({ recipient_user_id: recipient, event_type: `leave.${nextState}`, title: isOwner ? "Request cancelled" : "Request withdrawn", body: isOwner ? "The pharmacy administrator cancelled this leave request." : "An employee withdrew a pending leave request.", entity_type: "leave", entity_id: leave.id });
    await audit({ action: `leave.${nextState}`, entity_type: "leave", entity_id: leave.id });
    return reply(200, { closed: true, status: nextState });
  }

  if (action === "review_leave") {
    const leaveId = typeof body.leave_id === "string" ? body.leave_id : "";
    const status = body.status;
    const reviewReason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!leaveId || !["approved", "rejected", "needs_information"].includes(String(status))) return reply(400, { error: "Choose a valid request decision." });
    if (["rejected", "needs_information"].includes(String(status)) && !reviewReason) return reply(400, { error: "Add a reason or question so the employee knows what to do next." });
    const { data: leave, error: leaveError } = await admin.from("pharmacy_leave_requests")
      .select("id,employee_user_id,start_date,end_date,status,leave_type").eq("pharmacy_id", pharmacyId).eq("id", leaveId).maybeSingle();
    if (leaveError || !leave) return reply(404, { error: "This request no longer exists." });
    if (!["pending", "needs_information"].includes(leave.status)) return reply(409, { error: "This request has already been decided." });
    if (status === "approved") {
      const { data: conflicts, error } = await admin.from("pharmacy_shifts").select("id,shift_date,start_time,end_time")
        .eq("pharmacy_id", pharmacyId).eq("employee_user_id", leave.employee_user_id)
        .in("status", ["draft", "published"]).gte("shift_date", dateOffset(leave.start_date, -1)).lte("shift_date", leave.end_date);
      if (error) return reply(500, { error: "Could not check shifts against this leave request." });
      const active = (conflicts ?? []).filter((shift) => shift.shift_date < leave.start_date
        && timeMinutes(shift.end_time) <= timeMinutes(shift.start_time));
      if (active.length) return reply(409, { error: `Cancel or reassign the overnight shift crossing into ${leave.start_date} before approving leave.` });
      const currentDayConflicts = (conflicts ?? []).filter((shift) => shift.shift_date >= leave.start_date);
      if (currentDayConflicts.length) return reply(409, { error: `Cancel or reassign ${currentDayConflicts.length} shift(s) during the requested leave before approving it.` });
    }
    const { data, error } = await admin.from("pharmacy_leave_requests").update({
      status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_reason: reviewReason || null, updated_at: new Date().toISOString(),
    }).eq("pharmacy_id", pharmacyId).eq("id", leaveId).in("status", ["pending", "needs_information"])
      .select("id").maybeSingle();
    if (error) return reply(400, { error: error.message });
    if (!data) return reply(409, { error: "This request was already reviewed. Refresh the list and try again." });
    const decisionTitle = status === "approved" ? "Leave approved" : status === "rejected" ? "Leave declined" : "More information requested";
    const employeeMessage = status === "needs_information" ? `The pharmacy needs more information: ${reviewReason}`
      : status === "rejected" ? `Your leave request was declined: ${reviewReason}`
      : `Your leave from ${leave.start_date} to ${leave.end_date} was approved.`;
    await notify({ recipient_user_id: leave.employee_user_id, event_type: `leave.${status}`, title: decisionTitle, body: employeeMessage, entity_type: "leave", entity_id: leave.id });
    await audit({ action: `leave.${status}`, entity_type: "leave", entity_id: leave.id, metadata: { reason: reviewReason || null } });
    return reply(200, { reviewed: true, status });
  }

  if (action === "list_swap_targets") {
    const [{ data: members, error: memberError }, { data: settings, error: settingsError }] = await Promise.all([
      admin.from("pharmacy_members").select("user_id,profiles(display_name,email)").eq("pharmacy_id", pharmacyId).eq("membership_role", "staff"),
      admin.from("pharmacy_staff_settings").select("employee_user_id,employee_code,job_title,employment_status").eq("pharmacy_id", pharmacyId).eq("employment_status", "active"),
    ]);
    if (memberError || settingsError) return reply(500, { error: "Could not load employees available for shift swaps." });
    const activeIds = new Set((settings ?? []).map((setting) => setting.employee_user_id));
    const settingsById = new Map((settings ?? []).map((setting) => [setting.employee_user_id, setting]));
    return reply(200, { employees: (members ?? []).filter((item) => item.user_id !== user.id && activeIds.has(item.user_id)).map((item) => ({
      user_id: item.user_id, display_name: item.profiles?.display_name || item.profiles?.email || "Employee",
      employee_code: settingsById.get(item.user_id)?.employee_code ?? "", job_title: settingsById.get(item.user_id)?.job_title ?? "Pharmacy staff",
    })) });
  }

  if (action === "list_swap_requests") {
    let query = admin.from("pharmacy_shift_swap_requests")
      .select("id,shift_id,employee_user_id,target_user_id,note,status,reviewed_at,review_reason,created_at")
      .eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(300);
    if (!isOwner) query = query.or(`employee_user_id.eq.${user.id},target_user_id.eq.${user.id}`);
    const { data, error } = await query;
    if (error) return reply(500, { error: "Could not load shift swap requests." });
    const rows = data ?? [];
    const ids = [...new Set(rows.flatMap((row) => [row.employee_user_id, row.target_user_id]))];
    const { data: profiles, error: profileError } = ids.length
      ? await admin.from("profiles").select("id,display_name,email").in("id", ids)
      : { data: [], error: null };
    if (profileError) return reply(500, { error: "Could not load shift swap names." });
    const names = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name || profile.email || "Employee"]));
    const shiftIds = [...new Set(rows.map((row) => row.shift_id))];
    const { data: shiftsForRows } = shiftIds.length
      ? await admin.from("pharmacy_shifts").select("id,shift_date,start_time,end_time,location,role_label").in("id", shiftIds)
      : { data: [] };
    const shiftMap = new Map((shiftsForRows ?? []).map((shift) => [shift.id, shift]));
    return reply(200, { requests: rows.map((row) => ({
      ...row, employee_name: names.get(row.employee_user_id) ?? "Employee", target_name: names.get(row.target_user_id) ?? "Employee",
      shift: shiftMap.get(row.shift_id) ?? null,
    })) });
  }

  if (action === "create_swap_request") {
    const requestInput = body.request as Record<string, unknown> | undefined;
    const shiftId = typeof requestInput?.shift_id === "string" ? requestInput.shift_id : "";
    const targetUserId = typeof requestInput?.target_user_id === "string" ? requestInput.target_user_id : "";
    const note = typeof requestInput?.note === "string" ? requestInput.note.trim().slice(0, 500) : "";
    if (!shiftId || !targetUserId || targetUserId === user.id) return reply(400, { error: "Choose one of your shifts and another active employee." });
    const { data: shift, error: shiftError } = await admin.from("pharmacy_shifts")
      .select("id,employee_user_id,shift_date,start_time,end_time,status").eq("pharmacy_id", pharmacyId).eq("id", shiftId).maybeSingle();
    if (shiftError || !shift || shift.employee_user_id !== user.id || shift.status !== "published") return reply(404, { error: "Choose a published shift assigned to you." });
    const { data: target, error: targetError } = await admin.from("pharmacy_members").select("user_id")
      .eq("pharmacy_id", pharmacyId).eq("user_id", targetUserId).eq("membership_role", "staff").maybeSingle();
    if (targetError || !target) return reply(400, { error: "That employee is not part of this pharmacy." });
    const { data: targetSettings } = await admin.from("pharmacy_staff_settings").select("employment_status")
      .eq("pharmacy_id", pharmacyId).eq("employee_user_id", targetUserId).maybeSingle();
    if (targetSettings?.employment_status !== "active") return reply(409, { error: "Choose an active colleague." });
    const { data: pending, error: pendingError } = await admin.from("pharmacy_shift_swap_requests").select("id")
      .eq("pharmacy_id", pharmacyId).eq("shift_id", shiftId).eq("status", "pending").limit(1);
    if (pendingError) return reply(500, { error: "Could not check for another open request." });
    if (pending?.length) return reply(409, { error: "This shift already has a pending swap request." });
    const { data, error } = await admin.from("pharmacy_shift_swap_requests").insert({
      pharmacy_id: pharmacyId, shift_id: shiftId, employee_user_id: user.id, target_user_id: targetUserId, note: note || null,
    }).select("id,shift_id,employee_user_id,target_user_id,note,status,created_at").single();
    if (error) return reply(400, { error: "Could not submit this shift swap request." });
    const { data: profile } = await admin.from("profiles").select("display_name,email").eq("id", user.id).maybeSingle();
    const name = profile?.display_name || profile?.email || "An employee";
    await notifyOwners({ event_type: "shift_swap.submitted", title: "Shift swap requested", body: `${name} requested a colleague for a shift on ${shift.shift_date}.`, entity_type: "shift_swap", entity_id: data.id });
    await notify({ recipient_user_id: targetUserId, event_type: "shift_swap.invited", title: "Shift swap proposed", body: `${name} proposed a swap for ${shift.shift_date} at ${shift.start_time.slice(0, 5)}. The pharmacy administrator must approve it.`, entity_type: "shift_swap", entity_id: data.id });
    await audit({ action: "shift_swap.submitted", entity_type: "shift_swap", entity_id: data.id, metadata: { shift_id: shiftId, target_user_id: targetUserId } });
    return reply(200, { request: data });
  }

  if (action === "review_swap_request") {
    const requestId = typeof body.request_id === "string" ? body.request_id : "";
    const status = body.status;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!requestId || !["approved", "rejected"].includes(String(status))) return reply(400, { error: "Choose a swap request and decision." });
    if (status === "rejected" && !reason) return reply(400, { error: "Add a reason before declining this shift swap." });
    const { data: requestRow, error: requestError } = await admin.from("pharmacy_shift_swap_requests")
      .select("id,shift_id,employee_user_id,target_user_id,status").eq("pharmacy_id", pharmacyId).eq("id", requestId).maybeSingle();
    if (requestError || !requestRow || requestRow.status !== "pending") return reply(409, { error: "This swap request is no longer pending." });
    if (status === "approved") {
      const { data: shift, error: shiftError } = await admin.from("pharmacy_shifts")
        .select("id,employee_user_id,shift_date,start_time,end_time,status,location,role_label,break_minutes,timezone")
        .eq("pharmacy_id", pharmacyId).eq("id", requestRow.shift_id).maybeSingle();
      if (shiftError || !shift || shift.employee_user_id !== requestRow.employee_user_id || shift.status !== "published") return reply(409, { error: "The published shift changed after the request was sent." });
      const { data: targetSettings } = await admin.from("pharmacy_staff_settings").select("employment_status")
        .eq("pharmacy_id", pharmacyId).eq("employee_user_id", requestRow.target_user_id).maybeSingle();
      if (targetSettings?.employment_status !== "active") return reply(409, { error: "The colleague is no longer active." });
      const newRange = interval(shift.shift_date, shift.start_time, shift.end_time);
      const { data: nearby, error: nearbyError } = await admin.from("pharmacy_shifts")
        .select("id,shift_date,start_time,end_time").eq("pharmacy_id", pharmacyId)
        .eq("employee_user_id", requestRow.target_user_id).in("status", ["draft", "published"])
        .gte("shift_date", dateOffset(shift.shift_date, -1)).lte("shift_date", dateOffset(shift.shift_date, 1));
      if (nearbyError) return reply(500, { error: "Could not check colleague availability." });
      if ((nearby ?? []).some((other) => rangesOverlap(newRange, interval(other.shift_date, other.start_time, other.end_time)))) return reply(409, { error: "The colleague has an overlapping shift." });
      const finishDate = timeMinutes(shift.end_time) <= timeMinutes(shift.start_time) ? dateOffset(shift.shift_date, 1) : shift.shift_date;
      const { data: leave, error: leaveError } = await admin.from("pharmacy_leave_requests").select("id")
        .eq("pharmacy_id", pharmacyId).eq("employee_user_id", requestRow.target_user_id).eq("status", "approved")
        .lte("start_date", finishDate).gte("end_date", shift.shift_date).limit(1);
      if (leaveError) return reply(500, { error: "Could not check colleague leave." });
      if (leave?.length) return reply(409, { error: "The colleague has approved leave during this shift." });
      const { error: moveError } = await admin.from("pharmacy_shifts").update({
        employee_user_id: requestRow.target_user_id, status: "draft", published_at: null, published_by: null,
      }).eq("pharmacy_id", pharmacyId).eq("id", shift.id).eq("employee_user_id", requestRow.employee_user_id);
      if (moveError) return reply(409, { error: "The shift could not be reassigned. Refresh and review the current schedule." });
    }
    const { error } = await admin.from("pharmacy_shift_swap_requests").update({
      status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_reason: reason || null, updated_at: new Date().toISOString(),
    }).eq("pharmacy_id", pharmacyId).eq("id", requestId).eq("status", "pending");
    if (error) return reply(409, { error: "The request decision could not be saved." });
    const title = status === "approved" ? "Shift swap approved" : "Shift swap declined";
    const bodyText = status === "approved" ? "The shift has been reassigned as a draft. The administrator will publish the updated schedule." : `The shift swap was declined: ${reason}`;
    await notify({ recipient_user_id: requestRow.employee_user_id, event_type: `shift_swap.${status}`, title, body: bodyText, entity_type: "shift_swap", entity_id: requestId });
    await notify({ recipient_user_id: requestRow.target_user_id, event_type: `shift_swap.${status}`, title, body: bodyText, entity_type: "shift_swap", entity_id: requestId });
    await audit({ action: `shift_swap.${status}`, entity_type: "shift_swap", entity_id: requestId, metadata: { reason: reason || null } });
    return reply(200, { reviewed: true, status });
  }

  if (action === "list_notifications") {
    const { data, error } = await admin.from("pharmacy_hr_notifications")
      .select("id,event_type,title,body,entity_type,entity_id,created_at,read_at,delivery_status")
      .eq("pharmacy_id", pharmacyId).eq("recipient_user_id", user.id).order("created_at", { ascending: false }).limit(100);
    if (error) return reply(500, { error: "Could not load your notifications." });
    return reply(200, { notifications: data ?? [] });
  }

  if (action === "list_audit") {
    const { data, error } = await admin.from("pharmacy_hr_audit_events")
      .select("id,actor_user_id,action,entity_type,entity_id,occurred_at,metadata,profiles!pharmacy_hr_audit_events_actor_user_id_fkey(display_name,email)")
      .eq("pharmacy_id", pharmacyId).order("occurred_at", { ascending: false }).limit(250);
    if (error) return reply(500, { error: "Could not load workforce activity history." });
    return reply(200, { events: data ?? [] });
  }

  if (action === "mark_notification_read") {
    const notificationId = typeof body.notification_id === "string" ? body.notification_id : "";
    if (!notificationId) return reply(400, { error: "Choose a notification." });
    const { error } = await admin.from("pharmacy_hr_notifications").update({ read_at: new Date().toISOString() })
      .eq("pharmacy_id", pharmacyId).eq("recipient_user_id", user.id).eq("id", notificationId);
    if (error) return reply(400, { error: "Could not mark this notification read." });
    return reply(200, { read: true });
  }

  if (action === "get_workforce_settings") {
    const { data, error } = await admin.from("pharmacy_workforce_settings").select("timezone,currency,week_starts_on,attendance_enabled,payroll_preparation_enabled")
      .eq("pharmacy_id", pharmacyId).maybeSingle();
    if (error) return reply(500, { error: "Could not load workforce settings." });
    return reply(200, { settings: data ?? { timezone: "Africa/Khartoum", currency: "SDG", week_starts_on: 1, attendance_enabled: false, payroll_preparation_enabled: false } });
  }

  if (action === "save_workforce_settings") {
    const input = body.settings as Record<string, unknown> | undefined;
    const timezone = typeof input?.timezone === "string" ? input.timezone : "";
    const currency = typeof input?.currency === "string" ? input.currency.toUpperCase() : "";
    const weekStartsOn = Number(input?.week_starts_on);
    try { new Intl.DateTimeFormat("en", { timeZone: timezone }); } catch { return reply(400, { error: "Choose a valid IANA time zone." }); }
    if (!/^[A-Z]{3}$/.test(currency) || !Number.isInteger(weekStartsOn) || weekStartsOn < 1 || weekStartsOn > 7) return reply(400, { error: "Check the currency and first day of the week." });
    const { data, error } = await admin.from("pharmacy_workforce_settings").upsert({
      pharmacy_id: pharmacyId, timezone, currency, week_starts_on: weekStartsOn,
      attendance_enabled: Boolean(input?.attendance_enabled), payroll_preparation_enabled: Boolean(input?.payroll_preparation_enabled),
    }, { onConflict: "pharmacy_id" }).select("timezone,currency,week_starts_on,attendance_enabled,payroll_preparation_enabled").single();
    if (error) return reply(400, { error: error.message });
    await audit({ action: "workforce.settings_updated", entity_type: "settings", metadata: { timezone, currency, attendance_enabled: data.attendance_enabled, payroll_preparation_enabled: data.payroll_preparation_enabled } });
    return reply(200, { settings: data });
  }

  if (action === "clock_event") {
    const eventType = body.event_type;
    if (!["clock_in", "clock_out", "break_start", "break_end"].includes(String(eventType))) return reply(400, { error: "Choose a valid attendance event." });
    const { data: workforce, error: workforceError } = await admin.from("pharmacy_workforce_settings").select("attendance_enabled")
      .eq("pharmacy_id", pharmacyId).maybeSingle();
    if (workforceError || !workforce?.attendance_enabled) return reply(409, { error: "Attendance recording is not enabled by the pharmacy administrator." });
    const { data: staff, error: staffError } = await admin.from("pharmacy_staff_settings").select("employment_status")
      .eq("pharmacy_id", pharmacyId).eq("employee_user_id", user.id).maybeSingle();
    if (staffError || staff?.employment_status !== "active") return reply(403, { error: "Only active pharmacy employees can record attendance." });
    const { data: last, error: lastError } = await admin.from("pharmacy_attendance_events").select("event_type")
      .eq("pharmacy_id", pharmacyId).eq("employee_user_id", user.id).order("occurred_at", { ascending: false }).limit(1).maybeSingle();
    if (lastError) return reply(500, { error: "Could not check the last attendance event." });
    const allowed = eventType === "clock_in" ? !last || last.event_type === "clock_out"
      : eventType === "break_start" ? last?.event_type === "clock_in" || last?.event_type === "break_end"
      : eventType === "break_end" ? last?.event_type === "break_start"
      : last?.event_type === "clock_in" || last?.event_type === "break_end";
    if (!allowed) return reply(409, { error: "That punch is not valid after your last attendance event." });
    const { data, error } = await admin.from("pharmacy_attendance_events").insert({
      pharmacy_id: pharmacyId, employee_user_id: user.id, event_type: eventType, source: "employee_portal",
    }).select("id,event_type,occurred_at,source,created_at").single();
    if (error) return reply(400, { error: "Could not record attendance." });
    await audit({ action: `attendance.${eventType}`, entity_type: "attendance_event", entity_id: data.id });
    return reply(200, { event: data });
  }

  if (action === "list_attendance") {
    const month = typeof body.month === "string" ? body.month : new Date().toISOString().slice(0, 7);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return reply(400, { error: "Choose a valid month." });
    const start = `${month}-01`;
    const end = dateOffset(start, 32).slice(0, 7) + "-01";
    let query = admin.from("pharmacy_attendance_events")
      .select("id,employee_user_id,event_type,occurred_at,source,created_at,profiles!pharmacy_attendance_events_employee_user_id_fkey(display_name,email)")
      .eq("pharmacy_id", pharmacyId).gte("occurred_at", `${start}T00:00:00.000Z`).lt("occurred_at", `${end}T00:00:00.000Z`)
      .order("occurred_at", { ascending: false }).limit(1000);
    if (!isOwner) query = query.eq("employee_user_id", user.id);
    const { data, error } = await query;
    if (error) return reply(500, { error: "Could not load attendance events." });
    return reply(200, { events: data ?? [] });
  }

  if (action === "request_time_correction") {
    const request = body.correction as Record<string, unknown> | undefined;
    if (!request || !["clock_in", "clock_out", "break_start", "break_end"].includes(String(request.event_type))
      || typeof request.reason !== "string" || !request.reason.trim() || request.reason.length > 500
      || typeof request.occurred_at !== "string" || Number.isNaN(Date.parse(request.occurred_at))) return reply(400, { error: "Choose an event, valid time, and reason for the correction request." });
    const eventId = typeof request.event_id === "string" ? request.event_id : null;
    if (eventId) {
      const { data: event } = await admin.from("pharmacy_attendance_events").select("id")
        .eq("pharmacy_id", pharmacyId).eq("employee_user_id", user.id).eq("id", eventId).maybeSingle();
      if (!event) return reply(404, { error: "The attendance record could not be found." });
    }
    const { data, error } = await admin.from("pharmacy_time_correction_requests").insert({
      pharmacy_id: pharmacyId, employee_user_id: user.id, event_id: eventId,
      requested_event_type: request.event_type, requested_at: new Date(request.occurred_at).toISOString(), reason: request.reason.trim(),
    }).select("id,employee_user_id,event_id,requested_event_type,requested_at,reason,status,created_at").single();
    if (error) return reply(400, { error: "Could not submit the correction request." });
    await notifyOwners({ event_type: "attendance.correction_submitted", title: "Time correction requested", body: "An employee submitted a time correction for review.", entity_type: "time_correction", entity_id: data.id });
    await audit({ action: "attendance.correction_requested", entity_type: "time_correction", entity_id: data.id });
    return reply(200, { correction: data });
  }

  if (action === "list_time_corrections") {
    const { data, error } = await admin.from("pharmacy_time_correction_requests")
      .select("id,employee_user_id,event_id,requested_event_type,requested_at,reason,status,reviewed_by,reviewed_at,review_reason,created_at,profiles!pharmacy_time_correction_requests_employee_user_id_fkey(display_name,email)")
      .eq("pharmacy_id", pharmacyId).order("created_at", { ascending: false }).limit(300);
    if (error) return reply(500, { error: "Could not load time correction requests." });
    return reply(200, { corrections: data ?? [] });
  }

  if (action === "review_time_correction") {
    const correctionId = typeof body.correction_id === "string" ? body.correction_id : "";
    const status = body.status;
    const reason = typeof body.reason === "string" ? body.reason.trim().slice(0, 500) : "";
    if (!correctionId || !["approved", "rejected"].includes(String(status))) return reply(400, { error: "Choose a correction and decision." });
    if (status === "rejected" && !reason) return reply(400, { error: "Add a reason for declining the correction." });
    const { data: correction, error: getError } = await admin.from("pharmacy_time_correction_requests")
      .select("id,employee_user_id,event_id,requested_event_type,requested_at,status").eq("pharmacy_id", pharmacyId).eq("id", correctionId).maybeSingle();
    if (getError || !correction || correction.status !== "pending") return reply(409, { error: "This correction request is no longer pending." });
    if (status === "approved") {
      const { error } = await admin.from("pharmacy_attendance_events").insert({
        pharmacy_id: pharmacyId, employee_user_id: correction.employee_user_id,
        event_type: correction.requested_event_type, occurred_at: correction.requested_at,
        source: "approved_correction", device_ref: correction.id,
      });
      if (error) return reply(400, { error: "The correction event could not be recorded." });
    }
    const { error } = await admin.from("pharmacy_time_correction_requests").update({
      status, reviewed_by: user.id, reviewed_at: new Date().toISOString(), review_reason: reason || null,
    }).eq("pharmacy_id", pharmacyId).eq("id", correctionId).eq("status", "pending");
    if (error) return reply(400, { error: "Could not update the correction request." });
    const correctionEvent = "attendance.correction_" + String(status);
    const correctionBody = status === "approved"
      ? "Your attendance correction was approved and added as a separate event."
      : "Your attendance correction was declined: " + reason;
    await notify({
      recipient_user_id: correction.employee_user_id,
      event_type: correctionEvent,
      title: status === "approved" ? "Time correction approved" : "Time correction declined",
      body: correctionBody,
      entity_type: "time_correction",
      entity_id: correction.id,
    });
    await audit({ action: correctionEvent, entity_type: "time_correction", entity_id: correction.id, metadata: { reason: reason || null } });
    return reply(200, { reviewed: true });
  }

  if (action === "list_compensation") {
    const employeeId = typeof body.employee_user_id === "string" ? body.employee_user_id : "";
    if (!employeeId) return reply(400, { error: "Choose an employee." });
    const { data, error } = await admin.from("pharmacy_employee_compensation")
      .select("id,employee_user_id,effective_date,pay_basis,amount,currency,pay_schedule,created_at")
      .eq("pharmacy_id", pharmacyId).eq("employee_user_id", employeeId).order("effective_date", { ascending: false }).order("created_at", { ascending: false });
    if (error) return reply(500, { error: "Could not load compensation history." });
    return reply(200, { compensation: data ?? [] });
  }

  if (action === "save_compensation") {
    const input = body.compensation as Record<string, unknown> | undefined;
    const employeeId = typeof input?.employee_user_id === "string" ? input.employee_user_id : "";
    const amount = Number(input?.amount);
    const effectiveDate = input?.effective_date;
    const basis = input?.pay_basis;
    const currency = typeof input?.currency === "string" ? input.currency.toUpperCase() : "";
    const schedule = typeof input?.pay_schedule === "string" ? input.pay_schedule.trim().slice(0, 80) : "";
    if (!employeeId || !validDate(effectiveDate) || !["day", "week", "month", "hour", "annual"].includes(String(basis))
      || !Number.isFinite(amount) || amount < 0 || !/^[A-Z]{3}$/.test(currency)) return reply(400, { error: "Check the employee, effective date, pay basis, amount, and currency." });
    const { data: employee } = await admin.from("pharmacy_members").select("user_id").eq("pharmacy_id", pharmacyId).eq("user_id", employeeId).maybeSingle();
    if (!employee) return reply(400, { error: "That employee is not part of this pharmacy." });
    const { data, error } = await admin.from("pharmacy_employee_compensation").insert({
      pharmacy_id: pharmacyId, employee_user_id: employeeId, effective_date: effectiveDate,
      pay_basis: basis, amount: amount.toFixed(2), currency, pay_schedule: schedule || null, created_by: user.id,
    }).select("id,employee_user_id,effective_date,pay_basis,amount,currency,pay_schedule,created_at").single();
    if (error) return reply(400, { error: error.code === "23505" ? "A compensation record already exists for that effective date." : error.message });
    await audit({ action: "compensation.created", entity_type: "compensation", entity_id: data.id, metadata: { employee_user_id: employeeId, effective_date: effectiveDate, pay_basis: basis, currency } });
    return reply(200, { compensation: data });
  }

  return reply(400, { error: "Unknown team action." });
});
