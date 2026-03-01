"use client";

import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF } from "@react-three/drei";
import { Loader2 } from "lucide-react";

interface ModelViewerProps {
    modelPath: string;
}

function Model({ path }: { path: string }) {
    const { scene } = useGLTF(path);
    return <primitive object={scene} />;
}

export default function ModelViewer({ modelPath }: ModelViewerProps) {
    return (
        <div className="w-full h-full bg-gradient-to-b from-slate-900 to-slate-950 rounded-lg overflow-hidden">
            <Suspense
                fallback={
                    <div className="w-full h-full flex items-center justify-center">
                        <Loader2 className="w-6 h-6 text-[var(--ocms-accent)] animate-spin" />
                    </div>
                }
            >
                <Canvas
                    shadows
                    camera={{ position: [0, 0, 3], fov: 50 }}
                    style={{ width: "100%", height: "100%" }}
                >
                    <Stage environment="city" intensity={0.6}>
                        <Model path={modelPath} />
                    </Stage>
                    <OrbitControls
                        autoRotate
                        autoRotateSpeed={2}
                        enableZoom
                        enablePan={false}
                    />
                </Canvas>
            </Suspense>
        </div>
    );
}
