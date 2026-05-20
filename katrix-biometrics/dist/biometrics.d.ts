import type { KatrixBiometricsConfig, BiometricStatus, BiometricResult } from './types';
export declare class KatrixBiometrics {
    private readonly cfg;
    private get KEY_CRED_ID();
    private get KEY_LINKED();
    constructor(config: KatrixBiometricsConfig);
    /** Check support and linking status */
    getStatus(): BiometricStatus;
    /** Returns true if WebAuthn is supported in this browser */
    isSupported(): boolean;
    /**
     * REGISTER — Creates a new WebAuthn credential and stores it.
     * Call this once per device, typically on a "Link biometrics" button.
     */
    register(): Promise<BiometricResult>;
    /**
     * AUTHENTICATE — Verifies the user with their stored credential.
     * Call this on login. Returns success:true if verified.
     */
    authenticate(): Promise<BiometricResult>;
    /**
     * UNLINK — Removes stored credentials from storage.
     * The device credential itself is NOT revoked (WebAuthn has no revocation API),
     * but the user won't be able to log in with biometrics until re-registering.
     */
    unlink(): void;
    private preflight;
}
