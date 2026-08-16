/**
 * Types untuk Study Buddy system
 */

export type BuddyCharacter = 'fox' | 'owl' | 'cat' | 'bear';

export type BuddyState = 
  | 'idle'       // Loop animation, gentle movement
  | 'talking'    // Mouth moving, expressive
  | 'thinking'   // Pondering gesture
  | 'happy'      // Celebration, jumping
  | 'confused'   // Question mark
  | 'sleeping';  // Eyes closed

export type TriggerType =
  | 'pomodoro'
  | 'chapter_complete'
  | 'idle'
  | 'random'
  | 'quiz_reminder';

export interface BuddyTemplate {
  id: BuddyCharacter;
  name: string;
  personality: string;
  frames: {
    idle: number[];
    talking: number[];
    thinking: number[];
    happy: number[];
    confused: number[];
  };
  colors: {
    primary: string;
    secondary: string;
  };
}

export interface BuddySettings {
  enabled: boolean;
  character: BuddyCharacter;
  triggers: {
    pomodoro: boolean;
    chapterDone: boolean;
    idle: boolean;
    random: boolean;
    quizReminder: boolean;
  };
  timings: {
    pomodoroMinutes: number;
    idleSeconds: number;
    cooldownMinutes: number;
  };
  animations: boolean;
}

export interface ChatMessage {
  role: 'user' | 'buddy';
  content: string;
  timestamp: number;
  /** "question" = bubble interaktif dengan tombol opsi jawaban. */
  type?: 'text' | 'question';
  options?: string[];
  questionId?: string;
  quizId?: string;
}

export interface BuddyStorage {
  settings: BuddySettings;
  chatHistory: ChatMessage[];
  stats: {
    totalChats: number;
    helpfulCount: number;
    lastActiveDate: string;
  };
}
