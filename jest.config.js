/**
 * jest.config.js — OCMS unit test configuration
 * Uses ts-jest for TypeScript support without a separate build step.
 */

/** @type {import('jest').Config} */
module.exports = {
    testEnvironment: "node",
    transform: {
        "^.+\\.tsx?$": [
            "ts-jest",
            {
                tsconfig: {
                    module: "commonjs",
                    moduleResolution: "node",
                    esModuleInterop: true,
                    allowSyntheticDefaultImports: true,
                    strict: false,
                },
            },
        ],
    },
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
    },
    testMatch: ["**/__tests__/**/*.test.ts"],
    collectCoverageFrom: [
        "src/lib/**/*.ts",
        "src/app/api/**/*.ts",
        "src/auth.ts",
        "!src/**/*.d.ts",
    ],
    coverageReporters: ["text", "lcov"],
};
