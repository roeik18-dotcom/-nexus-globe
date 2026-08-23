/** The invariants the geographic model exists to hold. */
import { describe, expect, it } from "vitest";
import { resolveAdministrative, RESOLVER_ID, RESOLVER_COVERAGE, REFERENCE_DATASET } from "../adminResolver";
import { isPlottable, isCountryResolved, unlocated } from "../geographicReference";
import { loadCountries, continentsOf } from "../countryReference";

describe("FAKE_COORDINATES = 0", () => {
  it("never produces a coordinate from a label — not for a city, not ever", () => {
    for (const label of ["תל אביב", "רמת גן", "צפון הארץ", "Tel Aviv", "unknown place"]) {
      const g = resolveAdministrative(label, "test");
      expect(g.latitude).toBeUndefined();
      expect(g.longitude).toBeUndefined();
      expect(isPlottable(g)).toBe(false);
    }
    expect(RESOLVER_COVERAGE.produces_coordinates).toBe(false);
  });
});

describe("RAW_GEO_LABEL_PRESERVED", () => {
  it("keeps the source string untouched beside the resolution", () => {
    const g = resolveAdministrative("תל אביב", "test");
    expect(g.raw_label).toBe("תל אביב");
    expect(g.city_name).toBe("תל אביב");
    const u = resolveAdministrative("מקום שלא קיים", "test");
    expect(u.raw_label).toBe("מקום שלא קיים");
    expect(u.country_code).toBeUndefined();
  });
});

describe("DERIVED_ADMIN_RESOLUTION_EXPLICIT", () => {
  it("marks every country resolution DERIVED with resolver, source and confidence", () => {
    const g = resolveAdministrative("רמת גן", "group geography field");
    expect(g.country_code).toBe("ISR");
    expect(g.provenance).toBe("DERIVED");
    expect(g.resolver).toBe(RESOLVER_ID);
    expect(g.confidence).toBe("HIGH");
    expect(g.source).toBe("group geography field");
    expect(g.because).toContain(REFERENCE_DATASET);
  });

  it("no inferred country is ever marked REAL", () => {
    for (const label of ["תל אביב", "רמת גן", "צפון הארץ"]) {
      expect(resolveAdministrative(label, "t").provenance).toBe("DERIVED");
    }
  });

  it("a region stays REGION — no administrative centroid is implied", () => {
    const g = resolveAdministrative("צפון הארץ", "t");
    expect(g.precision).toBe("REGION");
    expect(g.city_name).toBeUndefined();
    expect(g.confidence).toBe("MEDIUM");
    expect(g.because).toContain("אין נקודה");
  });
});

describe("UNLOCATED_FIRST_CLASS", () => {
  it("an unknown label stays UNLOCATED rather than resolving to a wrong country", () => {
    const g = resolveAdministrative("Somewhere Nobody Recorded", "t");
    expect(g.precision).toBe("UNLOCATED");
    expect(isCountryResolved(g)).toBe(false);
    expect(g.because).toContain("UNLOCATED");
  });

  it("no geography at all is a state with a reason, not a blank", () => {
    const g = unlocated(null, "t");
    expect(g.precision).toBe("UNLOCATED");
    expect(g.because).toContain("לא נרשמה גאוגרפיה");
  });
});

describe("reference geography", () => {
  it("loads the real Natural Earth admin-0 dataset", () => {
    const c = loadCountries();
    expect(c.length).toBe(177);
    expect(c.find((x) => x.code === "ISR")?.continent).toBe("Asia");
    const conts = continentsOf(c);
    expect(conts.length).toBe(8);
    expect(conts.reduce((a, x) => a + x.countries, 0)).toBe(177);
  });
});
