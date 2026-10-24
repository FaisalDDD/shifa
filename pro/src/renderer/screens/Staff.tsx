import { useEffect, useMemo, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import type {
  AuthSession,
  AttendanceEvent,
  EmployeeCompensation,
  HrAuditEvent,
  LeaveType,
  PharmacyEmployee,
  Shift,
  StaffLeaveRequest,
  StaffNotification,
  StaffEmployeeOption,
  StaffShiftSwapRequest,
  TimeCorrectionRequest,
  WorkforceSettings,
} from "../../shared/types";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function localDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function monthKey(date: Date): string {
  return localDateKey(new Date(date.getFullYear(), date.getMonth(), 1)).slice(0, 7);
}

function calendarDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const slots = Math.ceil((offset + count) / 7) * 7;
  return Array.from({ length: slots }, (_, index) =>
    new Date(month.getFullYear(), month.getMonth(), index - offset + 1),
  );
}

function isoWeekday(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay();
}

function initials(name: string | null, email: string | null): string {
  const value = name?.trim() || email?.trim() || "Staff";
  const parts = value.includes("@") ? [value.split("@")[0]] : value.split(/\s+/);
  return parts.slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("");
}

function formatWorkTime(value: string, timezone: string): string {
  try {
    return new Intl.DateTimeFormat(undefined, { timeZone: timezone, dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return new Date(value).toLocaleString();
  }
}

function localInputToUtc(value: string, timezone: string): string {
  const [datePart, timePart] = value.split("T");
  const [year, month, day] = datePart.split("-").map(Number);
  const [hour, minute] = timePart.split(":").map(Number);
  const target = Date.UTC(year, month - 1, day, hour, minute);
  let guess = target;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  });
  for (let attempt = 0; attempt < 4; attempt++) {
    const parts = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
    const represented = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second));
    guess += target - represented;
  }
  const check = Object.fromEntries(formatter.formatToParts(new Date(guess)).map((part) => [part.type, part.value]));
  if (Number(check.year) !== year || Number(check.month) !== month || Number(check.day) !== day
    || Number(check.hour) !== hour || Number(check.minute) !== minute) {
    throw new Error("That time does not exist in the pharmacy time zone. Choose another local time.");
  }
  return new Date(guess).toISOString();
}

function shortError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/pharmacy_staff_settings|pharmacy_leave_requests|staff management migration|unknown team action/i.test(message)) {
    return "Staff scheduling is not connected yet. Apply the Shifa staff management migration and redeploy the pharmacy-team function.";
  }
  if (/failed to fetch|networkerror|ECONNREFUSED|ENOTFOUND|ETIMEDOUT/i.test(message)) {
    return "Can't reach Shifa right now. Check your connection and try again.";
  }
  return message.length > 180 ? "Couldn't complete the staff update. Please try again." : message;
}

function avatarFromFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      const side = 240;
      const scale = Math.min(side / image.naturalWidth, side / image.naturalHeight, 1);
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      const context = canvas.getContext("2d");
      if (!context) return reject(new Error("Could not prepare this photo."));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/jpeg", 0.78));
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This photo could not be opened."));
    };
    image.src = url;
  });
}

