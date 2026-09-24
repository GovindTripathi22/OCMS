import { encryptToken, decryptToken } from "@/lib/crypto";

describe("Token Encryption (AES-256-GCM)", () => {
    it("encrypts and decrypts a token correctly", () => {
        const originalToken = "gho_16CharactersSecretToken1234567890";
        const encrypted = encryptToken(originalToken);

        expect(encrypted).not.toBe(originalToken);
        expect(encrypted.startsWith("enc:v1:")).toBe(true);

        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(originalToken);
    });

    it("generates unique ciphertexts for identical inputs due to random IV", () => {
        const token = "gho_same_input_twice_987654321";
        const enc1 = encryptToken(token);
        const enc2 = encryptToken(token);

        expect(enc1).not.toBe(enc2);
        expect(decryptToken(enc1)).toBe(token);
        expect(decryptToken(enc2)).toBe(token);
    });

    it("handles legacy plaintext tokens gracefully (backward compatibility)", () => {
        const legacyToken = "gho_plaintext_token_from_older_version";
        expect(decryptToken(legacyToken)).toBe(legacyToken);

        const mockToken = "mock_token";
        expect(decryptToken(mockToken)).toBe("mock_token");
    });

    it("does not re-encrypt an already encrypted token", () => {
        const token = "gho_sample_token";
        const encrypted = encryptToken(token);
        const doubleEncrypted = encryptToken(encrypted);

        expect(doubleEncrypted).toBe(encrypted);
        expect(decryptToken(doubleEncrypted)).toBe(token);
    });

    it("fails closed on corrupted ciphertext or auth tag", () => {
        const token = "gho_sensitive_token";
        const encrypted = encryptToken(token);
        const parts = encrypted.split(":");

        // Corrupt the ciphertext
        const corruptedCiphertext = `${parts[0]}:${parts[1]}:${parts[2]}:${parts[3]}:00112233`;
        expect(() => decryptToken(corruptedCiphertext)).toThrow();

        // Corrupt the auth tag
        const corruptedTag = `${parts[0]}:${parts[1]}:${parts[2]}:00000000000000000000000000000000:${parts[4]}`;
        expect(() => decryptToken(corruptedTag)).toThrow();
    });

    it("handles empty or null token safely", () => {
        expect(encryptToken("")).toBe("");
        expect(decryptToken("")).toBe("");
        expect(decryptToken(null)).toBe("");
        expect(decryptToken(undefined)).toBe("");
    });
});
