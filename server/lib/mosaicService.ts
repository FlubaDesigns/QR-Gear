import {
  createProgram,
  getProgram,
  getProgramsByStore,
  updateProgram,
  deleteProgram,
  getProgramMoments,
  type SiteProgram,
  type ProgramEntry,
  type CreateProgramInput,
} from './programService';

export type MosaicProgram = SiteProgram;
export type MosaicEntry = ProgramEntry;
export type CreateMosaicInput = CreateProgramInput;

export const createMosaic = createProgram;
export const getMosaic = getProgram;
export const getMosaicsByStore = getProgramsByStore;
export const updateMosaic = updateProgram;
export const deleteMosaic = deleteProgram;
export const getMosaicMoments = getProgramMoments;
