/**
 * Chat Popup untuk Study Buddy
 * AI-powered conversation dengan OpenAgentic
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import { X, Send, Loader2, Trash2 } from 'lucide-react';
import type { BuddyCharacter, BuddyState, ChatMessage } from '@/lib/study-buddy/buddyTypes';
import { getBuddyStorage, addChatMessage, clearChatHistory } from '@/lib/study-buddy/buddyStorage';
import { BUDDY_TEMPLATES } from '@/lib/study-buddy/buddyTemplates';
import { apiFetch } from '@/lib/apiClient';

interface BuddyChatPopupProps {
  character: BuddyCharacter;
  initialMessage?: string;
  onClose: () => void;
  onStateChange: (state: BuddyState) => void;
}

export default function BuddyChatPopup({ character, initialMessage, onClose, onStateChange }: BuddyChatPopupProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const template = BUDDY_TEMPLATES[character];

  // Load chat history
  useEffect(() => {
    const storage = getBuddyStorage();
    setMessages(storage.chatHistory);

    // Add initial proactive message if provided
    if (initialMessage && storage.chatHistory.length === 0) {
      const buddyMessage: ChatMessage = {
        role: 'buddy',
        content: initialMessage,
        timestamp: Date.now(),
      };
      setMessages([buddyMessage]);
      addChatMessage(buddyMessage);
    }
  }, [initialMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: inputValue.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    addChatMessage(userMessage);
    setInputValue('');
    setIsLoading(true);
    onStateChange('thinking');

    try {
      // Call AI API
      const response = await apiFetch('/api/study-buddy/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          message: userMessage.content,
          history: messages.slice(-5), // Last 5 messages for context
        }),
      });

      if (!response.ok) throw new Error('Failed to get response');

      const data = await response.json();
      
      const buddyMessage: ChatMessage = {
        role: 'buddy',
        content: data.reply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, buddyMessage]);
      addChatMessage(buddyMessage);
      onStateChange('talking');
      
      // Return to idle after 2 seconds
      setTimeout(() => onStateChange('idle'), 2000);
    } catch (error) {
      console.error('Chat error:', error);
      const errorMessage: ChatMessage = {
        role: 'buddy',
        content: 'Maaf, aku sedang mengalami masalah. Coba lagi nanti ya!',
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      onStateChange('confused');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearHistory = () => {
    clearChatHistory();
    setMessages([]);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, x: 20, y: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: 20, y: 20 }}
      className="fixed inset-x-4 bottom-28 sm:inset-x-auto sm:bottom-32 sm:right-6 sm:left-auto z-50 w-auto sm:w-96 max-h-[70dvh] sm:h-[500px] bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 flex flex-col overflow-hidden"
    >
      {/* Header - Mobile Responsive */}
      <div 
        className="px-3 sm:px-4 py-2.5 sm:py-3 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between"
        style={{
          background: `linear-gradient(135deg, ${template.colors.primary}15, ${template.colors.primary}05)`,
        }}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div 
            className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center text-base sm:text-lg font-bold text-white flex-shrink-0"
            style={{ backgroundColor: template.colors.primary }}
          >
            {character === 'fox' && '🦊'}
            {character === 'owl' && '🦉'}
            {character === 'cat' && '🐱'}
            {character === 'bear' && '🐻'}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm sm:text-base text-gray-900 dark:text-white truncate">{template.name}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{template.personality}</p>
          </div>
        </div>
        <div className="flex gap-0.5 sm:gap-1 flex-shrink-0">
          <button
            onClick={handleClearHistory}
            className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation"
            title="Clear chat"
            aria-label="Clear chat history"
          >
            <Trash2 className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={onClose}
            className="flex h-10 w-10 sm:h-9 sm:w-9 items-center justify-center hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation"
            aria-label="Close chat"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Messages - Mobile Responsive */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2 sm:space-y-3">
        {messages.length === 0 ? (
          <div className="text-center text-gray-500 dark:text-gray-400 mt-8">
            <p className="text-sm">Hai! Aku {template.name}</p>
            <p className="text-xs mt-2">Tanya aku apa saja tentang pelajaranmu!</p>
          </div>
        ) : (
          messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] sm:max-w-[80%] px-3 sm:px-4 py-2 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-white'
                }`}
              >
                <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.content}</p>
              </div>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 px-4 py-2 rounded-2xl">
              <Loader2 className="w-4 h-4 animate-spin text-gray-500" />
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input - Mobile Responsive */}
      <div className="p-3 sm:p-4 border-t border-gray-200 dark:border-gray-800">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ketik pesan..."
            disabled={isLoading}
            className="flex-1 px-3 sm:px-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-full text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 disabled:opacity-50 touch-manipulation"
          />
          <button
            onClick={handleSend}
            disabled={!inputValue.trim() || isLoading}
            className="flex h-11 w-11 sm:h-10 sm:w-10 items-center justify-center bg-primary text-primary-foreground rounded-full hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation flex-shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}
