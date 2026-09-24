import crypto from "crypto";
import { prisma } from "@/lib/prisma";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits for GCM
const PREFIX = "enc:v1:";

/**
 * Derives a 32-byte key from ENCRYPTION_KEY or AUTH_SECRET.
 * In production, fails closed if no secret is configured.
 */
function getEncryptionKey(): Buffer {
    const secret = process.env.ENCRYPTION_KEY || process.env.AUTH_SECRET;
    if (!secret || secret.trim() === "") {
        if (process.env.NODE_ENV === "production") {
            throw new Error(
                "[OCMS Crypto Security] FATAL: ENCRYPTION_KEY or AUTH_SECRET must be configured in production."
            );
        }
        // Deterministic fallback for dev/test environments
        return crypto.createHash("sha256").update("ocms_dev_encryption_secret_key_32bytes!").digest();
    }
    return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a token using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<tag_hex>:<ciphertext_hex>
 */
export function encryptToken(token: string): string {
    if (!token) return "";
    if (token.startsWith(PREFIX)) {
        // Already encrypted
        return token;
    }

    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let ciphertext = cipher.update(token, "utf8", "hex");
    ciphertext += cipher.final("hex");

    const tag = cipher.getAuthTag();

    return `${PREFIX}${iv.toString("hex")}:${tag.toString("hex")}:${ciphertext}`;
}

/**
 * Decrypts a token encrypted with encryptToken.
 * Gracefully handles legacy unencrypted tokens (does not throw if not encrypted).
 */
export function decryptToken(value: string | null | undefined): string {
    if (!value) return "";
    if (!value.startsWith(PREFIX)) {
        // Legacy plaintext token or mock token
        return value;
    }

    const parts = value.split(":");
    if (parts.length !== 5) {
        throw new Error("[OCMS Crypto Security] Corrupted encrypted token format.");
    }

    const [, , ivHex, tagHex, ciphertextHex] = parts;
    if (!ivHex || !tagHex || !ciphertextHex) {
        throw new Error("[OCMS Crypto Security] Malformed encrypted token parts.");
    }

    const key = getEncryptionKey();
    const iv = Buffer.from(ivHex, "hex");
    const tag = Buffer.from(tagHex, "hex");

    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);

    let plaintext = decipher.update(ciphertextHex, "hex", "utf8");
    plaintext += decipher.final("utf8");

    return plaintext;
}

/**
 * Centralized helper to retrieve and decrypt a user's GitHub access token from the database.
 * Returns null if no GitHub account or token exists.
 */
export async function getUserGitHubAccessToken(userId: string): Promise<string | null> {
    try {
        const account = await prisma.account.findFirst({
            where: {
                userId,
                provider: "github",
            },
        });

        if (!account || !account.access_token) {
            return null;
        }

        return decryptToken(account.access_token);
    } catch (err) {
        console.error("[OCMS Crypto] Failed to retrieve GitHub access token:", err);
        return null;
    }
}
