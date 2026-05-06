import { moment } from "../core/factory";
import { registerCoreApi } from "../plugins/core";
import { registerDisplayApi } from "../plugins/display";
import { registerLocaleApi } from "../plugins/locale";
import { registerBuiltinTestLocales } from "../plugins/test-locales";
import { registerTemporalBridge } from "../plugins/temporal";
import { registerMigrationApi } from "../plugins/migration";

type MigrationMoment = Record<string, unknown>;
type TemporalMoment = { fn: Record<string, unknown>; fromTemporal?: (t: unknown) => unknown };

export function initializeCoreEntry(): void {
  registerCoreApi();
  registerDisplayApi();
  registerLocaleApi();
}

export function initializeFullEntry(): void {
  initializeCoreEntry();
  registerBuiltinTestLocales();
  registerMigrationApi(moment as MigrationMoment);
  registerTemporalBridge(moment as TemporalMoment);
}
