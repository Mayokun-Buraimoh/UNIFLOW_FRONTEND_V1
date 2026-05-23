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
  removeNotePdfFromStorage,
  setNotePdfBlobInStorage,
} from '../utils/notePdfStorage';
import { isUuid } from '../utils/uuidUtils';
import { USER_SCOPED_STORAGE_CLEARED_EVENT } from '../utils/clearUserScopedStorage';
import {
  getMappedCourseServerId,
  isLocalFirstTempId,
  syncNow,
  waitForCourseServerId,
} from '../localfirst/syncQueue';
import './CourseDetail.css';

/** Cache PDF in IndexedDB so NoteDetail can open even if server download fails. */
function cachePdfFileInStorage(noteId: string, rawFile: File): void {
    const isPdf =
        rawFile.type === 'application/pdf' || rawFile.name.toLowerCase().endsWith('.pdf');
    if (!isPdf || !noteId) return;
    void setNotePdfBlobInStorage(noteId, rawFile).catch((err) => {
        console.warn('Failed to cache PDF in IndexedDB', err);
    });
}

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
    const [filesLoading, setFilesLoading] = useState(false);
    const [filesLoadError, setFilesLoadError] = useState<string | null>(null);
    const [serverFilesLoaded, setServerFilesLoaded] = useState(false);
    const [filesFetchGeneration, setFilesFetchGeneration] = useState(0);
    const [courseSyncing, setCourseSyncing] = useState(() => isLocalFirstTempId(id));
    const [courseSyncError, setCourseSyncError] = useState<string | null>(null);
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

    const mapServerFileToUploaded = (
        sf: Record<string, unknown>,
        idx: number,
        existing?: UploadedFile
    ): UploadedFile => {
        const sid = String(sf.id ?? '');
        const origName = String(sf.originalName ?? '');
        const mime = String(sf.mimeType ?? '');
        const isAudio =
            mime.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(origName);
        const stripExt = (n: string) => n.replace(/\.[^/.]+$/, '');
        if (existing) {
            return {
                ...existing,
                id: sid,
                title: existing.title || stripExt(origName) || 'Note',
            };
        }
        return {
            id: sid,
            title: stripExt(origName) || 'Note',
            description:
                'Here you should add a helpful description to communicate the purpose of this documentation.',
            progress: 100,
            lectureNumber: idx + 1,
            sourceType: isAudio ? 'audio' : 'note',
            isConverting: false,
        };
    };

    const loadCourseName = React.useCallback(() => {
        const savedCourses = localStorage.getItem('uniflow_courses');
        if (savedCourses) {
            try {
                const courses: Course[] = JSON.parse(savedCourses);
                const course = courses.find((c) => c.id === id);
                setCourseName(course?.name || 'Course');
                return;
            } catch (err) {
                console.error('Failed to parse courses', err);
            }
        }
        setCourseName('Course');
    }, [id]);

    const loadLocalOnlyFiles = React.useCallback(() => {
        const savedFiles = localStorage.getItem(`uniflow_files_${id}`);
        if (!savedFiles) {
            setFiles([]);
            return;
        }
        try {
            const parsed = JSON.parse(savedFiles);
            if (parsed.length > 0 && parsed[0].id === '1' && parsed[0].title === 'Business Logic') {
                setFiles([]);
                localStorage.removeItem(`uniflow_files_${id}`);
            } else {
                setFiles(parsed);
            }
        } catch {
            setFiles([]);
        }
    }, [id]);

    const loadCourseAndFiles = React.useCallback(() => {
        loadCourseName();
        loadLocalOnlyFiles();
    }, [loadCourseName, loadLocalOnlyFiles]);

    // Mock initial state for files to mimic screenshot (only load if no local storage for this course)
    // Actually, let's persist files in localStorage per course
    useEffect(() => {
        loadCourseAndFiles();
    }, [loadCourseAndFiles]);

    useEffect(() => {
        const onStorageCleared = () => {
            loadCourseAndFiles();
            setFilesFetchGeneration((g) => g + 1);
        };
        window.addEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, onStorageCleared);
        return () => window.removeEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, onStorageCleared);
    }, [loadCourseAndFiles]);

    // Re-fetch from server after login in the same tab (storage events do not fire locally).
    useEffect(() => {
        const bump = () => setFilesFetchGeneration((g) => g + 1);
        window.addEventListener('focus', bump);
        return () => window.removeEventListener('focus', bump);
    }, []);

    useEffect(() => {
        if (files.length > 0) {
            localStorage.setItem(`uniflow_files_${id}`, JSON.stringify(files));
        }
    }, [files, id]);

    // If this folder was just created offline, wait for server UUID then fix the URL.
    useEffect(() => {
        if (!isLocalFirstTempId(id)) {
            setCourseSyncing(false);
            setCourseSyncError(null);
            return;
        }
        let cancelled = false;
        setCourseSyncing(true);
        setCourseSyncError(null);
        (async () => {
            try {
                await syncNow();
                const mapped = getMappedCourseServerId(id);
                const serverId = mapped && isUuid(mapped) ? mapped : await waitForCourseServerId(id);
                if (cancelled || !serverId || serverId === id) return;
                history.replace(`/course/${serverId}`);
            } catch (err) {
                if (!cancelled) {
                    console.warn('Course sync redirect failed', err);
                    setCourseSyncing(false);
                    setCourseSyncError(
                        err instanceof Error
                            ? err.message
                            : 'Could not save this course to your account. Go back to Courses and open it again.',
                    );
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [id, history]);

    // Pull files from the backend when signed in (survives logout/login).
    useEffect(() => {
        const token = localStorage.getItem('uniflow_token');
        if (!token) {
            setServerFilesLoaded(true);
            setFilesLoadError(null);
            return;
        }
        if (!isUuid(id)) {
            setServerFilesLoaded(true);
            return;
        }

        let cancelled = false;
        setFilesLoading(true);
        setFilesLoadError(null);

        (async () => {
            try {
                const serverFiles = await services.course.getFiles(id);
                if (cancelled || !Array.isArray(serverFiles)) return;

                setFiles((prev) => {
                    const prevById = new Map(prev.map((f) => [f.id, f]));
                    const merged: UploadedFile[] = serverFiles.map((sf: Record<string, unknown>, idx: number) => {
                        const sid = String(sf.id ?? '');
                        return mapServerFileToUploaded(sf, idx, prevById.get(sid));
                    });
                    const serverIds = new Set(merged.map((f) => f.id));
                    // Keep in-flight local-only uploads not yet on the server.
                    for (const local of prev) {
                        if (local.id.startsWith('local-') && !serverIds.has(local.id)) {
                            merged.push(local);
                        }
                    }
                    return merged;
                });
                setServerFilesLoaded(true);
            } catch (err) {
                if (cancelled) return;
                console.warn('CourseDetail: server file hydration failed', err);
                const msg = err instanceof Error ? err.message : 'Could not load notes from your account';
                setFilesLoadError(msg);
                setServerFilesLoaded(true);
            } finally {
                if (!cancelled) setFilesLoading(false);
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [id, filesFetchGeneration]);

    // Handle file selection
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files.length > 0) {
            const rawFile = e.target.files[0];
            const newTitle = rawFile.name.replace(/\.[^/.]+$/, ""); // Strip extension
            const isAudioFile = rawFile.type.startsWith('audio/') || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(rawFile.name);
            const isPdfFile =
                rawFile.type === 'application/pdf' || rawFile.name.toLowerCase().endsWith('.pdf');
            const needsServerConversion =
                !isAudioFile &&
                !isPdfFile &&
                /\.(doc|docx|dot|dotx|ppt|pptx|pot|potx|odt|ods|odp|rtf|txt)$/i.test(rawFile.name);

            let uploadCourseId = id;
            if (isLocalFirstTempId(id)) {
                try {
                    uploadCourseId = await waitForCourseServerId(id);
                    if (uploadCourseId !== id) {
                        history.replace(`/course/${uploadCourseId}`);
                    }
                } catch (err) {
                    const message =
                        err instanceof Error
                            ? err.message
                            : 'Course is still syncing. Open it again from the Courses list in a moment.';
                    alert(message);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                    return;
                }
            }

            // Client-only id until the server returns a real `course_files` UUID (never use Date.now() as a fake file id).
            const optimisticId = `local-${crypto.randomUUID()}`;
            const optimisticFile: UploadedFile = {
                id: optimisticId,
                title: newTitle,
                description: 'Here you should add a helpful description to communicate the purpose of this documentation.',
                progress: needsServerConversion ? 15 : isAudioFile ? 15 : 0,
                lectureNumber: files.length + 1,
                sourceType: isAudioFile ? 'audio' : 'note',
                isConverting: isAudioFile || needsServerConversion,
            };

            // Show optimistic item in UI immediately
            setFiles(prev => [...prev, optimisticFile]);

            // Cache PDF bytes locally for instant open (IndexedDB — works on iOS simulator).
            if (isPdfFile) {
                cachePdfFileInStorage(optimisticId, rawFile);
            }

            const token = localStorage.getItem('uniflow_token');

            // Define fallback helper
            const fallbackToLocal = () => {
                const isPdf = rawFile.type === 'application/pdf' || rawFile.name.toLowerCase().endsWith('.pdf');
                if (isPdf) {
                    void setNotePdfBlobInStorage(optimisticId, rawFile).then(() => {
                        try {
                            const existing = JSON.parse(localStorage.getItem(`uniflow_files_${uploadCourseId}`) || '[]');
                            const fileExists = existing.some((f: UploadedFile) => f.id === optimisticId);
                            if (!fileExists) {
                                existing.push(optimisticFile);
                                localStorage.setItem(`uniflow_files_${uploadCourseId}`, JSON.stringify(existing));
                            }
                        } catch (err) {
                            console.error('Failed to store note metadata', err);
                        }
                    }).catch((err) => {
                        console.error('Failed to cache PDF offline', err);
                        alert('Could not cache this PDF on device. Try again or use a smaller file.');
                    });
                } else {
                    try {
                        const existing = JSON.parse(localStorage.getItem(`uniflow_files_${uploadCourseId}`) || '[]');
                        const fileExists = existing.some((f: UploadedFile) => f.id === optimisticId);
                        if (!fileExists) {
                            existing.push(optimisticFile);
                            localStorage.setItem(`uniflow_files_${uploadCourseId}`, JSON.stringify(existing));
                        }
                    } catch (err) {
                        console.error("Local storage quota exceeded or failed to store PDF data");
                    }
                }
            };

            // If signed-in, attempt to upload to backend which will handle conversion to PDF
            if (token) {
                try {
                    const resp: unknown = await services.course.uploadFile(uploadCourseId, rawFile);
                    const raw = (resp as { file?: unknown })?.file ?? resp;
                    const rec = raw as { id?: string; originalName?: string; title?: string };
                    const serverId = String(rec?.id ?? '').trim();

                    if (!isUuid(serverId)) {
                        console.error('Upload succeeded but response had no valid course_files UUID; falling back to local-only.', resp);
                        fallbackToLocal();
                    } else {
                        void migrateNotePdfDataInStorage(optimisticId, serverId);
                        rememberPendingNoteRouteMapping(optimisticId, serverId);
                        if (isPdfFile) {
                            cachePdfFileInStorage(serverId, rawFile);
                        }

                        const serverFile: UploadedFile = {
                            id: serverId,
                            title: rec?.originalName || rec?.title || newTitle,
                            description: optimisticFile.description,
                            progress: needsServerConversion ? 50 : isAudioFile ? 20 : 100,
                            lectureNumber: optimisticFile.lectureNumber,
                            sourceType: optimisticFile.sourceType,
                            isConverting: isAudioFile || needsServerConversion,
                        };

                        // Replace optimistic entry with server-backed entry
                        setFiles((prev) => prev.map((f) => (f.id === optimisticId ? serverFile : f)));

                        // Also persist lightweight metadata locally
                        try {
                            const existing = JSON.parse(localStorage.getItem(`uniflow_files_${uploadCourseId}`) || '[]');
                            const filtered = existing.filter((f: UploadedFile) => f.id !== optimisticId);
                            filtered.push(serverFile);
                            localStorage.setItem(`uniflow_files_${uploadCourseId}`, JSON.stringify(filtered));
                        } catch {
                            /* noop */
                        }

                        // Attempt to download the stored PDF
                        try {
                            const apiBase = getApiBaseUrl().replace(/\/$/, '');
                            const downloadUrl = `${apiBase}/courses/${uploadCourseId}/files/${encodeURIComponent(serverFile.id)}`;
                            const headers: Record<string, string> = { Authorization: `Bearer ${token}` };

                            const dlResp = await fetch(downloadUrl, { headers });
                            if (dlResp.ok) {
                                const blob = await dlResp.blob();
                                await setNotePdfBlobInStorage(serverFile.id, blob);
                                setFiles((prev) =>
                                    prev.map((file) =>
                                        file.id === serverFile.id ? { ...file, progress: 100, isConverting: false } : file,
                                    ),
                                );
                            }
                        } catch (e) {
                            console.warn('Error while fetching stored PDF for local cache', e);
                        }
                    }
                } catch (err) {
                    console.warn('Upload to server failed', err);
                    const message =
                        err instanceof Error ? err.message : 'Upload failed. Check that the backend is running.';
                    setFiles((prev) => prev.filter((f) => f.id !== optimisticId));
                    alert(
                        `Could not save this note to your account:\n\n${message}\n\nNotes only stay after logout when they are saved to the server. Please try again.`,
                    );
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
            removeNotePdfFromStorage(selectedNote.id);

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
                        {courseSyncing ? (
                            <p className="empty-state-text">Setting up this course folder…</p>
                        ) : courseSyncError ? (
                            <div style={{ textAlign: 'center', padding: '24px' }}>
                                <p className="empty-state-text">{courseSyncError}</p>
                                <button
                                    type="button"
                                    className="nd-back-btn"
                                    style={{ marginTop: 12 }}
                                    onClick={() => history.push('/courses')}
                                >
                                    Back to Courses
                                </button>
                            </div>
                        ) : filesLoading ? (
                            <p className="empty-state-text">Loading your notes…</p>
                        ) : files.length === 0 ? (
                            <p className="empty-state-text">
                                {filesLoadError
                                    ? `Could not load notes: ${filesLoadError}`
                                    : serverFilesLoaded && localStorage.getItem('uniflow_token')
                                      ? 'No notes saved to your account for this course yet. Tap + to upload — files stay here after you log out once upload succeeds.'
                                      : 'Click on the add button to upload note files'}
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
