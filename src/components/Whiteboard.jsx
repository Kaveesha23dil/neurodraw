import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoom } from '../context/RoomContext';
import GestureController from '../services/GestureService';
import {
  Pencil, Eraser, Undo2, Trash2, Hand, HandMetal, Minus, Plus, Camera, CameraOff, Wand2
} from 'lucide-react';

export default function Whiteboard() {
  const { socketRef, activeSection, sections, inRoom } = useRoom();
  const canvasRef = useRef(null);
  
  // State refs for drawing
  const localStrokesRef = useRef([]);
  const lastPoint = useRef(null);
  const gestureLastPoint = useRef(null);
  const lastDrawTime = useRef(0);
  const currentStrokePointsRef = useRef([]);
  const strokeStartIndexRef = useRef(-1);
  const drawingStateRef = useRef({ tool: 'pen', color: '#a78bfa', width: 3 });

  // UI state
  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#a78bfa');
  const [strokeWidth, setStrokeWidth] = useState(3);
  
  // Gesture state
  const [gestureMode, setGestureMode] = useState(false);
  const [gestureStatus, setGestureStatus] = useState('');
  const [fingerPos, setFingerPos] = useState(null); // { x, y } in 0-1 range
  const [isPinchActive, setIsPinchActive] = useState(false);
  const [showCameraFeed, setShowCameraFeed] = useState(true);

  useEffect(() => {
    drawingStateRef.current = { tool: activeTool, color: strokeColor, width: strokeWidth };
  }, [activeTool, strokeColor, strokeWidth]);

  const gestureRef = useRef(null);
  const gestureVideoRef = useRef(null);
  const cameraFeedRef = useRef(null); // visible <video> element in PiP

  // ── Throttling utility (approx 30 FPS) ──
  const throttle = (callback, delay) => {
    return (...args) => {
      const now = Date.now();
      if (now - lastDrawTime.current >= delay) {
        callback(...args);
        lastDrawTime.current = now;
      }
    };
  };

  // ── Canvas drawing helpers ──
  const drawStroke = useCallback((data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.beginPath();
    
    // Smoothing: Midpoint averaging
    const midX = (data.prevX + data.x) / 2;
    const midY = (data.prevY + data.y) / 2;
    
    // Move to the previous point
    ctx.moveTo(data.prevX * w, data.prevY * h);
    // Draw a quadratic curve to the midpoint
    ctx.quadraticCurveTo(data.prevX * w, data.prevY * h, midX * w, midY * h);
    // Draw a line to the current point
    ctx.lineTo(data.x * w, data.y * h);
    
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.lineWidth;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
  }, []);

  const clearCanvasLocal = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }, []);

  const redrawCanvas = useCallback((strokes) => {
    clearCanvasLocal();
    (strokes || []).forEach(s => drawStroke(s));
  }, [clearCanvasLocal, drawStroke]);

  const analyzeMagicStroke = useCallback(() => {
    const { tool, color, width } = drawingStateRef.current;
    if (tool !== 'magic') return;
    const points = currentStrokePointsRef.current;
    if (points.length < 5) return;
    
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let pathLength = 0;
    
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
      
      if (i > 0) {
        const dx = p.x - points[i-1].x;
        const dy = p.y - points[i-1].y;
        pathLength += Math.sqrt(dx*dx + dy*dy);
      }
    }
    
    const w = maxX - minX;
    const h = maxY - minY;
    const start = points[0];
    const end = points[points.length - 1];
    const startEndDist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
    
    const isClosed = startEndDist < Math.max(w, h) * 0.25;
    
    let newStrokes = [];
    const sectionId = activeSection;

    if (strokeStartIndexRef.current !== -1) {
       localStrokesRef.current.splice(strokeStartIndexRef.current);
    }
    
    const generateSegments = (shapePoints) => {
      let segments = [];
      for (let i = 1; i < shapePoints.length; i++) {
         segments.push({
           x: shapePoints[i].x, y: shapePoints[i].y,
           prevX: shapePoints[i-1].x, prevY: shapePoints[i-1].y,
           color, lineWidth: width, sectionId
         });
      }
      return segments;
    };

    if (isClosed) {
      const aspectRatio = w / h;
      if (aspectRatio > 0.7 && aspectRatio < 1.3) {
         const cx = minX + w/2;
         const cy = minY + h/2;
         const r = (w + h) / 4;
         const steps = 36;
         let circlePts = [];
         for(let i=0; i<=steps; i++) {
           const angle = (i / steps) * Math.PI * 2;
           circlePts.push({ x: cx + Math.cos(angle)*r, y: cy + Math.sin(angle)*r });
         }
         newStrokes = generateSegments(circlePts);
      } else {
         newStrokes = generateSegments([
           {x: minX, y: minY}, {x: maxX, y: minY},
           {x: maxX, y: maxY}, {x: minX, y: maxY}, {x: minX, y: minY}
         ]);
      }
    } else {
      if (startEndDist > pathLength * 0.85) {
         newStrokes = generateSegments([start, end]);
      } else {
         newStrokes = generateSegments(points);
      }
    }
    
    localStrokesRef.current = [...localStrokesRef.current, ...newStrokes];
    redrawCanvas(localStrokesRef.current);
    socketRef.current?.emit('canvas-state-update', localStrokesRef.current);
    currentStrokePointsRef.current = [];
    strokeStartIndexRef.current = -1;
  }, [activeSection, redrawCanvas, socketRef]);

  // ── Socket listeners for whiteboard events ──
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleDraw = (strokeData) => {
      // Broadcast: Only within active section
      if (strokeData.sectionId !== activeSection) return;
      localStrokesRef.current.push(strokeData);
      drawStroke(strokeData);
    };

    const handleSync = (strokes) => {
      localStrokesRef.current = strokes;
      redrawCanvas(strokes);
    };

    const handleClear = () => {
      localStrokesRef.current = [];
      clearCanvasLocal();
    };

    const handleRemoteUndo = () => {
      // This is hit if the server sends an explicit undo event
      // However, server usually sends canvas-state-sync
      if (localStrokesRef.current.length > 0) {
        localStrokesRef.current.pop();
        redrawCanvas(localStrokesRef.current);
      }
    };

    socket.on('draw', handleDraw);
    socket.on('canvas-state-sync', handleSync);
    socket.on('clear-canvas', handleClear);
    socket.on('undo', handleRemoteUndo);

    return () => {
      socket.off('draw', handleDraw);
      socket.off('canvas-state-sync', handleSync);
      socket.off('clear-canvas', handleClear);
      socket.off('undo', handleRemoteUndo);
    };
  }, [socketRef, activeSection, drawStroke, redrawCanvas, clearCanvasLocal]);

  // ── Redraw when section changes ──
  useEffect(() => {
    if (!sections.length) return;
    const section = sections.find(s => s.id === activeSection);
    if (section) {
      localStrokesRef.current = section.strokes || [];
      redrawCanvas(section.strokes || []);
    }
  }, [activeSection, sections, redrawCanvas]);

  // ── Canvas resize ──
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const parent = canvas.parentElement;
      canvas.width = parent.clientWidth;
      canvas.height = parent.clientHeight;
      redrawCanvas(localStrokesRef.current);
    };
    resize();
    window.addEventListener('resize', resize);
    return () => window.removeEventListener('resize', resize);
  }, [inRoom, redrawCanvas]);

  // ── Mouse / touch drawing ──
  const getCanvasPoint = (e) => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return {
      x: (clientX - rect.left) / rect.width,
      y: (clientY - rect.top) / rect.height,
    };
  };

  const startDrawing = (e) => {
    if (gestureMode) return; // disable manual input in gesture mode
    e.preventDefault();
    setIsDrawing(true);
    lastPoint.current = getCanvasPoint(e);
    currentStrokePointsRef.current = [lastPoint.current];
    strokeStartIndexRef.current = localStrokesRef.current.length;
  };

  const throttledDraw = useCallback(
    throttle((point, prevPoint, color, width, sectionId) => {
      const strokeData = {
        x: point.x,
        y: point.y,
        prevX: prevPoint.x,
        prevY: prevPoint.y,
        color,
        lineWidth: width,
        sectionId
      };

      drawStroke(strokeData);
      currentStrokePointsRef.current.push(point);
      localStrokesRef.current.push(strokeData);
      socketRef.current?.emit('draw', strokeData);
    }, 33), // Throttle to approx 30 FPS
    [drawStroke, socketRef]
  );

  const handleDraw = (e) => {
    if (!isDrawing || !lastPoint.current || gestureMode) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;

    const actualColor = activeTool === 'eraser' ? '#0a0a0f' : strokeColor;
    const actualWidth = activeTool === 'eraser' ? strokeWidth * 4 : strokeWidth;

    throttledDraw(point, lastPoint.current, actualColor, actualWidth, activeSection);
    
    // Always update lastPoint regardless of throttling for accurate stroke progression
    lastPoint.current = point;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPoint.current = null;
    analyzeMagicStroke();
  };

  // ── Gesture mode ──
  const toggleGesture = async () => {
    if (gestureMode) {
      // Stop gesture
      if (gestureRef.current) {
        gestureRef.current.stop();
        gestureRef.current = null;
      }
      setGestureMode(false);
      setGestureStatus('');
      setFingerPos(null);
      setIsPinchActive(false);
      gestureLastPoint.current = null;
      // Stop and clear PiP feed
      if (cameraFeedRef.current) {
        const stream = cameraFeedRef.current.srcObject;
        if (stream) stream.getTracks().forEach(t => t.stop());
        cameraFeedRef.current.srcObject = null;
      }
      return;
    }

    // Start gesture
    setGestureStatus('loading');
    try {
      const controller = new GestureController();
      gestureRef.current = controller;

      // Create hidden video element for MediaPipe camera feed
      if (!gestureVideoRef.current) {
        const video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.style.display = 'none';
        document.body.appendChild(video);
        gestureVideoRef.current = video;
      }

      // Get camera stream and connect to PiP feed directly
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
        if (cameraFeedRef.current) {
          cameraFeedRef.current.srcObject = stream;
          await cameraFeedRef.current.play().catch(() => {});
        }
      } catch (camErr) {
        console.warn('Could not connect PiP feed directly:', camErr);
      }

      await controller.start(gestureVideoRef.current, ({ x, y, isPinching }) => {
        // Update visible finger cursor
        setFingerPos({ x, y });
        setIsPinchActive(isPinching);

        if (isPinching) {
          // Drawing
          const point = { x, y };
          if (gestureLastPoint.current) {
            const { tool, color, width } = drawingStateRef.current;
            const actualColor = tool === 'eraser' ? '#0a0a0f' : color;
            const actualWidth = tool === 'eraser' ? width * 4 : width;
            
            const now = Date.now();
            if (now - lastDrawTime.current >= 33) {
              const strokeData = {
                x: point.x,
                y: point.y,
                prevX: gestureLastPoint.current.x,
                prevY: gestureLastPoint.current.y,
                color: actualColor,
                lineWidth: actualWidth,
                sectionId: activeSection
              };
              
              drawStroke(strokeData);
              currentStrokePointsRef.current.push(point);
              localStrokesRef.current.push(strokeData);
              socketRef.current?.emit('draw', strokeData);
              lastDrawTime.current = now;
            }
          } else {
            currentStrokePointsRef.current = [point];
            strokeStartIndexRef.current = localStrokesRef.current.length;
          }
          gestureLastPoint.current = point;
        } else {
          if (gestureLastPoint.current) {
            analyzeMagicStroke();
          }
          // Not pinching — lift pen
          gestureLastPoint.current = null;
        }
      });

      setGestureMode(true);
      setGestureStatus('active');
      setShowCameraFeed(true);
    } catch (err) {
      console.error('Gesture init failed:', err);
      setGestureStatus('error');
      setTimeout(() => setGestureStatus(''), 3000);
    }
  };

  // Cleanup gesture on unmount
  useEffect(() => {
    return () => {
      if (gestureRef.current) gestureRef.current.stop();
      if (gestureVideoRef.current && gestureVideoRef.current.parentNode) {
        gestureVideoRef.current.parentNode.removeChild(gestureVideoRef.current);
      }
    };
  }, []);

  // ── Actions ──
  const handleUndo = () => {
    // 7. Undo Functionality - Maintain stroke history array & remove last stroke
    if (localStrokesRef.current.length > 0) {
      localStrokesRef.current.pop();
      redrawCanvas(localStrokesRef.current);
    }
    // Emit undo event
    socketRef.current?.emit('undo');
  };

  const handleClearCanvas = () => {
    // 8. Clear Canvas - Clear entire canvas
    clearCanvasLocal();
    localStrokesRef.current = [];
    // Emit clear-canvas event
    socketRef.current?.emit('clear-canvas');
  };

  const colors = ['#a78bfa', '#818cf8', '#f472b6', '#34d399', '#fbbf24', '#fb923c', '#ffffff', '#ef4444'];

  return (
    <div className="whiteboard-wrapper">
      {/* ── Toolbar ── */}
      <div className="wb-toolbar glass-panel">
        {/* Drawing tools */}
        <div className="tool-section">
          <button
            className={`tool-btn ${activeTool === 'pen' ? 'active' : ''}`}
            onClick={() => setActiveTool('pen')}
            title="Pen"
          >
            <Pencil size={18} />
          </button>
          <button
            className={`tool-btn ${activeTool === 'magic' ? 'active' : ''}`}
            onClick={() => setActiveTool('magic')}
            title="Magic Pen (Auto-Shapes)"
          >
            <Wand2 size={18} />
          </button>
          <button
            className={`tool-btn ${activeTool === 'eraser' ? 'active' : ''}`}
            onClick={() => setActiveTool('eraser')}
            title="Eraser"
          >
            <Eraser size={18} />
          </button>
        </div>

        <div className="tool-divider" />

        {/* Colors */}
        <div className="tool-section colors">
          {colors.map(c => (
            <button
              key={c}
              className={`color-dot ${strokeColor === c ? 'active' : ''}`}
              style={{ '--dot-color': c }}
              onClick={() => setStrokeColor(c)}
              title={c}
            />
          ))}
        </div>

        <div className="tool-divider" />

        {/* Stroke width */}
        <div className="tool-section width-section">
          <button
            className="tool-btn mini"
            onClick={() => setStrokeWidth(w => Math.max(1, w - 1))}
          >
            <Minus size={14} />
          </button>
          <span className="width-label">{strokeWidth}px</span>
          <button
            className="tool-btn mini"
            onClick={() => setStrokeWidth(w => Math.min(20, w + 1))}
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="tool-divider" />

        {/* Actions */}
        <div className="tool-section">
          <button className="tool-btn" onClick={handleUndo} title="Undo">
            <Undo2 size={18} />
          </button>
          <button className="tool-btn danger" onClick={handleClearCanvas} title="Clear Canvas">
            <Trash2 size={18} />
          </button>
        </div>

        <div className="tool-divider" />

        {/* Gesture / Finger Tracking toggle */}
        <div className="tool-section">
          <button
            id="track-finger-btn"
            className={`gesture-track-btn ${gestureMode ? 'active' : ''} ${gestureStatus === 'loading' ? 'loading' : ''}`}
            onClick={toggleGesture}
            title={gestureMode ? 'Stop Finger Tracking' : 'Activate Finger Drawing'}
            disabled={gestureStatus === 'loading'}
          >
            <span className="gesture-track-icon">
              {gestureStatus === 'loading' ? (
                <span className="gesture-track-spinner" />
              ) : gestureMode ? (
                <HandMetal size={16} />
              ) : (
                <Hand size={16} />
              )}
            </span>
            <span className="gesture-track-label">
              {gestureStatus === 'loading'
                ? 'Starting…'
                : gestureMode
                ? 'Stop Tracking'
                : 'Track Finger'}
            </span>
            {gestureMode && <span className="gesture-track-pulse" />}
          </button>
          {gestureStatus === 'error' && (
            <span className="gesture-label error">Camera Error</span>
          )}
        </div>

        {/* Camera feed toggle (only when active) */}
        {gestureMode && (
          <>
            <div className="tool-divider" />
            <div className="tool-section">
              <button
                className="tool-btn mini"
                title={showCameraFeed ? 'Hide Camera' : 'Show Camera'}
                onClick={() => setShowCameraFeed(v => !v)}
              >
                {showCameraFeed ? <CameraOff size={14} /> : <Camera size={14} />}
              </button>
            </div>
          </>
        )}
      </div>

      {/* ── Canvas ── */}
      <div className="canvas-container glass-panel">
        <canvas
          ref={canvasRef}
          className="drawing-canvas"
          onMouseDown={startDrawing}
          onMouseMove={handleDraw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={handleDraw}
          onTouchEnd={stopDrawing}
        />

        {/* Finger cursor — follows index finger */}
        {gestureMode && fingerPos && (
          <div
            className={`finger-cursor ${isPinchActive ? 'pinching' : ''}`}
            style={{
              left: `${fingerPos.x * 100}%`,
              top:  `${fingerPos.y * 100}%`,
              borderColor: isPinchActive ? strokeColor : 'rgba(167,139,250,0.9)',
              boxShadow: isPinchActive
                ? `0 0 0 3px ${strokeColor}55, 0 0 16px ${strokeColor}88`
                : '0 0 0 2px rgba(99,102,241,0.4), 0 0 10px rgba(99,102,241,0.3)',
            }}
          >
            {isPinchActive && (
              <span
                className="finger-cursor-dot"
                style={{ background: strokeColor }}
              />
            )}
          </div>
        )}

        {/* Bottom status bar */}
        {gestureMode && (
          <div className="gesture-overlay">
            <HandMetal size={16} />
            <span>
              {isPinchActive ? '✍️ Drawing…' : 'Pinch fingers to draw'}
            </span>
          </div>
        )}

        {/* Picture-in-Picture camera feed */}
        {gestureMode && showCameraFeed && (
          <div className="gesture-camera-feed-wrap">
            <div className="gesture-camera-header">
              <span>📷 Hand Camera</span>
            </div>
            <video
              ref={cameraFeedRef}
              className="gesture-camera-feed"
              autoPlay
              muted
              playsInline
            />
            {isPinchActive && (
              <div className="gesture-camera-badge">✍️ Drawing</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
