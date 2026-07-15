import { repos, type DbHandle } from "@openlocale/db";
import { verifyLicense, hasFeature, type VerifyResult } from "@openlocale/license";
import type { LicenseFeature } from "@openlocale/shared";

const SETTINGS_KEY = "license_key";

/**
 * Instance-wide license state: loaded from the settings table, verified
 * offline, cached in memory, refreshed on updates.
 */
export class LicenseState {
  private cached: VerifyResult | null = null;

  constructor(private handle: DbHandle) {}

  async current(): Promise<VerifyResult> {
    if (this.cached) return this.cached;
    const key = await repos.settings.get(this.handle, SETTINGS_KEY);
    this.cached = key ? verifyLicense(key) : { valid: false, reason: "no license installed" };
    return this.cached;
  }

  async setKey(key: string): Promise<VerifyResult> {
    const result = verifyLicense(key);
    if (result.valid) {
      await repos.settings.set(this.handle, SETTINGS_KEY, key.trim());
      this.cached = result;
    }
    return result;
  }

  async removeKey(): Promise<void> {
    await repos.settings.remove(this.handle, SETTINGS_KEY);
    this.cached = { valid: false, reason: "no license installed" };
  }

  async allows(feature: LicenseFeature): Promise<boolean> {
    return hasFeature(await this.current(), feature);
  }
}
