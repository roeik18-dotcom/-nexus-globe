"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import ThreeGlobe from "three-globe";

type GraphNode = {
  id: string;
  lat?: number;
  lng?: number;
};

type GraphLink = {
  source: string;
  target: string;
};

type GraphData = {
  nodes: GraphNode[];
  links: GraphLink[];
};

export default function GlobeView({ data }: { data?: GraphData }) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;

    const safeData: GraphData =
      data ?? {
        nodes: [
          { id: "A", lat: 32.0853, lng: 34.7818 },
          { id: "B", lat: 40.7128, lng: -74.006 },
        ],
        links: [{ source: "A", target: "B" }],
      };

    const width = mountRef.current.clientWidth || window.innerWidth;
    const height = mountRef.current.clientHeight || window.innerHeight;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 2000);
    camera.position.z = 300;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mountRef.current.appendChild(renderer.domElement);

    const globe = new ThreeGlobe()
      .globeImageUrl("//unpkg.com/three-globe/example/img/earth-dark.jpg")
      .pointsData(safeData.nodes)
      .pointLat((d: object) => (d as GraphNode).lat ?? 0)
      .pointLng((d: object) => (d as GraphNode).lng ?? 0)
      .pointColor(() => "#00ff88")
      .pointAltitude(0.02)
      .pointRadius(0.8)
      .arcsData(safeData.links)
      .arcColor(() => "#2347ff")
      .arcAltitude(0.18)
      .arcStroke(0.8);

    scene.add(globe);

    const ambientLight = new THREE.AmbientLight(0xffffff, 1.2);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(1, 1, 1);
    scene.add(directionalLight);

    let animationFrameId = 0;

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      globe.rotation.y += 0.0015;
      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      const newWidth = mountRef.current?.clientWidth || window.innerWidth;
      const newHeight = mountRef.current?.clientHeight || window.innerHeight;
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(newWidth, newHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", handleResize);
      renderer.dispose();
      if (mountRef.current?.contains(renderer.domElement)) {
        mountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [data]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
