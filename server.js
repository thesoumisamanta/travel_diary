import 'dotenv/config';
import app from './src/app.js';
import connectDB from './src/config/db.js';


const PORT = process.env.PORT || 5000;

connectDB()
    .then(() => {
        app.listen(PORT, () => {
            console.log(`Server running on port ${PORT} (${process.env.NODE_ENV})`);
        });
    })
    .catch((err) => {
        console.error('Failed to start server', err);
        process.exit(1);
    });
