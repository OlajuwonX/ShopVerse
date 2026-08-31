import { describe, expect, it } from "vitest";

import {
  authoriseInternalRequest,
  readBearerToken,
} from "@/server/security/internal-auth";

const SECRET = "a".repeat(32);

describe("readBearerToken", () => {
  it("reads a well-formed bearer header", () => {
    expect(readBearerToken(`Bearer ${SECRET}`)).toBe(SECRET);
    expect(readBearerToken(`bearer ${SECRET}`)).toBe(SECRET);
    expect(readBearerToken(`  Bearer   ${SECRET}  `)).toBe(SECRET);
  });

  it("rejects anything that is not a bearer header", () => {
    for (const header of [null, "", "Basic abc", "Bearer", "Bearer ", SECRET]) {
      expect(readBearerToken(header), String(header)).toBeNull();
    }
  });
});

describe("authoriseInternalRequest", () => {
  it("authorises only the exact configured secret", () => {
    expect(authoriseInternalRequest(`Bearer ${SECRET}`, SECRET)).toBe("authorised");
  });

  it("rejects a wrong secret of the same length", () => {
    expect(authoriseInternalRequest(`Bearer ${"b".repeat(32)}`, SECRET)).toBe(
      "unauthorised",
    );
  });

  it("rejects a secret that is a prefix of the real one", () => {
    expect(authoriseInternalRequest(`Bearer ${"a".repeat(31)}`, SECRET)).toBe(
      "unauthorised",
    );
  });

  it("rejects a missing or malformed header", () => {
    expect(authoriseInternalRequest(null, SECRET)).toBe("unauthorised");
    expect(authoriseInternalRequest("Bearer", SECRET)).toBe("unauthorised");
    expect(authoriseInternalRequest(SECRET, SECRET)).toBe("unauthorised");
  });

  it("reports not_configured when no secret is set, so the route can 404", () => {
    for (const configured of [undefined, ""]) {
      expect(
        authoriseInternalRequest(`Bearer ${SECRET}`, configured),
        String(configured),
      ).toBe("not_configured");
      expect(authoriseInternalRequest(null, configured), String(configured)).toBe(
        "not_configured",
      );
    }
  });

  it("compares hashes, so differing lengths cannot throw", () => {
    expect(() => authoriseInternalRequest("Bearer short", SECRET)).not.toThrow();
    expect(authoriseInternalRequest("Bearer short", SECRET)).toBe("unauthorised");
  });
});
