import app, { initializeDatabase } from './index.js';

const port = Number(process.env.PORT || 4000);

initializeDatabase()
  .then(() => {
    app.listen(port, () => console.log(`MatchSet API listening on :${port}`));
  })
  .catch((error) => {
    console.error('Could not start MatchSet:', error);
    process.exit(1);
  });
