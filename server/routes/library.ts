import * as express from 'express';
import { join as pathJoin } from 'path';
import { readFile } from 'fs/promises';
import { getLibraries, isPathValid, populateLibrary } from '../walker';
import { getThumbsDir, takeScreenshots } from '../walker/probe';
const libraryRouter = express.Router();

libraryRouter.get('/', function (req, res) {
  res.json(getLibraries());
});

libraryRouter.get('/refresh', function (req, res) {
  populateLibrary(true); // ignore cache and re-populate from FS.
  res.status(202).end();
});

libraryRouter.get('/thumb', (req, res) => {
  const { filePath } = req.query;
  const filePathStr = '' + filePath;
  const thumb = pathJoin(getThumbsDir(filePathStr), '1.png');

  const findThumb = async (tryAgain: boolean) => {
    if (!(await isPathValid(filePathStr))) {
      return res.status(404).end();
    }

    try {
      const fileContents = await readFile(thumb);
      res.header('Content-Type', 'image/png').send(fileContents);
    } catch (e) {
      if (e.code !== 'ENOENT') {
        return res.status(404).end();
      }

      if (tryAgain) {
        await takeScreenshots(filePathStr);
        findThumb(false);
      }
    }
  };

  findThumb(true);
});

export { libraryRouter };
