export interface KatrixBiometricsConfig {
    /** App name shown to the user during registration (e.g. "My App") */
    appName: string;
    /** Relying Party ID — must match your domain. Defaults to window.location.hostname */
    rpId?: string;
    /** User identifier (e.g. user ID or email) */
    userId: string;
    /** Username shown during registration */
    userName: string;
    /** Display name shown during registration */
    userDisplayName?: string;
    /** Prefix for localStorage keys. Defaults to "katrix_bio" */
    storagePrefix?: string;
    /** Timeout in ms for WebAuthn operations. Defaults to 60000 */
    timeout?: number;
    /** Custom storage adapter. Defaults to localStorage */
    storage?: StorageAdapter;
}
export interface StorageAdapter {
    get(key: string): string | null;
    set(key: string, value: string): void;
    remove(key: string): void;
}
export interface BiometricStatus {
    available: boolean;
    linked: boolean;
    credentialId: string | null;
}
export type BiometricResult = {
    success: true;
} | {
    success: false;
    error: BiometricErrorDetail;
};
export type BiometricError = 'NOT_SUPPORTED' | 'HTTPS_REQUIRED' | 'NOT_ALLOWED' | 'ALREADY_REGISTERED' | 'NOT_FOUND' | 'DOMAIN_ERROR' | 'UNKNOWN';
export interface BiometricErrorDetail {
    code: BiometricError;
    message: string;
    raw?: unknown;
}
