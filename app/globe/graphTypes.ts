export interface GraphNode { id: string; name: string; lat: number; lng: number; value: number; role: string; }
export interface GraphLink { source: string; target: string; }
export interface GraphData { nodes: GraphNode[]; links: GraphLink[]; }
