import express from 'express';
import { populateLibrary, probeVideoDetails } from './walker';
import { setupRoutes } from './routes';
import * as config from './config/config.json';

const app = express();

setupRoutes(app);

app.get('*', function(req, res) {
  res.status(404).send('Hey there! You lost?');
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('application started.');
  populateLibrary()
    .then((readFromFS) => {
      console.log('Populated from cache', !readFromFS);
      if(config.videos.statVideos && readFromFS) {
        return probeVideoDetails();
      }
    })
    .then(() => {
      console.log('library populated')
    });
});
