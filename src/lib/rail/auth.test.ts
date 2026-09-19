import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  authenticate,
  registerUser,
  getRoleDefaultPath,
  DEMO_ACCOUNTS,
  getAllUsers,
} from "./auth.ts";

describe("RailBlock Role-Based Authentication & Access", () => {
  it("authenticates seeded demo accounts for all 5 operational roles", () => {
    for (const [role, demo] of Object.entries(DEMO_ACCOUNTS)) {
      const res = authenticate(demo.employeeId, demo.passwordHash, demo.role);
      assert.equal(res.ok, true, `Failed to authenticate ${role} demo account`);
      if (res.ok) {
        assert.equal(res.session.role, demo.role);
        assert.equal(res.session.employeeId, demo.employeeId);
        assert.equal(res.session.name, demo.name);
      }
    }
  });

  it("rejects invalid passwords", () => {
    const res = authenticate("ENGG-101", "wrongpassword", "ENGG");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /invalid employee id or password/i);
    }
  });

  it("prevents role mismatch / privilege elevation", () => {
    // S&T user attempting to log into Engineering portal
    const res = authenticate("SNT-201", "rail123", "ENGG");
    assert.equal(res.ok, false);
    if (!res.ok) {
      assert.match(res.error, /belongs to SNT, not ENGG/i);
    }
  });

  it("registers a custom user with role and department pre-locked", () => {
    const customUser = {
      employeeId: "ENGG-TEST-99",
      name: "Harish Chandra",
      role: "ENGG" as const,
      department: "ENGG" as const,
      designation: "Assistant Divisional Engineer",
      passwordHash: "rail123",
    };

    const res = registerUser(customUser);
    assert.equal(res.ok, true);
    if (res.ok) {
      assert.equal(res.session.role, "ENGG");
      assert.equal(res.session.employeeId, "ENGG-TEST-99");
      assert.equal(res.session.designation, "Assistant Divisional Engineer");
    }

    // Attempting to register duplicate ID should fail
    const dupRes = registerUser(customUser);
    assert.equal(dupRes.ok, false);
    if (!dupRes.ok) {
      assert.match(dupRes.error, /already registered/i);
    }
  });

  it("maps each role to its dedicated workspace path", () => {
    assert.equal(getRoleDefaultPath("ENGG"), "/workspace/engineering");
    assert.equal(getRoleDefaultPath("SNT"), "/workspace/snt");
    assert.equal(getRoleDefaultPath("TRD"), "/workspace/trd");
    assert.equal(getRoleDefaultPath("CONTROL"), "/control");
    assert.equal(getRoleDefaultPath("ADMIN"), "/admin");
  });
});
