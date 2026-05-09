import React, { useState, useEffect, useCallback, useRef } from 'react';
import { IonPage, IonContent, IonIcon, IonAlert, IonSkeletonText } from '@ionic/react';
import {
  chevronBackOutline,
  chevronForwardOutline,
  searchOutline,
  refreshOutline, /* rotation */
  timeOutline,
  pricetagOutline,
  barChartOutline,
  helpCircleOutline,
  closeCircleOutline,
  checkmarkCircleOutline,
  bulbOutline,
  bookOutline,
  chevronDownOutline,
  chevronUpOutline,
  star,
  flash,
  documentTextOutline,
  closeOutline,
  trashOutline,
  paperPlaneOutline
} from 'ionicons/icons';
import { useHistory, useParams } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorkerSrc from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { aiClient, ChatMessage } from '../api/aiClient';
import { useAuth } from '../contexts/AuthContext';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import BackButton from '../components/BackButton';
import FocusSessionBreakOverlay from '../components/FocusSessionBreakOverlay';
import FocusSessionPauseOverlay from '../components/FocusSessionPauseOverlay';
import FocusSessionCompleteCelebration from '../components/FocusSessionCompleteCelebration';
import './Chatbot.css';
import './NoteDetail.css';
import { saveFocusSessionRecord } from '../utils/focusSessionAnalytics';
import {
  loadNoteReadingProgress,
  saveNoteReadingProgress,
} from '../utils/noteReadingProgress';
import { NOTE_PDF_UPDATED_EVENT, setNotePdfDataInStorage } from '../utils/notePdfStorage';
import { resolveDjangoAiOrigin } from '../constants/djangoAiPublic';
import { getApiBaseUrl } from '../constants/apiBaseUrl';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;

// Django API base — separate from the TS backend and environment-aware.
const DJANGO_API_URL = resolveDjangoAiOrigin();

interface Flashcard {
  id: number;
  q: string;
  a: string;
  isMastered: boolean;
}

interface DjangoFlashcard {
  id: number;
  pdf_id: string;
  question: string;
  answer: string;
  is_mastered: boolean;
}

interface QuizQuestion {
  id: number;
  pdfId: string;
  questionText: string;
  options: string[];
  correctAnswerIndex: number;
  explanation: string;
}

interface DjangoQuizQuestion {
  id: number;
  pdf_id: string;
  question_text: string;
  options: string[];
  correct_answer_index: number;
  explanation: string;
}

interface SummarySection {
  title: string;
  content: string;
  rank: number;
}

interface StoredFileMeta {
  id: string;
  title?: string;
  sourceType?: 'note' | 'audio';
  isConverting?: boolean;
  progress?: number;
}

interface StoredNoteContext {
  fileMeta: StoredFileMeta | null;
  courseId: string;
  courseName: string;
  documentName: string;
}

interface StickyNote {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  page: number; // Anchor to specific page
  color: 'green' | 'yellow' | 'purple' | 'blue' | 'pink' | 'red';
}

const STICKY_NOTE_COLORS: StickyNote['color'][] = ['yellow', 'green', 'blue', 'pink', 'red'];
const getStickyNotesStorageKey = (fileId: string) => `uniflow_sticky_notes_${fileId}`;

