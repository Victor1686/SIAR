
const bcrypt = require("bcrypt");
const repository = require("../data/usuarios-repository");

async function listarRoles(conexion) {
    return repository.obtenerRoles(conexion);
}

async function listarUsuarios(conexion) {
    return repository.listarUsuarios(conexion);
}

async function registrarUsuario(conexion, datos) {
    const nombre = String(datos.nombre || "").trim();
    const correo = String(datos.correo || "").trim();
    const usuario = String(datos.usuario || "").trim();
    const contrasena = datos.contrasena;

    const rolesIds = Array.isArray(datos.roles)
        ? [...new Set(datos.roles.map(Number))]
        : [];

    if (
        !nombre || !correo || !usuario ||
        typeof contrasena !== "string" ||
        contrasena.length < 8 ||
        rolesIds.length === 0 ||
        rolesIds.some(id => !Number.isInteger(id) || id <= 0)
    ) {
        throw new Error("DATOS_INVALIDOS");
    }

    const roles = await repository.obtenerRolesPorIds(conexion, rolesIds);

    if (roles.length !== rolesIds.length) {
        throw new Error("ROLES_INVALIDOS");
    }

    const hash = await bcrypt.hash(contrasena, 10);

    await conexion.beginTransaction();

    try {
        const idUsuario = await repository.crearUsuario(conexion, {
            nombre,
            correo,
            usuario,
            contrasena: hash
        });

        await repository.asignarRoles(conexion, idUsuario, roles);
        await conexion.commit();

        return {
            id: idUsuario,
            mensaje: "Usuario registrado correctamente"
        };
    } catch (error) {
        await conexion.rollback();
        throw error;
    }
}

async function actualizarUsuario(conexion, id, datos) {
    const idUsuario = Number(id);
    const nombre = String(datos.nombre || "").trim();
    const correo = String(datos.correo || "").trim();
    const usuario = String(datos.usuario || "").trim();

    const rolesIds = Array.isArray(datos.roles)
        ? [...new Set(datos.roles.map(Number))]
        : [];

    if (
        !Number.isInteger(idUsuario) || idUsuario <= 0 ||
        !nombre || !correo || !usuario ||
        rolesIds.length === 0 ||
        rolesIds.some(id => !Number.isInteger(id) || id <= 0)
    ) {
        throw new Error("DATOS_INVALIDOS");
    }

    if (!(await repository.existeUsuario(conexion, idUsuario))) {
        throw new Error("USUARIO_NO_EXISTE");
    }

    const roles = await repository.obtenerRolesPorIds(conexion, rolesIds);

    if (roles.length !== rolesIds.length) {
        throw new Error("ROLES_INVALIDOS");
    }

    await conexion.beginTransaction();

    try {
        await repository.actualizarDatosUsuario(conexion, idUsuario, {
            nombre,
            correo,
            usuario
        });

        await repository.eliminarRolesUsuario(conexion, idUsuario);
        await repository.asignarRoles(conexion, idUsuario, roles);

        await conexion.commit();

        return {
            mensaje: "Usuario actualizado correctamente"
        };
    } catch (error) {
        await conexion.rollback();
        throw error;
    }
}

async function cambiarEstado(conexion, id, activo) {
    const idUsuario = Number(id);

    if (
        !Number.isInteger(idUsuario) || idUsuario <= 0 ||
        ![0, 1].includes(Number(activo))
    ) {
        throw new Error("DATOS_INVALIDOS");
    }

    if (!(await repository.existeUsuario(conexion, idUsuario))) {
        throw new Error("USUARIO_NO_EXISTE");
    }

    await repository.cambiarEstadoUsuario(
        conexion,
        idUsuario,
        Number(activo)
    );

    return {
        mensaje: Number(activo) === 1
            ? "Usuario activado correctamente"
            : "Usuario desactivado correctamente"
    };
}

module.exports = {
    listarRoles,
    listarUsuarios,
    registrarUsuario,
    actualizarUsuario,
    cambiarEstado
};
