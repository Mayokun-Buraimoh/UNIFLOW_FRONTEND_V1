const AI_API_URL = 'http://localhost:8000/api/v1';

export interface ChatMessage {
    id: string;
    text: string;
    isUser: boolean;
    timestamp: Date;
    documents?: { filename: string }[];
}

export interface ChatHistory {
    id: string; // The session_id
    title: string;
    messages: ChatMessage[];
    createdAt: Date;
}

interface AIResponse {
    response: string;
    session_id: string;
    conversation_id: string;
}

interface AIHistoryResponse {
    id: string;
    user: string;
    session_id: string;
    message: string;
    response: string;
    context_files?: { filename: string; text: string }[];
    created_at: string;
}

export const aiClient = {
    /**
     * Send a message to the AI
     */
    async chat(userId: string, message: string, sessionId?: string, files?: File[]): Promise<AIResponse> {
        let body: BodyInit;
        let headers: HeadersInit = {};

        if (files && files.length > 0) {
            const formData = new FormData();
            formData.append('user_id', userId);
            formData.append('message', message);
            if (sessionId) formData.append('session_id', sessionId);
            files.forEach(file => {
                formData.append('files', file);
            });
            body = formData;
        } else {
            body = JSON.stringify({
                user_id: userId,
                message,
                session_id: sessionId
            });
            headers = {
                'Content-Type': 'application/json',
            };
        }

        const response = await fetch(`${AI_API_URL}/chat/`, {
            method: 'POST',
            headers,
            body,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`AI Service Error (${response.status}): ${errorText}`);
        }

        return response.json();
    },

    /**
     * Get chat history for a user
     */
    async getHistory(userId: string): Promise<ChatHistory[]> {
        const response = await fetch(`${AI_API_URL}/chat/history/?user_id=${userId}`);

        if (!response.ok) {
            throw new Error('Failed to fetch chat history');
        }

        const data: AIHistoryResponse[] = await response.json();

        // Group by session_id
        const sessions: Record<string, ChatHistory> = {};

        data.forEach(item => {
            if (!sessions[item.session_id]) {
                sessions[item.session_id] = {
                    id: item.session_id,
                    title: "Conversation", // Title could be generated or stored in future
                    messages: [],
                    createdAt: new Date(item.created_at) // Approximate
                };
            }

            // Add User message
            sessions[item.session_id].messages.push({
                id: `${item.id}-user`,
                text: item.message,
                isUser: true,
                timestamp: new Date(item.created_at),
                documents: item.context_files?.map(f => ({ filename: f.filename }))
            });

            // Add AI response
            sessions[item.session_id].messages.push({
                id: `${item.id}-ai`,
                text: item.response,
                isUser: false,
                timestamp: new Date(item.created_at)
            });
        });

        // Sort messages within sessions
        Object.values(sessions).forEach(session => {
            session.messages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
            // Update title to first few words of first message
            if (session.messages.length > 0) {
                const firstMsg = session.messages[0].text;
                session.title = firstMsg.split(/\s+/).slice(0, 4).join(" ");
            }
        });

        // Return as array, sorted by most recent
        return Object.values(sessions).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    }
};
