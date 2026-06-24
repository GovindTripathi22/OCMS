export interface PbrPreset {
    name: string;
    roughness: number;
    metalness: number;
    textureUrl: string;
    previewColor: string;
}

export const PBR_PRESETS: PbrPreset[] = [
    {
        name: "Brushed Chrome",
        roughness: 0.2,
        metalness: 0.9,
        textureUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48cmVjdCB3aWR0aD0nMTAwJyBoZWlnaHQ9JzEwMCcgZmlsbD0nI2QxZDVkYicvPmxpbmUgeDE9JzAnIHkxPScwJyB4Mj0nMTAwJyB5Mj0nMTAwJyBzdHJva2U9JyM5Y2EzYWYnIHN0cm9rZS13aWR0aD0nMC41Jy8+PGxpbmUgeDE9JzAnIHkxPScyMCcgeDI9JzEwMCcgeTI9JzEyMCcgc3Ryb2tlPScjOWNhM2FmJyBzdHJva2Utd2lkdGg9JzAuNScvPmxpbmUgeDE9JzAnIHkxPSc1MCcgeDI9JzEwMCcgeTI9JzE1MCcgc3Ryb2tlPScjOWNhM2FmJyBzdHJva2Utd2lkdGg9JzAuNScvPjwvc3ZnPg==",
        previewColor: "#d1d5db"
    },
    {
        name: "Gold",
        roughness: 0.15,
        metalness: 1.0,
        textureUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJz48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9J2cnIHgxPScwJScgeTE9JzAlJyB4Mj0nMTAwJScgeTI9JzEwMCsnPjxzdG9wIG9mZnNldD0nMCUnIHN0b3AtY29sb3I9JyNmZWYwOGEnLz48c3RvcCBvZmZzZXQ9JzUwJScgc3RvcC1jb2xvcj0nI2VhYjMwOCcvPjxzdG9wIG9mZnNldD0nMTAwJScgc3RvcC1jb2xvcj0nI2NhOGEwNCcvPjwvbGluZWFyR3JhZGllbnQ+PC9kZWZzPjxyZWN0IHdpZHRoPScxMDAnIGhlaWdodD0nMTAwJyBmaWxsPSd1cmwoI2cpJy8+PC9zdmc+",
        previewColor: "#facc15"
    },
    {
        name: "Leather",
        roughness: 0.7,
        metalness: 0.0,
        textureUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPSc2NCcgaGVpZ2h0PSc2NCc+PHJlY3Qgd2lkdGg9JzY0JyBoZWlnaHQ9JzY0JyBmaWxsPScjNzgzNTBmJy8+PHBhdGggZD0nTTAgMCBDIDEwIDEwLCAyMCA1LCAzMiAxMiBDIDQwIDIsIDUwIDE1LCA2NCA4JyBzdHJva2U9JyM0NTFhMDMnIHN0cm9rZS13aWR0aD0nMS41JyBmaWxsPSdub25lJyBvcGFjaXR5PScwLjMnLz48cGF0aCBkPSdNMCAzMiBDIDE1IDIwLCAyNSA0NSwgNDggMzgnIHN0cm9rZT0nIzQ1MWEwMycgc3Ryb2tlLXdpZHRoPScxLjUnIGZpbGw9J25vbmUnIG9wYWNpdHk9JzAuMycvPjwvc3ZnPg==",
        previewColor: "#78350f"
    },
    {
        name: "Pine Wood",
        roughness: 0.5,
        metalness: 0.0,
        textureUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxMjgnIGhlaWdodD0nMTI4Jz48cmVjdCB3aWR0aD0nMTI4JyBoZWlnaHQ9JzEyOCcgZmlsbD0nI2Q5NzcwNicvPjxwYXRoIGQ9J00wIDEwUSAzMCAyMCA2MCAxMCBUIDEyOCAxNSBNMCA0NSBRIDQwIDMwIDgwIDUwIFQgMTI4IDQwIE0wIDg1USAzMCA5NSA3MCA4MCBUIDEyOCA4NScgc3Ryb2tlPScjOTI0MDBlJyBzdHJva2Utd2lkdGg9JzInIGZpbGw9J25vbmUnIG9wYWNpdHk9JzAuNCcvPjwvc3ZnPg==",
        previewColor: "#d97706"
    },
    {
        name: "Carbon Fiber",
        roughness: 0.4,
        metalness: 0.6,
        textureUrl: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0naHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmcnIHdpZHRoPScxNicgaGVpZ2h0PScxNic+PHJlY3Qgd2lkdGg9JzE2JyBoZWlnaHQ9JzE2JyBmaWxsPScjMTExODI3Jy8+PHJlY3Qgd2lkdGg9JzgnIGhlaWdodD0nOCcgZmlsbD0nIzFmMjkzNycvPjxyZWN0IHg9JzgnIHk9JzgnIHdpZHRoPSc4JyBoZWlnaHQ9JzgnIGZpbGw9JzFmMjkzNycvPjxwYXRoIGQ9J00wIDAgTDE2IDE2IE04IDAgTDE2IDggTDAgOCBMMCAxNicgc3Ryb2tlPScjMzc0MTUxJyBzdHJva2Utd2lkdGg9JzEnIG9wYWNpdHk9JzAuNScvPjwvc3ZnPg==",
        previewColor: "#1e293b"
    }
];
