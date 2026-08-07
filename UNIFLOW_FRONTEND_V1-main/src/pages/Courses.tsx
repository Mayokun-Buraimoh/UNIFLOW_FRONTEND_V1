import React, { useState, useEffect, useRef } from 'react';
import { IonPage, IonContent, IonAlert } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import BackButton from '../components/BackButton';
import { USER_SCOPED_STORAGE_CLEARED_EVENT } from '../utils/clearUserScopedStorage';
import {
  createLocalFirst,
  deleteLocalFirst,
  getMappedCourseServerId,
  isLocalFirstTempId,
  syncNow,
  updateLocalFirst,
  waitForCourseServerId,
} from '../localfirst/syncQueue';
import { services } from '../api/services';
import { isUuid } from '../utils/uuidUtils';
import './Courses.css';

interface Course {
  id: string;
  name: string;
  notesCount: number;
  lastOpened: string;
  colorTheme: 'blue' | 'green' | 'red' | 'purple';
}

const THEMES = ['blue', 'green', 'red', 'purple'] as const;
const MAX_COURSE_FOLDERS = 15;

const Courses: React.FC = () => {
  const history = useHistory();
  const [courses, setCourses] = useState<Course[]>(() => {
    const savedCourses = localStorage.getItem('uniflow_courses');
    if (savedCourses) {
      try {
        return JSON.parse(savedCourses);
      } catch {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('uniflow_courses', JSON.stringify(courses));
  }, [courses]);
  useEffect(() => {
    const reloadFromStorage = () => {
      const raw = localStorage.getItem('uniflow_courses');
      if (!raw) {
        setCourses([]);
        return;
      }
      try {
        setCourses(JSON.parse(raw));
      } catch {
        setCourses([]);
      }
    };
    const onCoursesUpdated = () => {
      void (async () => {
        try {
          await syncNow();
          const serverCourses = await services.course.getCourses();
          if (!Array.isArray(serverCourses)) return;
          setCourses((prev) => {
            const formatDmy = (d: Date) =>
              d.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-');
            return serverCourses.map((sc: Record<string, unknown>, idx: number) => {
              const id = String(sc.id ?? '');
              const existing = prev.find((c) => c.id === id);
              return {
                id,
                name: String(sc.name ?? sc.code ?? 'Course'),
                notesCount: Number(sc.fileCount ?? existing?.notesCount ?? 0),
                lastOpened: existing?.lastOpened || formatDmy(new Date()),
                colorTheme: (existing?.colorTheme || THEMES[idx % THEMES.length]) as Course['colorTheme'],
              };
            });
          });
        } catch {
          reloadFromStorage();
        }
      })();
    };
    window.addEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, reloadFromStorage);
    window.addEventListener('uniflow_courses_updated', onCoursesUpdated);
    return () => {
      window.removeEventListener(USER_SCOPED_STORAGE_CLEARED_EVENT, reloadFromStorage);
      window.removeEventListener('uniflow_courses_updated', onCoursesUpdated);
    };
  }, []);

  // Drain any pending local-first course creates (e.g. after login).
  useEffect(() => {
    void syncNow();
  }, []);

  // Hydrate from server on mount so the user sees their courses on a fresh
  // device / cleared storage. Local-first state already rendered above —
  // this merges the server snapshot in additively and never drops courses
  // that are still pending sync (those have `lf-temp-…` ids).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await syncNow();
        const serverCourses = await services.course.getCourses();
        if (cancelled || !Array.isArray(serverCourses)) return;
        let localSnapshot: Course[] = [];
        try {
          const raw = localStorage.getItem('uniflow_courses');
          localSnapshot = raw ? JSON.parse(raw) : [];
          if (!Array.isArray(localSnapshot)) localSnapshot = [];
        } catch {
          localSnapshot = [];
        }
        const formatDmy = (d: Date) =>
          d
            .toLocaleDateString('en-GB', {
              day: '2-digit',
              month: '2-digit',
              year: '2-digit',
            })
            .replace(/\//g, '-');
        setCourses((prev) => {
          const base = localSnapshot.length > 0 ? localSnapshot : prev;
          const prevById = new Map(base.map((c) => [c.id, c]));
          const merged: Course[] = serverCourses.map((sc: Record<string, unknown>, idx: number) => {
            const id = String(sc.id ?? '');
            const existing = prevById.get(id);
            const fileCountForExisting = Number(sc.fileCount);
            if (existing) {
              return {
                ...existing,
                id,
                name: String(sc.name ?? existing.name),
                notesCount: Number.isFinite(fileCountForExisting)
                  ? fileCountForExisting
                  : existing.notesCount,
              };
            }
            const fileCount = Number(sc.fileCount);
            return {
              id,
              name: String(sc.name ?? sc.code ?? 'Course'),
              notesCount: Number.isFinite(fileCount) ? fileCount : 0,
              lastOpened: sc.lastOpened
                ? formatDmy(new Date(String(sc.lastOpened)))
                : formatDmy(new Date(String(sc.createdAt ?? Date.now()))),
              colorTheme: THEMES[idx % THEMES.length],
            };
          });
          const serverIds = new Set(merged.map((c) => c.id));
          for (const local of base) {
            if (!serverIds.has(local.id)) merged.push(local);
          }
          return merged;
        });
      } catch (err) {
        console.warn('Courses: server hydration failed, staying on local data', err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [showNameAlert, setShowNameAlert] = useState(false);
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  const [showDuplicateNameAlert, setShowDuplicateNameAlert] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Options/Deletion logic hooks
  const [showOptionsPopup, setShowOptionsPopup] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);
  const createCourseSubmittingRef = useRef(false);

  const handlePressStart = (course: Course) => {
    pressTimerRef.current = setTimeout(() => {
      setSelectedCourse(course);
      setShowOptionsPopup(true);
    }, 600); // reduced to 600ms to trigger earlier and avoid OS interruptions
  };

  const handlePressEnd = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
      pressTimerRef.current = null;
    }
  };

  const deleteFolder = async () => {
    if (!selectedCourse) return;

    const courseId = selectedCourse.id;
    deleteLocalFirst('courses', courseId, (entityId) => {
      setCourses((prev) => prev.filter((course) => course.id !== entityId));
    });
    try { localStorage.removeItem(`uniflow_files_${courseId}`); } catch { /* ignore */ }
    setSelectedCourse(null);
    setShowOptionsPopup(false);
  };

  const handleRenameClick = (e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    if (selectedCourse) {
      setEditingCourseId(selectedCourse.id);
      setEditingName(selectedCourse.name);
      setShowOptionsPopup(false);
    }
  };

  const normalizeCourseName = (name: string) => name.trim().toUpperCase();

  const hasDuplicateCourseName = (name: string, excludeCourseId?: string) => {
    const normalized = normalizeCourseName(name);
    if (!normalized) return false;
    return courses.some((course) => {
      if (excludeCourseId && course.id === excludeCourseId) return false;
      return normalizeCourseName(course.name) === normalized;
    });
  };

  const saveRenamedCourse = () => {
    if (editingCourseId && editingName.trim()) {
      if (hasDuplicateCourseName(editingName, editingCourseId)) {
        setShowDuplicateNameAlert(true);
        return;
      }
      const normalized = normalizeCourseName(editingName);
      updateLocalFirst('courses', editingCourseId, { name: normalized }, (entityId, patch) => {
        setCourses((prev) =>
          prev.map((course) =>
            course.id === entityId ? { ...course, ...(patch as Partial<Course>) } : course
          )
        );
      });
    }
    setEditingCourseId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      saveRenamedCourse();
    } else if (e.key === 'Escape') {
      setEditingCourseId(null);
    }
  };

  const getNotesCount = (course: Course) => {
    try {
      const savedFiles = localStorage.getItem(`uniflow_files_${course.id}`);
      if (savedFiles) {
        const parsed = JSON.parse(savedFiles);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch {
      // Ignored
    }
    return course.notesCount || 0;
  };

  const handleTogglePopover = () => {
    setShowAddPopover(!showAddPopover);
  };

  const handleAddNewFolder = () => {
    if (courses.length >= MAX_COURSE_FOLDERS) {
      setShowAddPopover(false);
      setShowLimitAlert(true);
      return;
    }
    setShowAddPopover(false);
    setShowNameAlert(true);
  };

  const createCourse = async (name: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (hasDuplicateCourseName(trimmed)) {
      setShowDuplicateNameAlert(true);
      return;
    }
    if (courses.length >= MAX_COURSE_FOLDERS) {
      setShowLimitAlert(true);
      return;
    }
    const lastOpened = new Date()
      .toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' })
      .replace(/\//g, '-');
    const normalized = normalizeCourseName(trimmed);
    const colorTheme = THEMES[courses.length % THEMES.length];

    const appendCourse = (courseId: string) => {
      setCourses((prev) => {
        if (prev.length >= MAX_COURSE_FOLDERS) return prev;
        if (prev.some((course) => normalizeCourseName(course.name) === normalized)) return prev;
        const next: Course = {
          id: courseId,
          name: normalized,
          notesCount: 0,
          lastOpened,
          colorTheme,
        };
        return [...prev, next];
      });
    };

    const token = localStorage.getItem('uniflow_token');
    if (token) {
      try {
        const res = await services.course.createCourse({ name: normalized, code: normalized });
        const serverId = String((res as { id?: string })?.id ?? '').trim();
        if (isUuid(serverId)) {
          appendCourse(serverId);
          return;
        }
      } catch (err) {
        console.warn('Courses: server create failed, using offline queue', err);
      }
    }

    createLocalFirst(
      'courses',
      {
        name: normalized,
        notesCount: 0,
        lastOpened,
        colorTheme,
      },
      (payload) => {
        appendCourse(String(payload.id));
      },
    );
  };

  /** Same path Vite/Capacitor serve from `public/assets` */
  const getFileIcon = (theme: string) => {
    void theme;
    return '/assets/icons/new_folder_icon.png';
  };

  return (
    <IonPage>
      <IonContent fullscreen className="courses-page-new">
        <div
          className={[
            'courses-minimal-container',
            showOptionsPopup ? 'courses-shell--options-open' : '',
            showAddPopover ? 'courses-shell--add-open' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >

          <div className="courses-header-new">
            <BackButton to="/home" />
            {!isSearching ? (
              <h1 className="title-text">Courses</h1>
            ) : (
              <input 
                  type="text"
                  autoFocus
                  placeholder="Search courses..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="title-text"
                  style={{ border: 'none', background: 'transparent', outline: 'none', flex: 1, padding: '0 8px', fontSize: '18px', color: '#2c5f2c', fontWeight: 600 }}
              />
            )}
            <div className={`header-actions-new ${showAddPopover ? 'active-popover' : ''}`}>
              <button 
                onClick={() => {
                  if (isSearching) {
                    setIsSearching(false);
                    setSearchQuery('');
                  } else {
                    setIsSearching(true);
                  }
                }}
                className="icon-btn search-btn-new"
              >
                {isSearching ? <span style={{fontSize: '24px', lineHeight: 1, color: '#4C6F59'}}>×</span> : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="#4C6F59" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="7"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                )}
              </button>
              <div className="add-btn-container" id="tour-add-course">
                <button className="icon-btn add-btn-new" onClick={handleTogglePopover}>
                  <div className="add-circle">
                    <svg viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </div>
                </button>
                {/* Popover */}
                {showAddPopover && (
                  <div className="add-popover">
                    <div className="add-popover-item" onClick={handleAddNewFolder}>
                      Add new folder
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="courses-body">
            {courses.length === 0 ? (
              <div className="courses-center-text" onClick={() => setShowAddPopover(false)}>
                <p>click the green add button at the top<br />right to add a new folder and upload<br />notes</p>
              </div>
            ) : (
              <div className="courses-list" onClick={() => setShowAddPopover(false)}>
                {courses
                  .filter(course => !searchQuery.trim() || course.name.toLowerCase().includes(searchQuery.trim().toLowerCase()))
                  .map(course => (
                  <div
                    key={course.id}
                    className={`course-card-v2 theme-${course.colorTheme} ${showOptionsPopup && selectedCourse?.id === course.id ? 'active-delete' : ''}`}
                    onContextMenu={(e) => { e.preventDefault(); }} // Prevent mobile context menu on long press
                    style={{ WebkitUserSelect: 'none', userSelect: 'none' }} // Crucial: prevents text selection from breaking the long press
                    onTouchStart={() => handlePressStart(course)}
                    onTouchEnd={handlePressEnd}
                    onTouchMove={handlePressEnd}
                    onTouchCancel={handlePressEnd} // Added for interrupted touches
                    onMouseDown={() => handlePressStart(course)}
                    onMouseUp={handlePressEnd}
                    onMouseLeave={handlePressEnd}
                    onClick={() => {
                      if (showOptionsPopup) return;
                      void (async () => {
                        let openId = course.id;
                        if (isLocalFirstTempId(openId)) {
                          try {
                            await syncNow();
                            const mapped = getMappedCourseServerId(openId);
                            openId =
                              mapped && isUuid(mapped) ? mapped : await waitForCourseServerId(openId);
                          } catch {
                            window.alert(
                              'This folder is still saving to your account. Wait a few seconds on the Courses screen, then try again.',
                            );
                            return;
                          }
                        }
                        history.push(`/course/${openId}`);
                      })();
                    }}
                  >
                    <div className="course-card-content">
                      <div className="course-card-left">
                        {editingCourseId === course.id ? (
                          <input
                            className="course-name-input"
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            onBlur={saveRenamedCourse}
                            onKeyDown={handleKeyDown}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                          />
                        ) : (
                          <h2 className="course-name">
                            {course.name}
                          </h2>
                        )}
                        <p className="course-notes">{getNotesCount(course)} notes</p>
                      </div>
                      <div className="course-card-right">
                        <img src={getFileIcon(course.colorTheme)} alt="File" className="course-file-icon" />
                      </div>
                    </div>
                    <div className="course-footer">
                      Last opened {course.lastOpened}
                    </div>

                    {/* Inline Options Popup */}
                    {showOptionsPopup && selectedCourse?.id === course.id && (
                      <div
                        className="inline-options-popup"
                        onClick={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                      >
                        <div
                          className="popup-btn rename-btn"
                          onClick={handleRenameClick}
                        >
                          Rename
                        </div>
                        <div className="popup-divider" />
                        <div
                          className="popup-btn delete-btn"
                          onClick={(e) => { e.stopPropagation(); deleteFolder(); }}
                        >
                          Delete Folder
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {/* Extra spacer for BottomNavigation overlap */}
                <div style={{ height: '100px' }} />
              </div>
            )}

            {/* Popover overlay background click handler for Add AND Options */}
            {(showAddPopover || showOptionsPopup) && (
              <div
                className="popover-overlay"
                onClick={() => {
                  setShowAddPopover(false);
                  setShowOptionsPopup(false);
                  setSelectedCourse(null);
                }}
              ></div>
            )}
          </div>

          <IonAlert
            isOpen={showNameAlert}
            onDidDismiss={() => setShowNameAlert(false)}
            cssClass="custom-ui-alert"
            header=""
            message={"Enter your preferred\ncourse title"}
            inputs={[
              {
                name: 'folderName',
                type: 'text',
                placeholder: 'e.g BUS101',
                cssClass: 'custom-alert-input uppercase-input'
              }
            ]}
            buttons={[
              {
                text: 'Cancel',
                role: 'cancel',
                cssClass: 'alert-btn-cancel',
                handler: () => {
                  setShowNameAlert(false);
                }
              },
              {
                text: 'Create',
                cssClass: 'alert-btn-create',
                handler: (data) => {
                  const raw =
                    data && typeof (data as { folderName?: string }).folderName === 'string'
                      ? (data as { folderName: string }).folderName
                      : '';
                  const title = raw.trim();
                  if (!title) {
                    return false;
                  }
                  if (hasDuplicateCourseName(title)) {
                    setShowDuplicateNameAlert(true);
                    return false;
                  }
                  if (createCourseSubmittingRef.current) {
                    return false;
                  }
                  createCourseSubmittingRef.current = true;
                  setShowNameAlert(false);
                  void createCourse(title).finally(() => {
                    createCourseSubmittingRef.current = false;
                  });
                  return true;
                },
              },
            ]}
          />

          <IonAlert
            isOpen={showDuplicateNameAlert}
            onDidDismiss={() => setShowDuplicateNameAlert(false)}
            cssClass="custom-ui-alert custom-ui-alert-limit"
            header="Duplicate name"
            message="A course folder with this name already exists. Use a different name."
            buttons={[
              {
                text: 'OK',
                cssClass: 'alert-btn-create',
                handler: () => setShowDuplicateNameAlert(false),
              },
            ]}
          />

          <IonAlert
            isOpen={showLimitAlert}
            onDidDismiss={() => setShowLimitAlert(false)}
            cssClass="custom-ui-alert custom-ui-alert-limit"
            header="Folder limit reached"
            message={`You can create up to ${MAX_COURSE_FOLDERS} course folders.`}
            buttons={[
              {
                text: 'OK',
                cssClass: 'alert-btn-create',
                handler: () => setShowLimitAlert(false),
              },
            ]}
          />
        </div>

        {/* Render BottomNavigation only if courses exist or based on choice */}
        {courses.length > 0 && <BottomNavigation />}
      </IonContent>
    </IonPage >
  );
};

export default Courses;
