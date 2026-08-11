/**
 * Study Buddy Provider - Wrapper component
 * Integrates widget with trigger system
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import StudyBuddyWidget from './StudyBuddyWidget';
import TriggerSystem from './TriggerSystem';
import type { TriggerType } from '@/lib/study-buddy/buddyTypes';

export default function StudyBuddyProvider() {
  const [triggerMessage, setTriggerMessage] = useState<string>('');
  const widgetRef = useRef<{ triggerProactiveMessage: (msg: string) => void }>(null);

  const handleTrigger = useCallback((type: TriggerType, message: string) => {
    setTriggerMessage(message);
  }, []);

  return (
    <>
      <StudyBuddyWidget triggerMessage={triggerMessage} />
      <TriggerSystem onTrigger={handleTrigger} />
    </>
  );
}
