"use client";

import { useRef, useEffect } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

type PlanetProps = {
  position: [number, number, number];
  size: number;
  color: string;
  rotationSpeed?: number;
};

interface WheelEventExtended extends WheelEvent {
  deltaY: number;
}

function Planet({ position, size, color, rotationSpeed = 0.01 }: PlanetProps) {
  const meshRef = useRef<THREE.Mesh>();

  useFrame(() => {
    if (meshRef.current) {
      // Orbit animation
      const orbitRadius = Math.sqrt(position[0] ** 2 + position[2] ** 2);
      const angle = meshRef.current.userData.angle || 0;
      const newAngle = angle + rotationSpeed;

      meshRef.current.position.x = Math.cos(newAngle) * orbitRadius;
      meshRef.current.position.z = Math.sin(newAngle) * orbitRadius;
      meshRef.current.position.y = position[1]; // Keep Y position the same

      // Store the angle for next frame
      meshRef.current.userData.angle = newAngle;

      // Planet self-rotation
      meshRef.current.rotation.y += rotationSpeed * 2;
    }
  });

  return (
    <mesh ref={meshRef} position={position}>
      <sphereGeometry args={[size, 32, 32]} />
      <meshStandardMaterial
        color={color}
        roughness={0.5}
        metalness={0.2}
        emissive={color}
        emissiveIntensity={0.2} // Adding some self-illumination
      />
    </mesh>
  );
}

