"use client";

import { Suspense, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Stage, useGLTF, useTexture } from "@react-three/drei";
import { Loader2 } from "lucide-react";
import * as THREE from "three";

interface ModelViewerProps {
    modelPath: string;
    textureUrl?: string;
    roughness?: number;
    metalness?: number;
}

// Sub-component to load texture safely and apply materials to GLTF children
function Model({ path, textureUrl, roughness, metalness }: {
    path: string;
    textureUrl?: string;
    roughness?: number;
    metalness?: number;
}) {
    const { scene } = useGLTF(path);
    
    // Always use a valid image for useTexture hook to prevent throw, fallback to 1x1 transparent png
    const hasTexture = !!textureUrl && textureUrl !== "";
    const loadedTexture = useTexture(hasTexture ? textureUrl : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=");

    useEffect(() => {
        scene.traverse((child: THREE.Object3D) => {
            const mesh = child as THREE.Mesh;
            if (mesh.isMesh && mesh.material) {
                const material = mesh.material as THREE.MeshStandardMaterial;
                if (roughness !== undefined) {
                    material.roughness = roughness;
                }
                if (metalness !== undefined) {
                    material.metalness = metalness;
                }
                if (hasTexture && loadedTexture) {
                    loadedTexture.wrapS = THREE.RepeatWrapping;
                    loadedTexture.wrapT = THREE.RepeatWrapping;
                    loadedTexture.repeat.set(2, 2);
                    material.map = loadedTexture;
                    material.needsUpdate = true;
                }
            }
        });
    }, [scene, loadedTexture, hasTexture, roughness, metalness]);

    return <primitive object={scene} />;
}

export default function ModelViewer({ modelPath, textureUrl, roughness, metalness }: ModelViewerProps) {
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
                        <Model 
                            path={modelPath} 
                            textureUrl={textureUrl} 
                            roughness={roughness} 
                            metalness={metalness} 
                        />
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
