import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoom } from '../context/RoomContext';
import GestureController from '../services/GestureService';
import {
  Pencil, Eraser, Undo2, Trash2, Hand, HandMetal, Minus, Plus
} from 'lucide-react';

export default function Whiteboard() {
  const { socketRef, activeSection, sections, inRoom } = useRoom();
  const canvasRef = useRef(null);
  const localStrokesRef = useRef([]);
  const lastPoint = useRef(null);
  const gestureLastPoint = useRef(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [activeTool, setActiveTool] = useState('pen');
  const [strokeColor, setStrokeColor] = useState('#a78bfa');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [gestureMode, setGestureMode] = useState(false);
  const [gestureStatus, setGestureStatus] = useState(''); // 'loading' | 'active' | 'error' | ''

  const gestureRef = useRef(null);
  const gestureVideoRef = useRef(null);

  // ── Canvas drawing helpers ──
  const drawStroke = useCallback((data) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;

    ctx.beginPath();
    ctx.moveTo(data.from.x * w, data.from.y * h);
    ctx.lineTo(data.to.x * w, data.to.y * h);
    ctx.strokeStyle = data.color;
    ctx.lineWidth = data.width;
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

  // ── Socket listeners for whiteboard events ──
  useEffect(() => {
    const socket = socketRef.current;
    if (!socket) return;

    const handleDraw = (strokeData) => {
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

    socket.on('draw', handleDraw);
    socket.on('canvas-state-sync', handleSync);
    socket.on('clear-canvas', handleClear);

    return () => {
      socket.off('draw', handleDraw);
      socket.off('canvas-state-sync', handleSync);
      socket.off('clear-canvas', handleClear);
    };
  }, [socketRef, drawStroke, redrawCanvas, clearCanvasLocal]);

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
  };

  const handleDraw = (e) => {
    if (!isDrawing || !lastPoint.current || gestureMode) return;
    e.preventDefault();
    const point = getCanvasPoint(e);
    if (!point) return;

    const strokeData = {
      from: lastPoint.current,
      to: point,
      color: activeTool === 'eraser' ? '#0a0a0f' : strokeColor,
      width: activeTool === 'eraser' ? strokeWidth * 4 : strokeWidth,
      tool: activeTool,
    };

    drawStroke(strokeData);
    localStrokesRef.current.push(strokeData);
    socketRef.current?.emit('draw', strokeData);
    lastPoint.current = point;
  };

  const stopDrawing = () => {
    setIsDrawing(false);
    lastPoint.current = null;
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
      gestureLastPoint.current = null;
      return;
    }

    // Start gesture
    setGestureStatus('loading');
    try {
      const controller = new GestureController();
      gestureRef.current = controller;

      // Create hidden video element for camera feed
      if (!gestureVideoRef.current) {
        const video = document.createElement('video');
        video.setAttribute('playsinline', '');
        video.style.display = 'none';
        document.body.appendChild(video);
        gestureVideoRef.current = video;
      }

      await controller.start(gestureVideoRef.current, ({ x, y, isPinching }) => {
        if (isPinching) {
          // Drawing
          const point = { x, y };
          if (gestureLastPoint.current) {
            const strokeData = {
              from: gestureLastPoint.current,
              to: point,
              color: activeTool === 'eraser' ? '#0a0a0f' : strokeColor,
              width: activeTool === 'eraser' ? strokeWidth * 4 : strokeWidth,
              tool: activeTool,
            };
            drawStroke(strokeData);
            localStrokesRef.current.push(strokeData);
            socketRef.current?.emit('draw', strokeData);
          }
          gestureLastPoint.current = point;
        } else {
          // Not pinching — lift pen
          gestureLastPoint.current = null;
        }
      });

      setGestureMode(true);
      setGestureStatus('active');
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

  const handleUndo = () => socketRef.current?.emit('undo');
  const handleClearCanvas = () => socketRef.current?.emit('clear-canvas');

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

        {/* Gesture toggle */}
        <div className="tool-section">
          <button
            className={`tool-btn gesture-btn ${gestureMode ? 'active' : ''}`}
            onClick={toggleGesture}
            title={gestureMode ? 'Stop Gesture Drawing' : 'Start Gesture Drawing'}
          >
            {gestureMode ? <HandMetal size={18} /> : <Hand size={18} />}
          </button>
          {gestureStatus === 'loading' && <span className="gesture-label">Loading...</span>}
          {gestureStatus === 'active' && <span className="gesture-label active">Gesture ON</span>}
          {gestureStatus === 'error' && <span className="gesture-label error">Camera Error</span>}
        </div>
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
        {gestureMode && (
          <div className="gesture-overlay">
            <HandMetal size={20} />
            <span>Gesture Mode — Pinch to draw</span>
          </div>
        )}
      </div>
    </div>
  );
}
