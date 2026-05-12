import React, { useState, useEffect, useRef } from 'react';
import { IonPage, IonContent } from '@ionic/react';
import { useHistory, useParams } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import { services } from '../api/services';
import { getApiBaseUrl } from '../constants/apiBaseUrl';
import { getNoteReadingProgressPercent } from '../utils/noteReadingProgress';
import {
  migrateNotePdfDataInStorage,
  rememberPendingNoteRouteMapping,
  setNotePdfDataInStorage,
} from '../utils/notePdfStorage';
import { isUuid } from '../utils/uuidUtils';
import { USER_SCOPED_STORAGE_CLEARED_EVENT } from '../utils/clearUserScopedStorage';
import './CourseDetail.css';

interface Course {
    id: string;
    name: string;
    notesCount: number;
    lastOpened: string;
    colorTheme: 'blue' | 'green' | 'red' | 'purple';
}

interface UploadedFile {
    id: string;
    title: string;
    description: string;
    progress: number;
    lectureNumber: number;
    sourceType?: 'note' | 'audio';
    isConverting?: boolean;
    customLectureLabel?: string;
}

const CourseDetail: React.FC = () => {
    const history = useHistory();
    const { id } = useParams<{ id: string }>();
    const [courseName, setCourseName] = useState('Course');
    const [files, setFiles] = useState<UploadedFile[]>([]);
    const [showUploadMenu, setShowUploadMenu] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Options/Deletion logic hooks
    const [showOptionsPopup, setShowOptionsPopup] = useState(false);
    const [selectedNote, setSelectedNote] = useState<UploadedFile | null>(null);
    const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
    const [editingLabelText, setEditingLabelText] = useState("");
    const lastTapRef = useRef<number>(0);
    const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

    const loadCourseAndFiles = React.useCallback(() => {
        const savedCourses = localStorage.getItem('uniflow_courses');
        if (savedCourses) {
            try {
                const courses: Course[] = JSON.parse(savedCourses);
                const course = courses.find((c) => c.id === id);
                if (course) {
                    setCourseName(course.name);
                } else {
                    setCourseName('Course');
                }
            } catch (err) {
                console.error('Failed to parse courses', err);
                setCourseName('Course');
            }
        } else {
            setCourseName('Course');
        }

        const savedFiles = localStorage.getItem(`uniflow_files_${id}`);
        if (savedFiles) {
            try {
                const parsed = JSON.parse(savedFiles);
                // Auto-purge the old mock data if it was saved to the user's storage
                if (parsed.length > 0 && parsed[0].id === '1' && parsed[0].title === 'Business Logic') {
                    setFiles([]);
                    localStorage.removeItem(`uniflow_files_${id}`);
                } else {
                    setFiles(parsed);
                }
            } catch {
                setFiles([]);
            }
        } else {
            setFiles([]);
        }
    }, [id]);

    // Mock initial state for files to mimic screenshot (only load if no local storage for this course)
    // Actually, let's persist files in localStorage per course
    useEffect(() => {
        loadCourseAndFiles();
    }, [loadCourseAndFiles]);

    useEffect(() => {
        window.addEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, loadCourseAndFiles);
        return () => window.removeEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, loadCourseAndFiles);
    }, [loadCourseAndFiles]);

    useEffect(() => {
        if (files.length > 0) {
            localStorage.setItem(`uniflow_files_${id}`, JSON.stringify(files));
        }
    }, [files, id]);

    // Handle file selection
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const rawFile = e.target.files[0];
            const newTitle = rawFile.name.replace(/\.[^/.]+$/, ""); // Strip extension
            const isAudioFile = rawFile.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(rawFile.name);

            // Client-only id until the server returns a real `course_files` UUID (never use Date.now() as a fake file id).
            const optimisticId = `local-${crypto.randomUUID()}`;
            const optimisticFile: UploadedFile = {
                id: optimisticId,
                title: newTitle,
                description: 'Here you should add a helpful description to communicate the purpose of this documentation.',
                progress: isAudioFile ? 15 : 0,
                lectureNumber: files.length + 1,
                sourceType: isAudioFile ? 'audio' : 'note',
                isConverting: isAudioFile
            };

            // Show optimistic item in UI immediately
            setFiles(prev => [...prev, optimisticFile]);

            const token = localStorage.getItem('uniflow_token');

            // Define fallback helper
            const fallbackToLocal = () => {
                const isPdf = rawFile.type === 'application/pdf' || rawFile.name.toLowerCase().endsWith('.pdf');
                if (isPdf) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                        const dataUrl = event.target?.result as string;
                        try {
                            setNotePdfDataInStorage(optimisticId, dataUrl);
                            const existing = JSON.parse(localStorage.getItem(`uniflow_files_${id}`) || '[]');
                            const fileExists = existing.some((f: UploadedFile) => f.id === optimisticId);
                            if (!fileExists) {
                                existing.push(optimisticFile);
                                localStorage.setItem(`uniflow_files_${id}`, JSON.stringify(existing));
                            }
                        } catch (err) {
                            console.error("Local storage quota exceeded or failed to store PDF data");
                            alert("Oops! Note too large to save offline. Try a smaller file, or check backend connection.");
                        }
                    };
                    reader.readAsDataURL(rawFile);
                } else {
                    const isWordOrPpt = /\.(doc|docx|ppt|pptx)$/i.test(rawFile.name);
                    if (isWordOrPpt) {
                        alert("Upload recorded, however native .doc / .ppt viewing currently requires backend conversion.");
                    }
                    try {
                        const existing = JSON.parse(localStorage.getItem(`uniflow_files_${id}`) || '[]');
                        const fileExists = existing.some((f: UploadedFile) => f.id === optimisticId);
                        if (!fileExists) {
                            existing.push(optimisticFile);
                            localStorage.setItem(`uniflow_files_${id}`, JSON.stringify(existing));
                        }
                    } catch (err) {
                        console.error("Local storage quota exceeded or failed to store PDF data");
                    }
                }
            };

            // If signed-in, attempt to upload to backend which will handle conversion to PDF
            if (token) {
                try {
                    const resp: unknown = await services.course.uploadFile(id, rawFile);
                    const raw = (resp as { file?: unknown })?.file ?? resp;
                    const rec = raw as { id?: string; originalName?: string; title?: string };
                    const serverId = String(rec?.id ?? '').trim();

                    if (!isUuid(serverId)) {
                        console.error('Upload succeeded but response had no valid course_files UUID; falling back to local-only.', resp);
                        fallbackToLocal();
                    } else {
                        migrateNotePdfDataInStorage(optimisticId, serverId);
                        rememberPendingNoteRouteMapping(optimisticId, serverId);

                        const serverFile: UploadedFile = {
                            id: serverId,
                            title: rec?.originalName || rec?.title || newTitle,
                            description: optimisticFile.description,
                            progress: isAudioFile ? 20 : 0,
                            lectureNumber: optimisticFile.lectureNumber,
                            sourceType: optimisticFile.sourceType,
                            isConverting: isAudioFile,
                        };

                        // Replace optimistic entry with server-backed entry
                        setFiles((prev) => prev.map((f) => (f.id === optimisticId ? serverFile : f)));

                        // Also persist lightweight metadata locally
                        try {
                            const existing = JSON.parse(localStorage.getItem(`uniflow_files_${id}`) || '[]');
                            const filtered = existing.filter((f: UploadedFile) => f.id !== optimisticId);
                            filtered.push(serverFile);
                            localStorage.setItem(`uniflow_files_${id}`, JSON.stringify(filtered));
                        } catch {
                            /* noop */
                        }

                        // Attempt to download the stored PDF
                        try {
                            const apiBase = getApiBaseUrl().replace(/\/$/, '');
                            const downloadUrl = `${apiBase}/courses/${id}/files/${encodeURIComponent(serverFile.id)}`;
                            const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

                            const dlResp = await fetch(downloadUrl, { headers });
                            if (dlResp.ok) {
                                const blob = await dlResp.blob();
                                const reader = new FileReader();
                                reader.onload = (ev) => {
                                    const dataUrl = ev.target?.result as string;
                                    try {
                                        setNotePdfDataInStorage(serverFile.id, dataUrl);
                                        setFiles((prev) =>
                                            prev.map((file) =>
                                                file.id === serverFile.id ? { ...file, progress: 100, isConverting: false } : file
                                            )
                                        );
                                    } catch (e) {
                                        console.error('Failed to cache downloaded PDF locally', e);
                                    }
                                };
                                reader.readAsDataURL(blob);
                            }
                        } catch (e) {
                            console.warn('Error while fetching stored PDF for local cache', e);
                        }
                    }
                } catch (err) {
                    console.warn('Upload to server failed, falling back to local storage', err);
                    fallbackToLocal();
                }
            } else {
                fallbackToLocal();
            }

            // Reset input so the same file could be added again if desired
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const handlePressStart = (note: UploadedFile) => {
        pressTimerRef.current = setTimeout(() => {
            setSelectedNote(note);
            setShowOptionsPopup(true);
        }, 600); // reduced to 600ms to trigger earlier and avoid OS interruptions
    };

    const handlePressEnd = () => {
        if (pressTimerRef.current) {
            clearTimeout(pressTimerRef.current);
            pressTimerRef.current = null;
        }
    };

    const deleteNote = () => {
        if (selectedNote) {
            const updatedFiles = files.filter(f => f.id !== selectedNote.id);
            setFiles(updatedFiles);
            localStorage.removeItem(`uniflow_note_data_${selectedNote.id}`); // Clean up the file content

            // Explicitly sync to localStorage for the course so it doesn't reappear on refresh
            if (updatedFiles.length === 0) {
                localStorage.removeItem(`uniflow_files_${id}`);
            } else {
                localStorage.setItem(`uniflow_files_${id}`, JSON.stringify(updatedFiles));
            }

            setSelectedNote(null);
            setShowOptionsPopup(false);
        }
    };

    const handleRenameClick = (e: React.MouseEvent | React.TouchEvent) => {
        e.stopPropagation();
        if (selectedNote) {
            setEditingNoteId(selectedNote.id);
            setEditingTitle(selectedNote.title);
            setShowOptionsPopup(false);
        }
    };

    const saveRenamedNote = () => {
        if (editingNoteId && editingTitle.trim()) {
            setFiles(files.map(f =>
                f.id === editingNoteId ? { ...f, title: editingTitle.trim() } : f
            ));
        }
        setEditingNoteId(null);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            saveRenamedNote();
            saveRenamedLabel();
        } else if (e.key === 'Escape') {
            setEditingNoteId(null);
            setEditingLabelId(null);
        }
    };

    const handleLabelDoubleClick = (file: UploadedFile) => {
        setEditingLabelId(file.id);
        setEditingLabelText(file.customLectureLabel || `Lecture ${file.lectureNumber}`);
    };

    const handleLabelTouch = (e: React.TouchEvent, file: UploadedFile) => {
        const now = Date.now();
        const DOUBLE_TAP_DELAY = 350; // slightly longer for reliability
        
        if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
            // Prevent default browser behavior (zoom/selection) on the second tap
            e.preventDefault();
            e.stopPropagation();
            handleLabelDoubleClick(file);
        }
        lastTapRef.current = now;
    };

    const saveRenamedLabel = () => {
        if (editingLabelId && editingLabelText.trim()) {
            setFiles(files.map(f =>
                f.id === editingLabelId ? { ...f, customLectureLabel: editingLabelText.trim() } : f
            ));
        }
        setEditingLabelId(null);
    };

    const triggerFileSelect = (acceptTypes: string) => {
        console.log("triggerFileSelect called with:", acceptTypes);
        console.log("fileInputRef current:", fileInputRef.current);
        if (fileInputRef.current) {
            fileInputRef.current.accept = acceptTypes;
            console.log("Attempting to click hidden input...");
            fileInputRef.current.click();
            console.log("Click method called on input.");
        } else {
            console.error("fileInputRef.current is NULL!");
        }
        setShowUploadMenu(false);
    };

    return (
        <IonPage>
            <IonContent fullscreen className="course-detail-page">
                <div className="course-detail-container">

                    {/* Status bar spacer */}
                    <div className="status-bar-spacer" />

                    <div className="course-detail-header">
                        <button className="cd-icon-btn" onClick={() => history.push(`/jotting?courseId=${id}`)} style={{ zIndex: 10 }}>
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4C6F59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                        </button>
                        <h1 className="cd-title-text">{courseName}</h1>
                        <div className={`cd-header-actions ${showUploadMenu ? 'active-popover' : ''}`}>
                            <button className="cd-icon-btn">
                                <svg viewBox="0 0 24 24" fill="none" stroke="#4C6F59" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="22" height="22">
                                    <circle cx="11" cy="11" r="8"></circle>
                                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                                </svg>
                            </button>
                            <div style={{ position: 'relative' }}>
                                <button className="cd-icon-btn" onClick={() => setShowUploadMenu(!showUploadMenu)}>
                                    <div className="cd-add-circle">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="14" height="14">
                                            <line x1="12" y1="5" x2="12" y2="19"></line>
                                            <line x1="5" y1="12" x2="19" y2="12"></line>
                                        </svg>
                                    </div>
                                </button>

                                {showUploadMenu && (
                                    <div className="cd-glassy-menu">
                                        <button 
                                            className="cd-glassy-menu-item" 
                                            onClick={(e) => { 
                                                console.log("Audio File button clicked");
                                                e.stopPropagation(); 
                                                triggerFileSelect('audio/*'); 
                                            }}
                                        >
                                            Audio File
                                        </button>
                                        <button 
                                            className="cd-glassy-menu-item" 
                                            onClick={(e) => { 
                                                console.log("Notes File button clicked");
                                                e.stopPropagation(); 
                                                triggerFileSelect('.pdf,.doc,.docx,.ppt,.pptx,.txt'); 
                                            }}
                                        >
                                            Notes File
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Hidden file input */}
                    <input
                        type="file"
                        ref={fileInputRef}
                        style={{ position: 'absolute', width: '1px', height: '1px', opacity: 0, zIndex: -10 }}
                        onChange={handleFileChange}
                    />

                    <div className="course-detail-body">
                        {files.length === 0 ? (
                            <p className="empty-state-text">
                                Click on the add button to upload note files
                            </p>
                        ) : (
                            <div className="cd-files-list">
                                {files.map(file => (
                                    <div key={file.id} className="cd-file-item">
                                        <div 
                                            className="cd-lecture-label"
                                            onDoubleClick={(e) => { e.stopPropagation(); handleLabelDoubleClick(file); }}
                                            onTouchStart={(e) => handleLabelTouch(e, file)}
                                            style={{ cursor: 'pointer', WebkitUserSelect: 'none', userSelect: 'none' }}
                                        >
                                            {editingLabelId === file.id ? (
                                                <input
                                                    className="cd-lecture-rename-input"
                                                    value={editingLabelText}
                                                    onChange={(e) => setEditingLabelText(e.target.value)}
                                                    onBlur={saveRenamedLabel}
                                                    onKeyDown={handleKeyDown}
                                                    autoFocus
                                                    onClick={(e) => e.stopPropagation()}
                                                />
                                            ) : (
                                                <>{file.customLectureLabel || `Lecture ${file.lectureNumber}`}</>
                                            )}
                                        </div>
                                        <div
                                            className={`cd-file-card ${showOptionsPopup && selectedNote?.id === file.id ? 'active-delete' : ''}`}
                                            onContextMenu={(e) => { e.preventDefault(); }} // Prevent mobile context menu on long press
                                            style={{ WebkitUserSelect: 'none', userSelect: 'none' }} // Crucial: prevents text selection from breaking the long press
                                            onTouchStart={() => handlePressStart(file)}
                                            onTouchEnd={handlePressEnd}
                                            onTouchMove={handlePressEnd}
                                            onTouchCancel={handlePressEnd} // Added for interrupted touches
                                            onMouseDown={() => handlePressStart(file)}
                                            onMouseUp={handlePressEnd}
                                            onMouseLeave={handlePressEnd}
                                            onClick={() => {
                                                if (showOptionsPopup) return;
                                                // Always navigate, even for local-only ids — `NoteDetail` shows
                                                // a "preparing your note" loading state and auto-redirects to
                                                // `/note/<serverUuid>` once `rememberPendingNoteRouteMapping`
                                                // has wired up the upload result.
                                                history.push(`/note/${file.id}`);
                                            }}
                                        >
                                            <div className="cd-card-indicator"></div>
                                            <div className="cd-card-content">
                                                {editingNoteId === file.id ? (
                                                    <input
                                                        className="cd-rename-input"
                                                        value={editingTitle}
                                                        onChange={(e) => setEditingTitle(e.target.value)}
                                                        onBlur={saveRenamedNote}
                                                        onKeyDown={handleKeyDown}
                                                        autoFocus
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                ) : (
                                                    <h2 className="cd-card-title">{file.title}</h2>
                                                )}
                                                <p className="cd-card-desc">{file.description}</p>
                                                <div className="cd-progress-container">
                                                    <div className="cd-progress-bar">
                                                        <div
                                                            className="cd-progress-fill"
                                                            style={{
                                                                width: `${file.isConverting
                                                                    ? Math.min(100, Math.max(0, file.progress))
                                                                    : getNoteReadingProgressPercent(file.id)}%`,
                                                            }}
                                                        ></div>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Inline Options Popup */}
                                            {showOptionsPopup && selectedNote?.id === file.id && (
                                                <div
                                                    className="cd-inline-options-popup"
                                                    onClick={(e) => e.stopPropagation()}
                                                    onTouchStart={(e) => e.stopPropagation()}
                                                >
                                                    <div
                                                        className="cd-popup-btn cd-rename-btn"
                                                        onClick={handleRenameClick}
                                                    >
                                                        Rename
                                                    </div>
                                                    <div className="cd-popup-divider" />
                                                    <div
                                                        className="cd-popup-btn cd-delete-btn"
                                                        onClick={(e) => { e.stopPropagation(); deleteNote(); }}
                                                    >
                                                        Delete Note
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Popover overlay background click handler for Add AND Options */}
                    {(showUploadMenu || showOptionsPopup) && (
                        <div
                            className="cd-menu-backdrop"
                            onClick={() => {
                                console.log("Backdrop clicked! Closing menus.");
                                setShowUploadMenu(false);
                                setShowOptionsPopup(false);
                                setSelectedNote(null);
                            }}
                        />
                    )}

                </div>

                <BottomNavigation />
            </IonContent>
        </IonPage >
    );
};

export default CourseDetail;
