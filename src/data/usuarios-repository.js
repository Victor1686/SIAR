
async function obtenerRoles(conexion) {
    const [roles] = await conexion.execute(
        `SELECT id_rol, nombre, permisos
         FROM rol
         ORDER BY id_rol`
    );
    return roles;
}

async function listarUsuarios(conexion) {
    const [usuarios] = await conexion.execute(
        `SELECT
            u.id_usuario,
            u.nombre,
            u.correo,
            u.usuario,
            u.activo,
            r.id_rol,
            r.nombre AS rol
         FROM usuario u
         LEFT JOIN usuario_rol ur ON u.id_usuario = ur.id_usuario
         LEFT JOIN rol r ON ur.id_rol = r.id_rol
         ORDER BY u.id_usuario`
    );

    const resultado = new Map();

    for (const fila of usuarios) {
        if (!resultado.has(fila.id_usuario)) {
            resultado.set(fila.id_usuario, {
                id: fila.id_usuario,
                nombre: fila.nombre,
                correo: fila.correo,
                usuario: fila.usuario,
                activo: fila.activo,
                roles: []
            });
        }

        if (fila.id_rol !== null) {
            resultado.get(fila.id_usuario).roles.push({
                id: fila.id_rol,
                nombre: fila.rol
            });
        }
    }

    return [...resultado.values()];
}

async function obtenerRolesPorIds(conexion, ids) {
    const placeholders = ids.map(() => "?").join(",");

    const [roles] = await conexion.execute(
        `SELECT id_rol, nombre, permisos
         FROM rol
         WHERE id_rol IN (${placeholders})`,
        ids
    );

    return roles;
}

async function crearUsuario(conexion, datos) {
    const [resultado] = await conexion.execute(
        `INSERT INTO usuario (nombre, correo, usuario, contrasena, activo)
         VALUES (?, ?, ?, ?, 1)`,
        [datos.nombre, datos.correo, datos.usuario, datos.contrasena]
    );

    return resultado.insertId;
}

async function asignarRoles(conexion, idUsuario, roles) {
    for (const rol of roles) {
        await conexion.execute(
            `INSERT INTO usuario_rol (id_usuario, id_rol)
             VALUES (?, ?)`,
            [idUsuario, rol.id_rol]
        );
    }
}

async function existeUsuario(conexion, idUsuario) {
    const [usuarios] = await conexion.execute(
        `SELECT id_usuario FROM usuario WHERE id_usuario = ?`,
        [idUsuario]
    );

    return usuarios.length > 0;
}

async function actualizarDatosUsuario(conexion, idUsuario, datos) {
    await conexion.execute(
        `UPDATE usuario
         SET nombre = ?, correo = ?, usuario = ?
         WHERE id_usuario = ?`,
        [datos.nombre, datos.correo, datos.usuario, idUsuario]
    );
}

async function eliminarRolesUsuario(conexion, idUsuario) {
    await conexion.execute(
        `DELETE FROM usuario_rol WHERE id_usuario = ?`,
        [idUsuario]
    );
}

async function cambiarEstadoUsuario(conexion, idUsuario, activo) {
    await conexion.execute(
        `UPDATE usuario
         SET activo = ?
         WHERE id_usuario = ?`,
        [activo, idUsuario]
    );
}

module.exports = {
    obtenerRoles,
    listarUsuarios,
    obtenerRolesPorIds,
    crearUsuario,
    asignarRoles,
    existeUsuario,
    actualizarDatosUsuario,
    eliminarRolesUsuario,
    cambiarEstadoUsuario
};
