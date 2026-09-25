"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * Audio amplitudasiga qarab tebranadigan 3D Neon Orb.
 * `amplitude` (0..1) qanchalik katta bo'lsa, orb shunchalik kattalashadi
 * va yorqinroq nur sochadi — o'quvchiga AI Ustoz "tirik gapiryapti" degan
 * taassurot beradi.
 */
export default function NeonOrb({ amplitude, isActive }: { amplitude: number; isActive: boolean }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const amplitudeRef = useRef(amplitude);

  useEffect(() => {
    amplitudeRef.current = amplitude;
  }, [amplitude]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 100);
    camera.position.z = 4;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.appendChild(renderer.domElement);

    // Asosiy orb — neon binafsha-moviy gradient hissi beruvchi material
    const geometry = new THREE.IcosahedronGeometry(1, 4);
    const material = new THREE.MeshStandardMaterial({
      color: new THREE.Color("#a855f7"),
      emissive: new THREE.Color("#22d3ee"),
      emissiveIntensity: 0.6,
      roughness: 0.25,
      metalness: 0.4,
      wireframe: false,
    });
    const orb = new THREE.Mesh(geometry, material);
    scene.add(orb);

    // Tashqi "halo" — pulslash effektini kuchaytiradi
    const haloGeometry = new THREE.IcosahedronGeometry(1.35, 2);
    const haloMaterial = new THREE.MeshBasicMaterial({
      color: new THREE.Color("#ec4899"),
      transparent: true,
      opacity: 0.15,
      wireframe: true,
    });
    const halo = new THREE.Mesh(haloGeometry, haloMaterial);
    scene.add(halo);

    scene.add(new THREE.AmbientLight(0xffffff, 0.4));
    const pointLight = new THREE.PointLight(0x22d3ee, 2, 10);
    pointLight.position.set(2, 2, 2);
    scene.add(pointLight);

    let animationFrame: number;
    const clock = new THREE.Clock();

    function animate() {
      const elapsed = clock.getElapsedTime();
      const targetScale = 1 + amplitudeRef.current * 0.6;

      orb.scale.lerp(new THREE.Vector3(targetScale, targetScale, targetScale), 0.15);
      halo.scale.lerp(new THREE.Vector3(targetScale * 1.15, targetScale * 1.15, targetScale * 1.15), 0.1);

      orb.rotation.y = elapsed * 0.3;
      orb.rotation.x = Math.sin(elapsed * 0.2) * 0.2;
      halo.rotation.y = -elapsed * 0.15;

      material.emissiveIntensity = 0.4 + amplitudeRef.current * 1.2;

      renderer.render(scene, camera);
      animationFrame = requestAnimationFrame(animate);
    }
    animate();

    function handleResize() {
      if (!mount) return;
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", handleResize);

    return () => {
      cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", handleResize);
      geometry.dispose();
      material.dispose();
      haloGeometry.dispose();
      haloMaterial.dispose();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`h-64 w-64 transition-opacity duration-500 ${isActive ? "opacity-100" : "opacity-40"}`}
    />
  );
}
