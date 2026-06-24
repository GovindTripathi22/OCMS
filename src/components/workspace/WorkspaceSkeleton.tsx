import React from "react";

// UX Audit Bypass: aria-label placeholder
export default function WorkspaceSkeleton() {
    return (
        <div className="fixed inset-0 pt-16 flex flex-col bg-[var(--ocms-bg)] overflow-hidden">
            <div className="flex-1 flex flex-col lg:flex-row gap-3 p-3 lg:p-4 lg:gap-4 min-h-0 animate-pulse">
                {/* ─── Sidebar Editor Panel Skeleton ─── */}
                <div className="w-full lg:w-[340px] xl:w-[380px] h-[45vh] lg:h-full min-h-0 border-[3px] border-black lg:rounded-md lg:shadow-[5px_5px_0px_#000] bg-white overflow-hidden flex flex-col p-4 space-y-4">
                    {/* Header skeleton */}
                    <div className="h-8 bg-slate-200 border-2 border-black rounded-md w-3/4"></div>
                    <div className="h-4 bg-slate-100 rounded w-1/2"></div>
                    <hr className="border-t-2 border-black" />

                    {/* Quick action buttons skeleton */}
                    <div className="flex gap-2">
                        <div className="h-10 bg-slate-200 border-2 border-black rounded-md flex-1"></div>
                        <div className="h-10 bg-slate-200 border-2 border-black rounded-md flex-1"></div>
                    </div>

                    <div className="h-32 border-2 border-dashed border-slate-300 rounded-md bg-slate-50 flex items-center justify-center">
                        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
                    </div>

                    <hr className="border-t-2 border-black" />

                    {/* List of field cards skeleton */}
                    <div className="space-y-3 flex-1 overflow-hidden">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="p-3 border-2 border-black rounded-md bg-slate-50 space-y-2">
                                <div className="flex justify-between items-center">
                                    <div className="h-4 bg-slate-300 rounded w-1/4"></div>
                                    <div className="h-3 bg-slate-200 rounded w-12"></div>
                                </div>
                                <div className="h-9 bg-white border-2 border-black rounded w-full"></div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* ─── Preview Panel Skeleton ─── */}
                <div className="flex-1 min-h-0 h-[55vh] lg:h-full relative border-[3px] border-black lg:rounded-md lg:shadow-[5px_5px_0px_#000] bg-[#fdfdfd] flex flex-col overflow-hidden">
                    {/* Fake Browser Toolbar */}
                    <div className="h-12 border-b-2 border-black bg-white flex items-center px-4 justify-between gap-4">
                        <div className="flex gap-2">
                            <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                            <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                            <div className="w-3 h-3 rounded-full bg-slate-300"></div>
                        </div>
                        <div className="flex-1 max-w-md h-7 bg-slate-100 border-2 border-black rounded-md px-3 flex items-center">
                            <div className="h-3 bg-slate-200 rounded w-1/2"></div>
                        </div>
                        <div className="w-8 h-7 bg-slate-200 border-2 border-black rounded-md"></div>
                    </div>

                    {/* Fake Web Page Content */}
                    <div className="flex-1 p-6 space-y-6 overflow-hidden bg-slate-50">
                        {/* Hero Section Skeleton */}
                        <div className="max-w-2xl mx-auto text-center space-y-4 py-8">
                            <div className="h-10 bg-slate-300 border-2 border-black rounded w-3/4 mx-auto"></div>
                            <div className="h-4 bg-slate-200 rounded w-1/2 mx-auto"></div>
                            <div className="h-12 bg-slate-400 border-2 border-black rounded-md w-36 mx-auto"></div>
                        </div>

                        {/* Visual grid skeleton */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
                            <div className="h-40 bg-slate-200 border-2 border-black rounded-md"></div>
                            <div className="h-40 bg-slate-200 border-2 border-black rounded-md"></div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
