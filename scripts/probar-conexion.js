
const pool = require('../src/data/conexion');

async function probarConexion() {
    try {
        const [resultado] = await pool.query(
            'SELECT DATABASE() AS base_datos, VERSION() AS version_mysql'
        );

        console.log('Conexión exitosa con MySQL.');
        console.log('Base de datos:', resultado[0].base_datos);
        console.log('Versión de MySQL:', resultado[0].version_mysql);

        const [tablas] = await pool.query('SHOW TABLES');

        console.log('Cantidad de tablas:', tablas.length);
        console.log('Tablas encontradas:');

        tablas.forEach((tabla) => {
            console.log(Object.values(tabla)[0]);
        });
    } catch (error) {
        console.error('Error al conectar con MySQL:', error.message);
        process.exitCode = 1;
    } finally {
        await pool.end();
    }
}

probarConexion();
