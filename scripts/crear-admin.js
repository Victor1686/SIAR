
const readline = require('readline');
const bcrypt = require('bcrypt');
const pool = require('../src/data/conexion');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function preguntar(texto) {
    return new Promise(resolve => {
        rl.question(texto, resolve);
    });
}

async function crearAdministrador() {
    let conexion;

    try {
        const nombre = await preguntar('Nombre completo: ');
        const correo = await preguntar('Correo: ');
        const usuario = await preguntar('Nombre de usuario: ');

        // Comprobar que todavía no exista un administrador.
        const [admins] = await pool.execute(`
            SELECT u.id_usuario
            FROM usuario u
            INNER JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
            INNER JOIN rol r ON ur.id_rol = r.id_rol
            WHERE r.nombre = 'Administrador'
            LIMIT 1
        `);

        if (admins.length > 0) {
            console.log('Ya existe un administrador. No se creó otro.');
            return;
        }

        // Solicitar la contraseña sin mostrarla en pantalla.
const contraseña = await new Promise((resolve, reject) => {
    const stdin = process.stdin;

    if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
        reject(new Error('La terminal no permite ocultar la contraseña.'));
        return;
    }

    const modoAnterior = stdin.isRaw;
    let valor = '';

    process.stdout.write('Contraseña: ');
    stdin.setRawMode(true);
    stdin.resume();

    function recibir(datos) {
        const tecla = datos.toString();

        if (tecla === '\u0003') {
            stdin.removeListener('data', recibir);
            stdin.setRawMode(modoAnterior);
            reject(new Error('Operación cancelada.'));
            return;
        }

        if (tecla === '\r' || tecla === '\n') {
            stdin.removeListener('data', recibir);
            stdin.setRawMode(modoAnterior);
            process.stdout.write('\n');
            resolve(valor);
        } else if (tecla === '\u0008' || tecla === '\u007f') {
            valor = valor.slice(0, -1);
        } else {
            valor += tecla;
        }
    }

    stdin.on('data', recibir);
});

        if (!nombre.trim() || !correo.trim() || !usuario.trim() || contraseña.length < 8) {
            console.log('Datos inválidos. La contraseña debe tener al menos 8 caracteres.');
            return;
        }

        const hash = await bcrypt.hash(contraseña, 12);

        conexion = await pool.getConnection();
        await conexion.beginTransaction();

        const [resultado] = await conexion.execute(
            `INSERT INTO usuario (nombre, correo, usuario, contrasena)
             VALUES (?, ?, ?, ?)`,
            [nombre.trim(), correo.trim(), usuario.trim(), hash]
        );

        const [roles] = await conexion.execute(
            `SELECT id_rol FROM rol WHERE nombre = 'Administrador' LIMIT 1`
        );

        if (roles.length === 0) {
            throw new Error('No existe el rol Administrador en la tabla rol.');
        }

        await conexion.execute(
            `INSERT INTO usuario_rol (id_usuario, id_rol)
             VALUES (?, ?)`,
            [resultado.insertId, roles[0].id_rol]
        );

        await conexion.commit();

        console.log('Administrador creado correctamente.');
        console.log('ID:', resultado.insertId);

    } catch (error) {
        if (conexion) {
            await conexion.rollback();
        }

        if (error.code === 'ER_DUP_ENTRY') {
            console.log('El correo o nombre de usuario ya está registrado.');
        } else {
            console.error('No se pudo crear el administrador:', error.message);
        }
    } finally {
        if (conexion) conexion.release();
        await pool.end();
        rl.close();
    }
}

crearAdministrador();
