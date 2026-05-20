"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.KatrixBiometrics = void 0;
const storage_1 = require("./storage");
// ─── HELPERS ─────────────────────────────────────────────────────────────────
function bufferToBase64(buffer) {
    return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}
function base64ToUint8Array(b64) {
    return Uint8Array.from(atob(b64), c => c.charCodeAt(0));
}
function makeError(code, message, raw) {
    return { code, message, raw };
}
function mapDOMError(e) {
    if (!(e instanceof Error)) {
        return makeError('UNKNOWN', 'Unknown error', e);
    }
    switch (e.name) {
        case 'NotAllowedError':
            return makeError('NOT_ALLOWED', 'User cancelled or the operation timed out.', e);
        case 'InvalidStateError':
            return makeError('ALREADY_REGISTERED', 'A credential already exists for this device.', e);
        case 'SecurityError':
            return makeError('DOMAIN_ERROR', 'Domain mismatch — ensure rpId matches your hostname.', e);
        case 'NotSupportedError':
            return makeError('NOT_SUPPORTED', 'This authenticator does not support the requested operation.', e);
        default:
            return makeError('UNKNOWN', e.message || 'An unknown error occurred.', e);
    }
}
// ─── CORE CLASS ──────────────────────────────────────────────────────────────
class KatrixBiometrics {
    get KEY_CRED_ID() {
        return `${this.cfg.storagePrefix}_cred_id`;
    }
    get KEY_LINKED() {
        return `${this.cfg.storagePrefix}_linked`;
    }
    constructor(config) {
        this.cfg = {
            storagePrefix: 'katrix_bio',
            timeout: 60000,
            storage: new storage_1.LocalStorageAdapter(),
            ...config,
        };
    }
    // ─── PUBLIC API ────────────────────────────────────────────────────────────
    /** Check support and linking status */
    getStatus() {
        return {
            available: this.isSupported(),
            linked: this.cfg.storage.get(this.KEY_LINKED) === 'true',
            credentialId: this.cfg.storage.get(this.KEY_CRED_ID),
        };
    }
    /** Returns true if WebAuthn is supported in this browser */
    isSupported() {
        return typeof window !== 'undefined' && !!window.PublicKeyCredential;
    }
    /**
     * REGISTER — Creates a new WebAuthn credential and stores it.
     * Call this once per device, typically on a "Link biometrics" button.
     */
    async register() {
        const guard = this.preflight();
        if (guard)
            return { success: false, error: guard };
        try {
            const challenge = crypto.getRandomValues(new Uint8Array(32));
            const rpId = this.cfg.rpId ?? window.location.hostname;
            const options = {
                publicKey: {
                    challenge,
                    rp: { name: this.cfg.appName, id: rpId },
                    user: {
                        id: new TextEncoder().encode(this.cfg.userId),
                        name: this.cfg.userName,
                        displayName: this.cfg.userDisplayName ?? this.cfg.userName,
                    },
                    pubKeyCredParams: [
                        { alg: -7, type: 'public-key' }, // ES256
                        { alg: -257, type: 'public-key' }, // RS256
                    ],
                    authenticatorSelection: {
                        authenticatorAttachment: 'platform',
                        userVerification: 'required',
                        residentKey: 'discouraged',
                    },
                    timeout: this.cfg.timeout,
                },
            };
            const credential = await navigator.credentials.create(options);
            if (!credential)
                throw new DOMException('No credential returned', 'UnknownError');
            // Persist credential ID
            const credId = bufferToBase64(credential.rawId);
            this.cfg.storage.set(this.KEY_CRED_ID, credId);
            this.cfg.storage.set(this.KEY_LINKED, 'true');
            return { success: true };
        }
        catch (e) {
            // If already registered on device, mark as linked anyway
            if (e instanceof Error && e.name === 'InvalidStateError') {
                this.cfg.storage.set(this.KEY_LINKED, 'true');
            }
            return { success: false, error: mapDOMError(e) };
        }
    }
    /**
     * AUTHENTICATE — Verifies the user with their stored credential.
     * Call this on login. Returns success:true if verified.
     */
    async authenticate() {
        const guard = this.preflight();
        if (guard)
            return { success: false, error: guard };
        try {
            const challenge = crypto.getRandomValues(new Uint8Array(32));
            const rpId = this.cfg.rpId ?? window.location.hostname;
            const storedCredId = this.cfg.storage.get(this.KEY_CRED_ID);
            const publicKeyOptions = {
                challenge,
                rpId,
                userVerification: 'required',
                timeout: this.cfg.timeout,
                ...(storedCredId
                    ? {
                        allowCredentials: [
                            {
                                type: 'public-key',
                                id: base64ToUint8Array(storedCredId).buffer,
                                transports: ['internal'],
                            },
                        ],
                    }
                    : {}),
            };
            const credential = await navigator.credentials.get({ publicKey: publicKeyOptions });
            if (!credential)
                throw new DOMException('No credential returned', 'UnknownError');
            return { success: true };
        }
        catch (e) {
            return { success: false, error: mapDOMError(e) };
        }
    }
    /**
     * UNLINK — Removes stored credentials from storage.
     * The device credential itself is NOT revoked (WebAuthn has no revocation API),
     * but the user won't be able to log in with biometrics until re-registering.
     */
    unlink() {
        this.cfg.storage.remove(this.KEY_CRED_ID);
        this.cfg.storage.remove(this.KEY_LINKED);
    }
    // ─── PRIVATE ──────────────────────────────────────────────────────────────
    preflight() {
        if (!this.isSupported()) {
            return makeError('NOT_SUPPORTED', 'WebAuthn is not supported in this browser.');
        }
        const isLocalhost = window.location.hostname === 'localhost' ||
            window.location.hostname === '127.0.0.1';
        if (window.location.protocol !== 'https:' && !isLocalhost) {
            return makeError('HTTPS_REQUIRED', 'WebAuthn requires HTTPS (except on localhost).');
        }
        return null;
    }
}
exports.KatrixBiometrics = KatrixBiometrics;
