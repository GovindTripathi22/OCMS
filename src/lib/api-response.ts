/**
 * Standardized API Response and Error Formatting for OCMS.
 *
 * Conforms to Master Specification:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "PROJECT_NOT_FOUND",
 *     "message": "Project not found",
 *     "requestId": "req_..."
 *   }
 * }
 *
 * Also maintains top-level errorCode/message for backward compatibility with existing tests.
 */

import { NextResponse } from "next/server";
import crypto from "crypto";

export function generateRequestId(): string {
    return `req_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

export function getRequestIdFromHeader(req?: Request): string {
    if (!req) return generateRequestId();
    return req.headers.get("x-request-id") || generateRequestId();
}

export interface StandardApiErrorDetails {
    code: string;
    message: string;
    requestId: string;
    fieldErrors?: Record<string, string>;
    details?: unknown;
}

export interface StandardApiErrorResponse {
    success: false;
    errorCode: string; // for backward compatibility
    message: string;   // for backward compatibility
    error: StandardApiErrorDetails;
    requestId: string;
}

export function apiError(
    code: string,
    message: string,
    status: number = 400,
    options: {
        requestId?: string;
        fieldErrors?: Record<string, string>;
        details?: unknown;
        headers?: Record<string, string>;
    } = {}
): NextResponse {
    const requestId = options.requestId || generateRequestId();

    const body: StandardApiErrorResponse = {
        success: false,
        errorCode: code,
        message,
        error: {
            code,
            message,
            requestId,
            ...(options.fieldErrors ? { fieldErrors: options.fieldErrors } : {}),
            ...(options.details !== undefined ? { details: options.details } : {}),
        },
        requestId,
    };

    return NextResponse.json(body, {
        status,
        headers: {
            "X-Request-Id": requestId,
            ...(options.headers || {}),
        },
    });
}

export function apiSuccess<T extends Record<string, unknown>>(
    data: T,
    status: number = 200,
    options: {
        requestId?: string;
        headers?: Record<string, string>;
    } = {}
): NextResponse {
    const requestId = options.requestId || generateRequestId();

    const body = {
        success: true,
        ...data,
        requestId,
    };

    return NextResponse.json(body, {
        status,
        headers: {
            "X-Request-Id": requestId,
            ...(options.headers || {}),
        },
    });
}
