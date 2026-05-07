/**
 * Auth token storage (in home directory for security)
 */
/**
 * Auth token storage structure
 */
export interface AuthToken {
    apiKey: string;
    createdAt: string;
}
/**
 * Get the global auth directory path (in home directory)
 */
export declare function getGlobalAuthDir(): string;
/**
 * Ensure the global auth directory exists
 */
export declare function ensureGlobalAuthDir(): void;
/**
 * Get the path to the auth token file (in home directory)
 */
export declare function getAuthPath(): string;
/**
 * Check if an auth token exists
 */
export declare function hasAuthToken(): boolean;
/**
 * Load the auth token
 * Returns null if not found or corrupted
 */
export declare function loadAuthToken(): AuthToken | null;
/**
 * Get the API key from env var or storage
 * Priority: LETTA_API_KEY env var > stored token
 * (Env vars override stored config - standard CLI convention)
 */
export declare function getApiKey(): string | null;
/**
 * Save the auth token (in home directory)
 * Sets restrictive file permissions (0600) on Unix-like systems
 */
export declare function saveAuthToken(apiKey: string): AuthToken;
/**
 * Clear the auth token
 */
export declare function clearAuthToken(): boolean;
/**
 * Prompt user for API key interactively
 */
export declare function promptForApiKey(): Promise<string>;
