import React, { useRef, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Points, PointMaterial } from '@react-three/drei';
import * as THREE from 'three';

// Simple noise function for shaders
const noiseShader = `
  //	Simplex 3D Noise 
  //	by Ian McEwan, Ashima Arts
  vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
  vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

  float snoise(vec3 v){ 
    const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
    const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

    vec3 i  = floor(v + dot(v, C.yyy) );
    vec3 x0 = v - i + dot(i, C.xxx) ;

    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min( g.xyz, l.zxy );
    vec3 i2 = max( g.xyz, l.zxy );

    vec3 x1 = x0 - i1 + 1.0 * C.xxx;
    vec3 x2 = x0 - i2 + 2.0 * C.xxx;
    vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

    i = mod(i, 289.0 ); 
    vec4 p = permute( permute( permute( 
              i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0 )) 
            + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

    float n_ = 1.0/7.0;
    vec3  ns = n_ * D.wyz - D.xzx;

    vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_ );

    vec4 x = x_ *ns.x + ns.yyyy;
    vec4 y = y_ *ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);

    vec4 b0 = vec4( x.xy, y.xy );
    vec4 b1 = vec4( x.zw, y.zw );

    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));

    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

    vec3 p0 = vec3(a0.xy,h.x);
    vec3 p1 = vec3(a0.zw,h.y);
    vec3 p2 = vec3(a1.xy,h.z);
    vec3 p3 = vec3(a1.zw,h.w);

    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
    p0 *= norm.x;
    p1 *= norm.y;
    p2 *= norm.z;
    p3 *= norm.w;

    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1), 
                                  dot(p2,x2), dot(p3,x3) ) );
  }
`;

// Layer 3: Flowing Data-Wave Mesh
function WaveMesh() {
  const meshRef = useRef();
  const materialRef = useRef();

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uColor: { value: new THREE.Color('#8b5cf6') },
    uHighlight: { value: new THREE.Color('#5eead4') }
  }), []);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime * 0.15;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, -10, -20]} rotation={[-Math.PI / 2 + 0.1, 0, 0]}>
      <planeGeometry args={[100, 100, 60, 60]} />
      <shaderMaterial
        ref={materialRef}
        transparent={true}
        wireframe={true}
        uniforms={uniforms}
        vertexShader={`
          uniform float uTime;
          varying float vZ;
          ${noiseShader}
          void main() {
            vec3 pos = position;
            // Add flowing wave motion
            float noise = snoise(vec3(pos.x * 0.05, pos.y * 0.05 + uTime * 2.0, uTime * 0.5));
            pos.z += noise * 6.0;
            
            // Second layer of noise for detail
            pos.z += snoise(vec3(pos.x * 0.1, pos.y * 0.1, uTime)) * 2.0;

            vZ = pos.z;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
          }
        `}
        fragmentShader={`
          uniform vec3 uColor;
          uniform vec3 uHighlight;
          varying float vZ;
          
          void main() {
            // Map height to brightness and mix colors
            float intensity = smoothstep(-6.0, 8.0, vZ);
            vec3 finalColor = mix(uColor, uHighlight, smoothstep(2.0, 8.0, vZ));
            
            // Fade out towards edges
            float alpha = smoothstep(-4.0, 4.0, vZ) * 0.3;
            
            gl_FragColor = vec4(finalColor, alpha);
          }
        `}
      />
    </mesh>
  );
}

// Layer 2: Intelligence Signals
function SignalParticles() {
  const ref = useRef();
  
  const count = 400;
  const positions = useMemo(() => {
    const p = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      p[i * 3] = (Math.random() - 0.5) * 80;
      p[i * 3 + 1] = (Math.random() - 0.5) * 40;
      p[i * 3 + 2] = (Math.random() - 0.5) * 40 - 10;
    }
    return p;
  }, [count]);

  useFrame((state) => {
    const time = state.clock.elapsedTime * 0.1;
    if (ref.current) {
      ref.current.rotation.y = time * 0.2;
      ref.current.rotation.x = Math.sin(time * 0.1) * 0.1;
    }
  });

  return (
    <Points ref={ref} positions={positions} stride={3}>
      <PointMaterial
        transparent
        color="#a78bfa"
        size={0.15}
        sizeAttenuation={true}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        opacity={0.6}
      />
    </Points>
  );
}

export default function ThreeBackground() {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: -5, pointerEvents: 'none', background: 'radial-gradient(ellipse at bottom, #0a0a20 0%, #03040b 100%)' }}>
      <Canvas camera={{ position: [0, 0, 15], fov: 60 }}>
        <fog attach="fog" args={['#03040b', 10, 40]} />
        <ambientLight intensity={0.5} />
        <WaveMesh />
        <SignalParticles />
      </Canvas>
    </div>
  );
}
