
require('dotenv').config();

const requiredVariables = [
    'DB_HOST',
    'DB_PORT',
    'DB_NAME',
    'DB_USER'
];

for (const variable of requiredVariables) {
    if (!process.env[variable]) {
        throw new Error(
            `Falta configurar la variable ${variable} en el archivo .env`
        );
    }
}

module.exports = {
    dbHost: process.env.DB_HOST,
    dbPort: Number(process.env.DB_PORT),
    dbName: process.env.DB_NAME,
    dbUser: process.env.DB_USER,
    dbPassword: process.env.DB_PASSWORD ?? ''
};
