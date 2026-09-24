export type ScriptMode = "static" | "dynamic";

export interface SchemaField {
    id: string;
    type: "text" | "image" | "link" | "3d-model" | "list";
    label: string;
    value: string;
    selector?: string;
    originalHtmlTag?: string;
    alt?: string;
    objectFit?: string;
    borderRadius?: string;
    roughness?: number;
    metalness?: number;
    textureUrl?: string;
}

export interface ProxyRewriteOptions {
    baseUrl: string;
    projectId?: string;
    scriptMode?: ScriptMode;
    nonce?: string;
}
