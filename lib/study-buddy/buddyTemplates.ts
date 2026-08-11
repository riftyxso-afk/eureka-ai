/**
 * Character templates untuk Study Buddy
 */

import type { BuddyTemplate } from './buddyTypes';

export const BUDDY_TEMPLATES: Record<string, BuddyTemplate> = {
  fox: {
    id: 'fox',
    name: 'Foxy',
    personality: 'Cerdas & playful',
    frames: {
      idle: [0, 1, 2, 3],
      talking: [4, 5, 6, 7],
      thinking: [8, 9],
      happy: [10, 11, 12],
      confused: [13, 14],
    },
    colors: {
      primary: '#FF6B35',
      secondary: '#FFF8F0',
    },
  },
  owl: {
    id: 'owl',
    name: 'Owly',
    personality: 'Bijaksana & calm',
    frames: {
      idle: [0, 1, 2, 3],
      talking: [4, 5, 6, 7],
      thinking: [8, 9],
      happy: [10, 11, 12],
      confused: [13, 14],
    },
    colors: {
      primary: '#8B7355',
      secondary: '#FFF8F0',
    },
  },
  cat: {
    id: 'cat',
    name: 'Caty',
    personality: 'Friendly & chill',
    frames: {
      idle: [0, 1, 2, 3],
      talking: [4, 5, 6, 7],
      thinking: [8, 9],
      happy: [10, 11, 12],
      confused: [13, 14],
    },
    colors: {
      primary: '#F59E0B',
      secondary: '#FFF8F0',
    },
  },
  bear: {
    id: 'bear',
    name: 'Barry',
    personality: 'Warm & protective',
    frames: {
      idle: [0, 1, 2, 3],
      talking: [4, 5, 6, 7],
      thinking: [8, 9],
      happy: [10, 11, 12],
      confused: [13, 14],
    },
    colors: {
      primary: '#8B5E3C',
      secondary: '#FFF8F0',
    },
  },
};
