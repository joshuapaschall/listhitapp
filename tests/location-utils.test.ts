import { describe, expect, test } from "@jest/globals";
import { searchLocations } from "../lib/location-utils";

describe("searchLocations", () => {
  test("searching by city returns formatted \"City (ST)\"", () => {
    const results = searchLocations("los angeles");
    expect(results[0]).toBe("Los Angeles (CA)");
  });

  test("searching by county returns \"County (ST)\"", () => {
    const results = searchLocations("cook");
    expect(results[0]).toBe("Cook County (IL)");
  });

  test("searching by state ID returns \"ST, USA\"", () => {
    const results = searchLocations("TX");
    expect(results).toContain("TX, USA");
  });
});
