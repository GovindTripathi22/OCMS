import { logger } from "@/lib/logger";

describe("Structured Logger", () => {
    let logSpy: jest.SpyInstance;
    let warnSpy: jest.SpyInstance;
    let errorSpy: jest.SpyInstance;

    beforeEach(() => {
        logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
        warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    });

    afterEach(() => {
        logSpy.mockRestore();
        warnSpy.mockRestore();
        errorSpy.mockRestore();
    });

    it("logs info messages with structured JSON and context", () => {
        logger.info("Project created", { userId: "user-1", projectId: "proj-1" });
        expect(logSpy).toHaveBeenCalledTimes(1);

        const logged = JSON.parse(logSpy.mock.calls[0][0]);
        expect(logged.level).toBe("INFO");
        expect(logged.message).toBe("Project created");
        expect(logged.userId).toBe("user-1");
        expect(logged.projectId).toBe("proj-1");
        expect(logged.timestamp).toBeDefined();
    });

    it("redacts sensitive fields in metadata", () => {
        logger.info("Auth attempt", {}, {
            access_token: "secret_123",
            password: "super_secret",
            token: "tok_abc",
            safeKey: "public_value",
        });

        const logged = JSON.parse(logSpy.mock.calls[0][0]);
        expect(logged.metadata.access_token).toBe("[REDACTED]");
        expect(logged.metadata.password).toBe("[REDACTED]");
        expect(logged.metadata.token).toBe("[REDACTED]");
        expect(logged.metadata.safeKey).toBe("public_value");
    });

    it("logs warnings and errors with serialized error message", () => {
        logger.warn("Slow query", { durationMs: 1500 });
        expect(warnSpy).toHaveBeenCalledTimes(1);

        logger.error("DB connection failed", { route: "/api/projects" }, new Error("ECONNREFUSED"));
        expect(errorSpy).toHaveBeenCalledTimes(1);

        const errorLog = JSON.parse(errorSpy.mock.calls[0][0]);
        expect(errorLog.level).toBe("ERROR");
        expect(errorLog.error).toBe("ECONNREFUSED");
    });
});
