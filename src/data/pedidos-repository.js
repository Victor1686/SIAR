
const ESTADOS_FINALIZADOS = ["Facturado", "Cancelado"];

// Consultar todos los pedidos
async function listarPedidos(conexion) {
    const [pedidos] = await conexion.execute(
        `SELECT
            p.id_pedido,
            p.id_mesa,
            m.numero AS numero_mesa,
            p.id_usuario,
            u.nombre AS nombre_usuario,
            p.fecha_hora,
            p.hora_envio_cocina,
            p.estado,
            p.total
         FROM pedido p
         INNER JOIN mesa m ON p.id_mesa = m.id_mesa
         INNER JOIN usuario u ON p.id_usuario = u.id_usuario
         ORDER BY p.fecha_hora DESC`
    );

    return pedidos;
}

// Consultar un pedido
async function obtenerPedido(conexion, idPedido) {
    const [pedidos] = await conexion.execute(
        `SELECT *
         FROM pedido
         WHERE id_pedido = ?`,
        [idPedido]
    );

    return pedidos[0] || null;
}

// Consultar los productos de un pedido
async function listarDetallesPedido(conexion, idPedido) {
    const [detalles] = await conexion.execute(
        `SELECT
            d.id_detalle,
            d.id_producto,
            p.nombre AS nombre_producto,
            d.cantidad,
            d.precio_unitario,
            d.observacion,
            (d.cantidad * d.precio_unitario) AS subtotal
         FROM detalle_pedido d
         INNER JOIN producto p ON d.id_producto = p.id_producto
         WHERE d.id_pedido = ?
         ORDER BY d.id_detalle`,
        [idPedido]
    );

    return detalles;
}

// Consultar un detalle específico
async function obtenerDetallePedido(conexion, idPedido, idDetalle) {
    const [detalles] = await conexion.execute(
        `SELECT
            id_detalle,
            id_pedido,
            id_producto,
            cantidad,
            precio_unitario,
            observacion
         FROM detalle_pedido
         WHERE id_pedido = ? AND id_detalle = ?`,
        [idPedido, idDetalle]
    );

    return detalles[0] || null;
}

// Consultar un producto disponible
async function obtenerProductoDisponible(conexion, idProducto) {
    const [productos] = await conexion.execute(
        `SELECT id_producto, nombre, precio
         FROM producto
         WHERE id_producto = ?
         AND disponible = 1
         AND activo = 1`,
        [idProducto]
    );

    return productos[0] || null;
}

// Listar productos disponibles
async function listarProductosDisponibles(conexion) {
    const [productos] = await conexion.execute(
        `SELECT id_producto, nombre, precio
         FROM producto
         WHERE disponible = 1
         AND activo = 1
         ORDER BY nombre`
    );

    return productos;
}

// Listar mesas
async function listarMesas(conexion) {
    const [mesas] = await conexion.execute(
        `SELECT id_mesa, numero, capacidad, ubicacion, estado
         FROM mesa
         ORDER BY numero`
    );

    return mesas;
}

// Crear pedido
async function crearPedido(conexion, datos) {
    const [resultado] = await conexion.execute(
        `INSERT INTO pedido (id_mesa, id_usuario, estado, total)
         VALUES (?, ?, 'Pendiente', 0)`,
        [datos.id_mesa, datos.id_usuario]
    );

    return resultado.insertId;
}

// Agregar producto a un pedido
async function agregarDetalle(conexion, datos) {
    const [resultado] = await conexion.execute(
        `INSERT INTO detalle_pedido
            (id_pedido, id_producto, cantidad, precio_unitario, observacion)
         VALUES (?, ?, ?, ?, ?)`,
        [
            datos.id_pedido,
            datos.id_producto,
            datos.cantidad,
            datos.precio_unitario,
            datos.observacion || null
        ]
    );

    return resultado.insertId;
}

// Actualizar producto de un pedido
async function actualizarDetallePedido(conexion, idPedido, idDetalle, datos) {
    await conexion.execute(
        `UPDATE detalle_pedido
         SET cantidad = ?, observacion = ?
         WHERE id_pedido = ? AND id_detalle = ?`,
        [datos.cantidad, datos.observacion || null, idPedido, idDetalle]
    );
}

// Eliminar producto de un pedido
async function eliminarDetallePedido(conexion, idPedido, idDetalle) {
    await conexion.execute(
        `DELETE FROM detalle_pedido
         WHERE id_pedido = ? AND id_detalle = ?`,
        [idPedido, idDetalle]
    );
}

// Actualizar total del pedido
async function actualizarTotalPedido(conexion, idPedido) {
    await conexion.execute(
        `UPDATE pedido
         SET total = (
             SELECT COALESCE(SUM(cantidad * precio_unitario), 0)
             FROM detalle_pedido
             WHERE id_pedido = ?
         )
         WHERE id_pedido = ?`,
        [idPedido, idPedido]
    );
}

// Actualizar estado del pedido
async function actualizarEstadoPedido(conexion, idPedido, estado) {
    await conexion.execute(
        `UPDATE pedido
         SET estado = ?
         WHERE id_pedido = ?`,
        [estado, idPedido]
    );
}

// Actualizar estado de una mesa
async function actualizarMesaEstado(conexion, idMesa, estado) {
    await conexion.execute(
        `UPDATE mesa
         SET estado = ?
         WHERE id_mesa = ?`,
        [estado, idMesa]
    );
}

// Registrar acción en auditoría
async function registrarAuditoria(conexion, datos) {
    await conexion.execute(
        `INSERT INTO auditoria
            (id_usuario, accion, entidad, id_entidad, detalle)
         VALUES (?, ?, ?, ?, ?)`,
        [
            datos.id_usuario,
            datos.accion,
            datos.entidad,
            datos.id_entidad,
            datos.detalle
        ]
    );
}

// Consultar historial de un pedido
async function listarAuditoriaPedido(conexion, idPedido) {
    const [historial] = await conexion.execute(
        `SELECT
            a.id_auditoria,
            a.id_usuario,
            u.nombre AS usuario,
            a.accion,
            a.fecha_hora,
            a.detalle
         FROM auditoria a
         LEFT JOIN usuario u ON a.id_usuario = u.id_usuario
         WHERE a.entidad = 'pedido'
         AND a.id_entidad = ?
         ORDER BY a.fecha_hora DESC`,
        [idPedido]
    );

    return historial;
}

// Comprobar si una mesa tiene otros pedidos activos
async function tienePedidosActivos(conexion, idMesa, idPedido) {
    const [pedidos] = await conexion.execute(
        `SELECT id_pedido
         FROM pedido
         WHERE id_mesa = ?
         AND id_pedido <> ?
         AND estado NOT IN ('Facturado', 'Cancelado')
         LIMIT 1`,
        [idMesa, idPedido]
    );

    return pedidos.length > 0;
}

module.exports = {
    listarPedidos,
    obtenerPedido,
    listarDetallesPedido,
    obtenerDetallePedido,
    obtenerProductoDisponible,
    listarProductosDisponibles,
    listarMesas,
    crearPedido,
    agregarDetalle,
    actualizarDetallePedido,
    eliminarDetallePedido,
    actualizarTotalPedido,
    actualizarEstadoPedido,
    actualizarMesaEstado,
    registrarAuditoria,
    listarAuditoriaPedido,
    tienePedidosActivos
};
