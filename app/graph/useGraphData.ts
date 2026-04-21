"use client";
import { useState, useEffect } from "react";
import type { GraphData } from "./types";
const D: GraphData = { nodes: [
  {id:"u1",name:"Alice",lat:40.71,lng:-74,value:42,role:"Designer"},
  {id:"u2",name:"Ben",lat:51.51,lng:-0.13,value:18,role:"Engineer"},
  {id:"u3",name:"Chloé",lat:48.85,lng:2.35,value:31,role:"Analyst"},
  {id:"u4",name:"Hiroshi",lat:35.68,lng:139.69,value:27,role:"Researcher"},
  {id:"u5",name:"Leila",lat:25.2,lng:55.27,value:55,role:"Director"}
], links: [
  {source:"u1",target:"u2"},{source:"u1",target:"u4"},
  {source:"u2",target:"u3"},{source:"u3",target:"u5"},{source:"u4",target:"u5"}
]};
export default function useGraphData(): GraphData {
  const [data] = useState<GraphData>(D);
  return data;
}
