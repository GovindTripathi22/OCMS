export interface SchemaField {
    id: string;
    type: "text" | "image" | "link" | "list" | "3d-model";
    label: string;
    value: string;
    selector?: string;
    originalHtmlTag?: string;
    path?: string;
}
