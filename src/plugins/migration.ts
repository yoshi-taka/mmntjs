import { configure, report as reportFn } from "../migration";

interface MigrationRegistrableMoment {
  config?: unknown;
  report?: unknown;
}

export function registerMigrationApi(moment: MigrationRegistrableMoment): void {
  moment.config = configure;
  moment.report = reportFn;
}
