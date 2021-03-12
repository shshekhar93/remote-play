import * as express from 'express';
import { getLibraries, populateLibrary } from '../walker';
const libraryRouter = express.Router();

libraryRouter.get('/', function(req, res) {
  res.json(getLibraries());
});

libraryRouter.get('/refresh', function(req, res) {
  populateLibrary(true); // ignore cache and re-populate from FS.
  res.status(202).end();
});

export {
  libraryRouter
};