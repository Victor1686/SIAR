
async function listarInsumos(conexion) {
    const [insumos] = await conexion.execute(`
        SELECT
            id_insumo,
            nombre,
            unidad_medida,
            stock,
            stock_minimo
        FROM insumo
        ORDER BY nombre
    `);

    return insumos;
}

async function obtenerInsumo(conexion, id) {
    const [insumos] = await conexion.execute(
        `SELECT * FROM insumo WHERE id_insumo = ?`,
        [id]
    );

    return insumos[0] || null;
}

async function crearInsumo(conexion, datos) {
    const [resultado] = await conexion.execute(
        `INSERT INTO insumo
         (nombre, unidad_medida, stock, stock_minimo)
         VALUES (?, ?, ?, ?)`,
        [
            datos.nombre,
            datos.unidad_medida,
            datos.stock,
            datos.stock_minimo
        ]
    );

    return resultado.insertId;
}

async function actualizarStock(conexion, id, stock) {
    await conexion.execute(
        `UPDATE insumo
         SET stock = ?
         WHERE id_insumo = ?`,
        [stock, id]
    );
}

async function registrarMovimiento(conexion, datos) {
    const [resultado] = await conexion.execute(
        `INSERT INTO movimiento_inventario
         (id_insumo, id_usuario, id_pedido, tipo, cantidad)
         VALUES (?, ?, ?, ?, ?)`,
        [
            datos.id_insumo,
            datos.id_usuario,
            datos.id_pedido ?? null,
            datos.tipo,
            datos.cantidad
        ]
    );

    return resultado.insertId;
}

async function listarMovimientos(conexion, idInsumo) {
    const [movimientos] = await conexion.execute(
        `SELECT
            m.id_movimiento,
            m.tipo,
            m.cantidad,
            m.fecha_hora,
            u.nombre AS usuario
         FROM movimiento_inventario m
         INNER JOIN usuario u ON m.id_usuario = u.id_usuario
         WHERE m.id_insumo = ?
         ORDER BY m.fecha_hora DESC`,
        [idInsumo]
    );

    return movimientos;
}

async function actualizarInsumo(conexion, id, datos) {
    const [resultado] = await conexion.execute(
        `UPDATE insumo
         SET nombre = ?, unidad_medida = ?, stock_minimo = ?
         WHERE id_insumo = ?`,
        [datos.nombre, datos.unidad_medida, datos.stock_minimo, id]
    );

    return resultado.affectedRows;
}
module.exports = {
    listarInsumos,
    obtenerInsumo,
    crearInsumo,
    actualizarInsumo,
    actualizarStock,
    registrarMovimiento,
    listarMovimientos
};