export function Staff({
  session,
  canManage,
  onNotice,
}: {
  session: AuthSession;
  canManage: boolean;
  onNotice: (message: string) => void;
}) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const monthId = monthKey(month);
  const [team, setTeam] = useState<PharmacyEmployee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<StaffLeaveRequest[]>([]);
  const [shiftSwapRequests, setShiftSwapRequests] = useState<StaffShiftSwapRequest[]>([]);
  const [swapTargets, setSwapTargets] = useState<StaffEmployeeOption[]>([]);
  const [notifications, setNotifications] = useState<StaffNotification[]>([]);
  const [auditEvents, setAuditEvents] = useState<HrAuditEvent[]>([]);
  const [workforce, setWorkforce] = useState<WorkforceSettings>({
    timezone: "Africa/Khartoum", currency: "SDG", week_starts_on: 1,
    attendance_enabled: false, payroll_preparation_enabled: false,
  });
  const [attendanceEvents, setAttendanceEvents] = useState<AttendanceEvent[]>([]);
  const [corrections, setCorrections] = useState<TimeCorrectionRequest[]>([]);
  const [compensation, setCompensation] = useState<EmployeeCompensation[]>([]);
  const [staffFeaturesReady, setStaffFeaturesReady] = useState(true);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");
  const [busy, setBusy] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [jobTitle, setJobTitle] = useState("Pharmacy staff");
  const [displayColor, setDisplayColor] = useState("#2563eb");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [weeklyHours, setWeeklyHours] = useState("40");
  const [workingDays, setWorkingDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [shiftStart, setShiftStart] = useState("09:00");
  const [shiftEnd, setShiftEnd] = useState("17:00");
  const [employmentStatus, setEmploymentStatus] = useState<PharmacyEmployee["employment_status"]>("active");
  const [department, setDepartment] = useState("");
  const [location, setLocation] = useState("");
  const [managerUserId, setManagerUserId] = useState("");
  const [contractType, setContractType] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [quickEmployeeId, setQuickEmployeeId] = useState("");
  const [quickDate, setQuickDate] = useState(localDateKey(new Date()));
  const [quickStart, setQuickStart] = useState("09:00");
  const [quickEnd, setQuickEnd] = useState("17:00");
  const [quickLocation, setQuickLocation] = useState("");
  const [quickRole, setQuickRole] = useState("Pharmacy staff");
  const [quickBreak, setQuickBreak] = useState("0");
  const [editingShiftId, setEditingShiftId] = useState("");
  const [selectedDate, setSelectedDate] = useState("");
  const [calendarMode, setCalendarMode] = useState<"month" | "agenda">("month");
  const [employeeFilter, setEmployeeFilter] = useState("all");
  const [shiftStatusFilter, setShiftStatusFilter] = useState<"all" | "draft" | "published" | "cancelled">("all");
  const [staffQuery, setStaffQuery] = useState("");
  const [staffStatusFilter, setStaffStatusFilter] = useState("all");
  const [departmentFilter, setDepartmentFilter] = useState("all");
  const [payAmount, setPayAmount] = useState("");
  const [payBasis, setPayBasis] = useState<EmployeeCompensation["pay_basis"]>("month");
  const [payCurrency, setPayCurrency] = useState("SDG");
  const [payEffectiveDate, setPayEffectiveDate] = useState(localDateKey(new Date()));
  const [paySchedule, setPaySchedule] = useState("Monthly");
  const [correctionType, setCorrectionType] = useState<AttendanceEvent["event_type"]>("clock_in");
  const [correctionDate, setCorrectionDate] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [leaveEmployeeId, setLeaveEmployeeId] = useState("");
  const [leaveType, setLeaveType] = useState<LeaveType>("sick");
  const [leaveStart, setLeaveStart] = useState(localDateKey(new Date()));
  const [leaveEnd, setLeaveEnd] = useState(localDateKey(new Date()));
  const [leaveReason, setLeaveReason] = useState("");
  const [swapShiftId, setSwapShiftId] = useState("");
  const [swapTargetId, setSwapTargetId] = useState("");
  const [swapNote, setSwapNote] = useState("");
  const [dragOverDate, setDragOverDate] = useState("");

  const employee = team.find((member) => member.user_id === selectedEmployeeId) ?? null;
  const staffMembers = team.filter((member) => member.membership_role === "staff");
  const activeStaffMembers = staffMembers.filter((member) => member.employment_status === "active");
  const departments = [...new Set(staffMembers.map((member) => member.department).filter((value): value is string => Boolean(value)))].sort();
  const visibleTeam = useMemo(() => team.filter((member) => {
    const query = staffQuery.trim().toLowerCase();
    const matchesQuery = !query || [member.display_name, member.email, member.employee_code, member.job_title, member.department, member.location]
      .some((value) => value?.toLowerCase().includes(query));
    return matchesQuery && (staffStatusFilter === "all" || member.employment_status === staffStatusFilter)
      && (departmentFilter === "all" || member.department === departmentFilter);
  }), [team, staffQuery, staffStatusFilter, departmentFilter]);
  const days = useMemo(() => calendarDays(month), [month]);
  const monthLabel = new Intl.DateTimeFormat("en", { month: "long", year: "numeric" }).format(month);
  const monthShifts = shifts.filter((shift) => shift.date.startsWith(monthId)
    && (employeeFilter === "all" || shift.employee_user_id === employeeFilter)
    && (shiftStatusFilter === "all" || shift.status === shiftStatusFilter));
  const scheduledHours = monthShifts.reduce((total, shift) => {
    const [startH, startM] = shift.start_time.split(":").map(Number);
    const [endH, endM] = shift.end_time.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    let endMinutes = endH * 60 + endM;
    if (endMinutes <= startMinutes) endMinutes += 1440;
    return total + Math.max(0, (endMinutes - startMinutes - shift.break_minutes) / 60);
  }, 0);
  const pendingLeave = leaveRequests.filter((leave) => leave.status === "pending" || leave.status === "needs_information").length;
  const unreadNotifications = notifications.filter((item) => !item.read_at).length;
  const myLastAttendance = attendanceEvents.filter((item) => item.employee_user_id === session.user_id)
    .sort((a, b) => b.occurred_at.localeCompare(a.occurred_at))[0];

  async function load() {
    try {
      const [members, monthShiftsList, workforceSettings, userNotifications, auditHistory, swapHistory, availableSwapTargets] = await Promise.all([
        canManage ? window.api.team.list() : Promise.resolve([] as PharmacyEmployee[]),
        window.api.hr.listShifts(monthId, "all"),
        window.api.team.workforceSettings(),
        window.api.team.notifications(),
        canManage ? window.api.team.auditEvents() : Promise.resolve([] as HrAuditEvent[]),
        window.api.team.shiftSwapRequests(),
        window.api.team.swapTargets(),
      ]);
      setTeam(members);
      setShifts(monthShiftsList);
      setWorkforce(workforceSettings);
      setNotifications(userNotifications);
      setAuditEvents(auditHistory);
      setShiftSwapRequests(swapHistory);
      setSwapTargets(availableSwapTargets);
      setSwapShiftId((current) => current || monthShiftsList.find((shift) => shift.employee_user_id === session.user_id && shift.status === "published")?.id || "");
      setSwapTargetId((current) => current || availableSwapTargets[0]?.user_id || "");
      if (workforceSettings.attendance_enabled) {
        setAttendanceEvents(await window.api.team.attendance(monthId));
        if (canManage) setCorrections(await window.api.team.correctionRequests());
      } else {
        setAttendanceEvents([]);
        setCorrections([]);
      }
      try {
        setLeaveRequests(await window.api.team.listLeaves());
        setStaffFeaturesReady(true);
      } catch (error) {
        setLeaveRequests([]);
        setStaffFeaturesReady(false);
        onNotice(shortError(error));
      }
      if (canManage && members.length > 0) {
        setSelectedEmployeeId((current) =>
          members.some((member) => member.user_id === current)
            ? current
            : (members.find((member) => member.membership_role === "staff") ?? members[0]).user_id,
        );
        setQuickEmployeeId((current) => current || members.find((member) => member.membership_role === "staff" && member.employment_status === "active")?.user_id || "");
        setLeaveEmployeeId((current) => current || members.find((member) => member.membership_role === "staff" && member.employment_status === "active")?.user_id || "");
      }
    } catch (error) {
      onNotice(shortError(error));
    }
  }

  useEffect(() => {
    void load();
    // The list is refreshed when the displayed month changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthId, canManage]);

  useEffect(() => {
    if (!employee) return;
    setDisplayName(employee.display_name ?? "");
    setJobTitle(employee.job_title || "Pharmacy staff");
    setDisplayColor(employee.display_color || "#2563eb");
    setAvatarDataUrl(employee.avatar_data_url);
    setWeeklyHours(String(employee.weekly_target_hours ?? 40));
    setWorkingDays(employee.working_days?.length ? employee.working_days : [1, 2, 3, 4, 5]);
    setShiftStart(employee.shift_start || "09:00");
    setShiftEnd(employee.shift_end || "17:00");
    setEmploymentStatus(employee.employment_status || "active");
    setDepartment(employee.department ?? "");
    setLocation(employee.location ?? "");
    setManagerUserId(employee.manager_user_id ?? "");
    setContractType(employee.contract_type ?? "");
    setStartDate(employee.start_date ?? "");
    setEndDate(employee.end_date ?? "");
    if (canManage) {
      void window.api.team.compensation(employee.user_id).then(setCompensation).catch((error) => onNotice(shortError(error)));
    }
  }, [employee?.user_id]);

  async function withBusy(action: () => Promise<void>) {
    setBusy(true);
    try {
      await action();
    } catch (error) {
      onNotice(shortError(error));
    } finally {
      setBusy(false);
    }
  }

  async function inviteEmployee() {
    if (!inviteEmail.trim()) return onNotice("Enter the employee's email address.");
    await withBusy(async () => {
      await window.api.team.invite(inviteEmail.trim());
      setInviteEmail("");
      await load();
      onNotice("Invitation sent. The employee can set a password from the email.");
    });
  }

  async function removeEmployee(member: PharmacyEmployee) {
    if (!window.confirm(`Deactivate ${member.display_name || member.email || "this employee"}? The employment record and history will be kept. Reassign future shifts first.`)) return;
    await withBusy(async () => {
      await window.api.team.remove(member.user_id);
      if (selectedEmployeeId === member.user_id) setEmploymentStatus("deactivated");
      await load();
      onNotice("Employee deactivated. Their employment and activity history are retained.");
    });
  }

  async function saveSettings() {
    if (!employee) return onNotice("Select an employee to update their profile.");
    await withBusy(async () => {
      await window.api.team.saveSettings({
        user_id: employee.user_id,
        display_name: displayName.trim(),
        job_title: jobTitle.trim() || "Pharmacy staff",
        display_color: displayColor,
        avatar_data_url: avatarDataUrl,
        weekly_target_hours: Number(weeklyHours) || 0,
        working_days: workingDays,
        shift_start: shiftStart,
        shift_end: shiftEnd,
        employment_status: employmentStatus,
        department: department.trim() || null,
        location: location.trim() || null,
        manager_user_id: managerUserId || null,
        contract_type: contractType.trim() || null,
        start_date: startDate || null,
        end_date: endDate || null,
      });
      await load();
      onNotice("Employee profile and working hours saved.");
    });
  }

  async function choosePhoto(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return onNotice("Choose an image file for the employee photo.");
    try {
      setAvatarDataUrl(await avatarFromFile(file));
    } catch (error) {
      onNotice(shortError(error));
    }
  }

  async function createShift(employeeUserId: string, date: string, start: string, end: string) {
    const targetEmployee = team.find((member) => member.user_id === employeeUserId);
    if (!targetEmployee || targetEmployee.membership_role !== "staff" || targetEmployee.employment_status !== "active") {
      return onNotice("Choose an active pharmacy employee for this shift.");
    }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(start) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(end) || start === end) {
      return onNotice("Enter valid shift times. Overnight shifts are supported.");
    }
    await withBusy(async () => {
      await window.api.hr.addShift({
        id: editingShiftId || undefined,
        employee_user_id: employeeUserId,
        date,
        start_time: start,
        end_time: end,
        location: quickLocation.trim() || null,
        role_label: quickRole.trim() || null,
        break_minutes: Number(quickBreak) || 0,
        timezone: workforce.timezone,
      });
      setEditingShiftId("");
      await load();
      onNotice(`${editingShiftId ? "Shift updated as a draft" : "Draft shift assigned"} to ${targetEmployee.display_name || targetEmployee.email || "employee"}. Publish the schedule to confirm it.`);
    });
  }

  function startEmployeeDrag(event: DragEvent<HTMLElement>, member: PharmacyEmployee) {
    event.dataTransfer.effectAllowed = "copy";
    event.dataTransfer.setData("text/plain", member.user_id);
  }

  function dropOnDay(event: DragEvent<HTMLDivElement>, day: Date) {
    event.preventDefault();
    const date = localDateKey(day);
    setDragOverDate("");
    if (day.getMonth() !== month.getMonth() || !canManage) return;
    const userId = event.dataTransfer.getData("text/plain");
    const targetEmployee = team.find((member) => member.user_id === userId);
    if (targetEmployee) void createShift(userId, date, targetEmployee.shift_start, targetEmployee.shift_end);
  }

  async function removeShift(shift: Shift) {
    if (!window.confirm(`Cancel ${shift.staff_name}'s ${shift.start_time}–${shift.end_time} shift on ${shift.date}? The record will remain in the schedule history.`)) return;
    await withBusy(async () => {
      await window.api.hr.deleteShift(shift.id);
      await load();
      onNotice("Shift cancelled and kept in schedule history.");
    });
  }

  function selectDay(date: string) {
    setSelectedDate(date);
    setQuickDate(date);
    setEditingShiftId("");
  }

  function editShift(shift: Shift) {
    setEditingShiftId(shift.id);
    setQuickEmployeeId(shift.employee_user_id ?? "");
    setQuickDate(shift.date);
    setQuickStart(shift.start_time);
    setQuickEnd(shift.end_time);
    setQuickLocation(shift.location ?? "");
    setQuickRole(shift.role_label ?? "Pharmacy staff");
    setQuickBreak(String(shift.break_minutes ?? 0));
    setSelectedDate(shift.date);
  }

  async function changeScheduleState(state: "published" | "draft") {
    const start = `${monthId}-01`;
    const end = localDateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const count = monthShifts.filter((shift) => shift.status === (state === "published" ? "draft" : "published")).length;
    if (!count) return onNotice(`There are no ${state === "published" ? "draft" : "published"} shifts to ${state === "published" ? "publish" : "return to draft"} this month.`);
    const verb = state === "published" ? "publish" : "return to draft";
    if (!window.confirm(`${verb[0].toUpperCase()}${verb.slice(1)} ${count} shift(s) for ${monthLabel}? Employees will receive an in-app schedule notice.`)) return;
    await withBusy(async () => {
      const result = await window.api.hr.setScheduleState(start, end, state);
      await load();
      onNotice(`${result.updated} shift(s) ${state === "published" ? "published" : "returned to draft"}.`);
    });
  }

  async function requestLeave() {
    if (!leaveStart || !leaveEnd || leaveEnd < leaveStart) {
      return onNotice("Choose a valid leave period.");
    }
    await withBusy(async () => {
      await window.api.team.requestLeave({
        employee_user_id: canManage ? leaveEmployeeId : undefined,
        leave_type: leaveType,
        start_date: leaveStart,
        end_date: leaveEnd,
        reason: leaveReason.trim() || null,
      });
      setLeaveReason("");
      await load();
      onNotice(canManage ? "Leave recorded for review." : "Leave request sent to the pharmacy administrator.");
    });
  }

  async function requestShiftSwap() {
    if (!swapShiftId || !swapTargetId) return onNotice("Choose one of your published shifts and an active colleague.");
    await withBusy(async () => {
      await window.api.team.requestShiftSwap({ shift_id: swapShiftId, target_user_id: swapTargetId, note: swapNote.trim() || null });
      setSwapNote("");
      await load();
      onNotice("Shift swap request sent to the colleague and pharmacy administrator.");
    });
  }

  async function reviewShiftSwap(item: StaffShiftSwapRequest, status: "approved" | "rejected") {
    const reason = status === "rejected" ? window.prompt("Reason for declining this shift swap (required):")?.trim() ?? "" : "";
    if (status === "rejected" && !reason) return onNotice("Add a reason before declining this swap.");
    await withBusy(async () => {
      await window.api.team.reviewShiftSwap(item.id, status, reason);
      await load();
      onNotice(status === "approved" ? "Swap approved; the reassigned shift is draft until you publish." : "Shift swap declined.");
    });
  }

  async function reviewLeave(leaveId: string, status: "approved" | "rejected") {
    const reason = status === "rejected" ? window.prompt("Reason for declining this request (required):")?.trim() ?? "" : "";
    if (status === "rejected" && !reason) return onNotice("Add a reason before declining this request.");
    await withBusy(async () => {
      await window.api.team.reviewLeave(leaveId, status, reason);
      await load();
      onNotice(status === "approved" ? "Leave request approved." : "Leave request declined.");
    });
  }

  async function askForLeaveInformation(leaveId: string) {
    const reason = window.prompt("What information should the employee provide?")?.trim() ?? "";
    if (!reason) return onNotice("Enter the question for the employee.");
    await withBusy(async () => {
      await window.api.team.reviewLeave(leaveId, "needs_information", reason);
      await load();
      onNotice("Question sent to the employee.");
    });
  }

  async function markNotificationRead(item: StaffNotification) {
    if (item.read_at) return;
    await withBusy(async () => {
      await window.api.team.markNotificationRead(item.id);
      setNotifications((current) => current.map((notice) => notice.id === item.id ? { ...notice, read_at: new Date().toISOString() } : notice));
    });
  }

  async function saveCompensation() {
    if (!employee || !payAmount.trim()) return onNotice("Enter an amount and select an employee.");
    const amount = Number(payAmount);
    if (!Number.isFinite(amount) || amount < 0) return onNotice("Enter a valid non-negative compensation amount.");
    await withBusy(async () => {
      const row = await window.api.team.addCompensation({
        employee_user_id: employee.user_id, effective_date: payEffectiveDate,
        pay_basis: payBasis, amount, currency: payCurrency.toUpperCase(), pay_schedule: paySchedule.trim() || null,
      });
      setCompensation((current) => [row, ...current].sort((a, b) => b.effective_date.localeCompare(a.effective_date)));
      setPayAmount("");
      onNotice("Effective-dated compensation record added to the confidential history.");
    });
  }

  async function saveWorkforce() {
    await withBusy(async () => {
      const updated = await window.api.team.saveWorkforceSettings(workforce);
      setWorkforce(updated);
      await load();
      onNotice("Workforce settings saved.");
    });
  }

  async function punch(eventType: AttendanceEvent["event_type"]) {
    await withBusy(async () => {
      await window.api.team.clock(eventType);
      await load();
      onNotice(`${eventType.replaceAll("_", " ")} recorded.`);
    });
  }

  async function submitTimeCorrection() {
    if (!correctionDate || !correctionReason.trim()) return onNotice("Enter the corrected time and a reason.");
    await withBusy(async () => {
      await window.api.team.requestCorrection({
        event_type: correctionType,
        occurred_at: localInputToUtc(correctionDate, workforce.timezone),
        reason: correctionReason.trim(),
      });
      setCorrectionReason("");
      await load();
      onNotice("Time correction sent for administrator review.");
    });
  }

  async function reviewTimeCorrection(item: TimeCorrectionRequest, status: "approved" | "rejected") {
    const reason = status === "rejected" ? window.prompt("Reason for declining this correction (required):")?.trim() ?? "" : "";
    if (status === "rejected" && !reason) return onNotice("Add a reason before declining this correction.");
    await withBusy(async () => {
      await window.api.team.reviewCorrection(item.id, status, reason);
      await load();
      onNotice(`Time correction ${status}.`);
    });
  }

  function toggleWorkday(day: number) {
    setWorkingDays((current) =>
      current.includes(day) ? current.filter((value) => value !== day) : [...current, day].sort(),
    );
  }

  const today = localDateKey(new Date());
  const todayShifts = shifts.filter((shift) => shift.date === today && shift.status === "published");
  const selectedDayShifts = selectedDate ? shifts.filter((shift) => shift.date === selectedDate
    && (employeeFilter === "all" || shift.employee_user_id === employeeFilter)
    && (shiftStatusFilter === "all" || shift.status === shiftStatusFilter)) : [];
  const ownerStats = canManage ? (
    <div className="staff-stats">
      <div className="staff-stat"><span>Active team</span><strong>{activeStaffMembers.length}</strong><small>of {staffMembers.length} employee accounts</small></div>
      <div className="staff-stat"><span>Scheduled today</span><strong>{todayShifts.length}</strong><small>Published shifts</small></div>
      <div className="staff-stat"><span>Planned hours</span><strong>{scheduledHours.toFixed(1)}</strong><small>Hours assigned this month</small></div>
      <div className="staff-stat"><span>Action queue</span><strong>{pendingLeave + corrections.filter((item) => item.status === "pending").length}</strong><small>{unreadNotifications} unread notice(s)</small></div>
    </div>
  ) : null;

  return (
    <main className="staff-screen">
      <header className="staff-page-header">
        <div>
          <div className="staff-eyebrow">PHARMACY OPERATIONS</div>
          <h1>People &amp; workforce</h1>
          <p>Manage employee records, publish schedules, review requests, and keep a clear activity trail.</p>
        </div>
        <div className="staff-header-actions">
          <span className="staff-notification-count">◉ {unreadNotifications} unread</span>
          {canManage && <div className="staff-invite">
            <input type="email" value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Employee email address" aria-label="Employee email address" />
            <button className="primary" onClick={() => void inviteEmployee()} disabled={busy}>＋ Invite employee</button>
          </div>}
        </div>
      </header>

      {ownerStats}

      {notifications.length > 0 && <section className="staff-section staff-notifications">
        <div className="staff-section-heading"><div><h2>Notifications</h2><p>Schedule updates, leave decisions, and attendance actions.</p></div><span className="staff-count">{unreadNotifications} unread</span></div>
        <div className="staff-notification-list">
          {notifications.slice(0, 5).map((item) => <button key={item.id} className={`staff-notification ${item.read_at ? "read" : "unread"}`} onClick={() => void markNotificationRead(item)}>
            <span className="staff-notification-dot" />
            <span><strong>{item.title}</strong><small>{item.body}</small><time>{formatWorkTime(item.created_at, workforce.timezone)}</time></span>
            {!item.read_at && <em>New</em>}
          </button>)}
        </div>
      </section>}

      {!staffFeaturesReady && <div className="staff-backend-notice">Workforce features are not available on this local backend yet. Apply the latest local Supabase migration and restart its pharmacy-team function.</div>}

      {canManage && <section className="staff-section">
        <div className="staff-section-heading">
          <div><h2>People directory</h2><p>Search staff records, review employment status, and select a profile to edit.</p></div>
          <span className="staff-count">{activeStaffMembers.length} active · {team.length} total</span>
        </div>
        <div className="staff-directory-filters">
          <input value={staffQuery} onChange={(event) => setStaffQuery(event.target.value)} placeholder="Search name, ID, email, role, department…" aria-label="Search employees" />
          <select value={staffStatusFilter} onChange={(event) => setStaffStatusFilter(event.target.value)} aria-label="Filter employment status">
            <option value="all">All statuses</option><option value="active">Active</option><option value="on_leave">On leave</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option>
          </select>
          <select value={departmentFilter} onChange={(event) => setDepartmentFilter(event.target.value)} aria-label="Filter department">
            <option value="all">All departments</option>{departments.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
        </div>
        {visibleTeam.length ? <div className="staff-team-grid">
          {visibleTeam.map((member) => {
            const isSelected = selectedEmployeeId === member.user_id;
            const accent = member.display_color || "#2563eb";
            return <article
              key={member.user_id}
              className={`staff-employee-card ${isSelected ? "selected" : ""}`}
              style={{ "--staff-color": accent } as CSSProperties}
              draggable={member.membership_role === "staff" && member.employment_status === "active"}
              onDragStart={(event) => startEmployeeDrag(event, member)}
              onClick={() => setSelectedEmployeeId(member.user_id)}
              onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") setSelectedEmployeeId(member.user_id); }}
              tabIndex={0}
              aria-label={`Select ${member.display_name || member.email || "employee"}`}
            >
              <div className="staff-card-top">
                {member.avatar_data_url ? <img className="staff-avatar" src={member.avatar_data_url} alt="" /> :
                  <div className="staff-avatar staff-avatar-initials">{initials(member.display_name, member.email)}</div>}
                <span className={`staff-role-badge ${member.membership_role}`}>{member.membership_role === "owner" ? "Admin" : "Employee"}</span>
                <span className={`staff-status ${member.employment_status}`}>{member.employment_status.replace("_", " ")}</span>
                {member.membership_role === "staff" && member.employment_status === "active" && <span className="staff-drag-handle" aria-hidden="true"><span>⠿</span><i /></span>}
              </div>
              <strong className="staff-card-name">{member.display_name || member.email || "Employee"}</strong>
              <span className="staff-card-job">{member.job_title || (member.membership_role === "owner" ? "Pharmacy administrator" : "Pharmacy staff")}</span>
              <div className="staff-card-meta"><span>{member.employee_code}</span><span>{member.department || member.job_title || "No department"}</span></div>
            </article>;
          })}
        </div> : <div className="staff-empty">No employees match these filters. Clear the filters or invite an employee.</div>}
      </section>}

      <section className="staff-section staff-planner-section">
        <div className="staff-section-heading staff-planner-heading">
          <div><h2>Schedule</h2><p>{canManage ? "Plan shifts as drafts, resolve conflicts, and publish the month when it is ready." : "Only confirmed shifts appear here. Changes from your pharmacy are shown in notifications."}</p></div>
          <div className="staff-month-control">
            <button className="icon-button" aria-label="Previous month" onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() - 1, 1))}>‹</button>
            <strong>{monthLabel}</strong>
            <button className="icon-button" aria-label="Next month" onClick={() => setMonth((value) => new Date(value.getFullYear(), value.getMonth() + 1, 1))}>›</button>
            <button className="staff-today" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</button>
            <button className={`staff-view-toggle ${calendarMode === "month" ? "active" : ""}`} onClick={() => setCalendarMode("month")}>Month</button>
            <button className={`staff-view-toggle ${calendarMode === "agenda" ? "active" : ""}`} onClick={() => setCalendarMode("agenda")}>Agenda</button>
          </div>
        </div>

        <div className="staff-schedule-filters">
          {canManage && <select value={employeeFilter} onChange={(event) => setEmployeeFilter(event.target.value)} aria-label="Filter schedule employee"><option value="all">All employees</option>{staffMembers.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email}</option>)}</select>}
          {canManage && <select value={shiftStatusFilter} onChange={(event) => setShiftStatusFilter(event.target.value as typeof shiftStatusFilter)} aria-label="Filter shift status"><option value="all">All shift states</option><option value="draft">Draft</option><option value="published">Published</option><option value="cancelled">Cancelled</option></select>}
          {canManage && <div className="staff-schedule-actions"><button className="primary" disabled={busy} onClick={() => void changeScheduleState("published")}>Publish month</button><button className="secondary" disabled={busy} onClick={() => void changeScheduleState("draft")}>Unpublish month</button></div>}
        </div>

        {calendarMode === "month" ? <div className="staff-calendar">
          <div className="staff-calendar-weekdays">{WEEKDAYS.map((day) => <div key={day}>{day}</div>)}</div>
          <div className="staff-calendar-grid">
            {days.map((day) => {
              const dateKey = localDateKey(day);
              const inMonth = day.getMonth() === month.getMonth();
              const dayShifts = monthShifts.filter((shift) => shift.date === dateKey);
              const isWorkday = employee?.working_days.includes(isoWeekday(day)) ?? false;
              return <div
                key={dateKey}
                className={`staff-day ${inMonth ? "" : "outside"} ${dragOverDate === dateKey ? "drag-over" : ""} ${selectedDate === dateKey ? "selected-day" : ""} ${inMonth && isWorkday && employee ? "expected-workday" : ""}`}
                onDragOver={(event) => { if (inMonth && canManage) { event.preventDefault(); setDragOverDate(dateKey); } }}
                onDragLeave={() => setDragOverDate((current) => current === dateKey ? "" : current)}
                onDrop={(event) => dropOnDay(event, day)}
                onClick={() => { if (inMonth) selectDay(dateKey); }}
                onKeyDown={(event) => { if (inMonth && (event.key === "Enter" || event.key === " ")) selectDay(dateKey); }}
                role="button" tabIndex={inMonth ? 0 : -1} aria-label={`${dateKey}, ${dayShifts.length} shifts`}
              >
                <div className="staff-day-number">{day.getDate()}{dayShifts.length > 0 && <span>{dayShifts.length}</span>}</div>
                <div className="staff-day-shifts">
                  {dayShifts.slice(0, 3).map((shift) => {
                    const person = team.find((member) => member.user_id === shift.employee_user_id);
                    const accent = person?.display_color || "#2563eb";
                    return <div key={shift.id} className={`staff-shift-chip ${shift.status}`} style={{ "--staff-color": accent } as CSSProperties} title={`${shift.staff_name} · ${shift.start_time}–${shift.end_time}`}>
                      <span className="staff-shift-time">{shift.start_time}</span>
                      <span className="staff-shift-name">{shift.staff_name}</span>
                      <span className="staff-shift-status-label">{shift.status}</span>
                    </div>;
                  })}
                  {dayShifts.length > 3 && <button className="staff-overflow" onClick={(event) => { event.stopPropagation(); selectDay(dateKey); }}>+{dayShifts.length - 3} more</button>}
                </div>
                {inMonth && canManage && <span className="staff-drop-hint">Drop staff here</span>}
              </div>;
            })}
          </div>
        </div> : <div className="staff-agenda">
          {monthShifts.length ? monthShifts.map((shift) => {
            const person = team.find((member) => member.user_id === shift.employee_user_id);
            return <article key={shift.id} className={`staff-agenda-row ${shift.status}`}>
              <time>{new Date(`${shift.date}T00:00:00`).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}</time>
              <strong>{shift.staff_name}</strong><span>{shift.role_label || person?.job_title || "Shift"}</span>
              <span>{shift.start_time}–{shift.end_time}{shift.break_minutes ? ` · ${shift.break_minutes}m break` : ""}</span>
              <span>{shift.location || person?.location || "Location not set"}</span>
              <span className={`staff-status ${shift.status}`}>{shift.status}</span>
              {canManage && shift.status !== "cancelled" && <button className="text-button" onClick={() => editShift(shift)}>Edit draft</button>}
            </article>;
          }) : <div className="staff-empty">No shifts match this month and filter.</div>}
        </div>}

        {selectedDate && <div className="staff-day-detail">
          <div className="staff-section-heading"><div><h3>{new Date(`${selectedDate}T00:00:00`).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</h3><p>{selectedDayShifts.length} shift(s) · Select a shift to edit or cancel.</p></div>{canManage && <button className="secondary" onClick={() => { setQuickDate(selectedDate); setEditingShiftId(""); }}>＋ Add shift</button>}</div>
          {selectedDayShifts.length ? <div className="staff-day-detail-list">{selectedDayShifts.map((shift) => <article key={shift.id} className={`staff-day-detail-row ${shift.status}`}>
            <div><strong>{shift.staff_name}</strong><small>{shift.role_label || "Pharmacy staff"} · {shift.location || "Location not set"}</small></div>
            <span>{shift.start_time}–{shift.end_time}{shift.break_minutes ? ` · ${shift.break_minutes} min break` : ""}</span>
            <span className={`staff-status ${shift.status}`}>{shift.status}</span>
            {canManage && shift.status !== "cancelled" && <div><button className="text-button" onClick={() => editShift(shift)}>Edit as draft</button><button className="text-button danger" onClick={() => void removeShift(shift)}>Cancel</button></div>}
          </article>)}</div> : <div className="staff-empty compact">No shifts on this date.</div>}
        </div>}

        {canManage && <div className="staff-quick-shift">
          <div><strong>{editingShiftId ? "Edit shift" : "New draft shift"}</strong><small>Saved changes stay draft until you publish the schedule.</small></div>
          <select value={quickEmployeeId} onChange={(event) => setQuickEmployeeId(event.target.value)} aria-label="Employee for custom shift">
            <option value="">Choose active employee</option>
            {activeStaffMembers.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email}</option>)}
          </select>
          <input type="date" value={quickDate} onChange={(event) => setQuickDate(event.target.value)} aria-label="Shift date" />
          <input type="time" value={quickStart} onChange={(event) => setQuickStart(event.target.value)} aria-label="Shift start time" />
          <span className="staff-time-separator">to</span>
          <input type="time" value={quickEnd} onChange={(event) => setQuickEnd(event.target.value)} aria-label="Shift end time" />
          <input value={quickRole} onChange={(event) => setQuickRole(event.target.value)} placeholder="Role / skill" aria-label="Shift role" />
          <input value={quickLocation} onChange={(event) => setQuickLocation(event.target.value)} placeholder="Location" aria-label="Shift location" />
          <input type="number" min="0" max="600" value={quickBreak} onChange={(event) => setQuickBreak(event.target.value)} placeholder="Break min" aria-label="Break minutes" />
          <button className="secondary" disabled={busy || !quickEmployeeId || !quickDate} onClick={() => void createShift(quickEmployeeId, quickDate, quickStart, quickEnd)}>{editingShiftId ? "Save draft" : "Add draft shift"}</button>
          {editingShiftId && <button className="text-button" onClick={() => setEditingShiftId("")}>Discard edit</button>}
        </div>}
      </section>

      <div className="staff-tools-grid">
        <section className="staff-section staff-tool-card">
          <div className="staff-section-heading"><div><h2>Requests &amp; leave</h2><p>{canManage ? "Review leave requests. Decisions and questions are recorded and sent to the employee." : "Send a leave request and follow its status here."}</p></div></div>
          <div className="staff-form-grid">
            {canManage && <select value={leaveEmployeeId} onChange={(event) => setLeaveEmployeeId(event.target.value)} aria-label="Employee requesting leave">
              <option value="">Choose employee</option>{staffMembers.map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email}</option>)}
            </select>}
            <select value={leaveType} onChange={(event) => setLeaveType(event.target.value as LeaveType)} aria-label="Leave type">
              <option value="sick">Sick leave</option><option value="annual">Annual leave</option><option value="personal">Personal leave</option><option value="unpaid">Unpaid leave</option><option value="family">Family leave</option>
            </select>
            <label><span>From</span><input type="date" value={leaveStart} onChange={(event) => setLeaveStart(event.target.value)} /></label>
            <label><span>To</span><input type="date" value={leaveEnd} onChange={(event) => setLeaveEnd(event.target.value)} /></label>
            <input className="staff-reason-input" value={leaveReason} onChange={(event) => setLeaveReason(event.target.value)} placeholder="Note or reason (optional)" />
            <button className="secondary" disabled={busy || !staffFeaturesReady || (canManage && !leaveEmployeeId)} onClick={() => void requestLeave()}>{canManage ? "Record leave" : "Request leave"}</button>
          </div>
          {leaveRequests.length ? <div className="staff-leave-list">
            {leaveRequests.map((leave) => <article className="staff-leave-row" key={leave.id}>
              <div className="staff-leave-type-icon">{leave.leave_type === "sick" ? "+" : leave.leave_type === "annual" ? "◷" : "◌"}</div>
              <div className="staff-leave-details"><strong>{canManage ? leave.staff_name : "My leave"} <span className="staff-leave-kind">{leave.leave_type} leave</span></strong><small>{leave.start_date} → {leave.end_date}{leave.reason ? ` · ${leave.reason}` : ""}{leave.review_reason ? ` · Admin: ${leave.review_reason}` : ""}</small></div>
              <span className={`staff-status ${leave.status}`}>{leave.status.replace("_", " ")}</span>
              {canManage && (leave.status === "pending" || leave.status === "needs_information") && <div className="staff-leave-actions"><button onClick={() => void reviewLeave(leave.id, "approved")} disabled={busy}>Approve</button>{leave.status === "pending" && <button onClick={() => void askForLeaveInformation(leave.id)} disabled={busy}>Ask info</button>}<button onClick={() => void reviewLeave(leave.id, "rejected")} disabled={busy}>Decline</button><button onClick={() => void window.api.team.withdrawLeave(leave.id).then(load).catch((error) => onNotice(shortError(error)))} disabled={busy}>Cancel</button></div>}
              {!canManage && leave.status === "needs_information" && <button className="secondary staff-leave-resubmit" onClick={() => { const response = window.prompt(leave.review_reason || "Add the requested information")?.trim(); if (response) void withBusy(async () => { await window.api.team.respondLeave(leave.id, response); await load(); onNotice("Your request was resubmitted."); }); }} disabled={busy}>Respond &amp; resubmit</button>}
              {!canManage && (leave.status === "pending" || leave.status === "needs_information") && <button className="text-button danger" onClick={() => void withBusy(async () => { await window.api.team.withdrawLeave(leave.id); await load(); onNotice("Leave request withdrawn."); })} disabled={busy}>Withdraw</button>}
            </article>)}
          </div> : <div className="staff-empty compact">No leave requests to show.</div>}
        </section>

        {canManage && <section className="staff-section staff-tool-card staff-workhours-card">
          <div className="staff-section-heading"><div><h2>Employee profile &amp; working hours</h2><p>Set the card identity, shift template, and weekly availability.</p></div></div>
          {employee ? <>
            <div className="staff-profile-edit">
              <div className="staff-avatar-preview" style={{ "--staff-color": displayColor } as CSSProperties}>
                {avatarDataUrl ? <img src={avatarDataUrl} alt="Employee profile" /> : <span>{initials(displayName, employee.email)}</span>}
              </div>
              <div className="staff-photo-controls"><strong>{employee.employee_code}</strong><label className={`staff-photo-button ${staffFeaturesReady ? "" : "disabled"}`}>{avatarDataUrl ? "Change profile photo" : "Add profile photo"}<input type="file" accept="image/png,image/jpeg,image/webp" disabled={!staffFeaturesReady} onChange={(event) => void choosePhoto(event.target.files?.[0])} /></label>{avatarDataUrl && <button className="link" onClick={() => setAvatarDataUrl(null)} disabled={!staffFeaturesReady}>Remove photo</button>}</div>
              <label className="staff-color-control"><span>Card color</span><input type="color" value={displayColor} onChange={(event) => setDisplayColor(event.target.value)} /></label>
            </div>
            <div className="staff-settings-fields">
              <label><span>Employee name</span><input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={employee.email || "Employee name"} /></label>
              <label><span>Job title</span><input value={jobTitle} onChange={(event) => setJobTitle(event.target.value)} placeholder="Pharmacist, cashier…" /></label>
              <label><span>Employment status</span><select value={employmentStatus} onChange={(event) => setEmploymentStatus(event.target.value as PharmacyEmployee["employment_status"])}><option value="active">Active</option><option value="on_leave">On leave</option><option value="suspended">Suspended</option><option value="deactivated">Deactivated</option></select></label>
              <label><span>Department</span><input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Dispensary, stock, accounts…" /></label>
              <label><span>Location</span><input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Branch or pharmacy site" /></label>
              <label><span>Manager</span><select value={managerUserId} onChange={(event) => setManagerUserId(event.target.value)}><option value="">No manager assigned</option>{team.filter((member) => member.user_id !== employee.user_id).map((member) => <option key={member.user_id} value={member.user_id}>{member.display_name || member.email}</option>)}</select></label>
              <label><span>Contract type</span><input value={contractType} onChange={(event) => setContractType(event.target.value)} placeholder="Full-time, part-time, temporary…" /></label>
              <label><span>Employment start</span><input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} /></label>
              <label><span>Employment end</span><input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} /></label>
              <label><span>Weekly target hours</span><input type="number" min="0" max="80" step="0.5" value={weeklyHours} onChange={(event) => setWeeklyHours(event.target.value)} /></label>
              <label><span>Usual shift</span><div className="staff-time-range"><input type="time" value={shiftStart} onChange={(event) => setShiftStart(event.target.value)} /><span>to</span><input type="time" value={shiftEnd} onChange={(event) => setShiftEnd(event.target.value)} /></div></label>
            </div>
            <div className="staff-workdays"><strong>Working days</strong><div>{WEEKDAYS.map((day, index) => <label key={day} className={workingDays.includes(index + 1) ? "checked" : ""}><input type="checkbox" checked={workingDays.includes(index + 1)} onChange={() => toggleWorkday(index + 1)} />{day}</label>)}</div></div>
            <div className="staff-compensation-panel">
              <div className="staff-section-heading"><div><h3>Compensation history</h3><p>Confidential owner-only records. Changes take effect on the date entered and never overwrite earlier rows.</p></div><span className="staff-count">Payroll preparation {workforce.payroll_preparation_enabled ? "enabled" : "off"}</span></div>
              {workforce.payroll_preparation_enabled ? <>
                <div className="staff-compensation-form">
                  <label><span>Amount</span><input type="number" min="0" step="0.01" value={payAmount} onChange={(event) => setPayAmount(event.target.value)} placeholder="0.00" /></label>
                  <label><span>Basis</span><select value={payBasis} onChange={(event) => setPayBasis(event.target.value as EmployeeCompensation["pay_basis"])}><option value="day">Per day</option><option value="week">Per week</option><option value="month">Per month</option><option value="hour">Per hour</option><option value="annual">Per year</option></select></label>
                  <label><span>Currency</span><input maxLength={3} value={payCurrency} onChange={(event) => setPayCurrency(event.target.value.toUpperCase())} /></label>
                  <label><span>Effective from</span><input type="date" value={payEffectiveDate} onChange={(event) => setPayEffectiveDate(event.target.value)} /></label>
                  <label><span>Pay schedule</span><input value={paySchedule} onChange={(event) => setPaySchedule(event.target.value)} placeholder="Monthly" /></label>
                  <button className="secondary" onClick={() => void saveCompensation()} disabled={busy || !payAmount}>Add history record</button>
                </div>
                {compensation.length > 0 ? <div className="staff-compensation-list">{compensation.map((record) => <div key={record.id}><time>{record.effective_date}</time><strong>{Number(record.amount).toLocaleString()} {record.currency}</strong><span>{record.pay_basis} · {record.pay_schedule || "Schedule not set"}</span></div>)}</div> : <div className="staff-empty compact">No compensation records have been saved.</div>}
              </> : <div className="staff-policy-note">Compensation history is locked until the administrator enables payroll preparation in Workforce settings. Shifa does not calculate statutory payroll.</div>}
            </div>
            <button className="primary staff-save-profile" onClick={() => void saveSettings()} disabled={busy || !staffFeaturesReady}>{busy ? "Saving…" : "Save employee settings"}</button>
          </> : <div className="staff-empty compact">Select an employee card above to edit their profile and usual hours.</div>}
        </section>}
      </div>

      <section className="staff-section staff-swap-section">
        <div className="staff-section-heading"><div><h2>Shift swap requests</h2><p>Employees may propose a colleague for a confirmed shift. Owner approval assigns it as a draft and notifies both employees.</p></div><span className="staff-count">{shiftSwapRequests.filter((item) => item.status === "pending").length} pending</span></div>
        <div className="staff-swap-form">
          <select value={swapShiftId} onChange={(event) => setSwapShiftId(event.target.value)} aria-label="Your published shift to swap">
            <option value="">Choose your published shift</option>{shifts.filter((shift) => shift.employee_user_id === session.user_id && shift.status === "published").map((shift) => <option key={shift.id} value={shift.id}>{shift.date} · {shift.start_time}–{shift.end_time}</option>)}
          </select>
          <select value={swapTargetId} onChange={(event) => setSwapTargetId(event.target.value)} aria-label="Colleague to take your shift"><option value="">Choose active colleague</option>{swapTargets.map((target) => <option key={target.user_id} value={target.user_id}>{target.display_name} · {target.employee_code}</option>)}</select>
          <input value={swapNote} onChange={(event) => setSwapNote(event.target.value)} placeholder="Note for the pharmacy (optional)" aria-label="Shift swap note" />
          <button className="secondary" onClick={() => void requestShiftSwap()} disabled={busy || !swapShiftId || !swapTargetId}>Request swap</button>
        </div>
        {shiftSwapRequests.length ? <div className="staff-swap-list">{shiftSwapRequests.map((item) => <article key={item.id}>
          <div><strong>{item.employee_name} → {item.target_name}</strong><small>{item.shift ? `${item.shift.shift_date} · ${item.shift.start_time.slice(0,5)}–${item.shift.end_time.slice(0,5)} · ${item.shift.role_label || "Shift"}` : "Shift details unavailable"}{item.note ? ` · ${item.note}` : ""}{item.review_reason ? ` · ${item.review_reason}` : ""}</small></div>
          <span className={`staff-status ${item.status}`}>{item.status}</span>
          {canManage && item.status === "pending" && <div><button onClick={() => void reviewShiftSwap(item, "approved")} disabled={busy}>Approve</button><button className="text-button danger" onClick={() => void reviewShiftSwap(item, "rejected")} disabled={busy}>Decline</button></div>}
        </article>)}</div> : <div className="staff-empty compact">No shift swap requests yet.</div>}
      </section>

      {workforce.attendance_enabled && <section className="staff-section staff-attendance-section">
        <div className="staff-section-heading"><div><h2>Attendance &amp; time records</h2><p>Clock events are stored as immutable records; any fix must be submitted as a separate correction request.</p></div><span className="staff-count">{workforce.timezone}</span></div>
        <div className="staff-clock-panel">
          <div><span>Current punch state</span><strong>{myLastAttendance ? myLastAttendance.event_type.replaceAll("_", " ") : "Not clocked in"}</strong><small>{myLastAttendance ? formatWorkTime(myLastAttendance.occurred_at, workforce.timezone) : "No attendance events recorded"}</small></div>
          {(!myLastAttendance || myLastAttendance.event_type === "clock_out") && <button className="primary" onClick={() => void punch("clock_in")} disabled={busy}>Clock in</button>}
          {(myLastAttendance?.event_type === "clock_in" || myLastAttendance?.event_type === "break_end") && <><button className="secondary" onClick={() => void punch("break_start")} disabled={busy}>Start break</button><button className="primary" onClick={() => void punch("clock_out")} disabled={busy}>Clock out</button></>}
          {myLastAttendance?.event_type === "break_start" && <button className="primary" onClick={() => void punch("break_end")} disabled={busy}>End break</button>}
        </div>
        <div className="staff-correction-form">
          <select value={correctionType} onChange={(event) => setCorrectionType(event.target.value as AttendanceEvent["event_type"])} aria-label="Requested attendance correction type"><option value="clock_in">Clock in</option><option value="clock_out">Clock out</option><option value="break_start">Break start</option><option value="break_end">Break end</option></select>
          <input type="datetime-local" value={correctionDate} onChange={(event) => setCorrectionDate(event.target.value)} aria-label="Correct attendance time" />
          <input value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="Why does this record need correction?" aria-label="Correction reason" />
          <button className="secondary" onClick={() => void submitTimeCorrection()} disabled={busy || !correctionDate || !correctionReason.trim()}>Request correction</button>
        </div>
        <div className="staff-section-heading staff-attendance-subheading"><div><h3>{canManage ? "Team attendance · " : "My attendance · "}{monthLabel}</h3><p>Original punches and approved corrections remain individually visible.</p></div></div>
        {attendanceEvents.length ? <div className="staff-attendance-list">{attendanceEvents.map((event) => <article key={event.id}><time>{formatWorkTime(event.occurred_at, workforce.timezone)}</time><strong>{canManage ? event.staff_name : "You"}</strong><span>{event.event_type.replaceAll("_", " ")}</span><small>{event.source.replaceAll("_", " ")}</small></article>)}</div> : <div className="staff-empty compact">No attendance events recorded for this month.</div>}
        {canManage && <><div className="staff-section-heading staff-attendance-subheading"><div><h3>Correction requests</h3><p>Approving creates an additional timestamped event; the original punch is never edited.</p></div></div>
          {corrections.filter((item) => item.status === "pending").length ? <div className="staff-correction-list">{corrections.filter((item) => item.status === "pending").map((item) => <article key={item.id}><div><strong>{item.staff_name} · {item.requested_event_type.replaceAll("_", " ")}</strong><small>{new Date(item.requested_at).toLocaleString()} · {item.reason}</small></div><button onClick={() => void reviewTimeCorrection(item, "approved")} disabled={busy}>Approve</button><button className="text-button danger" onClick={() => void reviewTimeCorrection(item, "rejected")} disabled={busy}>Decline</button></article>)}</div> : <div className="staff-empty compact">No pending corrections.</div>}
        </>}
      </section>}

      {canManage && <section className="staff-section staff-workforce-settings">
        <div className="staff-section-heading"><div><h2>Workforce settings</h2><p>Set the pharmacy’s schedule context and enable controlled modules when their policies are ready.</p></div></div>
        <div className="staff-workforce-grid">
          <label><span>Time zone</span><input value={workforce.timezone} onChange={(event) => setWorkforce((current) => ({ ...current, timezone: event.target.value }))} placeholder="Africa/Khartoum" /></label>
          <label><span>Payroll currency</span><input value={workforce.currency} maxLength={3} onChange={(event) => setWorkforce((current) => ({ ...current, currency: event.target.value.toUpperCase() }))} /></label>
          <label><span>Week starts</span><select value={workforce.week_starts_on} onChange={(event) => setWorkforce((current) => ({ ...current, week_starts_on: Number(event.target.value) }))}><option value={1}>Monday</option><option value={7}>Sunday</option><option value={6}>Saturday</option></select></label>
          <label className="staff-feature-toggle"><input type="checkbox" checked={workforce.attendance_enabled} onChange={(event) => setWorkforce((current) => ({ ...current, attendance_enabled: event.target.checked }))} /><span><strong>Attendance capture</strong><small>Immutable punches and reviewed correction requests. Rounding, overtime, and timesheet approval are not enabled.</small></span></label>
          <label className="staff-feature-toggle"><input type="checkbox" checked={workforce.payroll_preparation_enabled} onChange={(event) => setWorkforce((current) => ({ ...current, payroll_preparation_enabled: event.target.checked }))} /><span><strong>Payroll preparation records</strong><small>Store effective-dated compensation. No gross pay, statutory deductions, or payroll exports are calculated.</small></span></label>
          <button className="primary" onClick={() => void saveWorkforce()} disabled={busy}>Save workforce settings</button>
        </div>
      </section>}

      {canManage && <section className="staff-section staff-audit-section">
        <div className="staff-section-heading"><div><h2>Activity history</h2><p>Owner-only log of employee, schedule, leave, attendance, and compensation changes.</p></div><span className="staff-count">Latest {auditEvents.length}</span></div>
        {auditEvents.length ? <div className="staff-audit-list">{auditEvents.slice(0, 100).map((event) => <article key={event.id}>
          <time>{formatWorkTime(event.occurred_at, workforce.timezone)}</time><strong>{event.action.replaceAll(".", " · ").replaceAll("_", " ")}</strong><span>{event.entity_type}</span><small>{event.actor_name || "System"}</small>
        </article>)}</div> : <div className="staff-empty compact">No workforce actions recorded yet.</div>}
      </section>}

      {canManage && <section className="staff-section staff-team-access">
        <div className="staff-section-heading"><div><h2>Team access</h2><p>Deactivation preserves the employee record and history. Reassign future shifts before deactivating an account.</p></div></div>
        {team.filter((member) => member.membership_role === "staff").length ? <div className="staff-access-list">
          {team.filter((member) => member.membership_role === "staff").map((member) => <div key={member.user_id} className="staff-access-row">
            <div className="staff-access-avatar" style={{ "--staff-color": member.display_color } as CSSProperties}>{member.avatar_data_url ? <img src={member.avatar_data_url} alt="" /> : initials(member.display_name, member.email)}</div>
            <div><strong>{member.display_name || member.email || "Employee"}</strong><small>{member.email}</small></div>
            <span className="staff-access-code">{member.employee_code}</span>
            <span className={`staff-status ${member.employment_status}`}>{member.employment_status.replace("_", " ")}</span>
            {member.employment_status !== "deactivated" && <button className="text-button danger" onClick={() => void removeEmployee(member)} disabled={busy}>Deactivate</button>}
          </div>)}
        </div> : <div className="staff-empty compact">Invite an employee to manage team access here.</div>}
      </section>}

      {!canManage && <div className="staff-current-user-note">Signed in as {session.email ?? "staff member"} · You can view your assigned shifts and manage your leave requests.</div>}
    </main>
  );
}
