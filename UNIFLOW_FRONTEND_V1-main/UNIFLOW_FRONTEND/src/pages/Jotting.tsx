import React, { useState, useRef, useEffect } from 'react';
import { IonPage, IonContent, IonButton, IonIcon } from '@ionic/react';
import { search, save } from 'ionicons/icons';
import { useHistory, useLocation } from 'react-router-dom';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

import BottomNavigation from '../components/BottomNavigation';
import './Jotting.css';
import BackButton from '../components/BackButton';
import { setNotePdfDataInStorage } from '../utils/notePdfStorage';

const Jotting: React.FC = () => {
  const history = useHistory();
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  const courseId = searchParams.get('courseId');

  const [title, setTitle] = useState('New Jotting');
  const [content, setContent] = useState('');
  const [isKeyboardMode, setIsKeyboardMode] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lastPoint, setLastPoint] = useState({ x: 0, y: 0 });

  const [hasMoved, setHasMoved] = useState(false);

  // Handle click to switch to keyboard mode
  const handleClickToType = () => {
    if (!hasMoved) {
      setIsKeyboardMode(true);
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.focus();
        }
      }, 100);
    }
  };

  // Handle canvas drawing
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isKeyboardMode) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    setIsDrawing(true);
    setHasMoved(false);
    setLastPoint({ x, y });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = '#2c5f2c';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isKeyboardMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    setLastPoint({ x, y });
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  // Handle touch events for mobile
  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (isKeyboardMode) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    setIsDrawing(true);
    setHasMoved(false);
    setLastPoint({ x, y });

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.strokeStyle = '#2c5f2c';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || isKeyboardMode) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const touch = e.touches[0];
    const x = touch.clientX - rect.left;
    const y = touch.clientY - rect.top;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      if (Math.abs(x - lastPoint.x) > 2 || Math.abs(y - lastPoint.y) > 2) {
        setHasMoved(true);
      }
      ctx.lineTo(x, y);
      ctx.stroke();
    }

    setLastPoint({ x, y });
  };

  const handleTouchEnd = () => {
    setIsDrawing(false);
  };

  // Handle save functionality
  const handleSave = async () => {
    try {
      const container = document.querySelector('.jotting-content') as HTMLElement;
      if (!container) return;

      // Force textarea slightly visible if it contains text but isKeyboardMode is false, 
      // just to ensure html2canvas catches it if possible.
      const ta = container.querySelector('textarea');
      const originalOp = ta ? window.getComputedStyle(ta).opacity : '0';
      if (ta) ta.style.opacity = '1';

      const canvasRender = await html2canvas(container, {
        scale: 2,
        backgroundColor: '#ffffff'
      });

      if (ta) ta.style.opacity = originalOp;

      const imgData = canvasRender.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: canvasRender.width > canvasRender.height ? 'l' : 'p',
        unit: 'px',
        format: [canvasRender.width, canvasRender.height]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, canvasRender.width, canvasRender.height);
      const pdfDataUri = pdf.output('datauristring');
      const newId = 'JOT_' + Date.now().toString();

      if (courseId) {
        // Save as course note
        const existingFiles = JSON.parse(localStorage.getItem(`uniflow_files_${courseId}`) || '[]');
        const newFile = {
           id: newId,
           title: title || 'Untitled Jotting',
           description: 'Jotting Note',
           progress: 100,
           lectureNumber: existingFiles.length + 1,
           sourceType: 'jotting_pdf',
           isConverting: false
        };
        existingFiles.push(newFile);
        localStorage.setItem(`uniflow_files_${courseId}`, JSON.stringify(existingFiles));
        setNotePdfDataInStorage(newId, pdfDataUri);

        history.push(`/course/${courseId}`);
      } else {
        // Save globally
        const newJot = {
          id: newId,
          title: title || 'Untitled Jotting',
          pdfData: pdfDataUri,
          date: new Date().toISOString()
        };

        const savedJottings = JSON.parse(localStorage.getItem('uniflow_jottings') || '[]');
        savedJottings.push(newJot);
        localStorage.setItem('uniflow_jottings', JSON.stringify(savedJottings));

        const saveBtnIcon = document.querySelector('.save-btn ion-icon');
        if (saveBtnIcon) {
          saveBtnIcon.setAttribute('name', 'checkmark-outline');
          setTimeout(() => {
            saveBtnIcon.setAttribute('name', 'save');
          }, 2000);
        }
      }
    } catch(e) {
      console.error('Failed to save jotting:', e);
      alert('Error saving note.');
    }
  };

  // Handle search functionality
  const handleSearch = () => {
    console.log('Search clicked');
    // Navigate to search functionality
    history.push('/home');
  };

  // Initialize canvas size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (canvas) {
      const resizeCanvas = () => {
        const container = canvas.parentElement;
        if (container) {
          canvas.width = container.clientWidth;
          canvas.height = container.clientHeight;
        }
      };

      resizeCanvas();
      window.addEventListener('resize', resizeCanvas);
      return () => window.removeEventListener('resize', resizeCanvas);
    }
  }, []);

  return (
    <IonPage>
      <IonContent fullscreen className="jotting-screen">
        {/* Status Bar Spacer */}
        <div className="status-bar-spacer"></div>
        
        {/* Header */}
        <div className="jotting-header">
          <BackButton />
          <div className="header-content" style={{ flex: 1, padding: '0 12px' }}>
            <input 
              type="text" 
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="jotting-title" 
              style={{
                width: '100%',
                border: 'none',
                background: 'transparent',
                outline: 'none',
                textAlign: 'center',
                color: '#2c5f2c',
                fontWeight: 600,
                fontSize: '20px'
              }}
              placeholder="Title your jotting..."
            />
          </div>
          <div className="header-actions">
            <button className="search-btn" onClick={handleSearch}>
              <IonIcon icon={search} />
            </button>
            <button className="save-btn" onClick={handleSave} style={{ gap: '6px', padding: '8px 16px' }}>
              <IonIcon icon={save} />
              <span style={{ fontSize: '14px', fontWeight: 600 }}>Save</span>
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="jotting-content">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Start typing your jotting..."
            className={`jotting-textarea ${isKeyboardMode ? 'active' : ''}`}
            onBlur={() => {
              // Switch back to drawing mode when textarea loses focus
              setTimeout(() => setIsKeyboardMode(false), 100);
            }}
          />
          <canvas
            ref={canvasRef}
            className={`jotting-canvas ${isKeyboardMode ? 'inactive' : ''}`}
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onClick={handleClickToType}
          />
          {!isKeyboardMode && (
            <div className="jotting-instruction">
              Write with a stylus/pen, or click anywhere to type
            </div>
          )}
        </div>

        {/* Bottom Navigation */}
        <BottomNavigation />
      </IonContent>
    </IonPage>
  );
};

export default Jotting;
