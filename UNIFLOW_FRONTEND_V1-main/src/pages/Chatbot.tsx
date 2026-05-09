import { IonPage, IonContent } from "@ionic/react";
import { micOutline, attachOutline, searchOutline, createOutline, paperPlaneOutline, stopCircleOutline, chevronBackOutline } from "ionicons/icons";
import { IonIcon } from "@ionic/react";
import { useState, useRef, useEffect } from "react";
import { flushSync } from "react-dom";
import { useHistory } from "react-router-dom";
import "./Chatbot.css";
import { aiClient, ChatMessage, ChatHistory } from "../api/aiClient";
import { useAuth } from "../contexts/AuthContext";
import BackButton from "../components/BackButton";
import { getDefaultStartPath } from "../utils/appPreferences";

interface Attachment {
  id: string;
  file: File;
}

export default function Chatbot() {
  const history = useHistory();
  const { user } = useAuth();

  const navigateBackSafely = () => {
    if (history.length > 1) {
      history.goBack();
      return;
    }
    history.replace(getDefaultStartPath());
  };

  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatHistory[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [currentMessages, setCurrentMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const micButtonRef = useRef<HTMLButtonElement>(null);

  // --- Voice Dictation State ---
  const [isRecording, setIsRecording] = useState(false);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Initialize SpeechRecognition
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";

      recognition.onstart = () => {
        setIsRecording(true);
      };

      recognition.onresult = (event: any) => {
        let interimTranscript = "";
        let finalTranscript = "";

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          } else {
            interimTranscript += event.results[i][0].transcript;
          }
        }

        // We append the final/interim transcript to whatever the user already typed
        // Note: Managing exact cursor placement is tricky with continuous dictation,
        // so we typically just set the whole message box to the recognized text.
        // For simplicity in dictation mode, we replace the `message` state with the live transcript.
        // If they had existing text, we could prepend it.
        setMessage((prevMessage) => {
           // We only want to prepend the history *before* this dictation block started if we tracked it, 
           // but replacing `message` outright is the cleanest UX for most simple chatbots.
           return finalTranscript + interimTranscript;
        });
      };

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognition.onend = () => {
        setIsRecording(false);
      };

      recognitionRef.current = recognition;
    } else {
      console.warn("Speech Recognition API is not supported in this browser.");
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const blurMicButton = () => {
    requestAnimationFrame(() => {
      micButtonRef.current?.blur();
    });
  };

  const toggleVoice = () => {
    if (!recognitionRef.current) {
      alert("Voice dictation is not supported in your browser.");
      return;
    }

    if (isRecording) {
      recognitionRef.current.stop();
      blurMicButton();
    } else {
      setMessage("");
      setIsRecording(true);
      try {
        recognitionRef.current.start();
      } catch (err) {
        console.error("Speech recognition start failed", err);
        setIsRecording(false);
      }
      blurMicButton();
    }
  };
  
  useEffect(() => {
    if (user?.id) {
      loadHistory();
    }
  }, [user?.id]);

  const loadHistory = async () => {
    if (!user?.id) return;
    try {
      const historyData = await aiClient.getHistory(user.id);
      setChatHistory(historyData);
    } catch (error) {
      console.error("Failed to load history:", error);
    }
  };

  const handleSend = async () => {
    if (message.trim() && user?.id) {
      const userMessageText = message.trim();

      // Optimistic UI Update
      const userMessage: ChatMessage = {
        id: Math.random().toString(36).substr(2, 9),
        text: userMessageText,
        isUser: true,
        timestamp: new Date(),
        documents: attachments.map(a => ({ filename: a.file.name }))
      };

      // Set pending state
      const tempAiMessage: ChatMessage = {
        id: "pending",
        text: "Thinking...",
        isUser: false,
        timestamp: new Date()
      };

      setCurrentMessages(prev => [...prev, userMessage, tempAiMessage]);
      setMessage("");
      setIsLoading(true);

      try {
        const response = await aiClient.chat(user.id, userMessageText, currentChatId || undefined, attachments.map(a => a.file));

        const aiResponse: ChatMessage = {
          id: response.conversation_id, // or random
          text: response.response,
          isUser: false,
          timestamp: new Date()
        };

        // If this was a new chat, update session ID
        if (!currentChatId) {
          setCurrentChatId(response.session_id);
          loadHistory();
        }

        setCurrentMessages(prev => prev.map(msg => msg.id === 'pending' ? aiResponse : msg));

      } catch (error) {
        console.error("Chat error:", error);
        const errorMsg: ChatMessage = {
          id: Math.random().toString(),
          text: "Sorry, I encountered an error. Please try again.",
          isUser: false,
          timestamp: new Date()
        };
        setCurrentMessages(prev => prev.map(msg => msg.id === 'pending' ? errorMsg : msg));
      } finally {
        setIsLoading(false);
        setAttachments([]);
      }
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleAttachmentClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const newAttachments: Attachment[] = Array.from(files).map((file) => ({
        id: Math.random().toString(36).substr(2, 9),
        file: file
      }));
      setAttachments([...attachments, ...newAttachments]);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeAttachment = (id: string) => {
    setAttachments(attachments.filter(att => att.id !== id));
  };

  const toggleHistory = () => {
    setIsHistoryOpen(!isHistoryOpen);
  };

  const handleNewChat = () => {
    setCurrentChatId(null);
    setCurrentMessages([]);
    setMessage("");
    setAttachments([]);
    setIsHistoryOpen(false);
  };

  const handleDeleteChat = (chatId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatHistory(chatHistory.filter(chat => chat.id !== chatId));
    if (currentChatId === chatId) {
      handleNewChat();
    }
  };

  const handleSelectChat = (chat: ChatHistory) => {
    setCurrentChatId(chat.id);
    setCurrentMessages(chat.messages);
    setIsHistoryOpen(false);
  };

  return (
    <IonPage className="chatbot-page">
      {/* History Sidebar - Moved outside IonContent for smooth transitions */}
      <div className={`history-sidebar ${isHistoryOpen ? 'open' : ''}`}>
        <div className="history-header">
          <div className="history-search-container">
            <IonIcon icon={searchOutline} className="search-icon" />
            <input 
              type="text" 
              placeholder="search" 
              className="history-search" 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="edit-button" onClick={handleNewChat} type="button" title="New Chat">
              <IonIcon icon={createOutline} className="edit-icon" />
            </button>
          </div>
          <h2 className="history-title">History</h2>
        </div>
        <div className="history-list">
          {chatHistory.length === 0 ? (
            <div className="history-empty">No chat history yet</div>
          ) : (
            chatHistory
              .filter(chat => !searchQuery.trim() || chat.title.toLowerCase().includes(searchQuery.trim().toLowerCase()))
              .map((chat) => (
              <div
                key={chat.id}
                className={`history-item ${currentChatId === chat.id ? 'active' : ''}`}
                onClick={() => handleSelectChat(chat)}
              >
                <span className="history-item-text">{chat.title}</span>
                <button
                  className="delete-chat-button"
                  onClick={(e) => handleDeleteChat(chat.id, e)}
                  type="button"
                  title="Delete chat"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Overlay when history is open */}
      {isHistoryOpen && <div className="history-overlay" onClick={toggleHistory} />}

      {/* Back Arrow and Sidebar Menu Buttons - Moved to Page level for visibility */}
      <div className="top-navigation">
        <BackButton 
          icon={chevronBackOutline} 
          onClick={() => {
            if (isHistoryOpen) {
              setIsHistoryOpen(false);
            } else {
              flushSync(() => setIsHistoryOpen(false));
              navigateBackSafely();
            }
          }}
        />
        <button className="sidebar-menu" onClick={toggleHistory} type="button" title="Menu">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="sidebar-icon">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="9" y1="3" x2="9" y2="21" />
          </svg>
        </button>
      </div>

      <IonContent
        fullscreen
        className="chatbot-content"
        style={{
          '--background': '#ffffff',
          background: '#ffffff'
        } as React.CSSProperties}
      >

        {/* Messages Container */}
        {currentMessages.length > 0 ? (
          <div className="messages-container">
            {currentMessages.map((msg) => (
              <div key={msg.id} className={`message-bubble ${msg.isUser ? 'user-message' : 'ai-message'} ${msg.id === 'pending' ? 'pulsing' : ''}`}>
                {msg.documents && msg.documents.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '8px' }}>
                    {msg.documents.map((doc, idx) => (
                      <div key={idx} style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: msg.isUser ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.05)',
                        padding: '4px 8px',
                        borderRadius: '8px',
                        fontSize: '12px'
                      }}>
                        <IonIcon icon={attachOutline} style={{ fontSize: '14px' }} />
                        <span>{doc.filename}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="message-content">{msg.text}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="cards-container">
            <div 
              className="suggestion-card" 
              onClick={() => setMessage("Can you explain this topic to me in simple terms?")}
            >
              <h6>Can you explain</h6>
              <p>this topic to me in simple terms?</p>
            </div>

            <div 
              className="suggestion-card"
              onClick={() => setMessage("Can you summarize this chapter/article for me?")}
            >
              <h6>Can you summarize</h6>
              <p>this chapter/article for me?</p>
            </div>

            <div 
              className="suggestion-card"
              onClick={() => setMessage("Can you generate quiz questions so I can practice for my exam?")}
            >
              <h6>Can you generate</h6>
              <p>quiz questions so I can practice for my exam?</p>
            </div>
          </div>
        )}

        {/* Attachments Preview */}
        {attachments.length > 0 && (
          <div className="attachments-preview">
            {attachments.map((attachment) => (
              <div key={attachment.id} className="attachment-item">
                <span className="attachment-name" title={attachment.file.name}>
                  {attachment.file.name.length > 15
                    ? attachment.file.name.substring(0, 15) + '...'
                    : attachment.file.name}
                </span>
                <button
                  className="remove-attachment"
                  onClick={() => removeAttachment(attachment.id)}
                  type="button"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="input-container">
          <div className="input-bar">
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: "none" }}
              multiple
              onChange={handleFileChange}
            />
            <input
              type="text"
              placeholder="Ask me anything"
              className="input-field"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={isLoading}
            />
            {isRecording && (
              <div className="recording-pill">
                Listening...
              </div>
            )}

            <div className="input-bar-actions">
              <button
                className="attach-button"
                onClick={handleAttachmentClick}
                type="button"
                title="Attach files"
                disabled={isLoading}
              >
                <IonIcon icon={attachOutline} className="attach-icon" />
              </button>
              {message.trim() && (
                <button className="send-button" onClick={handleSend} type="button" disabled={isLoading} title="Send message">
                  <IonIcon icon={paperPlaneOutline} className="send-icon" />
                </button>
              )}
            </div>
          </div>
          <button 
             ref={micButtonRef}
             className={`mic-button ${isRecording ? 'recording' : ''}`} 
             type="button" 
             onClick={toggleVoice}
             title={isRecording ? 'Stop recording' : 'Start voice note'}
          >
            <IonIcon icon={isRecording ? stopCircleOutline : micOutline} className="mic-icon" />
          </button>
        </div>

      </IonContent>
    </IonPage>
  );
}
