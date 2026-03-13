import express from 'express';
import { register as registerCrud } from './am-crud';
import { register as registerSync } from './am-sync';
import { register as registerUtility } from './am-utility';

export function register(app: express.Express): void {
  registerCrud(app);
  registerSync(app);
  registerUtility(app);
}
