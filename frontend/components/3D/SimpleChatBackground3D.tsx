'use client'

import React, { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Points, PointMaterial } from '@react-three/drei'
import * as THREE from 'three'

function SimpleStars() {
  const ref = useRef<THREE.Points>(null)
  
  const particles = useMemo(() => {
    const positions = new Float32Array(5000 * 3)
    for (let i = 0; i < 5000; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 10
      positions[i * 3 + 1] = (Math.random() - 0.5) * 10
      positions[i * 3 + 2] = (Math.random() - 0.5) * 10
    }
    return positions
  }, [])

  useFrame((state) => {
    if (ref.current) {
      ref.current.rotation.x = state.clock.elapsedTime * 0.05
      ref.current.rotation.y = state.clock.elapsedTime * 0.1
    }
  })

  return (
    <Points ref={ref} positions={particles} stride={3} frustumCulled={false}>
      <PointMaterial
        transparent
        color="#00D4FF"
        size={0.05}
        sizeAttenuation={true}
        depthWrite={false}
        opacity={0.8}
      />
    </Points>
  )
}

function FloatingGeometry({ darkMode }: { darkMode?: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (meshRef.current) {
      meshRef.current.rotation.x = state.clock.elapsedTime * 0.2
      meshRef.current.rotation.y = state.clock.elapsedTime * 0.3
      meshRef.current.position.y = Math.sin(state.clock.elapsedTime) * 0.5
    }
  })

  return (
    <mesh ref={meshRef} position={[0, 0, -5]}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial
        color={darkMode ? "#00FF88" : "#00D4FF"}
        transparent
        opacity={0.1}
        wireframe
      />
    </mesh>
  )
}

interface SimpleChatBackground3DProps {
  darkMode?: boolean
}

const SimpleChatBackground3D: React.FC<SimpleChatBackground3DProps> = ({ darkMode = false }) => {
  return (
    <div className="absolute inset-0">
      <Canvas
        camera={{ 
          position: [0, 0, 5], 
          fov: 75,
          near: 0.1,
          far: 1000 
        }}
        style={{ background: 'transparent' }}
        gl={{ 
          alpha: true, 
          antialias: true,
          powerPreference: "high-performance"
        }}
      >
        <Suspense fallback={null}>
          <ambientLight intensity={0.1} />
          <pointLight position={[10, 10, 10]} intensity={0.5} />
          <SimpleStars />
          <FloatingGeometry darkMode={darkMode} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default SimpleChatBackground3D
