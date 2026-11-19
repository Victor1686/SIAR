async function existe(conexion, id) {
    const [filas] = await conexion.execute(
        "SELECT id_mesa FROM mesa WHERE id_mesa = ?",
        [id]
    );

    return filas.length > 0;
}

async function listar(conexion) {
    const [mesas] = await conexion.execute(
        `SELECT id_mesa, numero, capacidad, ubicacion, estado
         FROM mesa
         ORDER BY numero`
    );

    return mesas;
}

async function crear(conexion, mesa) {
    const [resultado] = await conexion.execute(
        `INSERT INTO mesa (numero, capacidad, ubicacion, estado)
         VALUES (?, ?, ?, ?)`,
        [mesa.numero, mesa.capacidad, mesa.ubicacion, mesa.estado]
    );

    return resultado.insertId;
}

async function actualizar(conexion, id, mesa) {
    if (!await existe(conexion, id)) return false;

    await conexion.execute(
        `UPDATE mesa
         SET numero = ?, capacidad = ?, ubicacion = ?
         WHERE id_mesa = ?`,
        [mesa.numero, mesa.capacidad, mesa.ubicacion, id]
    );

    return true;
}

async function cambiarEstado(conexion, id, estado) {
    if (!await existe(conexion, id)) return false;

    await conexion.execute(
        "UPDATE mesa SET estado = ? WHERE id_mesa = ?",
        [estado, id]
    );

    return true;
}

module.exports = {
    listar,
    crear,
    actualizar,
    cambiarEstado
};