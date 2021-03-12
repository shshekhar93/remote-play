import { libraryRouter } from './library';
import { Application } from 'express';

export function setupRoutes(app: Application): void {
  app.use('/library', libraryRouter);
}