const NoteDetail: React.FC = () => {
  const history = useHistory();
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();

  // Mini Chatbot Selection States
  const [selectedText, setSelectedText] = useState('');
  const [askAIPos, setAskAIPos] = useState<{ x: number, y: number } | null>(null);
  const [showMiniChatbot, setShowMiniChatbot] = useState(false);
  const [miniChatSessionId, setMiniChatSessionId] = useState<string | null>(null);
  const [miniChatMessages, setMiniChatMessages] = useState<ChatMessage[]>([]);
  const [miniChatInput, setMiniChatInput] = useState('');
  const [isMiniChatLoading, setIsMiniChatLoading] = useState(false);

  const [activeSegment, setActiveSegment] = useState<'notes' | 'summary' | 'quiz' | 'flashcards'>('notes');

  // Quiz states
  const [quizState, setQuizState] = useState<'unanswered' | 'answered'>('unanswered');
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(true);

  // Accordion states
  const [expandedSection, setExpandedSection] = useState<number | null>(1); // 1 is expanded open

  // Focus Session states
  const [showFocusPopup, setShowFocusPopup] = useState(false);
  const [studyTechnique, setStudyTechnique] = useState('pomodoro');
  const [studyTechniqueOpen, setStudyTechniqueOpen] = useState(false);
  const [focusTimer, setFocusTimer] = useState(25);
  const [dndEnabled, setDndEnabled] = useState(false);
  const [focusSessionSecondsLeft, setFocusSessionSecondsLeft] = useState<number | null>(null);
  const [isFocusSessionPaused, setIsFocusSessionPaused] = useState(false);
  const [showQuizBlockedAlert, setShowQuizBlockedAlert] = useState(false);
  const [showPomodoroBreakAlert, setShowPomodoroBreakAlert] = useState(false);
  const [pomodoroBreakMessage, setPomodoroBreakMessage] = useState('');
  const [isPomodoroBreakActive, setIsPomodoroBreakActive] = useState(false);

  const studyTechniques = [
    { value: 'pomodoro', label: 'Pomodoro Technique' },
    { value: 'active_recall', label: 'Active recall' },
    { value: 'study_your_way', label: 'Study your way' }
  ];

  // PDF states
  const [numPages, setNumPages] = useState<number | null>(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [pdfData, setPdfData] = useState<string | null>(null);
  const [scale, setScale] = useState(1.0);
  const [rotation, setRotation] = useState(0);
  const [isPdfFullscreen, setIsPdfFullscreen] = useState(false);
  const [storedFileMeta, setStoredFileMeta] = useState<StoredFileMeta | null>(null);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchMatchCount, setSearchMatchCount] = useState(0);
  const [stickyNotes, setStickyNotes] = useState<StickyNote[]>([]);
  const [showStickyNotes, setShowStickyNotes] = useState(false);
  const [hiddenStickyNoteIds, setHiddenStickyNoteIds] = useState<string[]>([]);
  const [stickyDeleteConfirmId, setStickyDeleteConfirmId] = useState<string | null>(null);
  const stickyDeleteTargetRef = useRef<string | null>(null);
  const pdfViewerRef = useRef<HTMLDivElement | null>(null);
  const hasRestoredReadingProgressRef = useRef(false);
  const dragStateRef = useRef<{
    noteId: string;
    type: 'drag' | 'resize';
    offsetX?: number;
    offsetY?: number;
    startX?: number;
    startY?: number;
    startWidth?: number;
    startHeight?: number;
    lastX?: number;
    lastY?: number;
    lastWidth?: number;
    lastHeight?: number;
    hasMoved?: boolean;
    captureEl?: HTMLElement | null;
    pointerId?: number;
  } | null>(null);
  const focusSessionStartedAtRef = useRef<string | null>(null);
  const focusSessionPlannedSecondsRef = useRef(0);
  const focusSessionTechniqueRef = useRef<'pomodoro' | 'active_recall' | 'study_your_way'>('pomodoro');
  const pomodoroIntervalSecondsRef = useRef<number | null>(null);
  const pomodoroBreakSecondsRef = useRef(0);
  const pomodoroNextBreakElapsedSecondsRef = useRef<number | null>(null);
  const focusCompletionHandledRef = useRef(false);
  const focusCelebrationVariantRef = useRef<'complete' | 'quiz'>('complete');

  const [showFocusCelebration, setShowFocusCelebration] = useState(false);

  // Flashcard states — dynamic from Django API
  const [flashcards, setFlashcards] = useState<Flashcard[]>([]);
  const [flashcardIndex, setFlashcardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [flashcardsLoading, setFlashcardsLoading] = useState(false);

  // Quiz states — dynamic from Django API
  const [quizzes, setQuizzes] = useState<QuizQuestion[]>([]);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizzesLoading, setQuizzesLoading] = useState(false);

  // Quiz scoring states
  const [quizScore, setQuizScore] = useState(0);
  const [quizFinished, setQuizFinished] = useState(false);
  const [quizFeedback, setQuizFeedback] = useState('');
  const [quizAnswers, setQuizAnswers] = useState<{ question_id: number; selected_index: number }[]>([]);
  const [quizSubmitting, setQuizSubmitting] = useState(false);
  const [quizScorePercent, setQuizScorePercent] = useState(0);

  // Summary states — dynamic from Django API
  const [summarySections, setSummarySections] = useState<SummarySection[]>([]);
  const [summaryOverview, setSummaryOverview] = useState<string>("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  /**
   * The study AI endpoints expect a UUID from `course_files.id`.
   * When the route `id` is a numeric note id (`course_notes.id`), we must promote it first.
   */
  const [aiPdfId, setAiPdfId] = useState<string | null>(null);

  // Metadata states
  const [documentName, setDocumentName] = useState<string>("");
  const [courseName, setCourseName] = useState<string>("");
  const [storedNoteContext, setStoredNoteContext] = useState<StoredNoteContext>({
    fileMeta: null,
    courseId: '',
    courseName: '',
    documentName: ''
  });

  // Map Django SQL keys to UI keys
  const mapDjangoFlashcard = (fc: DjangoFlashcard): Flashcard => ({
    id: fc.id,
    q: fc.question,
    a: fc.answer,
    isMastered: fc.is_mastered,
  });

  const mapDjangoQuiz = (q: DjangoQuizQuestion): QuizQuestion => ({
    id: q.id,
    pdfId: q.pdf_id,
    questionText: q.question_text,
    options: q.options,
    correctAnswerIndex: q.correct_answer_index,
    explanation: q.explanation,
  });

  const getStoredFileMeta = useCallback((fileId: string): StoredFileMeta | null => {
    const courseKeys = Object.keys(localStorage).filter((key) => key.startsWith('uniflow_files_'));

    for (const key of courseKeys) {
      try {
        const raw = localStorage.getItem(key);
        const files = raw ? JSON.parse(raw) : [];
        const match = Array.isArray(files) ? files.find((file: StoredFileMeta) => file.id === fileId) : null;
        if (match) {
          return match;
        }
      } catch (error) {
        console.error('Failed to parse stored file metadata', error);
      }
    }

    return null;
  }, []);

  const getStoredNoteContext = useCallback((fileId: string): StoredNoteContext => {
    let courses: Array<{ id: string; name?: string }> = [];

    try {
      const rawCourses = localStorage.getItem('uniflow_courses');
      courses = rawCourses ? JSON.parse(rawCourses) : [];
    } catch (error) {
      console.error('Failed to parse stored courses', error);
    }

    const courseKeys = Object.keys(localStorage).filter((key) => key.startsWith('uniflow_files_'));

    for (const key of courseKeys) {
      try {
        const raw = localStorage.getItem(key);
        const files = raw ? JSON.parse(raw) : [];
        const match = Array.isArray(files) ? files.find((file: StoredFileMeta) => file.id === fileId) : null;

        if (match) {
          const courseId = key.replace('uniflow_files_', '');
          const matchedCourse = Array.isArray(courses)
            ? courses.find((course) => course.id === courseId)
            : null;

          return {
            fileMeta: match,
            courseId,
            courseName: matchedCourse?.name || '',
            documentName: match.title || ''
          };
        }
      } catch (error) {
        console.error('Failed to resolve stored note context', error);
      }
    }

    return {
      fileMeta: null,
      courseId: '',
      courseName: '',
      documentName: ''
    };
  }, []);

  const fetchAndCachePdfForFile = useCallback(async (courseId: string, fileId: string): Promise<string | null> => {
    if (!courseId || !fileId) return null;
    try {
      const token = localStorage.getItem('uniflow_token');
      if (!token) return null;
      const apiBase = getApiBaseUrl().replace(/\/$/, '');
      const downloadUrl = `${apiBase}/courses/${encodeURIComponent(courseId)}/files/${encodeURIComponent(fileId)}`;
      const res = await fetch(downloadUrl, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(String(ev.target?.result || ''));
        reader.onerror = () => reject(new Error('Failed to read PDF blob'));
        reader.readAsDataURL(blob);
      });
      if (!dataUrl.startsWith('data:application/pdf;base64,')) return null;
      setNotePdfDataInStorage(fileId, dataUrl);
      return dataUrl;
    } catch (error) {
      console.warn('Failed to fetch/cache note PDF from backend', error);
      return null;
    }
  }, []);

  const syncNotePayloadFromStorage = useCallback((targetId: string) => {
    if (!targetId) return;
    const noteContext = getStoredNoteContext(targetId);
    const fileMeta = noteContext.fileMeta || getStoredFileMeta(targetId);
    setStoredFileMeta(fileMeta);
    setStoredNoteContext(noteContext);

    const hydrate = async () => {
      const primaryKey = `uniflow_note_data_${targetId}`;
      const fileId = String(fileMeta?.id || targetId);
      const fileKey = `uniflow_note_data_${fileId}`;
      let data = localStorage.getItem(primaryKey) || localStorage.getItem(fileKey);
      if (!data && noteContext.courseId && fileId) {
        data = await fetchAndCachePdfForFile(noteContext.courseId, fileId);
      }
      setPdfData(data || null);
    };
    void hydrate();

    if (noteContext.documentName) {
      setDocumentName((current) => current || noteContext.documentName);
    }
    if (noteContext.courseName) {
      setCourseName((current) => current || noteContext.courseName);
    }
  }, [fetchAndCachePdfForFile, getStoredFileMeta, getStoredNoteContext]);

  const resolvedCourseName = courseName || storedNoteContext.courseName || 'Study Session';
  const resolvedDocumentName = documentName || storedNoteContext.documentName || storedFileMeta?.title || 'Focus Session';
  const savedSessionCourseName = storedNoteContext.courseName || courseName || 'Unknown Course';
  const resetFocusSessionTracking = () => {
    focusSessionStartedAtRef.current = null;
    focusSessionPlannedSecondsRef.current = 0;
    pomodoroIntervalSecondsRef.current = null;
    pomodoroBreakSecondsRef.current = 0;
    pomodoroNextBreakElapsedSecondsRef.current = null;
    setIsPomodoroBreakActive(false);
    setShowPomodoroBreakAlert(false);
    setPomodoroBreakMessage('');
  };

  const resetQuizSessionState = () => {
    setQuizIndex(0);
    setQuizState('unanswered');
    setSelectedOption(null);
    setShowExplanation(true);
    setQuizScore(0);
    setQuizFinished(false);
    setQuizAnswers([]);
    setQuizFeedback('');
    setQuizScorePercent(0);
  };

  const formatBreakDuration = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes > 0 && remainingSeconds > 0) {
      return `${minutes} min ${remainingSeconds} sec`;
    }

    if (minutes > 0) {
      return `${minutes} min`;
    }

    return `${remainingSeconds} sec`;
  };

  const continuePomodoroSession = () => {
    setShowPomodoroBreakAlert(false);
    setPomodoroBreakMessage('');
    setIsPomodoroBreakActive(false);
    setIsFocusSessionPaused(false);
  };

  const handleFocusCelebrationDismiss = useCallback(() => {
    setShowFocusCelebration(false);
    if (focusCelebrationVariantRef.current === 'quiz') {
      resetQuizSessionState();
      setIsPdfFullscreen(false);
      setActiveSegment('quiz');
    }
    focusCompletionHandledRef.current = false;
  }, []);

  // Fetch flashcards from Django API for the given pdf_id
  const fetchFlashcards = useCallback(async (pdfId: string) => {
    setFlashcardsLoading(true);
    try {
      const res = await fetch(`${DJANGO_API_URL}/api/flashcards/?pdf_id=${encodeURIComponent(pdfId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const cards: Flashcard[] = (data.flashcards || []).map(mapDjangoFlashcard);
      setFlashcards(cards);
      setFlashcardIndex(0);
      setIsFlipped(false);

      if (data.document_name) setDocumentName(data.document_name);
      if (data.course_name) setCourseName(data.course_name);

      // Auto-switch to flashcards tab once data arrives
      if (cards.length > 0) {
        setActiveSegment('flashcards');
      }
    } catch (err) {
      console.error('Failed to fetch flashcards from Django:', err);
    } finally {
      setFlashcardsLoading(false);
    }
  }, []);

  // Fetch quizzes from Django API for the given pdf_id
  const fetchQuizzes = useCallback(async (pdfId: string) => {
    setQuizzesLoading(true);
    try {
      const res = await fetch(`${DJANGO_API_URL}/api/quizzes/?pdf_id=${encodeURIComponent(pdfId)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const qz: QuizQuestion[] = (data.quizzes || []).map(mapDjangoQuiz);
      setQuizzes(qz);
      setQuizIndex(0);
      setQuizState('unanswered');
      setSelectedOption(null);

      if (data.document_name) setDocumentName(data.document_name);
      if (data.course_name) setCourseName(data.course_name);

      // Auto-switch to quiz tab once data arrives when focus mode is inactive.
      if (qz.length > 0 && focusSessionSecondsLeft === null) {
        setActiveSegment('quiz');
      }
    } catch (err) {
      console.error('Failed to fetch quizzes from Django:', err);
    } finally {
      setQuizzesLoading(false);
    }
  }, [focusSessionSecondsLeft]);

  // Fetch summaries from Django API
  const fetchSummary = useCallback(async (pdfId: string) => {
    setSummaryLoading(true);
    try {
      const res = await fetch(`${DJANGO_API_URL}/api/notes/${encodeURIComponent(pdfId)}/summary/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const sections: SummarySection[] = data.summary || [];
      const overview: string = data.overview || "";
      setSummarySections(sections);
      setSummaryOverview(overview);

      if (data.document_name) setDocumentName(data.document_name);
      if (data.course_name) setCourseName(data.course_name);

      // Auto-switch to summary tab once data arrives
      if (sections.length > 0) {
        setActiveSegment('summary');
      }
    } catch (err) {
      console.error('Failed to fetch summary from Django:', err);
    } finally {
      setSummaryLoading(false);
    }
  }, []);

  const ensureAiPdfId = useCallback(
    async (rawId: string): Promise<string> => {
      const s = (rawId || '').trim();
      if (!s) return s;

      // UUID ids (course_files.id) work as-is. Note ids tend to be numeric strings.
      const isNumeric = /^\d+$/.test(s);
      if (!isNumeric) {
        setAiPdfId(s);
        return s;
      }

      try {
        const token = localStorage.getItem('uniflow_token');
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (token) headers.Authorization = `Bearer ${token}`;

        const res = await fetch(`${DJANGO_API_URL}/api/notes/promote-for-ai/`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ note_id: s }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        const promoted = String(data?.pdf_id || '').trim();
        if (promoted) {
          setAiPdfId(promoted);
          return promoted;
        }
      } catch (e) {
        console.error('Failed to promote note for AI:', e);
      }

      // Fallback: keep the raw id so UI still works (though study endpoints may 500).
      setAiPdfId(s);
      return s;
    },
    []
  );

  // PATCH is_mastered status back to Django
  const toggleMastered = async (flashcard: Flashcard) => {
    const newMastered = !flashcard.isMastered;
    // Optimistic UI update
    setFlashcards(prev =>
      prev.map(fc => fc.id === flashcard.id ? { ...fc, isMastered: newMastered } : fc)
    );
    try {
      const res = await fetch(`${DJANGO_API_URL}/api/flashcards/${flashcard.id}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_mastered: newMastered }),
      });
      if (!res.ok) {
        // Revert optimistic update on failure
        setFlashcards(prev =>
          prev.map(fc => fc.id === flashcard.id ? { ...fc, isMastered: flashcard.isMastered } : fc)
        );
        console.error('Failed to update mastered status');
      }
    } catch (err) {
      // Revert on network error
      setFlashcards(prev =>
        prev.map(fc => fc.id === flashcard.id ? { ...fc, isMastered: flashcard.isMastered } : fc)
      );
      console.error('Network error updating mastered status:', err);
    }
  };

  // Load PDF from localStorage + stay in sync when upload finishes async (same tab) or tab refocuses
  useEffect(() => {
    if (!id) {
      setPdfData(null);
      return;
    }

    syncNotePayloadFromStorage(id);

    const onPdfUpdated = (e: Event) => {
      const noteId = (e as CustomEvent<{ noteId: string }>).detail?.noteId;
      if (noteId === id) syncNotePayloadFromStorage(id);
    };

    const onVisibility = () => {
      if (document.visibilityState === 'visible') {
        syncNotePayloadFromStorage(id);
      }
    };

    const onWindowFocus = () => {
      syncNotePayloadFromStorage(id);
    };

    const onStorage = (ev: StorageEvent) => {
      if (ev.key === `uniflow_note_data_${id}`) {
        syncNotePayloadFromStorage(id);
      }
    };

    window.addEventListener(NOTE_PDF_UPDATED_EVENT, onPdfUpdated);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('focus', onWindowFocus);
    window.addEventListener('storage', onStorage);

    return () => {
      window.removeEventListener(NOTE_PDF_UPDATED_EVENT, onPdfUpdated);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('focus', onWindowFocus);
      window.removeEventListener('storage', onStorage);
    };
  }, [id, syncNotePayloadFromStorage]);

  // Safety net: FileReader / network cache can land shortly after open; poll briefly if metadata exists but PDF not yet
  useEffect(() => {
    if (!id || pdfData) return;
    const meta = getStoredFileMeta(id);
    if (!meta) return;

    let attempts = 0;
    const maxAttempts = 48;
    const timer = window.setInterval(() => {
      attempts += 1;
      const latest = localStorage.getItem(`uniflow_note_data_${id}`);
      if (latest) {
        syncNotePayloadFromStorage(id);
        window.clearInterval(timer);
      } else if (attempts >= maxAttempts) {
        window.clearInterval(timer);
      }
    }, 500);

    return () => window.clearInterval(timer);
  }, [id, pdfData, getStoredFileMeta, syncNotePayloadFromStorage]);

  useEffect(() => {
    if (!id) {
      setStickyNotes([]);
      setShowStickyNotes(false);
      setHiddenStickyNoteIds([]);
      setStickyDeleteConfirmId(null);
      return;
    }

    try {
      const rawStickyNotes = localStorage.getItem(getStickyNotesStorageKey(id));
      const parsedStickyNotes = rawStickyNotes ? JSON.parse(rawStickyNotes) : [];
      setStickyNotes(Array.isArray(parsedStickyNotes) ? parsedStickyNotes : []);
    } catch (error) {
      console.error('Failed to load sticky notes', error);
      setStickyNotes([]);
    }
    setShowStickyNotes(false);
    setHiddenStickyNoteIds([]);
    setStickyDeleteConfirmId(null);
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    try {
      if (stickyNotes.length === 0) {
        localStorage.removeItem(getStickyNotesStorageKey(id));
        return;
      }

      localStorage.setItem(getStickyNotesStorageKey(id), JSON.stringify(stickyNotes));
    } catch (error) {
      console.error('Failed to persist sticky notes', error);
    }
  }, [id, stickyNotes]);

  // Check for existing flashcards and quizzes in DB whenever a Note id is present
  useEffect(() => {
    if (!id) return;
    let alive = true;
    (async () => {
      const pdfId = await ensureAiPdfId(id);
      if (!alive) return;
      // If we're still on a numeric id (not a UUID) we can't call study endpoints (they expect course_files UUIDs).
      if (/^\d+$/.test(id) && pdfId === id) {
        console.warn('Study AI skipped: note id is not linked to a course_files UUID. Upload/select a course file to use AI.');
        return;
      }
      fetchFlashcards(pdfId);
      fetchQuizzes(pdfId);
      fetchSummary(pdfId);
    })();
    return () => {
      alive = false;
    };
  }, [id, fetchFlashcards, fetchQuizzes, fetchSummary]);

  const [containerWidth, setContainerWidth] = useState<number>(window.innerWidth - 40);

  useEffect(() => {
    const handleResize = () => {
      const nextWidth = isPdfFullscreen ? window.innerWidth - 32 : window.innerWidth - 40;
      setContainerWidth(nextWidth);
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isPdfFullscreen]);

  useEffect(() => {
    if (activeSegment !== 'notes' || !pdfData || !id) {
      return;
    }
    const el = pdfViewerRef.current;
    if (!el) {
      return;
    }

    let raf = 0;
    const onScroll = () => {
      if (raf) {
        cancelAnimationFrame(raf);
      }
      raf = requestAnimationFrame(() => {
        const { scrollTop, scrollHeight, clientHeight } = el;
        if (scrollHeight <= 0) {
          return;
        }
        const viewed = scrollTop + clientHeight;
        const pct = Math.min(100, (viewed / scrollHeight) * 100);
        saveNoteReadingProgress(id, pct);
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      el.removeEventListener('scroll', onScroll);
      if (raf) {
        cancelAnimationFrame(raf);
      }
    };
  }, [activeSegment, pdfData, id]);

  useEffect(() => {
    if (activeSegment !== 'notes' || !pdfData || !numPages || !id) {
      return;
    }
    if (hasRestoredReadingProgressRef.current) {
      return;
    }
    hasRestoredReadingProgressRef.current = true;

    const progress = loadNoteReadingProgress(id);
    if (!progress.hasCurrentPercent || progress.currentPercent <= 0) {
      return;
    }
    const t = window.setTimeout(() => {
      const viewer = pdfViewerRef.current;
      if (!viewer) {
        return;
      }
      const maxScroll = viewer.scrollHeight - viewer.clientHeight;
      if (maxScroll > 0) {
        viewer.scrollTop = (progress.currentPercent / 100) * maxScroll;
      }
    }, 450);
    return () => clearTimeout(t);
  }, [activeSegment, pdfData, numPages, id]);

  useEffect(() => {
    // Reset restore guard whenever a different PDF/note is loaded.
    hasRestoredReadingProgressRef.current = false;
  }, [id, pdfData]);

  useEffect(() => {
    let selectionTimer: ReturnType<typeof setTimeout> | null = null;

    const handleSelection = () => {
      // Debounce – wait for the user to finish dragging handles
      if (selectionTimer) clearTimeout(selectionTimer);
      selectionTimer = setTimeout(() => {
        // Only show popup in notes view, when the chatbot isn't already open
        if (activeSegment !== 'notes' || showMiniChatbot) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) {
          setAskAIPos(null);
          return;
        }

        // Expand to full sentence / paragraph on mobile
        const range = selection.getRangeAt(0).cloneRange();
        const container = range.commonAncestorContainer;
        const textContent = container.nodeType === Node.TEXT_NODE
          ? container.textContent || ''
          : (container as HTMLElement).innerText || '';

        // If selected text is fewer than 3 chars, try expanding to surrounding sentence
        let text = selection.toString().trim();
        if (text.length < 3 && textContent.length > 0) {
          text = textContent.trim();
        }

        if (text && text.length > 5) {
          setSelectedText(text);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 || rect.height > 0) {
            setAskAIPos({
              x: rect.left + rect.width / 2,
              y: Math.max(rect.top - 56, 60)
            });
          }
        } else {
          setAskAIPos(null);
        }
      }, 300);
    };

    document.addEventListener('selectionchange', handleSelection);
    return () => {
      document.removeEventListener('selectionchange', handleSelection);
      if (selectionTimer) clearTimeout(selectionTimer);
    };
  }, [activeSegment, showMiniChatbot]);

  // Track the current visible page using IntersectionObserver
  useEffect(() => {
    const viewer = pdfViewerRef.current;
    if (!viewer || !numPages || activeSegment !== 'notes') return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const pageNode = entry.target as HTMLElement;
            const pNum = Number(pageNode.getAttribute('data-page-number'));
            if (pNum) {
              setPageNumber(pNum);
            }
          }
        });
      },
      { 
        threshold: 0.3, 
        root: viewer,
        rootMargin: '-10% 0px -10% 0px' 
      }
    );

    const timer = setTimeout(() => {
      const pageElements = viewer.querySelectorAll('.react-pdf__Page');
      pageElements.forEach((el) => {
        observer.observe(el);
      });
    }, 100);

    return () => {
      clearTimeout(timer);
      observer.disconnect();
    };
  }, [numPages, pdfData, activeSegment, rotation, scale]);

  useEffect(() => {
    if (focusSessionSecondsLeft === null) {
      return;
    }

    if (focusSessionSecondsLeft <= 0) {
      if (focusCompletionHandledRef.current) {
        return;
      }
      focusCompletionHandledRef.current = true;

      const completedTechnique = focusSessionTechniqueRef.current;
      if (focusSessionStartedAtRef.current && focusSessionPlannedSecondsRef.current > 0) {
        saveFocusSessionRecord({
          id: `focus-${Date.now()}`,
          noteId: id || null,
          courseId: storedNoteContext.courseId || null,
          startedAt: focusSessionStartedAtRef.current,
          endedAt: new Date().toISOString(),
          durationSeconds: focusSessionPlannedSecondsRef.current,
          minutesRead: Math.max(1, Math.round(focusSessionPlannedSecondsRef.current / 60)),
          courseName: savedSessionCourseName,
          documentName: resolvedDocumentName,
          quizScorePercent: quizFinished ? Math.round(quizScorePercent) : null
        });
      }
      resetFocusSessionTracking();
      setFocusSessionSecondsLeft(null);
      setIsFocusSessionPaused(false);

      focusCelebrationVariantRef.current = completedTechnique === 'active_recall' ? 'quiz' : 'complete';
      setShowFocusCelebration(true);

      return;
    }

    if (
      focusSessionTechniqueRef.current === 'pomodoro' &&
      !isFocusSessionPaused &&
      !showPomodoroBreakAlert &&
      pomodoroNextBreakElapsedSecondsRef.current !== null &&
      focusSessionPlannedSecondsRef.current > 0
    ) {
      const elapsedSeconds = focusSessionPlannedSecondsRef.current - focusSessionSecondsLeft;
      if (elapsedSeconds >= pomodoroNextBreakElapsedSecondsRef.current) {
        const nextBreakTarget = pomodoroNextBreakElapsedSecondsRef.current + (pomodoroIntervalSecondsRef.current || 0);
        pomodoroNextBreakElapsedSecondsRef.current = nextBreakTarget < focusSessionPlannedSecondsRef.current
          ? nextBreakTarget
          : null;
        setIsFocusSessionPaused(true);
        setIsPomodoroBreakActive(true);
        setPomodoroBreakMessage(`Take a ${formatBreakDuration(pomodoroBreakSecondsRef.current)} break, then tap continue session when you're ready.`);
        setShowPomodoroBreakAlert(true);
        return;
      }
    }

    if (isFocusSessionPaused) {
      return;
    }

    const timerId = window.setInterval(() => {
      setFocusSessionSecondsLeft((current) => {
        if (current === null || current <= 1) {
          window.clearInterval(timerId);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => window.clearInterval(timerId);
  }, [focusSessionSecondsLeft, formatBreakDuration, isFocusSessionPaused, quizFinished, quizScorePercent, resolvedCourseName, resolvedDocumentName, showPomodoroBreakAlert, storedNoteContext.courseId]);

  useEffect(() => {
    if (!id || !storedFileMeta?.isConverting || pdfData) {
      return;
    }

    syncNotePayloadFromStorage(id);
    const pollId = window.setInterval(() => syncNotePayloadFromStorage(id), 3000);
    return () => window.clearInterval(pollId);
  }, [id, storedFileMeta?.isConverting, pdfData, syncNotePayloadFromStorage]);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPageNumber(1);
  };

  const highlightPattern = useCallback(
    (text: string, pattern: string) => {
      if (!pattern) return text;
      const splitText = text.split(new RegExp(`(${pattern})`, 'gi'));
      return splitText.map((chunk) =>
        chunk.toLowerCase() === pattern.toLowerCase() ? `<mark>${chunk}</mark>` : chunk
      ).join('');
    },
    []
  );

  const textRenderer = useCallback(
    (textItem: any) => highlightPattern(textItem.str, searchQuery),
    [searchQuery, highlightPattern]
  );

  const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 3.0));
  const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);
  const handlePrevPage = () => setPageNumber(prev => Math.max(prev - 1, 1));
  const handleNextPage = () => setPageNumber(prev => Math.min(prev + 1, numPages || 1));

  const handleAskAI = async () => {
    if (!selectedText || !user?.id) return;
    setAskAIPos(null);
    setShowMiniChatbot(true);

    // Auto-message logic
    const initialUserMessage: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      text: `Explain this section regarding "${documentName}": "${selectedText}"`,
      isUser: true,
      timestamp: new Date()
    };

    setMiniChatMessages([initialUserMessage]);
    setIsMiniChatLoading(true);

    const sessionId = miniChatSessionId || `session_${Math.random().toString(36).substr(2, 9)}`;
    if (!miniChatSessionId) setMiniChatSessionId(sessionId);

    try {
      const apiResponse = await aiClient.chat(user.id, initialUserMessage.text, sessionId);
      const aiMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        text: apiResponse.response,
        isUser: false,
        timestamp: new Date()
      };
      setMiniChatMessages(prev => [...prev, aiMessage]);
    } catch (e) {
      setMiniChatMessages(prev => [...prev, {
        id: 'error',
        text: "Sorry, I couldn't reach the AI server.",
        isUser: false,
        timestamp: new Date()
      }]);
    } finally {
      setIsMiniChatLoading(false);
    }
  };

  const handleMiniChatSend = async () => {
    if (!miniChatInput.trim() || isMiniChatLoading || !user?.id) return;
    const newMsgText = miniChatInput.trim();
    setMiniChatInput('');

    const userMsg: ChatMessage = {
      id: Math.random().toString(36).substr(2, 9),
      text: newMsgText,
      isUser: true,
      timestamp: new Date()
    };
    setMiniChatMessages(prev => [...prev, userMsg]);
    setIsMiniChatLoading(true);

    const sessionId = miniChatSessionId || `session_${Math.random().toString(36).substr(2, 9)}`;
    if (!miniChatSessionId) setMiniChatSessionId(sessionId);

    try {
      const apiResponse = await aiClient.chat(user.id, newMsgText, sessionId);
      const aiMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        text: apiResponse.response,
        isUser: false,
        timestamp: new Date()
      };
      setMiniChatMessages(prev => [...prev, aiMessage]);
    } catch (e) {
      setMiniChatMessages(prev => [...prev, {
        id: 'error',
        text: "Communication error.",
        isUser: false,
        timestamp: new Date()
      }]);
    } finally {
      setIsMiniChatLoading(false);
    }
  };

  /** Page the user is actually viewing inside the scrollable PDF viewer (not stale React state). */
  const getVisiblePdfPageNumber = useCallback(() => {
    const viewer = pdfViewerRef.current;
    if (!viewer || !numPages) {
      return pageNumber;
    }

    const pageEls = viewer.querySelectorAll('.react-pdf__Page');
    if (!pageEls.length) {
      return pageNumber;
    }

    const vr = viewer.getBoundingClientRect();
    let bestPage = pageNumber;
    let bestArea = 0;

    pageEls.forEach((node) => {
      const el = node as HTMLElement;
      const r = el.getBoundingClientRect();
      const top = Math.max(r.top, vr.top);
      const bottom = Math.min(r.bottom, vr.bottom);
      const left = Math.max(r.left, vr.left);
      const right = Math.min(r.right, vr.right);
      const area = Math.max(0, bottom - top) * Math.max(0, right - left);
      if (area > bestArea) {
        bestArea = area;
        const n = Number(el.getAttribute('data-page-number'));
        if (!Number.isNaN(n) && n >= 1) {
          bestPage = n;
        }
      }
    });

    return bestArea > 0 ? bestPage : pageNumber;
  }, [numPages, pageNumber]);

  const handleAddStickyNote = () => {
    const targetPage = getVisiblePdfPageNumber();
    setShowStickyNotes(true);
    setHiddenStickyNoteIds([]);
    setStickyNotes((current) => [
      ...current,
      {
        id: `sticky-${Date.now()}`,
        x: 20,
        y: 20,
        width: 220,
        height: 200,
        text: '',
        page: targetPage,
        color: STICKY_NOTE_COLORS[current.length % STICKY_NOTE_COLORS.length]
      }
    ]);
  };

  const handleStickyNotesButtonClick = () => {
    if (!showStickyNotes || hiddenStickyNoteIds.length > 0) {
      setShowStickyNotes(true);
      setHiddenStickyNoteIds([]);
      setStickyDeleteConfirmId(null);

      if (stickyNotes.length === 0) {
        handleAddStickyNote();
      }

      return;
    }

    handleAddStickyNote();
  };

  const updateStickyNote = (noteId: string, text: string) => {
    setStickyNotes((current) => current.map((note) => (
      note.id === noteId ? { ...note, text } : note
    )));
  };

  const removeStickyNote = (noteId: string) => {
    setStickyNotes((current) => current.filter((note) => note.id !== noteId));
    setHiddenStickyNoteIds((current) => current.filter((nid) => nid !== noteId));
    setStickyDeleteConfirmId((current) => current === noteId ? null : current);
  };

  const hideStickyNote = (noteId: string) => {
    setHiddenStickyNoteIds((current) => (
      current.includes(noteId) ? current : [...current, noteId]
    ));
    setStickyDeleteConfirmId(null);
  };

  const updateStickyNoteColor = (noteId: string, color: StickyNote['color']) => {
    setStickyNotes((current) => current.map((note) => (
      note.id === noteId ? { ...note, color } : note
    )));
  };

  const clearPdfSearchHighlights = useCallback(() => {
    const viewer = pdfViewerRef.current;
    if (!viewer) {
      return;
    }

    viewer.querySelectorAll('.nd-pdf-search-hit').forEach((node) => {
      node.classList.remove('nd-pdf-search-hit');
    });
  }, []);

  const runPdfSearch = useCallback((query: string) => {
    const viewer = pdfViewerRef.current;
    if (!viewer) {
      return;
    }

    clearPdfSearchHighlights();

    const trimmedQuery = query.trim().toLowerCase();
    if (!trimmedQuery) {
      setSearchMatchCount(0);
      return;
    }

    const textNodes = Array.from(
      viewer.querySelectorAll('.react-pdf__Page__textContent span')
    ) as HTMLSpanElement[];

    const matches = textNodes.filter((node) =>
      node.textContent?.toLowerCase().includes(trimmedQuery)
    );

    matches.forEach((node) => node.classList.add('nd-pdf-search-hit'));
    setSearchMatchCount(matches.length);

    if (matches[0]) {
      matches[0].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [clearPdfSearchHighlights]);

  useEffect(() => {
    if (activeSegment !== 'notes' || !pdfData) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      runPdfSearch(searchQuery);
    }, 180);

    return () => window.clearTimeout(timeoutId);
  }, [activeSegment, pdfData, searchQuery, rotation, runPdfSearch]);

  useEffect(() => {
    const handlePointerMove = (event: PointerEvent) => {
      const state = dragStateRef.current;
      if (!state || !pdfViewerRef.current) return;

      const element = document.getElementById(`sticky-note-container-${state.noteId}`);
      if (!element) return;

      if (state.type === 'drag' && state.offsetX !== undefined && state.offsetY !== undefined) {
        const deltaX = Math.abs(event.clientX - (state.startX || event.clientX));
        const deltaY = Math.abs(event.clientY - (state.startY || event.clientY));
        
        if (!state.hasMoved && (deltaX > 2 || deltaY > 2)) {
          state.hasMoved = true;
        }

        if (state.hasMoved) {
          if (event.cancelable) {
            event.preventDefault();
          }
          const pageContainer = element.parentElement;
          if (!pageContainer) return;
          const pageRect = pageContainer.getBoundingClientRect();

          const nextX = Math.max(0, event.clientX - pageRect.left - state.offsetX);
          const nextY = Math.max(0, event.clientY - pageRect.top - state.offsetY);

          element.style.left = `${nextX}px`;
          element.style.top = `${nextY}px`;
          
          state.lastX = nextX;
          state.lastY = nextY;
        }
      } else if (state.type === 'resize' && state.startX !== undefined && state.startY !== undefined && state.startWidth !== undefined && state.startHeight !== undefined) {
        const deltaX = event.clientX - state.startX;
        const deltaY = event.clientY - state.startY;

        let newWidth = Math.max(200, Math.min(state.startWidth + deltaX, 500));
        let newHeight = Math.max(150, Math.min(state.startHeight + deltaY, 600));

        if (event.cancelable) {
          event.preventDefault();
        }
        // Direct DOM update for performance
        element.style.width = `${newWidth}px`;
        element.style.height = `${newHeight}px`;

        // Track for final state sync
        state.lastWidth = newWidth;
        state.lastHeight = newHeight;
      }
    };

    const endPointerGesture = () => {
      const state = dragStateRef.current;
      if (state?.captureEl != null && state.pointerId != null) {
        try {
          state.captureEl.releasePointerCapture(state.pointerId);
        } catch {
          /* ignore */
        }
      }
      if (state) {
        setStickyNotes((current) => current.map((note) => {
          if (note.id !== state.noteId) return note;

          return {
            ...note,
            x: state.lastX !== undefined ? state.lastX : note.x,
            y: state.lastY !== undefined ? state.lastY : note.y,
            width: state.lastWidth !== undefined ? state.lastWidth : note.width,
            height: state.lastHeight !== undefined ? state.lastHeight : note.height,
          };
        }));
      }
      dragStateRef.current = null;
    };

    const moveOpts: AddEventListenerOptions = { capture: true, passive: false };
    window.addEventListener('pointermove', handlePointerMove, moveOpts);
    window.addEventListener('pointerup', endPointerGesture, true);
    window.addEventListener('pointercancel', endPointerGesture, true);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove, moveOpts);
      window.removeEventListener('pointerup', endPointerGesture, true);
      window.removeEventListener('pointercancel', endPointerGesture, true);
    };
  }, []);

  const handleNextFlashcard = () => {
    if (flashcardIndex < flashcards.length - 1) {
      setFlashcardIndex(prev => prev + 1);
      setIsFlipped(false);
    }
  };
  const handlePrevFlashcard = () => {
    if (flashcardIndex > 0) {
      setFlashcardIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  };

  const handleBack = () => {
    history.goBack();
  };

  const handleOptionSelect = (index: number) => {
    if (quizState === 'unanswered') {
      setSelectedOption(index);
      setQuizState('answered');
      // Track this answer
      const currentQuiz = quizzes[quizIndex];
      if (currentQuiz) {
        setQuizAnswers(prev => [
          ...prev.filter(a => a.question_id !== currentQuiz.id),
          { question_id: currentQuiz.id, selected_index: index }
        ]);
        if (index === currentQuiz.correctAnswerIndex) {
          setQuizScore(prev => prev + 1);
        }
      }
    }
  };

  const handleRetakeQuiz = () => {
    resetQuizSessionState();
  };

  const handleSubmitQuiz = async (finalAnswers: { question_id: number; selected_index: number }[]) => {
    setQuizSubmitting(true);
    try {
      const userId = localStorage.getItem('uniflow_user')
        ? JSON.parse(localStorage.getItem('uniflow_user')!).id
        : 'anonymous';
      const res = await fetch(`${DJANGO_API_URL}/api/quiz/submit/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pdf_id: id,
          user_id: userId,
          answers: finalAnswers,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setQuizScorePercent(data.score_percentage ?? 0);
        setQuizFeedback(data.feedback ?? '');
      } else {
        // Fallback: calculate locally
        const pct = quizzes.length > 0 ? Math.round((quizScore / quizzes.length) * 100) : 0;
        setQuizScorePercent(pct);
        setQuizFeedback(pct >= 80 ? "Mastered! You're ready for the exam." : pct >= 50 ? "Good effort! Review the Summary tab." : "Keep going! Try re-reading the document.");
      }
    } catch {
      // Fallback: calculate locally
      const pct = quizzes.length > 0 ? Math.round((quizScore / quizzes.length) * 100) : 0;
      setQuizScorePercent(pct);
      setQuizFeedback(pct >= 80 ? "Mastered! You're ready for the exam." : pct >= 50 ? "Good effort! Review the Summary tab." : "Keep going! Try re-reading the document.");
    } finally {
      setQuizSubmitting(false);
      setQuizFinished(true);
    }
  };

  const toggleSection = (section: number) => {
    if (expandedSection === section) setExpandedSection(null);
    else setExpandedSection(section);
  };

  const currentCard = flashcards[flashcardIndex];
  const isFocusSessionActive = focusSessionSecondsLeft !== null;
  const isConversionPending = !pdfData && storedFileMeta?.isConverting;
  const focusPopupPrimaryLabel = !isFocusSessionActive
    ? 'Start Session'
    : isPomodoroBreakActive
      ? 'Continue Session'
      : isFocusSessionPaused
        ? 'Resume Session'
        : 'Pause Session';
  const handleQuizSegmentClick = () => {
    if (isFocusSessionActive) {
      setShowQuizBlockedAlert(true);
      return;
    }

    setActiveSegment('quiz');
  };
  const handleStickyPointerDown = (event: React.PointerEvent, noteId: string) => {
    const target = event.target as HTMLElement;
    // Let textarea, resize handle, and controls handle their own gestures
    if (
      target.closest('textarea') ||
      target.closest('.nd-sticky-note-resize-handle') ||
      target.closest('button')
    ) {
      return;
    }

    event.stopPropagation();
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      event.preventDefault();
    }

    const element = document.getElementById(`sticky-note-container-${noteId}`);
    if (!element) return;

    try {
      element.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }

    const noteRect = element.getBoundingClientRect();
    dragStateRef.current = {
      noteId,
      type: 'drag',
      offsetX: event.clientX - noteRect.left,
      offsetY: event.clientY - noteRect.top,
      startX: event.clientX,
      startY: event.clientY,
      hasMoved: false,
      captureEl: element,
      pointerId: event.pointerId,
    };
  };

  const handleResizePointerDown = (event: React.PointerEvent<HTMLDivElement>, noteId: string) => {
    event.stopPropagation();
    event.preventDefault();
    const note = stickyNotes.find(n => n.id === noteId);
    if (!note) return;

    const container = document.getElementById(`sticky-note-container-${noteId}`);
    const captureEl = container ?? event.currentTarget;
    try {
      captureEl.setPointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }

    dragStateRef.current = {
      noteId,
      type: 'resize',
      startX: event.clientX,
      startY: event.clientY,
      startWidth: note.width || 220,
      startHeight: note.height || 200,
      captureEl,
      pointerId: event.pointerId,
    };
  };

  const formatFocusTimer = (seconds: number | null) => {
    if (seconds === null) {
      return 'Focus Session';
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  return (
    <IonPage className={`note-detail-page ${isPdfFullscreen ? 'pdf-fullscreen' : ''}`}>
      {/* Transparent edge blocker to absorb Ionic's swipe-back gesture */}
      <div className="nd-swipe-guard" />
      {!isPdfFullscreen && (
        <div className="nd-header nd-header-settings-style">
          <BackButton />
          <h1 className="nd-title nd-title-centred">{resolvedDocumentName || 'Loading...'}</h1>
          {!isFocusSessionActive && (
            <button className="nd-focus-btn nd-focus-btn-right" onClick={() => setShowFocusPopup(true)}>
              Focus
            </button>
          )}
        </div>
      )}

      {isFocusSessionActive && activeSegment !== 'notes' && (
        <button
          type="button"
          className={`nd-focus-timer-floating ${isPdfFullscreen ? 'fullscreen' : 'windowed'}`}
          onClick={() => setShowFocusPopup(true)}
        >
          {isPomodoroBreakActive
            ? `Break • ${formatFocusTimer(focusSessionSecondsLeft)}`
            : isFocusSessionPaused
              ? `Paused • ${formatFocusTimer(focusSessionSecondsLeft)}`
              : formatFocusTimer(focusSessionSecondsLeft)}
        </button>
      )}

      <IonAlert
        isOpen={showQuizBlockedAlert}
        onDidDismiss={() => setShowQuizBlockedAlert(false)}
        header="Focus Session Active"
        message="Finish focus mode first to open the quiz."
        buttons={['OK']}
      />

      <IonAlert
        isOpen={stickyDeleteConfirmId !== null}
        onDidDismiss={() => {
          setStickyDeleteConfirmId(null);
          stickyDeleteTargetRef.current = null;
        }}
        header="Delete sticky note?"
        message="This will remove the note permanently."
        buttons={[
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Delete',
            role: 'destructive',
            handler: () => {
              const nid = stickyDeleteTargetRef.current;
              stickyDeleteTargetRef.current = null;
              if (nid) removeStickyNote(nid);
            },
          },
        ]}
      />

      <FocusSessionBreakOverlay
        open={showPomodoroBreakAlert}
        message={pomodoroBreakMessage}
        onContinue={continuePomodoroSession}
      />
      <FocusSessionPauseOverlay
        open={Boolean(focusSessionSecondsLeft !== null && isFocusSessionPaused && !isPomodoroBreakActive && !showPomodoroBreakAlert && !showFocusPopup)}
        remainingLabel={formatFocusTimer(focusSessionSecondsLeft)}
        onResume={() => setIsFocusSessionPaused(false)}
      />

      <FocusSessionCompleteCelebration
        open={showFocusCelebration}
        variant={focusCelebrationVariantRef.current}
        documentName={resolvedDocumentName}
        onDismiss={handleFocusCelebrationDismiss}
      />

      {showFocusPopup && (
        <div className="nd-focus-popup-overlay">
          <div className="nd-focus-popup">
            <h2>Focus Session</h2>

            <div className="nd-focus-section" style={{ position: 'relative' }}>
              <label>Study Technique</label>
              <div
                className="nd-glassy-dropdown-btn"
                onClick={() => setStudyTechniqueOpen(!studyTechniqueOpen)}
              >
                <span>{studyTechniques.find(t => t.value === studyTechnique)?.label || 'Select'}</span>
                <IonIcon icon={chevronDownOutline} className={`nd-dropdown-icon ${studyTechniqueOpen ? 'open' : ''}`} />
              </div>

              {studyTechniqueOpen && (
                <div className="nd-glassy-dropdown-menu">
                  {studyTechniques.map(tech => (
                    <div
                      key={tech.value}
                      className={`nd-glassy-dropdown-item ${studyTechnique === tech.value ? 'selected' : ''}`}
                      onClick={() => {
                        setStudyTechnique(tech.value);
                        setStudyTechniqueOpen(false);
                      }}
                    >
                      {tech.label}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="nd-focus-section">
              <label>Timer (minutes)</label>
              <input
                type="number"
                value={focusTimer}
                onChange={(e) => setFocusTimer(Number(e.target.value))}
                min="1"
              />
            </div>

            <div className="nd-focus-section-toggle">
              <label htmlFor="dnd-toggle">Turn on DND (Focus Mode)</label>
              <div
                className={`nd-toggle-switch ${dndEnabled ? 'active' : ''}`}
                onClick={() => setDndEnabled(!dndEnabled)}
              >
                <div className="nd-toggle-knob"></div>
              </div>
            </div>

            <div className="nd-focus-actions">
              <button className="nd-focus-start" onClick={() => {
                if (!isFocusSessionActive) {
                  const plannedMinutes = Math.max(focusTimer, 1);
                  const plannedSeconds = plannedMinutes * 60;
                  const intervalMinutes = Math.max(Math.round(plannedMinutes / 5), 1);
                  const breakMinutes = Math.max(Math.round(intervalMinutes / 5), 1);

                  focusSessionStartedAtRef.current = new Date().toISOString();
                  focusSessionPlannedSecondsRef.current = plannedSeconds;
                  focusSessionTechniqueRef.current = studyTechnique as 'pomodoro' | 'active_recall' | 'study_your_way';
                  pomodoroIntervalSecondsRef.current = studyTechnique === 'pomodoro' ? intervalMinutes * 60 : null;
                  pomodoroBreakSecondsRef.current = studyTechnique === 'pomodoro' ? breakMinutes * 60 : 0;
                  pomodoroNextBreakElapsedSecondsRef.current = studyTechnique === 'pomodoro' && plannedMinutes > intervalMinutes
                    ? intervalMinutes * 60
                    : null;
                  setIsPomodoroBreakActive(false);
                  setShowPomodoroBreakAlert(false);
                  setPomodoroBreakMessage('');
                  focusCompletionHandledRef.current = false;
                  setShowFocusPopup(false);
                  setActiveSegment('notes');
                  setIsPdfFullscreen(true);
                  setFocusSessionSecondsLeft(plannedSeconds);
                  setIsFocusSessionPaused(false);
                  return;
                }

                if (isPomodoroBreakActive) {
                  continuePomodoroSession();
                  setShowFocusPopup(false);
                  return;
                }

                setIsFocusSessionPaused((current) => !current);
                setShowFocusPopup(false);
              }}>{focusPopupPrimaryLabel}</button>
              <button
                className="nd-focus-cancel"
                onClick={() => {
                  if (isFocusSessionActive) {
                    if (focusSessionStartedAtRef.current && focusSessionPlannedSecondsRef.current > 0) {
                      const remainingSeconds = focusSessionSecondsLeft ?? 0;
                      const elapsedSeconds = Math.max(0, focusSessionPlannedSecondsRef.current - remainingSeconds);
                      if (elapsedSeconds > 0) {
                        saveFocusSessionRecord({
                          id: `focus-${Date.now()}`,
                          noteId: id || null,
                          courseId: storedNoteContext.courseId || null,
                          startedAt: focusSessionStartedAtRef.current,
                          endedAt: new Date().toISOString(),
                          durationSeconds: elapsedSeconds,
                          minutesRead: Math.max(1, Math.round(elapsedSeconds / 60)),
                          courseName: savedSessionCourseName,
                          documentName: resolvedDocumentName,
                          quizScorePercent: quizFinished ? Math.round(quizScorePercent) : null
                        });
                      }
                    }
                    resetFocusSessionTracking();
                    focusCompletionHandledRef.current = false;
                    setFocusSessionSecondsLeft(null);
                    setIsFocusSessionPaused(false);
                    setShowFocusPopup(false);
                    return;
                  }

                  setShowFocusPopup(false);
                }}
              >
                {isFocusSessionActive ? 'End Session' : 'Cancel'}
              </button>
            </div>
          </div>
        </div>
      )}

      {!isPdfFullscreen && (
        <div className="nd-segments-container">
          <div className="nd-segments">
            <button
              className={`nd-segment-btn ${activeSegment === 'notes' ? 'active' : ''}`}
              onClick={() => setActiveSegment('notes')}
            >
              Notes
            </button>
            <button
              className={`nd-segment-btn ${activeSegment === 'summary' ? 'active' : ''}`}
              onClick={() => setActiveSegment('summary')}
            >
              Summary
            </button>
            <button
              className={`nd-segment-btn ${activeSegment === 'quiz' ? 'active' : ''}`}
              onClick={handleQuizSegmentClick}
            >
              Quiz
            </button>
            <button
              className={`nd-segment-btn ${activeSegment === 'flashcards' ? 'active' : ''}`}
              onClick={() => setActiveSegment('flashcards')}
            >
              Flashcards
              {flashcardsLoading && (
                <span className="nd-tab-spinner" aria-label="Loading flashcards" />
              )}
            </button>
          </div>
        </div>
      )}

      <IonContent className={`nd-content ${isPdfFullscreen ? 'fullscreen' : ''}`} scrollY={!isPdfFullscreen} fullscreen={isPdfFullscreen}>
        {activeSegment === 'notes' && (
          <div className={`nd-tab-container nd-notes-tab ${isPdfFullscreen ? 'fullscreen' : ''}`}>
            <div className="status-bar-spacer" aria-hidden="true" />
            <div className="nd-pdf-toolbar">
              <div className="nd-toolbar-group nd-toolbar-group-start">
                <span className="nd-page-info">{numPages ? `${numPages} Pages` : '-'}</span>
                {isFocusSessionActive && (
                  <button
                    type="button"
                    className="nd-focus-timer-inline"
                    onClick={() => setShowFocusPopup(true)}
                  >
                    {isPomodoroBreakActive
                      ? `Break • ${formatFocusTimer(focusSessionSecondsLeft)}`
                      : isFocusSessionPaused
                        ? `Paused • ${formatFocusTimer(focusSessionSecondsLeft)}`
                        : formatFocusTimer(focusSessionSecondsLeft)}
                  </button>
                )}
                <button
                  className={`nd-tool-btn ${isSearchOpen ? 'active' : ''}`}
                  onClick={() => {
                    setIsSearchOpen((current) => !current);
                    if (isSearchOpen) {
                      setSearchQuery('');
                      clearPdfSearchHighlights();
                      setSearchMatchCount(0);
                    }
                  }}
                  aria-label="Search text in PDF"
                >
                  <IonIcon icon={searchOutline} />
                </button>
                <button
                  className="nd-tool-btn nd-fullscreen-btn"
                  onClick={() => setIsPdfFullscreen((current) => !current)}
                  aria-label={isPdfFullscreen ? 'Minimize PDF viewer' : 'Maximize PDF viewer'}
                >
                  {isPdfFullscreen ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M9 3H4v5" />
                      <path d="M15 3h5v5" />
                      <path d="M9 21H4v-5" />
                      <path d="M15 21h5v-5" />
                      <path d="M9 9 4 4" />
                      <path d="M15 9 20 4" />
                      <path d="M9 15 4 20" />
                      <path d="M15 15 20 20" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true">
                      <path d="M10 10 4 4" />
                      <path d="M14 10 20 4" />
                      <path d="M10 14 4 20" />
                      <path d="M14 14 20 20" />
                      <path d="M8 4H4v4" />
                      <path d="M16 4h4v4" />
                      <path d="M8 20H4v-4" />
                      <path d="M16 20h4v-4" />
                    </svg>
                  )}
                </button>
                <button
                  className={`nd-tool-btn ${showStickyNotes ? 'active' : ''}`}
                  onClick={handleStickyNotesButtonClick}
                  aria-label={showStickyNotes ? 'Add another sticky note' : 'Show sticky notes'}
                >
                  <IonIcon icon={documentTextOutline} />
                </button>
              </div>
              <div className="nd-toolbar-divider"></div>
              <div className="nd-toolbar-group">
                <button className="nd-tool-btn" onClick={handleRotate}><IonIcon icon={refreshOutline} /></button>
              </div>
            </div>

            {isSearchOpen && (
              <div className="nd-pdf-searchbar">
                <div className="nd-pdf-search-input-wrap">
                  <IonIcon icon={searchOutline} />
                  <input
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search text in this PDF"
                    className="nd-pdf-search-input"
                  />
                </div>
                <span className="nd-pdf-search-count">
                  {searchQuery.trim() ? `${searchMatchCount} match${searchMatchCount === 1 ? '' : 'es'}` : 'Type to search'}
                </span>
              </div>
            )}

            <div className="nd-pdf-viewer" ref={pdfViewerRef}>
              {pdfData ? (
                <>

                  <Document
                    key={`nd-pdf-${id}-${pdfData.length}`}
                    file={pdfData}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<div style={{ padding: '20px', textAlign: 'center' }}>Loading PDF...</div>}
                    error={<div style={{ padding: '20px', textAlign: 'center' }}>Failed to load PDF.</div>}
                  >
                    {numPages && Array.from(new Array(numPages), (el, index) => (
                      <div key={`page_wrapper_${index + 1}`} style={{ position: 'relative', marginBottom: '16px', display: 'inline-block' }}>
                        <Page
                          pageNumber={index + 1}
                          rotate={rotation}
                          width={containerWidth}
                          renderTextLayer={true}
                          renderAnnotationLayer={true}
                          customTextRenderer={textRenderer}
                          className="nd-pdf-page"
                        />
                        {/* Render sticky notes anchored to this page */}
                        {showStickyNotes && stickyNotes
                          .filter((note) => note.page === (index + 1) && !hiddenStickyNoteIds.includes(note.id))
                          .map((note) => (
                            <div
                              key={note.id}
                              id={`sticky-note-container-${note.id}`}
                              className={`nd-sticky-note nd-sticky-note-${note.color}`}
                              style={{
                                left: note.x,
                                top: note.y,
                                width: note.width ? `${note.width}px` : '220px',
                                height: note.height ? `${note.height}px` : '200px'
                              }}
                              onPointerDown={(event) => handleStickyPointerDown(event, note.id)}
                            >
                              <div
                                className="nd-sticky-note-header"
                              >
                                <span>Sticky note</span>
                                <div className="nd-sticky-note-header-actions">
                                  <button
                                    type="button"
                                    className="nd-sticky-note-delete-btn"
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                    }}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      stickyDeleteTargetRef.current = note.id;
                                      setStickyDeleteConfirmId(note.id);
                                    }}
                                    aria-label="Delete sticky note"
                                  >
                                    <IonIcon icon={trashOutline} />
                                  </button>
                                  <div className="nd-sticky-note-colors">
                                    {STICKY_NOTE_COLORS.map((color) => (
                                      <button
                                        key={color}
                                        className={`nd-sticky-note-color nd-sticky-note-color-${color} ${note.color === color ? 'active' : ''}`}
                                        onPointerDown={(e) => {
                                          e.stopPropagation();
                                          e.preventDefault();
                                          updateStickyNoteColor(note.id, color);
                                        }}
                                        aria-label={`Use ${color} sticky note`}
                                      />
                                    ))}
                                  </div>
                                  <button
                                    className="nd-sticky-note-close"
                                    onPointerDown={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      hideStickyNote(note.id);
                                    }}
                                  >
                                    <IonIcon icon={closeOutline} />
                                  </button>
                                </div>
                              </div>
                              <textarea
                                value={note.text}
                                onChange={(event) => updateStickyNote(note.id, event.target.value)}
                                onPointerDown={(e) => e.stopPropagation()}
                                placeholder="Write a note..."
                                className="nd-sticky-note-textarea"
                              />
                              <div
                                className="nd-sticky-note-resize-handle"
                                onPointerDown={(event) => handleResizePointerDown(event, note.id)}
                              >
                                ⌟
                              </div>
                            </div>
                          ))}
                      </div>
                    ))}
                  </Document>
                </>
              ) : isConversionPending ? (
                <div className="nd-conversion-screen">
                  <div className="nd-conversion-orb nd-conversion-orb-one" />
                  <div className="nd-conversion-orb nd-conversion-orb-two" />
                  <div className="nd-conversion-card">
                    <div className="nd-conversion-viewer-loader" aria-hidden="true">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <div className="nd-conversion-wave">
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                    <p className="nd-conversion-eyebrow">Audio Note</p>
                    <h2>Converting your note</h2>
                    <p className="nd-conversion-copy">
                      We&apos;re turning this recording into a readable study note. You&apos;ll see the PDF here as soon as processing finishes.
                    </p>
                    <div className="nd-conversion-progress">
                      <div
                        className="nd-conversion-progress-fill"
                        style={{ width: `${Math.max(storedFileMeta?.progress || 20, 12)}%` }}
                      />
                    </div>
                    <span className="nd-conversion-footnote">Processing in the background...</span>
                  </div>
                </div>
              ) : (
                <p style={{ textAlign: 'center', padding: '40px', color: '#888' }}>No PDF document uploaded. Go back and upload a document to view it here.</p>
              )}
            </div>
          </div>
        )}

        {activeSegment === 'summary' && (
          <div className="nd-tab-container nd-summary-tab">
            <div className="nd-summary-header">
              <div className="nd-sh-left">
                <div className="nd-sh-icon">
                  <IonIcon icon={bookOutline} />
                </div>
                <div className="nd-sh-text">
                  <span className="nd-sh-category">{resolvedCourseName}</span>
                  <span className="nd-sh-title">{resolvedDocumentName}</span>
                </div>
              </div>
              <div className="nd-sh-right">
                <IonIcon icon={timeOutline} />
                <span>{summarySections.length > 0 ? `${summarySections.length * 2} min read` : '5 min read'}</span>
              </div>
            </div>

            <div className="nd-tags">
              <span className="nd-tag"><IonIcon icon={pricetagOutline} /> Business Rules</span>
              <span className="nd-tag"><IonIcon icon={pricetagOutline} /> Workflows</span>
              <span className="nd-tag"><IonIcon icon={pricetagOutline} /> Processes</span>
            </div>

            <div className="nd-overview-card">
              <div className="nd-oc-header">
                <IonIcon icon={barChartOutline} />
                <span>OVERVIEW</span>
              </div>
              <p className="nd-oc-text">
                {summaryOverview || "Document overview is being analyzed..."}
              </p>
            </div>

            {summaryLoading ? (
              <div className="nd-fc-loading-skeleton">
                <IonSkeletonText animated style={{ width: '100%', height: '80px', borderRadius: '12px', marginBottom: '12px' }} />
                <IonSkeletonText animated style={{ width: '100%', height: '120px', borderRadius: '12px', marginBottom: '12px' }} />
                <IonSkeletonText animated style={{ width: '70%', height: '40px', borderRadius: '12px' }} />
              </div>
            ) : summarySections.length === 0 ? (
              <div className="nd-fc-empty">
                <IonIcon icon={bookOutline} style={{ fontSize: '2rem', opacity: 0.4 }} />
                <p>No summary generated yet.</p>
              </div>
            ) : (
              summarySections.map((section, index) => {
                const colorClasses = ['nd-blue-card', 'nd-purple-card', 'nd-yellow-card'];
                const colorClass = colorClasses[index % colorClasses.length];
                const sectionId = index + 1;

                return (
                  <div
                    key={index}
                    className={`nd-accordion-card ${colorClass} ${expandedSection === sectionId ? 'expanded' : ''}`}
                  >
                    <div className="nd-ac-header" onClick={() => toggleSection(sectionId)}>
                      <h3><span className="nd-ac-dot"></span> {section.title}</h3>
                      <IonIcon icon={expandedSection === sectionId ? chevronUpOutline : chevronDownOutline} />
                    </div>
                    {expandedSection === sectionId && (
                      <div className="nd-ac-content">
                        <p>{section.content}</p>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {activeSegment === 'quiz' && (
          <div className="nd-tab-container nd-quiz-tab">
            {quizzesLoading ? (
              <div className="nd-fc-loading-skeleton">
                <IonSkeletonText animated style={{ width: '100%', height: '140px', borderRadius: '16px', marginBottom: '20px' }} />
                <IonSkeletonText animated style={{ width: '100%', height: '60px', borderRadius: '8px', marginBottom: '10px' }} />
                <IonSkeletonText animated style={{ width: '100%', height: '60px', borderRadius: '8px', marginBottom: '10px' }} />
                <IonSkeletonText animated style={{ width: '100%', height: '60px', borderRadius: '8px' }} />
              </div>
            ) : quizzes.length === 0 ? (
              <div className="nd-fc-empty">
                <IonIcon icon={helpCircleOutline} style={{ fontSize: '2rem', opacity: 0.4 }} />
                <p>No quizzes yet. Upload a PDF to auto-generate them.</p>
              </div>
            ) : quizFinished ? (
              /* ===== QUIZ FINISHED RESULT SCREEN ===== */
              <div className="nd-qf-wrapper">
                {/* White card containing header and ring */}
                <div className="nd-quiz-finished-card">
                  <div className="nd-qf-header">
                    {/* Clicking the retry icon retakes the quiz */}
                    <button className="nd-qf-retry-icon-btn" onClick={handleRetakeQuiz} title="Retake Quiz">
                      <IonIcon icon={refreshOutline} />
                    </button>
                    <h2 className="nd-qf-title">Quiz Finished</h2>
                  </div>
                  <p className="nd-qf-subtitle">
                    You got {quizScore} out of {quizzes.length} questions
                  </p>

                  {/* Circular progress ring */}
                  <div className="nd-qf-ring-wrapper">
                    <svg className="nd-qf-ring" viewBox="0 0 200 200">
                      <circle
                        className="nd-qf-ring-bg"
                        cx="100" cy="100" r="86"
                        fill="none" strokeWidth="6"
                      />
                      <circle
                        className="nd-qf-ring-progress"
                        cx="100" cy="100" r="86"
                        fill="none" strokeWidth="6"
                        strokeDasharray={`${2 * Math.PI * 86}`}
                        strokeDashoffset={`${2 * Math.PI * 86 * (1 - quizScorePercent / 100)}`}
                        strokeLinecap="round"
                        style={{
                          stroke: quizScorePercent >= 80 ? '#4ade80' : quizScorePercent >= 50 ? '#f5a623' : '#e74c3c',
                        }}
                      />
                    </svg>
                    <span className="nd-qf-percent">{Math.round(quizScorePercent)}%</span>
                  </div>
                </div>

                {/* Back to Courses — outside card, prominent red pill */}
                <button className="nd-qf-courses-btn" onClick={() => history.goBack()}>
                  Back to Courses
                </button>

                <div className="nd-quiz-footer">
                  {resolvedCourseName} • {resolvedDocumentName}
                </div>
              </div>
            ) : (
              <div className="nd-quiz-card">
                <div className="nd-qc-header">
                  <div className="nd-qc-left">
                    <div className="nd-qc-icon">
                      <IonIcon icon={helpCircleOutline} />
                    </div>
                    <div className="nd-qc-text">
                      <span className="nd-qc-category">{resolvedCourseName} • Quiz</span>
                      <span className="nd-qc-title">{resolvedDocumentName}</span>
                    </div>
                  </div>
                  <div className="nd-qc-right">
                    {quizIndex + 1} / {quizzes.length}
                  </div>
                </div>

                <div className="nd-progress-bar">
                  <div className="nd-progress-fill" style={{ width: `${Math.round(((quizIndex + 1) / quizzes.length) * 100)}%` }}></div>
                </div>

                <div className="nd-question-box">
                  {quizzes[quizIndex]?.questionText}
                </div>

                <div className="nd-options">
                  {quizzes[quizIndex]?.options.map((opt, index) => {
                    let optClass = "nd-option";
                    let icon = null;

                    if (quizState === 'answered') {
                      if (index === quizzes[quizIndex].correctAnswerIndex) {
                        optClass += " correct";
                        icon = <IonIcon icon={checkmarkCircleOutline} />;
                      } else if (index === selectedOption && index !== quizzes[quizIndex].correctAnswerIndex) {
                        optClass += " incorrect";
                        icon = <IonIcon icon={closeCircleOutline} />;
                      }
                    }

                    return (
                      <div
                        key={index}
                        className={optClass}
                        onClick={() => {
                          if (quizState !== 'answered') {
                            handleOptionSelect(index);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                      >
                        <span className="nd-opt-text">{opt}</span>
                        {icon && <span className="nd-opt-icon">{icon}</span>}
                      </div>
                    );
                  })}
                </div>

                {quizState === 'answered' && (
                  <div className="nd-explanation-section">
                    {showExplanation && (
                      <div className="nd-explanation-box">
                        <IonIcon icon={bulbOutline} className="nd-bulb" />
                        <span>{quizzes[quizIndex]?.explanation}</span>
                      </div>
                    )}
                    <div className="nd-explanation-actions">
                      <button
                        className="nd-hide-btn"
                        onClick={() => setShowExplanation(!showExplanation)}
                      >
                        {showExplanation ? 'Hide explanation' : 'Show explanation'}
                      </button>
                      <button
                        className="nd-next-btn"
                        disabled={quizSubmitting}
                        onClick={() => {
                          if (quizIndex < quizzes.length - 1) {
                            setQuizIndex(prev => prev + 1);
                            setQuizState('unanswered');
                            setSelectedOption(null);
                            setShowExplanation(true);
                          } else {
                            // Last question — compute final answers and submit
                            const currentQuiz = quizzes[quizIndex];
                            const finalAnswers = currentQuiz
                              ? [
                                ...quizAnswers.filter(a => a.question_id !== currentQuiz.id),
                                { question_id: currentQuiz.id, selected_index: selectedOption ?? -1 }
                              ]
                              : quizAnswers;
                            handleSubmitQuiz(finalAnswers);
                          }
                        }}
                      >
                        {quizSubmitting
                          ? 'Calculating...'
                          : quizIndex < quizzes.length - 1
                            ? <><span>Next</span> <IonIcon icon={chevronForwardOutline} /></>
                            : 'Finish Quiz 🎉'}
                      </button>
                    </div>
                  </div>
                )}

                <div className="nd-quiz-footer">
                  {resolvedCourseName} • {resolvedDocumentName}
                </div>
              </div>
            )}
          </div>
        )}

        {activeSegment === 'flashcards' && (
          <div className="nd-tab-container nd-flashcards-tab">
            <div className="nd-fc-header">
              <div className="nd-fc-header-left">
                <div className="nd-fc-icon">
                  <IonIcon icon={flash} />
                </div>
                <div className="nd-fc-text">
                  <span className="nd-fc-category">{resolvedCourseName} • {resolvedDocumentName}</span>
                  <span className="nd-fc-title">Flash Card</span>
                </div>
              </div>
            </div>

            <div className="nd-flashcard-container">
              <div className={`nd-flashcard ${isFlipped ? 'flipped' : ''}`} onClick={() => setIsFlipped(!isFlipped)}>
                <div className="nd-flashcard-inner">
                  <div className="nd-flashcard-front">
                    <div className="nd-fc-book-icon">
                      <IonIcon icon={bookOutline} />
                    </div>
                    <h3 className="nd-fc-question">{currentCard?.q || "Generating flashcards..."}</h3>
                    <p className="nd-fc-tap-text">Tap to reveal answer</p>
                  </div>
                  <div className="nd-flashcard-back">
                    <p className="nd-fc-answer">{currentCard?.a || "Please wait while we extract text and generate flashcards."}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="nd-fc-dots">
              {flashcards.length > 0 ? flashcards.map((_, i) => (
                <span key={i} className={`nd-fc-dot ${i === flashcardIndex ? 'active' : ''}`}></span>
              )) : <span className="nd-fc-dot active"></span>}
            </div>

            <div className="nd-fc-controls">
              <button className="nd-fc-nav-btn" onClick={handlePrevFlashcard} disabled={flashcardIndex === 0 || flashcards.length === 0}>
                <IonIcon icon={chevronBackOutline} />
              </button>
              <button className="nd-fc-action-btn" onClick={() => setIsFlipped(false)}>
                <IonIcon icon={refreshOutline} /> Reset
              </button>
              <button
                className={`nd-fc-action-btn mastered ${currentCard?.isMastered ? 'active' : ''}`}
                onClick={() => currentCard && toggleMastered(currentCard)}
                disabled={flashcards.length === 0}
              >
                <IonIcon icon={star} /> Mastered
              </button>
              <button className="nd-fc-nav-btn" onClick={handleNextFlashcard} disabled={flashcardIndex >= flashcards.length - 1 || flashcards.length === 0}>
                <IonIcon icon={chevronForwardOutline} />
              </button>
            </div>

            <div className="nd-fc-status">
              {flashcards.length > 0 ? flashcardIndex + 1 : 0} / {flashcards.length} • {flashcards.filter(f => f.isMastered).length} mastered
            </div>

            <div className="nd-quiz-footer" style={{ marginTop: '20px' }}>
              {resolvedCourseName} • {resolvedDocumentName}
            </div>
          </div>
        )}
      </IonContent>

      {/* Ask AI Floating Button */}
      {askAIPos && activeSegment === 'notes' && !showMiniChatbot && (
        <button
          id="ask-ai-floating-btn"
          className="nd-ask-ai-btn"
          style={{
            position: 'fixed',
            top: `${askAIPos.y}px`,
            left: `${askAIPos.x}px`,
            transform: 'translateX(-50%)',
          }}
          onClick={(e) => { e.stopPropagation(); handleAskAI(); }}
        >
          <IonIcon icon={bulbOutline} /> Ask AI
        </button>
      )}

      {/* Mini Chatbot — OG Chatbot Style */}
      {showMiniChatbot && (
        <div className="nd-mini-chatbot chatbot-content">
          <div className="nd-mini-chatbot-header">
            <span className="nd-mini-chatbot-title">
              <IonIcon icon={bulbOutline} /> AI Assistant
            </span>
            <button
              type="button"
              className="nd-mini-chatbot-close"
              onClick={() => setShowMiniChatbot(false)}
              aria-label="Close assistant"
            >
              <IonIcon icon={closeOutline} />
            </button>
          </div>

          <div className="nd-mini-chatbot-messages">
            {miniChatMessages.map((msg, idx) => (
              <div
                key={idx}
                className={`message-bubble ${msg.isUser ? 'user-message' : 'ai-message'}`}
              >
                <div className="message-content">{msg.text}</div>
              </div>
            ))}
            {isMiniChatLoading && (
              <div className="ai-message message-bubble">
                <div className="message-content" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="pulsing-dot">●</span> Thinking...
                </div>
              </div>
            )}
          </div>

          <div className="nd-mini-chatbot-input-area">
            <div className="input-bar">
              <input
                type="text"
                className="input-field"
                value={miniChatInput}
                onChange={(e) => setMiniChatInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleMiniChatSend()}
                placeholder="Ask a follow-up..."
                disabled={isMiniChatLoading}
              />
              <div className="input-bar-actions">
                <button
                  type="button"
                  className="send-button"
                  onClick={handleMiniChatSend}
                  disabled={isMiniChatLoading || !miniChatInput.trim()}
                  title="Send"
                >
                  <IonIcon icon={paperPlaneOutline} className="send-icon" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </IonPage>
  );
};

export default NoteDetail;


