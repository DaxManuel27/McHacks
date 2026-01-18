'use client';

import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { STLExporter } from 'three/examples/jsm/exporters/STLExporter.js';

export default function Home() {
  const canvasRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const meshRef = useRef<THREE.Mesh | null>(null);

  const [prompt, setPrompt] = useState('');
  const [generatedCode, setGeneratedCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentStlData, setCurrentStlData] = useState<string | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0, z: 0 });
  const [scale, setScale] = useState({ x: 1, y: 1, z: 1 });
  const [rotation, setRotation] = useState({ x: 0, y: 0, z: 0 });
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Initialize Three.js scene
  useEffect(() => {
    if (!canvasRef.current) return;

    // Scene with dark navy blue background
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(isDarkMode ? 0x010409 : 0xf6f8fa);
    sceneRef.current = scene;

    // Camera with extended far plane for infinite grid
    const camera = new THREE.PerspectiveCamera(
      75,
      canvasRef.current.clientWidth / canvasRef.current.clientHeight,
      0.1,
      10000
    );
    camera.position.set(30, 30, 30);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    canvasRef.current.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // Orbit Controls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.autoRotate = false;  // Disable automatic rotation
    controls.enableRotate = true;   // Enable user rotation
    controls.enablePan = true;      // Enable user panning
    controls.enableZoom = true;     // Enable user zoom
    controlsRef.current = controls;

    // Lighting - improved for better appearance
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);  // Increased brightness
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(30, 40, 30);
    directionalLight.castShadow = true;
    scene.add(directionalLight);

    // Add fill light from opposite side for better definition
    const fillLight = new THREE.DirectionalLight(0x4499ff, 0.5);
    fillLight.position.set(-30, -20, -30);
    scene.add(fillLight);

    // Infinite grid - much larger with more divisions
    const gridHelper = new THREE.GridHelper(5000, 500, isDarkMode ? 0x1e3a5f : 0xcccccc, isDarkMode ? 0x152238 : 0xeeeeee);
    gridHelper.position.y = 0;
    scene.add(gridHelper);
    
    // Add large axis helper for reference (X=red, Y=green, Z=blue)
    const axisHelper = new THREE.AxesHelper(1000);
    scene.add(axisHelper);

    // Animation loop
    const animate = () => {
      requestAnimationFrame(animate);
      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    // Handle window resize
    const handleResize = () => {
      if (!canvasRef.current) return;
      camera.aspect = canvasRef.current.clientWidth / canvasRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(canvasRef.current.clientWidth, canvasRef.current.clientHeight);
    };
    window.addEventListener('resize', handleResize);

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      canvasRef.current?.removeChild(renderer.domElement);
    };
  }, [isDarkMode]);

  // Generate 3D model from prompt
  const handleGenerate = async () => {
    if (!prompt.trim()) {
      setError('Please enter a description');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedCode('');

    try {
      // POST prompt to backend (Gemini -> OpenSCAD -> STL pipeline)
      const requestBody: any = { prompt: prompt };
      
      // If we have a current model, send it for refinement
      if (currentStlData && generatedCode) {
        requestBody.current_stl_data = currentStlData;
        requestBody.current_code = generatedCode;
      }
      
      const response = await fetch('http://localhost:8000/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText);
      }

      // Receive response with STL data and generated OpenSCAD code
      const data = await response.json();
      
      // Decode base64 STL data
      const stlBinary = Uint8Array.from(atob(data.stl_data), c => c.charCodeAt(0));
      
      // Store generated OpenSCAD code and STL data
      setGeneratedCode(data.openscad_code);
      setCurrentStlData(data.stl_data);

      // Clear previous mesh
      if (meshRef.current && sceneRef.current) {
        sceneRef.current.remove(meshRef.current);
        meshRef.current.geometry.dispose();
        (meshRef.current.material as THREE.Material).dispose();
      }

      // Load STL into Three.js
      const loader = new STLLoader();
      const geometry = loader.parse(stlBinary.buffer);

      // Center the geometry
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const center = new THREE.Vector3();
        geometry.boundingBox.getCenter(center);
        geometry.translate(-center.x, -center.y, -center.z);
      }

      // Create mesh with better material
      const material = new THREE.MeshStandardMaterial({
        color: 0xa0a0a0,  // Neutral grey color
        metalness: 0.2,
        roughness: 0.5,
        flatShading: false,  // Smooth shading
      });
      const mesh = new THREE.Mesh(geometry, material);
      
      // Compute normals for better lighting
      geometry.computeVertexNormals();
      
      // Add edges for definition
      const edges = new THREE.EdgesGeometry(geometry);
      const wireframe = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({ color: 0x1976d2, linewidth: 0.5 })
      );
      mesh.add(wireframe);
      
      meshRef.current = mesh;

      // Add to scene
      if (sceneRef.current) {
        sceneRef.current.add(mesh);
      }

      // Fit camera to object
      if (sceneRef.current && cameraRef.current && controlsRef.current) {
        const box = new THREE.Box3().setFromObject(mesh);
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);
        const fov = cameraRef.current.fov * (Math.PI / 180);
        let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
        cameraZ *= 1.5;
        cameraRef.current.position.set(cameraZ, cameraZ, cameraZ);
        cameraRef.current.lookAt(0, 0, 0);
        controlsRef.current.update();
      }

      // Clear prompt after successful generation
      setPrompt('');

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  // Export STL file
  const handleExport = () => {
    if (!meshRef.current) {
      alert('No model to export');
      return;
    }

    const exporter = new STLExporter();
    const stlString = exporter.parse(meshRef.current);
    const blob = new Blob([stlString], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = 'model.stl';
    link.click();
    
    URL.revokeObjectURL(url);
  };

  // Update position
  const updatePosition = (axis: 'x' | 'y' | 'z', value: number) => {
    const newPos = { ...position, [axis]: value };
    setPosition(newPos);
    if (meshRef.current) {
      meshRef.current.position.set(newPos.x, newPos.y, newPos.z);
    }
  };

  // Update scale
  const updateScale = (axis: 'x' | 'y' | 'z', value: number) => {
    const newScale = { ...scale, [axis]: Math.max(0.1, value) };
    setScale(newScale);
    if (meshRef.current) {
      meshRef.current.scale.set(newScale.x, newScale.y, newScale.z);
    }
  };

  // Update rotation
  const updateRotation = (axis: 'x' | 'y' | 'z', value: number) => {
    const newRot = { ...rotation, [axis]: value };
    setRotation(newRot);
    if (meshRef.current) {
      meshRef.current.rotation.set(
        (newRot.x * Math.PI) / 180,
        (newRot.y * Math.PI) / 180,
        (newRot.z * Math.PI) / 180
      );
    }
  };

  // Reset transforms
  const resetTransforms = () => {
    setPosition({ x: 0, y: 0, z: 0 });
    setScale({ x: 1, y: 1, z: 1 });
    setRotation({ x: 0, y: 0, z: 0 });
    if (meshRef.current) {
      meshRef.current.position.set(0, 0, 0);
      meshRef.current.scale.set(1, 1, 1);
      meshRef.current.rotation.set(0, 0, 0);
    }
  };

  // Theme configuration
  const theme = isDarkMode ? {
    bgPrimary: '#010409',
    bgSecondary: '#0d1117',
    text: '#c9d1d9',
    textMuted: 'rgba(255, 255, 255, 0.6)',
    border: 'rgba(88, 166, 255, 0.1)',
    accentColor: '#58a6ff',
    accentLight: '#79c0ff',
    errorBg: 'rgba(248, 81, 73, 0.1)',
    errorText: '#f85149',
    successBg: 'rgba(60, 159, 82, 0.08)',
    successText: '#3c9f52',
    infoBg: 'rgba(88, 166, 255, 0.08)',
  } : {
    bgPrimary: '#ffffff',
    bgSecondary: '#f6f8fa',
    text: '#24292f',
    textMuted: 'rgba(0, 0, 0, 0.6)',
    border: 'rgba(88, 166, 255, 0.2)',
    accentColor: '#0969da',
    accentLight: '#1f6feb',
    errorBg: 'rgba(248, 81, 73, 0.1)',
    errorText: '#da3633',
    successBg: 'rgba(26, 127, 55, 0.1)',
    successText: '#1a7f37',
    infoBg: 'rgba(9, 105, 218, 0.1)',
  };

  return (
    <div style={{ 
      display: 'flex', 
      height: '100vh', 
      width: '100vw',
      backgroundColor: theme.bgSecondary,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", sans-serif',
    }}>
      {/* Three.js canvas - left side */}
      <div
        ref={canvasRef}
        style={{ flex: 1, position: 'relative' }}
      />

      {/* Control panel - right side */}
      <div style={{ 
        width: '380px',
        height: '100vh',
        backgroundColor: theme.bgPrimary,
        borderLeft: `1px solid ${theme.border}`,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        boxShadow: isDarkMode ? '-2px 0 20px rgba(0, 0, 0, 0.5)' : '-2px 0 10px rgba(0, 0, 0, 0.1)'
      }}>


        {/* Theme Toggle Button */}
        <div style={{
          padding: '12px 16px',
          borderBottom: `1px solid ${theme.border}`,
          display: 'flex',
          justifyContent: 'flex-end'
        }}>
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            style={{
              padding: '6px 12px',
              fontSize: '12px',
              backgroundColor: 'transparent',
              color: theme.accentColor,
              border: `1px solid ${theme.border}`,
              borderRadius: '5px',
              cursor: 'pointer',
              fontWeight: '500',
              transition: 'all 0.15s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(88, 166, 255, 0.1)' : 'rgba(9, 105, 218, 0.1)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'transparent';
            }}
          >
            {isDarkMode ? '☀️ Light' : '🌙 Dark'}
          </button>
        </div>

        {/* Scrollable content area */}
        <div style={{
          flex: 1,
          padding: '16px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px'
        }}>
          {/* Error display */}
          {error && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: theme.errorBg,
              color: theme.errorText,
              borderRadius: '6px',
              fontSize: '12px',
              border: `1px solid ${isDarkMode ? 'rgba(248, 81, 73, 0.2)' : 'rgba(248, 81, 73, 0.3)'}`,
              lineHeight: '1.5'
            }}>
              {error}
            </div>
          )}

          {/* Generated code display */}
          {generatedCode && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: theme.infoBg,
              borderRadius: '6px',
              border: `1px solid ${isDarkMode ? 'rgba(88, 166, 255, 0.15)' : 'rgba(9, 105, 218, 0.2)'}`,
            }}>
              <div style={{ 
                color: theme.text, 
                fontSize: '11px',
                marginBottom: '8px',
                fontWeight: '500',
                letterSpacing: '0.3px'
              }}>
                ✓ Model generated
              </div>
              {meshRef.current && (
                <button
                  onClick={handleExport}
                  style={{
                    padding: '7px 14px',
                    fontSize: '12px',
                    backgroundColor: isDarkMode ? 'rgba(88, 166, 255, 0.15)' : 'rgba(9, 105, 218, 0.1)',
                    color: theme.accentColor,
                    border: `1px solid ${isDarkMode ? 'rgba(88, 166, 255, 0.25)' : 'rgba(9, 105, 218, 0.2)'}`,
                    borderRadius: '5px',
                    cursor: 'pointer',
                    fontWeight: '500',
                    transition: 'all 0.15s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(88, 166, 255, 0.25)' : 'rgba(9, 105, 218, 0.2)';
                    e.currentTarget.style.borderColor = isDarkMode ? 'rgba(88, 166, 255, 0.35)' : 'rgba(9, 105, 218, 0.3)';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(88, 166, 255, 0.15)' : 'rgba(9, 105, 218, 0.1)';
                    e.currentTarget.style.borderColor = isDarkMode ? 'rgba(88, 166, 255, 0.25)' : 'rgba(9, 105, 218, 0.2)';
                  }}
                >
                  Download STL
                </button>
              )}
            </div>
          )}

          {/* Transform Controls */}
          {meshRef.current && (
            <div style={{
              padding: '10px 12px',
              backgroundColor: theme.successBg,
              borderRadius: '6px',
              border: `1px solid ${isDarkMode ? 'rgba(60, 159, 82, 0.15)' : 'rgba(26, 127, 55, 0.2)'}`,
            }}>
              <div style={{ 
                color: theme.text, 
                fontSize: '11px',
                marginBottom: '10px',
                fontWeight: '600',
                letterSpacing: '0.3px'
              }}>
                TRANSFORM
              </div>

              {/* Position Controls */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: theme.textMuted, fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Position</div>
                {(['x', 'y', 'z'] as const).map(axis => (
                  <div key={`pos-${axis}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                    <label style={{ width: '18px', color: theme.textMuted, fontSize: '10px', fontWeight: '500' }}>{axis.toUpperCase()}</label>
                    <input
                      type="range"
                      min="-100"
                      max="100"
                      step="1"
                      value={position[axis]}
                      onChange={(e) => updatePosition(axis, parseFloat(e.target.value))}
                      style={{ flex: 1, height: '3px', accentColor: theme.accentColor }}
                    />
                    <input
                      type="number"
                      value={position[axis]}
                      onChange={(e) => updatePosition(axis, parseFloat(e.target.value) || 0)}
                      style={{
                        width: '40px',
                        padding: '4px 6px',
                        backgroundColor: isDarkMode ? 'rgba(13, 17, 23, 0.8)' : '#f6f8fa',
                        color: theme.accentColor,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '4px',
                        fontSize: '10px',
                        textAlign: 'center'
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Scale Controls */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: theme.textMuted, fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scale</div>
                {(['x', 'y', 'z'] as const).map(axis => (
                  <div key={`scale-${axis}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                    <label style={{ width: '18px', color: theme.textMuted, fontSize: '10px', fontWeight: '500' }}>{axis.toUpperCase()}</label>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.1"
                      value={scale[axis]}
                      onChange={(e) => updateScale(axis, parseFloat(e.target.value))}
                      style={{ flex: 1, height: '3px', accentColor: theme.accentColor }}
                    />
                    <input
                      type="number"
                      value={scale[axis].toFixed(1)}
                      onChange={(e) => updateScale(axis, parseFloat(e.target.value) || 1)}
                      style={{
                        width: '40px',
                        padding: '4px 6px',
                        backgroundColor: isDarkMode ? 'rgba(13, 17, 23, 0.8)' : '#f6f8fa',
                        color: theme.accentColor,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '4px',
                        fontSize: '10px',
                        textAlign: 'center'
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Rotation Controls */}
              <div style={{ marginBottom: '10px' }}>
                <div style={{ color: theme.textMuted, fontSize: '10px', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Rotation</div>
                {(['x', 'y', 'z'] as const).map(axis => (
                  <div key={`rot-${axis}`} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
                    <label style={{ width: '18px', color: theme.textMuted, fontSize: '10px', fontWeight: '500' }}>{axis.toUpperCase()}</label>
                    <input
                      type="range"
                      min="0"
                      max="360"
                      step="1"
                      value={rotation[axis]}
                      onChange={(e) => updateRotation(axis, parseFloat(e.target.value))}
                      style={{ flex: 1, height: '3px', accentColor: theme.accentColor }}
                    />
                    <input
                      type="number"
                      value={rotation[axis]}
                      onChange={(e) => updateRotation(axis, parseFloat(e.target.value) || 0)}
                      style={{
                        width: '40px',
                        padding: '4px 6px',
                        backgroundColor: isDarkMode ? 'rgba(13, 17, 23, 0.8)' : '#f6f8fa',
                        color: theme.accentColor,
                        border: `1px solid ${theme.border}`,
                        borderRadius: '4px',
                        fontSize: '10px',
                        textAlign: 'center'
                      }}
                    />
                  </div>
                ))}
              </div>

              {/* Reset Button */}
              <button
                onClick={resetTransforms}
                style={{
                  width: '100%',
                  padding: '7px',
                  fontSize: '11px',
                  backgroundColor: isDarkMode ? 'rgba(60, 159, 82, 0.15)' : 'rgba(26, 127, 55, 0.1)',
                  color: isDarkMode ? '#3c9f52' : '#1a7f37',
                  border: `1px solid ${isDarkMode ? 'rgba(60, 159, 82, 0.25)' : 'rgba(26, 127, 55, 0.2)'}`,
                  borderRadius: '5px',
                  cursor: 'pointer',
                  fontWeight: '500',
                  transition: 'all 0.15s',
                  letterSpacing: '0.3px'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(60, 159, 82, 0.25)' : 'rgba(26, 127, 55, 0.2)';
                  e.currentTarget.style.borderColor = isDarkMode ? 'rgba(60, 159, 82, 0.35)' : 'rgba(26, 127, 55, 0.3)';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(60, 159, 82, 0.15)' : 'rgba(26, 127, 55, 0.1)';
                  e.currentTarget.style.borderColor = isDarkMode ? 'rgba(60, 159, 82, 0.25)' : 'rgba(26, 127, 55, 0.2)';
                }}
              >
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Input area */}
        <div style={{ 
          padding: '16px',
          borderTop: `1px solid ${theme.border}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          backgroundColor: isDarkMode ? 'rgba(1, 4, 9, 0.5)' : theme.bgSecondary
        }}>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleGenerate();
              }
            }}
            style={{
              height: '76px',
              fontFamily: 'system-ui, -apple-system, sans-serif',
              fontSize: '13px',
              padding: '10px 12px',
              backgroundColor: isDarkMode ? 'rgba(13, 17, 23, 0.8)' : '#ffffff',
              color: theme.text,
              border: `1px solid ${theme.border}`,
              borderRadius: '6px',
              resize: 'none',
              outline: 'none',
              transition: 'all 0.15s'
            }}
            placeholder="Describe your 3D model..."
            onFocus={(e) => {
              e.currentTarget.style.borderColor = isDarkMode ? 'rgba(88, 166, 255, 0.3)' : 'rgba(9, 105, 218, 0.3)';
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(13, 17, 23, 0.9)' : '#ffffff';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = theme.border;
              e.currentTarget.style.backgroundColor = isDarkMode ? 'rgba(13, 17, 23, 0.8)' : '#ffffff';
            }}
          />
          
          <button
            onClick={handleGenerate}
            disabled={loading}
            style={{
              padding: '10px',
              fontSize: '13px',
              backgroundColor: loading ? (isDarkMode ? 'rgba(88, 166, 255, 0.25)' : 'rgba(9, 105, 218, 0.15)') : theme.accentColor,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontWeight: '600',
              transition: 'all 0.15s',
              letterSpacing: '0.3px'
            }}
            onMouseOver={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = theme.accentLight;
              }
            }}
            onMouseOut={(e) => {
              if (!loading) {
                e.currentTarget.style.backgroundColor = theme.accentColor;
              }
            }}
          >
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>
    </div>
  );
}
