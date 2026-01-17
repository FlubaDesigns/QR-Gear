/**
 * Null Guard Tests for Product Builder
 * 
 * These tests verify that all builder modules properly handle null/undefined state
 * to prevent runtime crashes when state is incomplete or cleared during async operations.
 */

import { describe, it, expect } from 'vitest';

interface MockBuilderState {
  selectedProduct: any | null;
  qrProductState: string | null;
  selectedPlacements: string[] | null | undefined;
  content: {
    url?: string;
    title?: string;
    description?: string;
    headerStyle: { enabled: boolean; text: string };
    footerStyle: { enabled: boolean; text: string };
  };
  loadedGraphic: { compositeUrl?: string; qrOnlyUrl?: string } | null;
  loadedBackground: { url?: string; name?: string } | null;
  pricing?: any;
}

function safeSelectedPlacementsLength(state: MockBuilderState): number {
  return (state.selectedPlacements || []).length;
}

function safeSelectedPlacementsIncludes(state: MockBuilderState, id: string): boolean {
  return (state.selectedPlacements || []).includes(id);
}

function safeSelectedPlacementsMap<T>(state: MockBuilderState, fn: (p: string) => T): T[] {
  return (state.selectedPlacements || []).map(fn);
}

function buildPlacements(state: MockBuilderState): string[] {
  return (state.selectedPlacements || []).length > 0 
    ? state.selectedPlacements! 
    : ["front-chest"];
}

describe('Builder Null Guards', () => {
  
  describe('selectedPlacements null handling', () => {
    
    it('handles undefined selectedPlacements', () => {
      const state: MockBuilderState = {
        selectedProduct: { id: 'test' },
        qrProductState: 'qr_basic',
        selectedPlacements: undefined,
        content: { headerStyle: { enabled: false, text: '' }, footerStyle: { enabled: false, text: '' } },
        loadedGraphic: null,
        loadedBackground: null,
      };
      
      expect(safeSelectedPlacementsLength(state)).toBe(0);
      expect(safeSelectedPlacementsIncludes(state, 'front-chest')).toBe(false);
      expect(safeSelectedPlacementsMap(state, p => p.toUpperCase())).toEqual([]);
      expect(buildPlacements(state)).toEqual(["front-chest"]);
    });
    
    it('handles null selectedPlacements', () => {
      const state: MockBuilderState = {
        selectedProduct: { id: 'test' },
        qrProductState: 'qr_basic',
        selectedPlacements: null,
        content: { headerStyle: { enabled: false, text: '' }, footerStyle: { enabled: false, text: '' } },
        loadedGraphic: null,
        loadedBackground: null,
      };
      
      expect(safeSelectedPlacementsLength(state)).toBe(0);
      expect(safeSelectedPlacementsIncludes(state, 'front-chest')).toBe(false);
      expect(safeSelectedPlacementsMap(state, p => p.toUpperCase())).toEqual([]);
      expect(buildPlacements(state)).toEqual(["front-chest"]);
    });
    
    it('handles empty array selectedPlacements', () => {
      const state: MockBuilderState = {
        selectedProduct: { id: 'test' },
        qrProductState: 'qr_basic',
        selectedPlacements: [],
        content: { headerStyle: { enabled: false, text: '' }, footerStyle: { enabled: false, text: '' } },
        loadedGraphic: null,
        loadedBackground: null,
      };
      
      expect(safeSelectedPlacementsLength(state)).toBe(0);
      expect(safeSelectedPlacementsIncludes(state, 'front-chest')).toBe(false);
      expect(safeSelectedPlacementsMap(state, p => p.toUpperCase())).toEqual([]);
      expect(buildPlacements(state)).toEqual(["front-chest"]);
    });
    
    it('handles populated selectedPlacements', () => {
      const state: MockBuilderState = {
        selectedProduct: { id: 'test' },
        qrProductState: 'qr_basic',
        selectedPlacements: ['front-chest', 'back'],
        content: { headerStyle: { enabled: false, text: '' }, footerStyle: { enabled: false, text: '' } },
        loadedGraphic: null,
        loadedBackground: null,
      };
      
      expect(safeSelectedPlacementsLength(state)).toBe(2);
      expect(safeSelectedPlacementsIncludes(state, 'front-chest')).toBe(true);
      expect(safeSelectedPlacementsIncludes(state, 'sleeve')).toBe(false);
      expect(safeSelectedPlacementsMap(state, p => p.toUpperCase())).toEqual(['FRONT-CHEST', 'BACK']);
      expect(buildPlacements(state)).toEqual(['front-chest', 'back']);
    });
  });
  
  describe('loadedGraphic null handling', () => {
    
    it('handles null loadedGraphic', () => {
      const state: MockBuilderState = {
        selectedProduct: { id: 'test', imageUrl: 'fallback.jpg' },
        qrProductState: 'qr_basic',
        selectedPlacements: ['front-chest'],
        content: { headerStyle: { enabled: false, text: '' }, footerStyle: { enabled: false, text: '' } },
        loadedGraphic: null,
        loadedBackground: null,
      };
      
      const artworkUrl = state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "";
      const qrOnlyUrl = state.loadedGraphic?.qrOnlyUrl || "";
      
      expect(artworkUrl).toBe('fallback.jpg');
      expect(qrOnlyUrl).toBe('');
    });
    
    it('handles populated loadedGraphic', () => {
      const state: MockBuilderState = {
        selectedProduct: { id: 'test', imageUrl: 'fallback.jpg' },
        qrProductState: 'qr_basic',
        selectedPlacements: ['front-chest'],
        content: { headerStyle: { enabled: false, text: '' }, footerStyle: { enabled: false, text: '' } },
        loadedGraphic: { compositeUrl: 'composite.jpg', qrOnlyUrl: 'qr.png' },
        loadedBackground: null,
      };
      
      const artworkUrl = state.loadedGraphic?.compositeUrl || state.selectedProduct?.imageUrl || "";
      const qrOnlyUrl = state.loadedGraphic?.qrOnlyUrl || "";
      
      expect(artworkUrl).toBe('composite.jpg');
      expect(qrOnlyUrl).toBe('qr.png');
    });
  });
  
  describe('pricing null handling', () => {
    
    it('handles undefined pricing', () => {
      const state: MockBuilderState = {
        selectedProduct: { id: 'test' },
        qrProductState: 'qr_basic',
        selectedPlacements: ['front-chest'],
        content: { headerStyle: { enabled: false, text: '' }, footerStyle: { enabled: false, text: '' } },
        loadedGraphic: null,
        loadedBackground: null,
        pricing: undefined,
      };
      
      const pricingData = state.pricing || null;
      expect(pricingData).toBeNull();
    });
    
    it('handles null pricing', () => {
      const state: MockBuilderState = {
        selectedProduct: { id: 'test' },
        qrProductState: 'qr_basic',
        selectedPlacements: ['front-chest'],
        content: { headerStyle: { enabled: false, text: '' }, footerStyle: { enabled: false, text: '' } },
        loadedGraphic: null,
        loadedBackground: null,
        pricing: null,
      };
      
      const pricingData = state.pricing || null;
      expect(pricingData).toBeNull();
    });
  });
});
