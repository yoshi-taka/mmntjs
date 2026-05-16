/**
 * DST boundary tests.
 *
 * Uses moment-timezone as oracle for all expectations.
 * Covers spring-forward, fall-back, and DST-observing zones across hemispheres.
 */
/* oxlint-disable no-explicit-any */
import { describe, test, expect } from "bun:test";
import { moment, momentTimezone, oracleEqual } from "./helper";

/* ------------------------------------------------------------------ */
/*  America/New_York spring forward (2012-03-11)                      */
/* ------------------------------------------------------------------ */

describe("America/New_York spring forward 2012", () => {
  const inputs = [
    "2012-03-11 01:59:59",
    "2012-03-11 02:00:00",
    "2012-03-11 02:30:00",
    "2012-03-11 02:59:59",
    "2012-03-11 03:00:00",
  ];
  for (const input of inputs) {
    test(input, () => {
      oracleEqual(
        moment.tz(input, "America/New_York"),
        momentTimezone.tz(input, "America/New_York"),
      );
    });
  }
});

/* ------------------------------------------------------------------ */
/*  America/New_York fall back (2012-11-04)                           */
/* ------------------------------------------------------------------ */

describe("America/New_York fall back 2012", () => {
  const inputs = [
    "2012-11-04 00:59:59",
    "2012-11-04 01:00:00",
    "2012-11-04 01:30:00",
    "2012-11-04 01:59:59",
    "2012-11-04 02:00:00",
  ];
  for (const input of inputs) {
    test(input, () => {
      oracleEqual(
        moment.tz(input, "America/New_York"),
        momentTimezone.tz(input, "America/New_York"),
      );
    });
  }

  test("01:30 with -04:00 offset (EDT, first occurrence)", () => {
    oracleEqual(
      moment.tz("2012-11-04 01:30:00-04:00", "America/New_York"),
      momentTimezone.tz("2012-11-04 01:30:00-04:00", "America/New_York"),
    );
  });

  test("01:30 with -05:00 offset (EST, second occurrence)", () => {
    oracleEqual(
      moment.tz("2012-11-04 01:30:00-05:00", "America/New_York"),
      momentTimezone.tz("2012-11-04 01:30:00-05:00", "America/New_York"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Europe/London spring forward (2012-03-25)                         */
/* ------------------------------------------------------------------ */

describe("Europe/London spring forward 2012", () => {
  const inputs = ["2012-03-25 00:59:59", "2012-03-25 01:00:00", "2012-03-25 01:30:00"];
  for (const input of inputs) {
    test(input, () => {
      oracleEqual(moment.tz(input, "Europe/London"), momentTimezone.tz(input, "Europe/London"));
    });
  }

  test("2012-03-25 02:00:00", () => {
    oracleEqual(
      moment.tz("2012-03-25 02:00:00", "Europe/London"),
      momentTimezone.tz("2012-03-25 02:00:00", "Europe/London"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Europe/London fall back (2012-10-28)                              */
/* ------------------------------------------------------------------ */

describe("Europe/London fall back 2012", () => {
  const inputs = [
    "2012-10-28 01:59:59",
    "2012-10-28 02:00:00",
    "2012-10-28 02:30:00",
    "2012-10-28 02:59:59",
    "2012-10-28 03:00:00",
  ];
  for (const input of inputs) {
    test(input, () => {
      oracleEqual(moment.tz(input, "Europe/London"), momentTimezone.tz(input, "Europe/London"));
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Europe/Berlin spring forward (2012-03-25)                         */
/* ------------------------------------------------------------------ */

describe("Europe/Berlin spring forward 2012", () => {
  const inputs = [
    "2012-03-25 01:59:59",
    "2012-03-25 02:00:00",
    "2012-03-25 02:30:00",
    "2012-03-25 02:59:59",
    "2012-03-25 03:00:00",
  ];
  for (const input of inputs) {
    test(input, () => {
      oracleEqual(moment.tz(input, "Europe/Berlin"), momentTimezone.tz(input, "Europe/Berlin"));
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Europe/Berlin fall back (2012-10-28)                              */
/* ------------------------------------------------------------------ */

describe("Europe/Berlin fall back 2012", () => {
  const inputs = ["2012-10-28 02:59:59", "2012-10-28 03:00:00"];
  for (const input of inputs) {
    test(input, () => {
      oracleEqual(moment.tz(input, "Europe/Berlin"), momentTimezone.tz(input, "Europe/Berlin"));
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Australia/Sydney spring forward (2012-10-07) — southern hemisphere */
/* ------------------------------------------------------------------ */

describe("Australia/Sydney spring forward 2012", () => {
  const inputs = [
    "2012-10-06 23:59:59",
    "2012-10-07 00:00:00",
    "2012-10-07 00:30:00",
    "2012-10-07 01:00:00",
    "2012-10-07 02:00:00",
  ];
  for (const input of inputs) {
    test(input, () => {
      oracleEqual(
        moment.tz(input, "Australia/Sydney"),
        momentTimezone.tz(input, "Australia/Sydney"),
      );
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Australia/Sydney fall back (2012-04-01)                           */
/* ------------------------------------------------------------------ */

describe("Australia/Sydney fall back 2012", () => {
  const inputs = [
    "2012-03-31 23:59:59",
    "2012-04-01 01:00:00",
    "2012-04-01 02:00:00",
    "2012-04-01 02:30:00",
    "2012-04-01 02:59:59",
    "2012-04-01 03:00:00",
  ];
  for (const input of inputs) {
    test(input, () => {
      oracleEqual(
        moment.tz(input, "Australia/Sydney"),
        momentTimezone.tz(input, "Australia/Sydney"),
      );
    });
  }
});

/* ------------------------------------------------------------------ */
/*  Australia/Adelaide — southern hemisphere with :30 offset          */
/* ------------------------------------------------------------------ */

describe("Australia/Adelaide DST 2024", () => {
  test("autumn: 02:59:59 before fall-back", () => {
    oracleEqual(
      moment.tz("2024-04-06 02:59:59", "Australia/Adelaide"),
      momentTimezone.tz("2024-04-06 02:59:59", "Australia/Adelaide"),
    );
  });

  test("autumn: 03:00 after fall-back", () => {
    oracleEqual(
      moment.tz("2024-04-07 03:00:00", "Australia/Adelaide"),
      momentTimezone.tz("2024-04-07 03:00:00", "Australia/Adelaide"),
    );
  });

  test("spring-forward: 02:30", () => {
    oracleEqual(
      moment.tz("2024-10-06 02:30:00", "Australia/Adelaide"),
      momentTimezone.tz("2024-10-06 02:30:00", "Australia/Adelaide"),
    );
  });
});

/* ------------------------------------------------------------------ */
/*  Pacific/Auckland                                                  */
/* ------------------------------------------------------------------ */

describe("Pacific/Auckland DST 2024", () => {
  test("autumn: 02:59:59 before fall-back", () => {
    oracleEqual(
      moment.tz("2024-04-06 02:59:59", "Pacific/Auckland"),
      momentTimezone.tz("2024-04-06 02:59:59", "Pacific/Auckland"),
    );
  });

  test("winter valueOf matches oracle", () => {
    const ts = 1587126975779;
    const mm = moment.utc(ts).tz("Pacific/Auckland");
    const om = momentTimezone.utc(ts).tz("Pacific/Auckland");
    oracleEqual(mm, om);
  });
});

/* ------------------------------------------------------------------ */
/*  Pacific/Chatham — unusual +12:45/+13:45 offset                    */
/* ------------------------------------------------------------------ */

describe("Pacific/Chatham DST", () => {
  test("spring forward 2024-09-29", () => {
    const inputs = ["2024-09-29 02:44:59", "2024-09-29 02:45:00", "2024-09-29 03:00:00"];
    for (const input of inputs) {
      oracleEqual(moment.tz(input, "Pacific/Chatham"), momentTimezone.tz(input, "Pacific/Chatham"));
    }
  });

  test("fall back 2024-04-07", () => {
    const inputs = ["2024-04-07 02:44:59", "2024-04-07 02:45:00", "2024-04-07 03:00:00"];
    for (const input of inputs) {
      oracleEqual(moment.tz(input, "Pacific/Chatham"), momentTimezone.tz(input, "Pacific/Chatham"));
    }
  });
});

/* ------------------------------------------------------------------ */
/*  isDST oracle consistency                                          */
/* ------------------------------------------------------------------ */

describe("isDST consistency with oracle", () => {
  const DST_TEST_CASES: { input: string; zone: string }[] = [
    { input: "2024-01-15 12:00", zone: "America/New_York" },
    { input: "2024-07-15 12:00", zone: "America/New_York" },
    { input: "2024-01-15 12:00", zone: "Europe/London" },
    { input: "2024-07-15 12:00", zone: "Europe/London" },
    { input: "2024-01-15 12:00", zone: "Australia/Sydney" },
    { input: "2024-07-15 12:00", zone: "Australia/Sydney" },
  ];

  for (const { input, zone } of DST_TEST_CASES) {
    test(`${zone} at ${input} isDST matches oracle`, () => {
      const mm = moment.tz(input, zone);
      const om = momentTimezone.tz(input, zone);
      expect(mm.isDST()).toBe(om.isDST());
    });
  }

  test("UTC is never DST", () => {
    expect(moment.utc().isDST()).toBe(false);
    expect(moment.tz("UTC").isDST()).toBe(false);
  });

  test("America/Phoenix is never DST", () => {
    const mm = moment.tz("2024-07-15 12:00", "America/Phoenix");
    expect(mm.isDST()).toBe(false);
  });
});
