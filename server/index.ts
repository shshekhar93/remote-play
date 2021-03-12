import express from 'express';
import { populateLibrary } from './walker';
import { setupRoutes } from './routes';

const app = express();

setupRoutes(app);

app.get('*', function(req, res) {
  res.status(404).send('Hey there! You lost?');
});

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log('application started.');
  populateLibrary()
    .then(() => {
      console.log('library populated')
    });
});
