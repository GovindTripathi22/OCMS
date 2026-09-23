import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const referer = request.headers.get('referer');
    const path = request.nextUrl.pathname;



    // Do not intercept the proxy endpoint itself
    if (path.startsWith('/api/proxy')) {
        return NextResponse.next();
    }

    // Intercept requests from inside the preview iframe
    if (referer) {
        try {
            const refererUrl = new URL(referer);
            // Must originate strictly from the same application origin and target the proxy route
            if (refererUrl.origin === request.nextUrl.origin && refererUrl.pathname === '/api/proxy') {
                const targetUrlStr = refererUrl.searchParams.get('url');
                const projectId = refererUrl.searchParams.get('projectId');
                if (targetUrlStr) {
                    const targetUrl = new URL(targetUrlStr);
                    // Ensure the target protocol is strictly http or https
                    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
                        return NextResponse.next();
                    }
                    // Construct absolute URL on target origin
                    const targetAssetUrl = new URL(
                        path + request.nextUrl.search,
                        targetUrl.origin
                    );

                    // Rewrite the request to the proxy route
                    const rewriteUrl = request.nextUrl.clone();
                    rewriteUrl.pathname = '/api/proxy';
                    
                    let newSearch = `?url=${encodeURIComponent(targetAssetUrl.toString())}`;
                    if (projectId) {
                        newSearch += `&projectId=${encodeURIComponent(projectId)}`;
                    }
                    rewriteUrl.search = newSearch;
                    
                    return NextResponse.rewrite(rewriteUrl);
                }
            }
        } catch (e) {
            console.error('Middleware proxy rewrite failed:', e);
        }
    }

    return NextResponse.next();
}

export const config = {
    matcher: [
        '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
    ],
};