function BlackHole() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { camera, size, gl } = useThree();
  const isZoomingRef = useRef(false);

  useEffect(() => {
    if (!meshRef.current) return;

    gl.setPixelRatio(window.devicePixelRatio);

    // Create a simpler shader without dynamic AA sampling
    const material = new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(size.width, size.height) },
        cameraPos: { value: new THREE.Vector3() },
        cameraMatrix: { value: new THREE.Matrix4() },
        blackHoleMass: { value: 1.0 },
        isZooming: { value: 0.0 }, // Use a uniform instead of define for quality control
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        
        void main() {
          vNormal = normalize(normalMatrix * normal);
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform vec2 resolution;
        uniform vec3 cameraPos;
        uniform mat4 cameraMatrix;
        uniform float blackHoleMass;
        uniform float isZooming;
        
        varying vec3 vWorldPosition;
        varying vec3 vNormal;
        
        const float PI = 3.14159265359;
        
        // Fixed quality settings - no more dynamic AA_SAMPLES
        const int MAX_STEPS = 150;
        const float MAX_DIST = 100.0;
        const float EPSILON = 0.001;
        
        // Get a procedural star field with subtle nebula background
        vec3 stars(vec3 dir) {
          // Starfield with several layers
          vec3 starColor = vec3(0.0);
          
          // Main stars
          float seed1 = fract(sin(dot(dir, vec3(123.456, 789.321, 456.789))) * 43758.5453);
          float seed2 = fract(sin(dot(dir, vec3(234.567, 891.432, 567.891))) * 22973.8901);
          
          if (seed1 > 0.9997) {
            // Bright star
            float brightness = 0.8 + 0.2 * seed2;
            starColor = vec3(brightness);
          } else if (seed1 > 0.999) {
            // Medium star
            float brightness = 0.4 + 0.2 * seed2;
            starColor = vec3(brightness);
          } else if (seed1 > 0.996) {
            // Dim star
            float brightness = 0.1 + 0.1 * seed2;
            starColor = vec3(brightness);
          }
          
          // Add very subtle nebula in background (blue/purple tones)
          vec3 nebula = vec3(0.0);
          float nebulaNoise = fract(sin(dot(dir * 0.5, vec3(45.78, 113.94, 97.41))) * 45758.5453);
          float nebulaPattern = fract(sin(dot(dir * 0.2, vec3(89.23, 25.87, 54.28))) * 22973.8901);
          
          if (nebulaNoise > 0.85) { // Higher threshold for less nebula
            float nebulaStrength = (nebulaNoise - 0.85) * 4.0 * 0.015; // Reduced strength
            nebula = mix(
              vec3(0.1, 0.2, 0.4), // Subtle blue
              vec3(0.2, 0.1, 0.3), // Subtle purple
              nebulaPattern
            ) * nebulaStrength;
          }
          
          return starColor + nebula;
        }
        
        // Accurately calculate accretion disk color with temperature gradient and wave animation
        vec3 getDiskColor(float radius, float angle, float innerRadius, float time) {
          // Temperature follows T ∝ r^(-3/4) for thin disks
          float temperature = pow(innerRadius / radius, 0.75);
          
          // Color gradient based on Gargantua orange-yellow appearance
          vec3 color;
          if (temperature > 0.8) {
            // Hot inner region (bright yellow-white)
            color = vec3(1.0, 0.9, 0.7);
          } else if (temperature > 0.6) {
            // Middle region (orange)
            color = vec3(1.0, 0.6, 0.2);
          } else {
            // Outer region (darker orange-red)
            color = vec3(0.9, 0.3, 0.0);
          }
          
          // Wave animation pattern - adds vertical wave motion
          float waveHeight = 0.3;
          float waveFreq = 3.0;
          float waveSpeed = 0.8;
          float verticalOffset = sin(angle * waveFreq + time * waveSpeed) * waveHeight;
          
          // Dynamic swirling pattern based on time with wave effect
          float rotationSpeed = 0.3;
          float swirl = 0.85 + 0.15 * sin(
            angle * 6.0 + 
            radius * 1.5 - 
            time * rotationSpeed * (1.0 + 1.0/radius) +
            verticalOffset
          );
          
          // Multiple rings for more detail
          float rings = 0.92 + 0.08 * sin(radius * 20.0);
          float fineRings = 0.95 + 0.05 * sin(radius * 100.0);
          
          // Add pulsing wave animation
          float pulse = 1.0 + 0.15 * sin(time * 0.5 + radius * 2.0);
          
          // Increase overall brightness
          return color * swirl * rings * fineRings * pulse * 2.5;
        }
        
        // Apply relativistic Doppler and gravitational effects to color
        vec3 applyRelativisticEffects(vec3 color, float diskRadius, float doppler, float schwarzschildRadius) {
          // 1. Apply Doppler beaming (I ∝ D^4)
          float beamingFactor = pow(doppler, 4.0);
          color *= beamingFactor;
          
          // 2. Apply Doppler color shift for orange-yellow disk
          if (doppler > 1.0) {
            // Blueshift (approaching)
            color.r *= 0.9 / doppler;
            color.g *= 1.0;
            color.b *= doppler * 1.1;
          } else {
            // Redshift (receding)
            color.r *= 1.1 / doppler;
            color.g *= 1.0 / doppler;
            color.b *= doppler * 0.8;
          }
          
          // 3. Apply gravitational redshift
          float gravRedshift = sqrt(1.0 - schwarzschildRadius / diskRadius);
          color *= gravRedshift;
          
          return color;
        }
        
        // Ray march through the scene with adaptive stepping
        vec3 rayMarchBlackHole(vec3 ro, vec3 rd) {
          // Calculate physics parameters
          float schwarzschildRadius = 2.0 * blackHoleMass;
          float photonSphereRadius = 1.5 * schwarzschildRadius;
          float innerDiskRadius = 3.0 * schwarzschildRadius;
          float outerDiskRadius = 20.0 * schwarzschildRadius;
          float diskThickness = 0.1 * schwarzschildRadius;
          
          // Add wave-like thickness variation to disk
          diskThickness *= (1.0 + 0.2 * sin(time * 0.3));
          
          // Ray position
          vec3 p = ro;
          float totalDistance = 0.0;
          
          // Store closest approach to black hole
          float closestApproach = MAX_DIST;
          
          // Variable to track if we've passed through the disk
          bool hitDisk = false;
          vec3 diskColor = vec3(0.0);
          float diskVisibility = 0.0;
          
          // Trace the ray
          for (int i = 0; i < MAX_STEPS; i++) {
            // Distance from current point to black hole center
            float distToCenter = length(p);
            closestApproach = min(closestApproach, distToCenter);
            
            // Check for collision with event horizon
            if (distToCenter <= schwarzschildRadius + EPSILON) {
              return vec3(0.0); // Black hole is completely black
            }
            
            // Calculate gravitational deflection - more accurate formula
            float lensStrength = 1.5 * schwarzschildRadius / (distToCenter * distToCenter);
            vec3 toBlackHole = normalize(-p);
            rd = normalize(rd + toBlackHole * lensStrength);
            
            // Adaptive step size - smaller near black hole and disk
            float stepFactor = 0.05;
            float diskFactor = 1.0;
            
            // Take smaller steps near the disk plane
            if (abs(p.y) < diskThickness * 3.0 && 
                distToCenter > innerDiskRadius * 0.5 && 
                distToCenter < outerDiskRadius * 1.5) {
              diskFactor = 0.2;
            }
            
            float step = max(distToCenter * stepFactor * diskFactor, 0.05);
            
            // Check if we're about to cross the disk
            vec3 nextP = p + rd * step;
            
            // Wave animation in disk position - makes disk undulate
            float diskYOffset = sin(length(p.xz) * 0.2 - time * 0.8) * diskThickness * 0.5;
            
            if ((p.y - diskYOffset) * (nextP.y - diskYOffset) <= 0.0) { // Sign change in y = crossing the warped plane
              float diskRadius = length(p.xz);
              
              if (diskRadius >= innerDiskRadius && diskRadius <= outerDiskRadius) {
                // We're hitting the disk
                hitDisk = true;
                float diskAngle = atan(p.z, p.x);
                
                // Orbital velocity (Keplerian)
                float orbitalSpeed = sqrt(blackHoleMass / pow(diskRadius, 3.0));
                
                // Calculate disk velocity vector
                vec3 diskVelocity = normalize(vec3(-p.z, 0.0, p.x)) * orbitalSpeed;
                
                // Relativistic Doppler effect (approaching = blueshift, receding = redshift)
                float dopplerFactor = 1.0 / (1.0 - dot(normalize(diskVelocity), rd) * 0.4);
                
                // Get disk color with animated rotation
                vec3 baseColor = getDiskColor(diskRadius, diskAngle, innerDiskRadius, time);
                
                // Apply all relativistic effects
                baseColor = applyRelativisticEffects(baseColor, diskRadius, dopplerFactor, schwarzschildRadius);
                
                // Calculate view angle
                float viewAngle = abs(dot(rd, vec3(0.0, 1.0, 0.0)));
                diskVisibility = smoothstep(0.0, 0.2, viewAngle);
                
                diskColor = baseColor * diskVisibility;
              }
            }
            
            // Move along the ray
            p += rd * step;
            totalDistance += step;
            
            // Check if we've gone too far
            if (totalDistance > MAX_DIST) {
              if (hitDisk) {
                return diskColor;
              } else {
                return stars(rd);
              }
            }
          }
          
          if (hitDisk) {
            return diskColor;
          } else {
            return stars(rd);
          }
        }
        
        void main() {
          // Simple anti-aliasing based on isZooming uniform
          vec3 finalColor;
          
          // During zooming: simpler rendering (no AA)
          if (isZooming > 0.5) {
            // Single ray direction - no AA
            vec3 rayDirection = normalize(vWorldPosition - cameraPos);
            finalColor = rayMarchBlackHole(cameraPos, rayDirection);
          } 
          // Not zooming: higher quality with 2x2 fixed AA
          else {
            finalColor = vec3(0.0);
            
            // 2x2 fixed grid anti-aliasing
            for (int i = 0; i < 4; i++) {
              float x = mod(float(i), 2.0) - 0.5;
              float y = floor(float(i) / 2.0) - 0.5;
              
              // Calculate ray direction with slight offset for anti-aliasing
              vec3 offset = normalize(vWorldPosition - cameraPos);
              vec3 right = normalize(cross(vec3(0.0, 1.0, 0.0), offset));
              vec3 up = normalize(cross(offset, right));
              
              float pixelOffsetX = x * 0.001;
              float pixelOffsetY = y * 0.001;
              
              vec3 rayDirection = normalize(offset + right * pixelOffsetX + up * pixelOffsetY);
              finalColor += rayMarchBlackHole(cameraPos, rayDirection);
            }
            
            // Average the samples
            finalColor /= 4.0;
          }
          
          // Calculate parameters for Einstein ring
          float schwarzschildRadius = 2.0 * blackHoleMass;
          float photonSphereRadius = 1.5 * schwarzschildRadius;
          
          // Direction to black hole center
          vec3 dirToBlackHole = normalize(-cameraPos);
          
          // Direction to current fragment
          vec3 rayDir = normalize(vWorldPosition - cameraPos);
          
          // Calculate view angle from camera to black hole
          float viewAngleCos = dot(rayDir, dirToBlackHole);
          float viewAngle = acos(viewAngleCos);
          
          // Calculate Einstein ring angle
          float distToBlackHole = length(cameraPos);
          float einsteinRingAngle = atan(photonSphereRadius / distToBlackHole);
          
          // Create smooth, thin Einstein ring
          float ringWidth = 0.008 * einsteinRingAngle;
          float ringFactor = smoothstep(einsteinRingAngle - ringWidth, einsteinRingAngle, viewAngle) * 
                           smoothstep(einsteinRingAngle + ringWidth, einsteinRingAngle, viewAngle);
          
          // Bright, blue-white glow for the Einstein ring (changed from orange-gold)
          finalColor += vec3(0.6, 0.8, 1.0) * ringFactor * 6.0;
          
          // Secondary lensing effect (subtler)
          float secondaryRingWidth = ringWidth * 0.5;
          float secondaryRingAngle = einsteinRingAngle * 0.7;
          float secondaryRingFactor = smoothstep(secondaryRingAngle - secondaryRingWidth, secondaryRingAngle, viewAngle) * 
                                    smoothstep(secondaryRingAngle + secondaryRingWidth, secondaryRingAngle, viewAngle);
          
          // Blue-purple secondary ring (changed from orange-red)
          finalColor += vec3(0.4, 0.5, 0.9) * secondaryRingFactor * 2.0;
          
          // Remove the subtle overall orange glow (comment it out)
          // float diskGlowAngle = PI * 0.4;
          // float diskGlowFactor = smoothstep(diskGlowAngle + 0.1, diskGlowAngle - 0.1, viewAngle) * 0.15;
          // finalColor += vec3(0.8, 0.4, 0.1) * diskGlowFactor;
          
          // HDR tone mapping (improved for better contrast)
          finalColor = finalColor / (finalColor + vec3(1.0));
          
          // Increase contrast slightly
          finalColor = pow(finalColor, vec3(1.1));
          
          // Gamma correction
          finalColor = pow(finalColor, vec3(1.0 / 2.2));
          
          gl_FragColor = vec4(finalColor, 1.0);
        }
      `,
      side: THREE.BackSide,
    });

    // Apply material to mesh
    meshRef.current.material = material;

    // Update function
    const updateMaterial = ({
      time,
      camera,
      isZooming,
    }: {
      time: number;
      camera: THREE.Camera;
      isZooming: boolean;
    }) => {
      material.uniforms.time.value = time;
      material.uniforms.cameraPos.value.copy(camera.position);
      material.uniforms.cameraMatrix.value.copy(camera.matrixWorld);

      // Update zoom quality control
      material.uniforms.isZooming.value = isZooming ? 1.0 : 0.0;
    };

    meshRef.current.userData.updateMaterial = updateMaterial;
  }, [size, gl]);

  // Update on each frame
  useFrame((state) => {
    if (meshRef.current && meshRef.current.userData.updateMaterial) {
      meshRef.current.userData.updateMaterial({
        time: state.clock.getElapsedTime(),
        camera: camera,
        isZooming: isZoomingRef.current,
      });
    }
  });

  // Enhanced smooth camera controls with direct zoom response
  useEffect(() => {
    const canvas = document.querySelector("canvas");
    if (!canvas) return;

    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let targetPosition = { phi: Math.PI * 0.4, theta: Math.PI * 0.25 };
    let currentPosition = { phi: Math.PI * 0.4, theta: Math.PI * 0.25 };
    let targetDistance = 30; // Start further out
    let currentDistance = 30;
    let velocity = { phi: 0, theta: 0 };
    let isMoving = false;
    let zoomTimeout: ReturnType<typeof setTimeout>;

    // Update camera position with direct zoom response
    const updateCameraPosition = () => {
      // Smooth rotation but direct zoom response
      currentPosition.phi += (targetPosition.phi - currentPosition.phi) * 0.15;
      currentPosition.theta +=
        (targetPosition.theta - currentPosition.theta) * 0.15;

      // Direct zoom response - KEY for reducing lag
      currentDistance = targetDistance;

      // Apply rotation velocity with damping
      if (isMoving) {
        targetPosition.phi += velocity.phi;
        targetPosition.theta += velocity.theta;

        // Damping
        velocity.phi *= 0.95;
        velocity.theta *= 0.95;

        if (
          Math.abs(velocity.phi) < 0.0001 &&
          Math.abs(velocity.theta) < 0.0001
        ) {
          isMoving = false;
        }
      }

      // Clamp phi to avoid flipping
      targetPosition.phi = Math.max(
        0.1,
        Math.min(Math.PI - 0.1, targetPosition.phi)
      );

      // Convert to Cartesian coordinates
      const sinPhi = Math.sin(currentPosition.phi);
      const cosPhi = Math.cos(currentPosition.phi);
      const sinTheta = Math.sin(currentPosition.theta);
      const cosTheta = Math.cos(currentPosition.theta);

      camera.position.x = currentDistance * sinPhi * cosTheta;
      camera.position.y = currentDistance * cosPhi;
      camera.position.z = currentDistance * sinPhi * sinTheta;

      camera.lookAt(0, 0, 0);
    };

    let animationFrameId: number;

    const animate = () => {
      updateCameraPosition();
      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
      isMoving = false;
      velocity = { phi: 0, theta: 0 };
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;

      const deltaX = e.clientX - previousMousePosition.x;
      const deltaY = e.clientY - previousMousePosition.y;

      // Calculate velocity for inertia
      velocity.theta = -(deltaX * 0.005);
      velocity.phi = -(deltaY * 0.005);

      targetPosition.theta += velocity.theta;
      targetPosition.phi += velocity.phi;

      previousMousePosition = { x: e.clientX, y: e.clientY };
      isMoving = true;
    };

    const onWheel = (e: WheelEventExtended) => {
      e.preventDefault();

      // Set zooming flag to reduce quality during zoom
      isZoomingRef.current = true;

      // Clear existing timeout
      clearTimeout(zoomTimeout);

      // Multiplicative zoom for more natural feel
      const zoomFactor = 1.15;

      if (e.deltaY > 0) {
        // Zoom out - multiply by factor
        targetDistance = Math.min(100, targetDistance * zoomFactor);
      } else {
        // Zoom in - divide by factor
        targetDistance = Math.max(5, targetDistance / zoomFactor);
      }

      // Restore quality after zooming stops
      zoomTimeout = setTimeout(() => {
        isZoomingRef.current = false;
      }, 150);
    };

    // Improved touch support
    let touchStartDistance = 0;
    let initialTargetDistance = 0;

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        isDragging = true;
        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        isMoving = false;
        velocity = { phi: 0, theta: 0 };
      } else if (e.touches.length === 2) {
        // Store initial values for pinch zoom
        touchStartDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        initialTargetDistance = targetDistance;

        // Reduce quality during pinch zoom
        isZoomingRef.current = true;
        clearTimeout(zoomTimeout);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (isDragging && e.touches.length === 1) {
        const deltaX = e.touches[0].clientX - previousMousePosition.x;
        const deltaY = e.touches[0].clientY - previousMousePosition.y;

        velocity.theta = -(deltaX * 0.005);
        velocity.phi = -(deltaY * 0.005);

        targetPosition.theta += velocity.theta;
        targetPosition.phi += velocity.phi;

        previousMousePosition = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        isMoving = true;
      } else if (e.touches.length === 2) {
        // Using distance ratio for more intuitive zoom
        const currentTouchDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );

        // Calculate ratio and apply to initial distance
        const ratio = currentTouchDistance / touchStartDistance;
        targetDistance = Math.max(
          5,
          Math.min(100, initialTargetDistance / ratio)
        );

        // Keep low quality during zoom
        isZoomingRef.current = true;
        clearTimeout(zoomTimeout);
      }
    };

    const onTouchEnd = () => {
      isDragging = false;

      // Restore quality after touch interaction
      clearTimeout(zoomTimeout);
      zoomTimeout = setTimeout(() => {
        isZoomingRef.current = false;
      }, 150);
    };

    // Add event listeners
    canvas.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mouseup", onMouseUp);
    window.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("touchstart", onTouchStart);
    window.addEventListener("touchmove", onTouchMove, { passive: false });
    window.addEventListener("touchend", onTouchEnd);

    return () => {
      // Clean up
      cancelAnimationFrame(animationFrameId);
      clearTimeout(zoomTimeout);
      canvas.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mouseup", onMouseUp);
      window.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      window.removeEventListener("touchmove", onTouchMove);
      window.removeEventListener("touchend", onTouchEnd);
    };
  }, [camera]);

  return (
    <group>
      <mesh ref={meshRef}>
        <sphereGeometry args={[100, 80, 80]} />
      </mesh>

      {/* Add comet orbiting around black hole */}

      <Planet
        position={[30, 0, 0]}
        size={2.5}
        color="#5D9DFF"
        rotationSpeed={0.005}
      />
      <Planet
        position={[0, 0, 40]}
        size={3}
        color="#80FFD5"
        rotationSpeed={0.003}
      />
      <Planet
        position={[-35, 5, -15]}
        size={2}
        color="#FFE066"
        rotationSpeed={0.007}
      />

      {/* Add stronger light sources for planets */}
      <pointLight
        position={[0, 0, 0]}
        intensity={1.5}
        distance={100}
        decay={1.5}
      />
    </group>
  );
}

function DistantSun() {
  const { camera } = useThree();
  const sunRef = useRef<THREE.Mesh>(null);
  const flareRef = useRef<THREE.Sprite>(null);

  // Position the sun at a more reasonable distance but still far enough for directional effect
  const sunPosition: [number, number, number] = [150, 60, -200];

  useFrame(() => {
    if (sunRef.current && flareRef.current) {
      // Update lens flare position to always face camera
      const sunScreenPosition = new THREE.Vector3(...sunPosition);
      sunScreenPosition.project(camera);

      // Only show flare when sun is in front of camera
      if (sunScreenPosition.z < 1) {
        flareRef.current.position.copy(camera.position);
        flareRef.current.lookAt(sunRef.current.position);
        flareRef.current.visible = true;

        // Scale flare with distance
        const dist = camera.position.distanceTo(sunRef.current.position);
        const scale = Math.min(20, Math.max(10, dist * 0.05));
        flareRef.current.scale.set(scale, scale, 1);
      } else {
        flareRef.current.visible = false;
      }
    }
  });

  return (
    <group>
      {/* Large glowing sun sphere */}
      <mesh ref={sunRef} position={sunPosition}>
        <sphereGeometry args={[30, 32, 32]} />
        <meshBasicMaterial color="#FFF5E0" />

        {/* Add a point light at the sun's center for omnidirectional glow */}
        <pointLight color="#FFF5E0" intensity={15} distance={500} decay={1.5} />
      </mesh>

      {/* Stronger directional light to simulate sun rays */}
      <directionalLight
        position={sunPosition}
        intensity={1.0}
        color="#FFF5E0"
        castShadow
      />

      {/* Enhanced lens flare effect */}
      <sprite ref={flareRef} position={[0, 0, 0]}>
        <spriteMaterial
          map={new THREE.TextureLoader().load(
            "data:image/png;base64,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"
          )}
          transparent={true}
          blending={THREE.AdditiveBlending}
          depthTest={false}
          depthWrite={false}
        />
      </sprite>

      {/* Add glow halo around sun */}
      <mesh position={sunPosition}>
        <sphereGeometry args={[40, 32, 32]} />
        <meshBasicMaterial
          color="#FFF5E0"
          transparent={true}
          opacity={0.2}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

export default function InterstellarBlackHole() {
  return (
    <div className="w-full h-screen bg-black">
      <Canvas gl={{ antialias: true, powerPreference: "high-performance" }}>
        <color attach="background" args={["#000000"]} />
        <ambientLight intensity={0.5} /> {/* Increased ambient light */}
        <BlackHole />
        <DistantSun />
      </Canvas>

      {/* Optional instructions */}
      <div className="absolute bottom-5 left-1/2 transform -translate-x-1/2 text-white text-opacity-70 text-sm">
        Github | revell29
      </div>
    </div>
  );
}
