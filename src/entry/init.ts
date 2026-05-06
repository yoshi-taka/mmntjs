import { moment } from "../core/factory";
import { registerCoreApi } from "../plugins/core";
import { registerDisplayApi } from "../plugins/display";
import { registerBuiltinTestLocales } from "../plugins/test-locales";
import { registerTemporalBridge } from "../plugins/temporal";
import { registerMigrationApi } from "../plugins/migration";
import { initializeLocaleEntry } from "./locale-init";

type MigrationMoment = Record<string, unknown>;
type TemporalMoment = { fn: Record<string, unknown>; fromTemporal?: (t: unknown) => unknown };

export function initializeCoreEntry(): void {
  registerCoreApi();
  registerDisplayApi();
}

export function initializeFullEntry(): void {
  initializeCoreEntry();
  initializeLocaleEntry();
  registerBuiltinTestLocales();
  registerMigrationApi(moment as MigrationMoment);
  registerTemporalBridge(moment as TemporalMoment);
}
