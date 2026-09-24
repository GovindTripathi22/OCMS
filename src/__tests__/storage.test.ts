import { FilesystemStorage } from "@/lib/storage";
import fs from "fs/promises";
import path from "path";
import os from "os";

describe("FilesystemStorage Abstraction", () => {
    let tempDir: string;
    let storage: FilesystemStorage;

    beforeEach(async () => {
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "ocms-storage-test-"));
        storage = new FilesystemStorage(tempDir, "/test-uploads");
    });

    afterEach(async () => {
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("puts and gets files correctly", async () => {
        const key = "models/cube.glb";
        const content = Buffer.from("glb-test-content-123");

        const url = await storage.put(key, content);
        expect(url).toBe("/test-uploads/models/cube.glb");

        const retrieved = await storage.get(key);
        expect(retrieved).not.toBeNull();
        expect(retrieved?.toString("utf8")).toBe("glb-test-content-123");
    });

    it("returns null for non-existent file", async () => {
        const result = await storage.get("non-existent-key.txt");
        expect(result).toBeNull();
    });

    it("deletes files", async () => {
        const key = "delete-me.txt";
        await storage.put(key, Buffer.from("data"));

        const deleted = await storage.delete(key);
        expect(deleted).toBe(true);

        const check = await storage.get(key);
        expect(check).toBeNull();
    });

    it("blocks directory traversal attacks", async () => {
        await expect(storage.put("../../../etc/passwd", Buffer.from("evil"))).rejects.toThrow();
        await expect(storage.get("..\\..\\secret.txt")).rejects.toThrow();
    });
});
