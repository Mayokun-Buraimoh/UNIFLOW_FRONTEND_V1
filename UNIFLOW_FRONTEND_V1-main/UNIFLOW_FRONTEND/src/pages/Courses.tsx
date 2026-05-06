import React, { useState, useEffect, useRef } from 'react';
import { IonPage, IonContent, IonAlert } from '@ionic/react';
import { useHistory } from 'react-router-dom';
import BottomNavigation from '../components/BottomNavigation';
import BackButton from '../components/BackButton';
import { services } from '../api/services';
import './Courses.css';

interface Course {
  id: string;
  name: string;
  notesCount: number;
  lastOpened: string;
  colorTheme: 'blue' | 'green' | 'red' | 'purple';
}

const THEMES = ['blue', 'green', 'red', 'purple'] as const;

const Courses: React.FC = () => {
  const history = useHistory();
  const [courses, setCourses] = useState<Course[]>(() => {
    const savedCourses = localStorage.getItem('uniflow_courses');
    if (savedCourses) {
      try {
        return JSON.parse(savedCourses);
      } catch (err) {
        return [];
      }
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem('uniflow_courses', JSON.stringify(courses));
  }, [courses]);
  const [showAddPopover, setShowAddPopover] = useState(false);
  const [showNameAlert, setShowNameAlert] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Options/Deletion logic hooks
  const [showOptionsPopup, setShowOptionsPopup] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [editingCourseId, setEditingCourseId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const pressTimerRef = useRef<NodeJS.Timeout | null>(null);

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
    const token = localStorage.getItem('uniflow_token');

    if (token) {
      try {
        await services.course.deleteCourse(courseId);
      } catch (err) {
        // If the delete on server failed, show a message and abort local deletion
        console.error('Failed to delete course on server', err);
        window.alert('Failed to delete course on server. Please try again.');
        setShowOptionsPopup(false);
        setSelectedCourse(null);
        return;
      }
    }

    // Remove locally in all cases (server deletion succeeded or no token)
    setCourses(prev => prev.filter(c => c.id !== courseId));
    try { localStorage.removeItem(`uniflow_files_${courseId}`); } catch (e) { /* ignore */ }
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

  const saveRenamedCourse = () => {
    if (editingCourseId && editingName.trim()) {
      setCourses(courses.map(c =>
        c.id === editingCourseId ? { ...c, name: editingName.toUpperCase() } : c
      ));
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

  const getNotesCount = (courseId: string) => {
    try {
      const savedFiles = localStorage.getItem(`uniflow_files_${courseId}`);
      if (savedFiles) {
        const parsed = JSON.parse(savedFiles);
        if (Array.isArray(parsed)) return parsed.length;
      }
    } catch (err) {
      // Ignored
    }
    return 0;
  };

  const handleTogglePopover = () => {
    setShowAddPopover(!showAddPopover);
  };

  const handleAddNewFolder = () => {
    setShowAddPopover(false);
    setShowNameAlert(true);
  };

  const createCourse = async (name: string) => {
    if (!name || !name.trim()) return;
    const token = localStorage.getItem('uniflow_token');

    // If signed in, try to create on the backend and fall back to localStorage
    if (token) {
      try {
        const resp: any = await services.course.createCourse({ name: name.toUpperCase(), code: name.toUpperCase() });
        // Map backend response to local Course shape used by this page
        const created = resp?.id ? resp : resp?.course ? resp.course : resp;
        const newCourse: Course = {
          id: created.id || Date.now().toString(),
          name: (created.name || name).toUpperCase(),
          notesCount: 0,
          lastOpened: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-'),
          colorTheme: THEMES[courses.length % THEMES.length],
        };
        setCourses(prev => [...prev, newCourse]);
        return;
      } catch (err) {
        // Fall through to local creation
        console.warn('Create course on server failed, falling back to local:', err);
      }
    }

    // Local fallback
    const fallback: Course = {
      id: Date.now().toString(),
      name: name.toUpperCase(),
      notesCount: 0,
      lastOpened: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: '2-digit' }).replace(/\//g, '-'),
      colorTheme: THEMES[courses.length % THEMES.length],
    };
    setCourses(prev => [...prev, fallback]);
  };

  const getFileIcon = (theme: string) => {
    switch (theme) {
      case 'blue': return '/assets/icons/Blue_File.png';
      case 'green': return '/assets/icons/Green_File.png';
      case 'red': return '/assets/icons/Red_File.png';
      case 'purple': return '/assets/icons/Blue_File.png'; // Handled via CSS Hue-Rotate for Purple
      default: return '/assets/icons/Blue_File.png';
    }
  };

  return (
    <IonPage>
      <IonContent fullscreen className="courses-page-new">
        <div className="courses-minimal-container">

          <div className="courses-header-new">
            <BackButton />
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
              <div className="add-btn-container">
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
                      if (!showOptionsPopup) {
                        history.push(`/course/${course.id}`);
                      }
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
                        <p className="course-notes">{getNotesCount(course.id)} notes</p>
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
                handler: async (data) => {
                  await createCourse(data.folderName);
                  setShowNameAlert(false);
                }
              }
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
