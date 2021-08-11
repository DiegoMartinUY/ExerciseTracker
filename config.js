const dotenv = require('dotenv');
dotenv.config();
module.exports = {
    PORT: process.env.PORT,
    DB_NAME: process.env.DB_NAME,
    MONGO_URI: process.env.MONGO_URI
};