import type { Department, Role } from "./types";

export interface UserSession {
  userId: string;
  employeeId: string;
  name: string;
  role: Role;
  department: Department | "CONTROL" | "ADMIN";
  designation: string;
}

export interface PrototypeUser extends UserSession {
  passwordHash: string;
}

export const DEMO_ACCOUNTS: Record<Role, PrototypeUser> = {
  ENGG: {
    userId: "u-engg-101",
    employeeId: "ENGG-101",
    name: "Ramesh Verma",
    role: "ENGG",
    department: "ENGG",
    designation: "SSE / Permanent Way (Sonipat)",
    passwordHash: "rail123",
  },
  SNT: {
    userId: "u-snt-201",
    employeeId: "SNT-201",
    name: "Suresh Sharma",
    role: "SNT",
    department: "SNT",
    designation: "SSE / Signal & Telecom (Panipat)",
    passwordHash: "rail123",
  },
  TRD: {
    userId: "u-trd-301",
    employeeId: "TRD-301",
    name: "Vikram Singh",
    role: "TRD",
    department: "TRD",
    designation: "SSE / Traction Distribution (Kurukshetra)",
    passwordHash: "rail123",
  },
  CONTROL: {
    userId: "u-ctrl-401",
    employeeId: "CTRL-401",
    name: "Rajesh Gupta",
    role: "CONTROL",
    department: "CONTROL",
    designation: "Chief Section Controller (Delhi Division)",
    passwordHash: "rail123",
  },
  ADMIN: {
    userId: "u-adm-001",
    employeeId: "ADM-001",
    name: "Amitabh Sen",
    role: "ADMIN",
    department: "ADMIN",
    designation: "System Administrator (CRIS/HQ)",
    passwordHash: "rail123",
  },
};

const SESSION_KEY = "railblock_session_v1";
const USERS_KEY = "railblock_users_v1";

export function getSession(): UserSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (raw) {
      return JSON.parse(raw) as UserSession;
    }
  } catch (err) {
    console.warn("Corrupted session data cleared:", err);
    clearSession();
  }
  return null;
}

export function saveSession(session: UserSession): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } catch (err) {
    console.warn("Failed to persist session to localStorage:", err);
  }
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(SESSION_KEY);
  } catch (err) {
    console.warn("Failed to clear session:", err);
  }
}

let memoryUsers: PrototypeUser[] = [];

export function getAllUsers(): PrototypeUser[] {
  const base = Object.values(DEMO_ACCOUNTS);
  if (typeof window === "undefined") {
    return [...base, ...memoryUsers];
  }
  try {
    const raw = localStorage.getItem(USERS_KEY);
    if (raw) {
      const custom = JSON.parse(raw) as PrototypeUser[];
      if (Array.isArray(custom)) {
        return [...base, ...custom];
      }
    }
  } catch (err) {
    console.warn("Could not load custom users:", err);
  }
  return [...base, ...memoryUsers];
}

export function authenticate(
  employeeId: string,
  password: string,
  expectedRole?: Role,
): { ok: true; session: UserSession } | { ok: false; error: string } {
  const cleanId = employeeId.trim().toUpperCase();
  const cleanPass = password.trim();

  if (!cleanId || !cleanPass) {
    return { ok: false, error: "Please provide both Employee ID and password." };
  }

  const users = getAllUsers();
  const match = users.find((u) => u.employeeId.toUpperCase() === cleanId);

  if (!match) {
    return { ok: false, error: "Invalid Employee ID or password." };
  }

  if (match.passwordHash !== cleanPass) {
    return { ok: false, error: "Invalid Employee ID or password." };
  }

  if (expectedRole && match.role !== expectedRole) {
    return {
      ok: false,
      error: `Employee ${match.employeeId} belongs to ${match.role}, not ${expectedRole}. Please access your designated operational workspace.`,
    };
  }

  const session: UserSession = {
    userId: match.userId,
    employeeId: match.employeeId,
    name: match.name,
    role: match.role,
    department: match.department,
    designation: match.designation,
  };

  saveSession(session);
  return { ok: true, session };
}

export function registerUser(
  user: Omit<PrototypeUser, "userId">,
): { ok: true; session: UserSession } | { ok: false; error: string } {
  const cleanId = user.employeeId.trim().toUpperCase();
  const cleanName = user.name.trim();
  const cleanPass = user.passwordHash.trim();

  if (!cleanName || cleanName.length < 3) {
    return { ok: false, error: "Full Name must be at least 3 characters." };
  }
  if (!cleanId || cleanId.length < 3) {
    return { ok: false, error: "Employee ID must be at least 3 characters." };
  }
  if (!cleanPass || cleanPass.length < 4) {
    return { ok: false, error: "Password must be at least 4 characters." };
  }

  const existing = getAllUsers();
  if (existing.some((u) => u.employeeId.toUpperCase() === cleanId)) {
    return { ok: false, error: `Employee ID '${cleanId}' is already registered.` };
  }

  const newUser: PrototypeUser = {
    ...user,
    userId: `u-${user.role.toLowerCase()}-${Date.now().toString().slice(-4)}`,
    employeeId: cleanId,
    name: cleanName,
    passwordHash: cleanPass,
  };

  if (typeof window !== "undefined") {
    try {
      const customRaw = localStorage.getItem(USERS_KEY);
      const customList = customRaw ? (JSON.parse(customRaw) as PrototypeUser[]) : [];
      customList.push(newUser);
      localStorage.setItem(USERS_KEY, JSON.stringify(customList));
    } catch (err) {
      console.warn("Failed to store custom user:", err);
    }
  }
  memoryUsers.push(newUser);

  const session: UserSession = {
    userId: newUser.userId,
    employeeId: newUser.employeeId,
    name: newUser.name,
    role: newUser.role,
    department: newUser.department,
    designation: newUser.designation,
  };

  saveSession(session);
  return { ok: true, session };
}

export function revokeUser(employeeId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const customRaw = localStorage.getItem(USERS_KEY);
    if (!customRaw) return false;
    let customList = JSON.parse(customRaw) as PrototypeUser[];
    customList = customList.filter((u) => u.employeeId.toUpperCase() !== employeeId.toUpperCase());
    localStorage.setItem(USERS_KEY, JSON.stringify(customList));
    memoryUsers = memoryUsers.filter((u) => u.employeeId.toUpperCase() !== employeeId.toUpperCase());
    return true;
  } catch (err) {
    console.warn("Failed to revoke user:", err);
    return false;
  }
}

export function getRoleDefaultPath(role: Role): string {
  switch (role) {
    case "CONTROL":
      return "/control";
    case "ADMIN":
      return "/admin";
    case "ENGG":
      return "/workspace/engineering";
    case "SNT":
      return "/workspace/snt";
    case "TRD":
      return "/workspace/trd";
    default:
      return "/access";
  }
}
