const path = require('path');

require('dotenv').config({ path: process.env.ENV_FILE || path.join(__dirname, '.env') });
