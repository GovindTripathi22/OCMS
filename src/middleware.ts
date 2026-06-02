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
    if (referer && referer.includes('/api/proxy?url=')) {
        try {
            const refererUrl = new URL(referer);
            const targetUrlStr = refererUrl.searchParams.get('url');
            const projectId = refererUrl.searchParams.get('projectId');
            if (targetUrlStr) {
                const targetUrl = new URL(targetUrlStr);
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
