/**
 * Study Buddy Widget - Main floating component
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, MessageSquare, Settings, Minimize2 } from 'lucide-react';
import PixelArtAvatar from './PixelArtAvatar';
import BuddyChatPopup from './BuddyChatPopup';
import type { BuddyState } from '@/lib/study-buddy/buddyTypes';
import { getBuddyStorage } from '@/lib/study-buddy/buddyStorage';

interface StudyBuddyWidgetProps {
  triggerMessage?: string;
}

export default function StudyBuddyWidget({ triggerMessage }: StudyBuddyWidgetProps) {
  const [isEnabled, setIsEnabled] = useState(false);
  const [character, setCharacter] = useState<'fox' | 'owl' | 'cat' | 'bear'>('fox');
  const [buddyState, setBuddyState] = useState<BuddyState>('idle');
  const [isMinimized, setIsMinimized] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [currentMessage, setCurrentMessage] = useState<string>('');

  // Load settings from storage
  useEffect(() => {
    const storage = getBuddyStorage();
    setIsEnabled(storage.settings.enabled);
    setCharacter(storage.settings.character);
  }, []);

  // Handle trigger message from parent
  useEffect(() => {
    if (triggerMessage) {
      setCurrentMessage(triggerMessage);
      setShowChat(true);
      setBuddyState('talking');
    }
  }, [triggerMessage]);

  // Don't render if disabled
  if (!isEnabled) return null;

  const handleBuddyClick = () => {
    if (isMinimized) {
      setIsMinimized(false);
    } else {
      setShowChat(true);
      setBuddyState('talking');
    }
  };

  const handleCloseChat = () => {
    setShowChat(false);
    setBuddyState('idle');
    setCurrentMessage('');
  };

  return (
    <>
      {/* Main Buddy Widget - Bottom Right */}
      <motion.div
        className="fixed bottom-6 right-6 z-50"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ 
          scale: isMinimized ? 0.7 : 1, 
          opacity: 1,
          y: isMinimized ? 20 : 0 
        }}
        transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      >
        {/* Buddy Container */}
        <div className="relative">
          {/* Speech bubble hint */}
          <AnimatePresence>
            {!showChat && currentMessage && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full right-0 mb-2 mr-2"
              >
                <div className="bg-white dark:bg-gray-800 px-3 py-2 rounded-lg shadow-lg text-sm max-w-[200px] border border-gray-200 dark:border-gray-700">
                  {currentMessage}
                  <div className="absolute -bottom-1 right-4 w-2 h-2 bg-white dark:bg-gray-800 border-r border-b border-gray-200 dark:border-gray-700 transform rotate-45" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Buddy Avatar - Clickable */}
          <motion.button
            onClick={handleBuddyClick}
            className="relative bg-gradient-to-br from-primary/10 to-primary/5 p-4 rounded-2xl shadow-lg hover:shadow-xl transition-shadow border border-primary/20 cursor-pointer group"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <PixelArtAvatar
              character={character}
              state={buddyState}
              size={64}
              className="drop-shadow-md"
            />
            
            {/* Pulse indicator when active */}
            {buddyState !== 'idle' && (
              <span className="absolute -top-1 -right-1 flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
              </span>
            )}
          </motion.button>

          {/* Control buttons */}
          <div className="absolute -top-2 -left-2 flex gap-1">
            <button
              onClick={() => setIsMinimized(!isMinimized)}
              className="p-1 bg-white dark:bg-gray-800 rounded-full shadow-md hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors border border-gray-200 dark:border-gray-700"
            >
              <Minimize2 className="w-3 h-3 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </motion.div>

      {/* Chat Popup */}
      <AnimatePresence>
        {showChat && (
          <BuddyChatPopup
            character={character}
            initialMessage={currentMessage}
            onClose={handleCloseChat}
            onStateChange={setBuddyState}
          />
        )}
      </AnimatePresence>
    </>
  );
}
